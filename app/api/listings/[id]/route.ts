import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withReviewStats } from "@/lib/moderation";
import { isPastBooking } from "@/lib/format";
import { fetchListingByKey, fetchListingReviews, isPublishedLive, userHasReview } from "@/lib/listing-query";
import { encodeStayMeta, parseListingMeta } from "@/lib/listing-meta";
import { todayIso } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const listing = await fetchListingByKey(id);
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await getServerSession(authOptions);
    const isOwner = session?.user?.id === listing.ownerId;
    const isAdmin = session?.user?.role === "ADMIN";
    if (!isPublishedLive(listing) && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "This listing is awaiting admin approval." }, { status: 404 });
    }

    const reviews = await fetchListingReviews(listing.id);
    const metaParsed = parseListingMeta(listing.meta);
    const myBookings = session?.user?.id
      ? await prisma.booking.findMany({
          where: { userId: session.user.id, listingId: listing.id, status: "confirmed" },
          orderBy: { startDate: "asc" },
        })
      : [];

    const stats = withReviewStats({ reviews });
    const imported = metaParsed.guestReviews.map((r, i) => ({
      id: `booking-${listing.slug}-${i}`,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt,
      name: r.name,
    }));
    const live = reviews.map((r) => ({
      id: r.id,
      rating: Number(r.rating),
      body: String(r.body ?? ""),
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
      name: String(r.name ?? "Guest"),
    }));
    const reviewsOut = [...live, ...imported];
    const reviewCount = stats.reviewCount || metaParsed.externalRating.count || reviewsOut.length;
    const reviewAvg = stats.reviewAvg || metaParsed.externalRating.score || 0;
    const guest = session?.user?.role === "TRAVELER";
    const alreadyReviewed = session?.user?.id ? await userHasReview(listing.id, session.user.id) : false;
    const finishedStay = myBookings.some((b) => isPastBooking(b.endDate, b.startDate));
    const canReview = Boolean(guest && session?.user?.id !== listing.ownerId && finishedStay && !alreadyReviewed);
    return NextResponse.json({
      id: listing.id,
      slug: listing.slug,
      kind: listing.kind,
      ownerId: listing.ownerId,
      name: listing.name,
      nastaliq: listing.nastaliq,
      city: listing.city,
      region: listing.region,
      cover: listing.cover,
      description: listing.description,
      price: Number(listing.price),
      priceUnit: listing.priceUnit,
      status: listing.status,
      rejectReason: listing.rejectReason ?? "",
      published: Boolean(listing.published),
      reviewCount,
      reviewAvg,
      reviews: reviewsOut,
      myBookings,
      canReview,
      meta: metaParsed,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load listing" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    const listing = await fetchListingByKey(id);
    if (!listing || listing.ownerId !== session.user.id) {
      return NextResponse.json({ error: "You can only edit your own listing" }, { status: 403 });
    }
    const body = await req.json();
    const meta = encodeStayMeta(body, parseListingMeta(listing.meta));
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        name: body.name ?? listing.name,
        nastaliq: body.nastaliq ?? listing.nastaliq,
        city: body.city ?? listing.city,
        region: body.region ?? listing.region,
        cover: body.cover ?? listing.cover,
        description: body.description ?? listing.description,
        price: body.price !== undefined ? Number(body.price) : Number(listing.price),
        priceUnit: body.priceUnit ?? listing.priceUnit,
        published: false,
        meta,
      },
    });
    try {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { status: "pending", rejectReason: "" },
      });
    } catch {
      await prisma.$executeRaw`
        UPDATE Listing
        SET status = 'pending', rejectReason = '', published = false, meta = ${meta}, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${listing.id}
      `;
    }
    return NextResponse.json({ id: updated.id, slug: updated.slug, status: "pending" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not save listing" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    const listing = await fetchListingByKey(id);
    if (!listing || listing.ownerId !== session.user.id) {
      return NextResponse.json({ error: "You can only remove your own listing" }, { status: 403 });
    }
    const today = todayIso();
    const future = await prisma.booking.findMany({
      where: { listingId: listing.id, status: "confirmed", endDate: { gte: today } },
      select: { endDate: true },
    });
    if (future.length) {
      const blockedUntil = future.reduce((max, b) => (b.endDate > max ? b.endDate : max), future[0].endDate);
      return NextResponse.json(
        { error: "This listing has a confirmed booking and cannot be deleted.", blockedUntil },
        { status: 409 },
      );
    }
    await prisma.listing.delete({ where: { id: listing.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not remove listing" }, { status: 500 });
  }
}
