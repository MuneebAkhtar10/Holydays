import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { datesOverlap } from "@/lib/format";
import { toBookingDTO } from "@/lib/booking-dto";
import { notifyBookingUpdate } from "@/lib/booking-notify";
import { parseBookingExtras } from "@/lib/booking-view";
import { publicOrigin } from "@/lib/auth-tokens";
import { parseListingMeta } from "@/lib/listing-meta";
import { roomsLeftFor } from "@/lib/availability";
import { loadBookableStay } from "@/lib/bookable-stay";

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
      SELECT listingId AS "listingId", id, rating, body FROM Review WHERE userId = ${session.user.id} AND listingId = ${booking.listingId} LIMIT 1
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

  if (body.status === "cancel_requested") {
    if (booking.status === "cancelled") {
      return NextResponse.json({ error: "This booking is already cancelled." }, { status: 400 });
    }
    if (booking.status === "cancel_requested") return NextResponse.json(toBookingDTO(booking));
    const reason = String(body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({ error: "Tell us why you're cancelling." }, { status: 400 });
    }
    const extra = parseBookingExtras(booking.extras);
    extra.cancelReason = reason;
    extra.cancelRequestedAt = new Date().toISOString();
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "cancel_requested", extras: JSON.stringify(extra) },
      include: { listing: true, user: true },
    });
    return NextResponse.json(toBookingDTO(updated));
  }

  if (booking.status === "cancelled" || booking.status === "cancel_requested") {
    return NextResponse.json({ error: "This booking is cancelled." }, { status: 400 });
  }

  const startDate = String(body.startDate ?? booking.startDate);
  const endDate = String(body.endDate ?? booking.endDate);
  const guests = body.guests !== undefined ? Number(body.guests) : booking.guests;
  if (!startDate || endDate < startDate) {
    return NextResponse.json({ error: "Choose valid dates." }, { status: 400 });
  }
  const listingMeta = parseListingMeta(booking.listing.meta);
  if (listingMeta.closedFrom && startDate >= listingMeta.closedFrom) {
    return NextResponse.json({ error: "This listing is no longer taking bookings from that date onward." }, { status: 403 });
  }
  if (startDate !== booking.startDate || endDate !== booking.endDate) {
    const stay = await loadBookableStay(booking.listing.slug);
    if (!stay) {
      return NextResponse.json({ error: "This listing is no longer available." }, { status: 409 });
    }
    const existingExtras = parseBookingExtras(booking.extras);
    const roomsHeld = Math.max(1, Number((existingExtras as Record<string, unknown>).rooms) || 1);
    const roomsLeft = await roomsLeftFor(booking.listingId, stay, startDate, endDate, booking.id);
    if (roomsLeft < roomsHeld) {
      return NextResponse.json(
        { error: `Only ${roomsLeft} room${roomsLeft === 1 ? "" : "s"} left at ${booking.listing.name} for those dates.` },
        { status: 409 },
      );
    }
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
