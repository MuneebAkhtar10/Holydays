import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayIso } from "@/lib/format";
import { fetchListingByKey } from "@/lib/listing-query";
import { parseListingMeta } from "@/lib/listing-meta";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function furthestConfirmedBookingEnd(listingId: string): Promise<string | null> {
  const today = todayIso();
  const bookings = await prisma.booking.findMany({
    where: { listingId, status: "confirmed", endDate: { gte: today } },
    select: { endDate: true },
  });
  if (!bookings.length) return null;
  return bookings.reduce((max, b) => (b.endDate > max ? b.endDate : max), bookings[0].endDate);
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    const listing = await fetchListingByKey(id);
    if (!listing || listing.ownerId !== session.user.id) {
      return NextResponse.json({ error: "You can only manage your own listing" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode ?? "");

    if (mode === "reactivate") {
      const meta = { ...parseListingMeta(listing.meta), closedFrom: "" };
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          meta: JSON.stringify(meta),
          status: listing.status === "closed" ? "approved" : listing.status,
        },
      });
      return NextResponse.json({ ok: true, status: listing.status === "closed" ? "approved" : listing.status, closedFrom: "" });
    }

    const blockedUntil = await furthestConfirmedBookingEnd(listing.id);

    if (mode === "now") {
      if (blockedUntil) {
        return NextResponse.json(
          { error: "This listing has a confirmed booking and cannot be deactivated yet.", blockedUntil },
          { status: 409 },
        );
      }
      await prisma.listing.update({ where: { id: listing.id }, data: { status: "closed", published: false } });
      return NextResponse.json({ ok: true, status: "closed" });
    }

    if (mode === "schedule") {
      const closedFrom = String(body?.closedFrom ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(closedFrom)) {
        return NextResponse.json({ error: "Choose a valid date" }, { status: 400 });
      }
      const today = todayIso();
      if (blockedUntil) {
        if (closedFrom <= blockedUntil) {
          return NextResponse.json(
            { error: `Choose a date after ${blockedUntil} — that's when your last confirmed booking ends.`, blockedUntil },
            { status: 400 },
          );
        }
      } else if (closedFrom < today) {
        return NextResponse.json({ error: "Choose today or a future date" }, { status: 400 });
      }
      const meta = { ...parseListingMeta(listing.meta), closedFrom };
      await prisma.listing.update({ where: { id: listing.id }, data: { meta: JSON.stringify(meta) } });
      return NextResponse.json({ ok: true, closedFrom });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not update listing" }, { status: 500 });
  }
}
