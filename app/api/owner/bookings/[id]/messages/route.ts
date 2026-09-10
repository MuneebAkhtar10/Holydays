import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyGuestHostMessage } from "@/lib/booking-notify";
import { appendMessage, asMessages, markChatRead, parseBookingExtras } from "@/lib/booking-view";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "OWNER" || !session.user.id) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { listing: true, user: true },
  });
  if (!booking || booking.listing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const body = await req.json();
  let extra = parseBookingExtras(booking.extras);
  if (body.read) {
    extra = markChatRead(extra, "owner");
    await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extra) } });
    return NextResponse.json({ ok: true, messages: asMessages(extra) });
  }
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Write a message." }, { status: 400 });
  extra = appendMessage(extra, "owner", message);
  await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extra) } });
  await notifyGuestHostMessage({
    guestEmail: booking.user.email,
    guestName: booking.user.name || "Guest",
    listing: booking.listing.name,
    hostName: session.user.name || "Your host",
    message,
    bookingId: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
  });
  return NextResponse.json({ ok: true, messages: extra.assistance });
}
