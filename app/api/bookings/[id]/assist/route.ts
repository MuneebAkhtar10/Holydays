import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyBookingUpdate } from "@/lib/booking-notify";
import { appendMessage, asMessages, markChatRead, parseBookingExtras } from "@/lib/booking-view";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { listing: { include: { owner: true } }, user: true },
  });
  if (!booking || booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const body = await req.json();
  let extra = parseBookingExtras(booking.extras);
  if (body.read) {
    extra = markChatRead(extra, "guest");
    await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extra) } });
    return NextResponse.json({ ok: true, messages: asMessages(extra) });
  }
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Write a message." }, { status: 400 });
  extra = appendMessage(extra, "guest", message);
  await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extra) } });
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const text = `${session.user.name} messaged you about ${booking.listing.name} (${booking.startDate} — ${booking.endDate}): ${message}`;
  if (booking.listing.owner.email) {
    await notifyBookingUpdate(
      booking.listing.owner.email,
      "HolyDays guest message",
      text,
      `${origin}/owner#messages`,
    );
  }
  return NextResponse.json({ ok: true, messages: extra.assistance });
}
