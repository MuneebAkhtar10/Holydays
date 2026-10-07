import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** All accounts, with listing counts per status. ?role=OWNER|TRAVELER|ADMIN|all  ?q=search  ?kind=STAY|ATTRACTION|TAXI|RESTAURANT */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const url = new URL(req.url);
    const role = url.searchParams.get("role") || "OWNER";
    const q = (url.searchParams.get("q") || "").trim();
    const kind = url.searchParams.get("kind") || "";

    const where = {
      ...(role !== "all" ? { role } : {}),
      ...(kind ? { ownerKind: kind } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const [users, listingCounts, bookingCounts, roleCounts, pendingListings, cancellations] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { id: true, name: true, email: true, phone: true, image: true, role: true, ownerKind: true, createdAt: true, emailVerified: true },
      }),
      prisma.listing.groupBy({ by: ["ownerId", "status"], _count: { _all: true } }),
      prisma.booking.groupBy({ by: ["userId"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.listing.count({ where: { status: "pending" } }),
      prisma.booking.count({ where: { status: "cancel_requested" } }),
    ]);

    const listingsByOwner = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    for (const row of listingCounts) {
      const cur = listingsByOwner.get(row.ownerId) ?? { total: 0, approved: 0, pending: 0, rejected: 0 };
      const n = row._count._all;
      cur.total += n;
      if (row.status === "approved") cur.approved += n;
      else if (row.status === "rejected") cur.rejected += n;
      else cur.pending += n;
      listingsByOwner.set(row.ownerId, cur);
    }
    const bookingsByUser = new Map(bookingCounts.map((r) => [r.userId, r._count._all]));
    const byRole = Object.fromEntries(roleCounts.map((r) => [r.role, r._count._all]));

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        emailVerified: Boolean(u.emailVerified),
        createdAt: u.createdAt.toISOString(),
        listings: listingsByOwner.get(u.id) ?? { total: 0, approved: 0, pending: 0, rejected: 0 },
        bookings: bookingsByUser.get(u.id) ?? 0,
      })),
      totals: {
        owners: byRole.OWNER ?? 0,
        travellers: byRole.TRAVELER ?? 0,
        admins: byRole.ADMIN ?? 0,
        pendingListings,
        cancellations,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  }
}
