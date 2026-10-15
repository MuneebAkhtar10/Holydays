import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/auth-tokens";
import { passQrDataUrl, passUrl } from "@/lib/booking-pass";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The guest's own pass: the link the QR holds, and the QR as a PNG to show or save. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { listing: { select: { ownerId: true } } },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const mine = booking.userId === session.user.id;
    const theirs = booking.listing.ownerId === session.user.id;
    if (!mine && !theirs && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const url = passUrl(publicOrigin(), booking.id);
    return NextResponse.json({ url, qr: await passQrDataUrl(url) });
  } catch (err) {
    console.error("GET /api/bookings/[id]/pass", err);
    return NextResponse.json({ error: "Could not build this pass." }, { status: 500 });
  }
}
