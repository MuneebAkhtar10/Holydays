import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toBookingDTO } from "@/lib/booking-dto";
import { notifyBookingUpdate } from "@/lib/booking-notify";
import { publicOrigin } from "@/lib/auth-tokens";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "OWNER" || !session.user.id) {
      return NextResponse.json({ error: "Owner only" }, { status: 403 });
    }
    const { id } = await params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { listing: true, user: true } });
    if (!booking || booking.listing.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status !== "pending_driver") {
      return NextResponse.json({ error: "This request has already been answered." }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const accept = Boolean(body.accept);
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: accept ? "confirmed" : "declined" },
      include: { listing: true, user: true },
    });
    await notifyBookingUpdate(
      updated.user?.email || "",
      accept ? "HolyDays trip confirmed" : "HolyDays trip request declined",
      accept
        ? `${updated.listing.name} accepted your custom trip request for ${updated.startDate}. Contact them to finalize the rate.`
        : `${updated.listing.name} could not take your custom trip request for ${updated.startDate}. Try another driver or a different time.`,
      `${publicOrigin()}/bookings/${updated.id}`,
    );
    return NextResponse.json(toBookingDTO(updated));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not respond to this request." }, { status: 500 });
  }
}
