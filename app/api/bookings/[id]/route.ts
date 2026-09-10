import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { datesOverlap } from "@/lib/format";
import { toBookingDTO } from "@/lib/booking-dto";
import { notifyBookingUpdate } from "@/lib/booking-notify";
import { parseBookingExtras } from "@/lib/booking-view";
import { publicOrigin } from "@/lib/auth-tokens";

type Ctx = { params: Promise<{ id: string }> };

async function loadMine(id: string, userId: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: { listing: true, user: true },
  }).then((row) => (row && row.userId === userId ? row : null));
}

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const booking = await loadMine(id, session.user.id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  let mine: { listingId: string; id: string; rating: number; body: string } | null = null;
  try {
    const rows = await prisma.$queryRaw<{ listingId: string; id: string; rating: number; body: string }[]>`
      SELECT listingId, id, rating, body FROM Review WHERE userId = ${session.user.id} AND listingId = ${booking.listingId} LIMIT 1
    `;
    mine = rows[0] ?? null;
  } catch {
    mine = null;
  }
  return NextResponse.json(toBookingDTO({ ...booking, myReview: mine }));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const booking = await loadMine(id, session.user.id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const body = await req.json();

  if (body.status === "cancelled") {
    if (booking.status === "cancelled") return NextResponse.json(toBookingDTO(booking));
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "cancelled" },
      include: { listing: true, user: true },
    });
    await notifyBookingUpdate(
      session.user.email || "",
      `HolyDays booking cancelled`,
      `Your booking at ${updated.listing.name} (${updated.startDate} — ${updated.endDate}) was cancelled.`,
      `${publicOrigin()}/trips`,
    );
    return NextResponse.json(toBookingDTO(updated));
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking is cancelled." }, { status: 400 });
  }

  const startDate = String(body.startDate ?? booking.startDate);
  const endDate = String(body.endDate ?? booking.endDate);
  const guests = body.guests !== undefined ? Number(body.guests) : booking.guests;
  if (!startDate || endDate < startDate) {
    return NextResponse.json({ error: "Choose valid dates." }, { status: 400 });
  }
  const others = await prisma.booking.findMany({
    where: { userId: session.user.id, listingId: booking.listingId, status: "confirmed", NOT: { id } },
  });
  const clash = others.find((b) => datesOverlap(startDate, endDate, b.startDate, b.endDate));
  if (clash) {
    return NextResponse.json({ error: "Those dates overlap another booking you already have." }, { status: 409 });
  }
  const extra = parseBookingExtras(booking.extras);
  extra.modifiedAt = new Date().toISOString();
  const updated = await prisma.booking.update({
    where: { id },
    data: { startDate, endDate, guests, extras: JSON.stringify(extra) },
    include: { listing: true, user: true },
  });
  await notifyBookingUpdate(
    session.user.email || "",
    `HolyDays booking updated`,
    `Your stay at ${updated.listing.name} is now ${updated.startDate} — ${updated.endDate} · ${updated.guests} guests.`,
    `${publicOrigin()}/bookings/${updated.id}`,
  );
  return NextResponse.json(toBookingDTO(updated));
}
