import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
