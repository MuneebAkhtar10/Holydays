import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyGuestHostMessage, notifyOwnerGuestMessage } from "@/lib/booking-notify";
import { appendMessage, asMessages, markChatRead, parseBookingExtras } from "@/lib/booking-view";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin replies inside the guest's existing thread. The message is stored as the host side so the guest
 * sees one conversation, and both the guest and the partner are emailed so nobody is left out of the loop.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const { id } = await params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { listing: true, user: true } });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    let extra = parseBookingExtras(booking.extras);

    if (body.read) {
      extra = markChatRead(extra, "owner");
      await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extra) } });
      return NextResponse.json({ ok: true, messages: asMessages(extra) });
    }

    const message = String(body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "Write a message." }, { status: 400 });

    extra = appendMessage(extra, "owner", message);
    const written = asMessages(extra);
    const lastIndex = written.length - 1;
    if (lastIndex >= 0) {
      // Keep the author on the record so both desks can label it "HolyDays support".
      (extra.assistance as Record<string, unknown>[])[lastIndex].by = "admin";
    }
    await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extra) } });

    await notifyGuestHostMessage({
      guestEmail: booking.user.email,
      guestName: booking.user.name || "Guest",
      listing: booking.listing.name,
      hostName: "HolyDays support",
      message,
      bookingId: booking.id,
      startDate: booking.startDate,
      endDate: booking.endDate,
    });
    await notifyOwnerGuestMessage(booking.id, `HolyDays support replied to ${booking.user.name || "the guest"}: ${message}`);

    return NextResponse.json({ ok: true, messages: asMessages(extra) });
  } catch (err) {
    console.error("POST /api/admin/bookings/[id]/messages", err);
    return NextResponse.json({ error: "Could not send this message." }, { status: 500 });
  }
}
