import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayIso } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** One account and every listing they own, any status. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, image: true, role: true, ownerKind: true, createdAt: true, emailVerified: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const listings = await prisma.listing.findMany({
      where: { ownerId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        kind: true,
        name: true,
        city: true,
        cover: true,
        description: true,
        price: true,
        priceUnit: true,
        status: true,
        rejectReason: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    });

    return NextResponse.json({
      user: { ...user, emailVerified: Boolean(user.emailVerified), createdAt: user.createdAt.toISOString() },
      listings: listings.map(({ _count, createdAt, ...l }) => ({
        ...l,
        status: l.status || "pending",
        createdAt: createdAt.toISOString(),
        bookings: _count.bookings,
        owner: { name: user.name, email: user.email },
        ownerId: user.id,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load this account." }, { status: 500 });
  }
}

const LIVE = ["confirmed", "pending_payment", "pending_driver", "cancel_requested"];

/**
 * Permanently delete a traveller or partner. Their listings, bookings, reviews and sign-in tokens go with them
 * (database cascade), so the same email can register again from scratch. Refused while any trip that still
 * lies ahead involves them, because deleting it would lose a guest's booking or a refund that is still owed.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const { id } = await params;
    if (id === session.user.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, email: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "ADMIN") return NextResponse.json({ error: "Admin accounts cannot be deleted here." }, { status: 400 });

    const today = todayIso();
    const live = await prisma.booking.count({
      where: {
        status: { in: LIVE },
        endDate: { gte: today },
        OR: [{ userId: id }, { listing: { ownerId: id } }],
      },
    });
    if (live > 0) {
      return NextResponse.json(
        {
          error: `This account still has ${live} upcoming booking${live === 1 ? "" : "s"}. Cancel or complete ${live === 1 ? "it" : "them"} (and refund anything paid) first, then delete the account.`,
        },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.media.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not delete this account." }, { status: 500 });
  }
}
