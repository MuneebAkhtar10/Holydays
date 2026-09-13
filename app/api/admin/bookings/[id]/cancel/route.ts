import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toBookingDTO } from "@/lib/booking-dto";
import { notifyBookingUpdate } from "@/lib/booking-notify";
import { parseBookingExtras } from "@/lib/booking-view";
import { publicOrigin } from "@/lib/auth-tokens";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { listing: true, user: true } });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.status !== "cancel_requested") {
      return NextResponse.json({ error: "This booking has no pending cancellation request." }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const approve = Boolean(body.approve);
    const extra = parseBookingExtras(booking.extras);
    extra.cancelDecision = approve ? "approved" : "denied";
    extra.cancelDecidedAt = new Date().toISOString();
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: approve ? "cancelled" : "confirmed", extras: JSON.stringify(extra) },
      include: { listing: true, user: true },
    });
    await notifyBookingUpdate(
      updated.user?.email || "",
      approve ? "HolyDays booking cancelled" : "HolyDays cancellation request denied",
      approve
        ? `Your booking at ${updated.listing.name} (${updated.startDate} — ${updated.endDate}) has been cancelled as requested.`
        : `Your request to cancel ${updated.listing.name} (${updated.startDate} — ${updated.endDate}) was not approved — the booking stays confirmed.`,
      `${publicOrigin()}/bookings/${updated.id}`,
    );
    return NextResponse.json(toBookingDTO(updated));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not update this cancellation request." }, { status: 500 });
  }
}
