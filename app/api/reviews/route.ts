import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPastBooking } from "@/lib/format";
import { fetchListingByKey, upsertGuestReview } from "@/lib/listing-query";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in to leave a review." }, { status: 401 });
    if (session.user.role === "ADMIN" || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Reviews are for travellers who booked." }, { status: 403 });
    }

    const body = await req.json();
    const rating = Number(body.rating);
    const text = String(body.body ?? "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Choose a rating from 1 to 5 stars." }, { status: 400 });
    }
    if (text.length < 8) {
      return NextResponse.json({ error: "Write a short review (at least 8 characters)." }, { status: 400 });
    }

    const listing = await fetchListingByKey(String(body.listingId ?? ""));
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    if (listing.ownerId === session.user.id) {
      return NextResponse.json({ error: "You cannot review your own listing." }, { status: 403 });
    }

    const booked = await prisma.booking.findMany({
      where: { userId: session.user.id, listingId: listing.id, status: "confirmed" },
    });
    const past = booked.find((b) => isPastBooking(b.endDate, b.startDate));
    if (!past) {
      return NextResponse.json({ error: "You can review after a booking has ended." }, { status: 403 });
    }

    await upsertGuestReview(listing.id, session.user.id, rating, text);
    return NextResponse.json({ ok: true, rating, body: text });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not post review." }, { status: 500 });
  }
}
