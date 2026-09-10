import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { datesOverlap } from "@/lib/format";
import { fetchListingByKey, fetchPublicListings, isPublishedLive } from "@/lib/listing-query";
import { loadBookableStay } from "@/lib/bookable-stay";
import { quoteStay, type QuoteInput } from "@/lib/pricing";
import { toBookingDTO } from "@/lib/booking-dto";
import { notifyBookingCreated } from "@/lib/booking-notify";
import { parseBookingExtras } from "@/lib/booking-view";
import { listingToTaxi, listingToZiyarat, parseMealRates, sanitizePackage, type PackageStaySlice } from "@/lib/package-plan";
import { pilgrimCountryForPlace } from "@/lib/pilgrim";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: { listing: true },
    orderBy: { createdAt: "desc" },
  });
  let mine: { listingId: string; id: string; rating: number; body: string }[] = [];
  try {
    mine = await prisma.$queryRaw`
      SELECT listingId AS "listingId", id, rating, body FROM Review WHERE userId = ${session.user.id}
    `;
  } catch {
    mine = [];
  }
  return NextResponse.json(
    bookings.map((b) =>
      toBookingDTO({
        ...b,
        myReview: mine.find((r) => r.listingId === b.listingId) ?? null,
      }),
    ),
  );
}

export async function POST(req: Request) {
  try {
    return await createBooking(req);
  } catch (err) {
    console.error("POST /api/bookings", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not place reservation" },
      { status: 500 },
    );
  }
}

async function createBooking(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to place a reservation." }, { status: 401 });
  }
  const body = await req.json();
  const listing = await fetchListingByKey(String(body.listingId ?? ""));
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (!isPublishedLive(listing)) {
    return NextResponse.json({ error: "This listing is not live yet." }, { status: 403 });
  }

  const startDate = String(body.startDate ?? "");
  let endDate = String(body.endDate ?? body.startDate ?? "");
  if (!startDate) return NextResponse.json({ error: "Choose dates" }, { status: 400 });
  if (listing.kind === "TAXI" || listing.kind === "ATTRACTION") {
    endDate = startDate;
  }
  if (endDate && endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after the start date." }, { status: 400 });
  }

  const existing = await prisma.booking.findMany({
    where: { userId: session.user.id, listingId: listing.id, status: "confirmed" },
  });
  const clash = existing.find((b) => datesOverlap(startDate, endDate, b.startDate, b.endDate));
  if (clash) {
    return NextResponse.json(
      { error: `Those dates overlap a booking you already have (${clash.startDate} – ${clash.endDate}). Pick other dates or cancel that one.` },
      { status: 409 },
    );
  }

  let total = Number(body.total) || Number(listing.price);
  let extras = String(body.extras ?? "");
  let extraSlices: PackageStaySlice[] = [];
  let stayQuoteInput: QuoteInput | null = null;
  if (listing.kind === "STAY") {
    const stay = await loadBookableStay(listing.slug);
    if (stay) {
      const input: QuoteInput = {
        checkin: startDate,
        checkout: endDate,
        rooms: Number(body.rooms) || 1,
        adults: Number(body.adults) || Number(body.guests) || 1,
        children: Number(body.children) || 0,
        childAges: Array.isArray(body.childAges) ? body.childAges.map(Number) : [],
        roomId: String(body.roomId ?? ""),
        ratePlanId: String(body.ratePlanId ?? ""),
        extraBeds: Number(body.extraBeds) || 0,
        cribs: Number(body.cribs) || 0,
        extras: Array.isArray(body.extraIds) ? body.extraIds.map(String) : String(body.extras ?? "").split(",").filter(Boolean),
        airportTransfer: Boolean(body.airportTransfer),
        promo: String(body.promo ?? ""),
        member: Boolean(body.member),
      };
      const quote = quoteStay(stay, input);
      stayQuoteInput = input;
      const packageStay = Boolean(pilgrimCountryForPlace(stay.city, stay.region));
      let pack = null;
      if (packageStay) {
        const [zRows, tRows] = await Promise.all([fetchPublicListings("ATTRACTION"), fetchPublicListings("TAXI")]);
        const ziyarat = zRows.map(listingToZiyarat);
        const taxiList = tRows.map(listingToTaxi);
        const saved = sanitizePackage(
          body.package,
          input.adults + input.children,
          quote.nights,
          ziyarat,
          taxiList,
          parseMealRates(stay.mealRates),
          startDate,
          endDate,
        );
        pack = {
          ...saved,
          ziyarat: ziyarat.filter((z) => saved.ziyaratIds.includes(z.id)),
          taxiList: taxiList.filter((t) => saved.taxis.some((p) => p.id === t.id)),
        };
        const extraStaySum = saved.stays.reduce((s, row) => s + (Number(row.amount) || 0), 0);
        total = quote.grand + saved.total - extraStaySum;
        extraSlices = saved.stays;
      } else {
        total = quote.grand;
      }
      extras = JSON.stringify({
        roomId: quote.room.id,
        ratePlanId: quote.rate.id,
        rooms: quote.rooms,
        specialRequests: String(body.specialRequests ?? ""),
        terms: true,
        quote: { start: quote.start, total: quote.total, taxes: quote.taxes, grand: quote.grand, rules: quote.rulesApplied },
        extraBeds: input.extraBeds,
        cribs: input.cribs,
        promo: input.promo,
        airportTransfer: input.airportTransfer,
        extras: input.extras,
        package: pack,
      });
    }
  }

  const booking = await prisma.booking.create({
    data: {
      userId: session.user.id,
      listingId: listing.id,
      startDate,
      endDate,
      guests: Number(body.guests) || Number(body.adults) || 1,
      extras,
      payment: String(body.payment ?? "property"),
      phone: String(body.phone ?? ""),
      total,
    },
    include: { listing: { include: { owner: true } }, user: true },
  });

  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const guestEmail = booking.user?.email || session.user.email || "";
  const notice = await notifyBookingCreated({
    email: guestEmail,
    phone: booking.phone,
    name: booking.user?.name || session.user.name || "Guest",
    listing: booking.listing.name,
    id: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
    total: booking.total,
    origin,
    ownerEmail: booking.listing.owner?.email,
  });
  const extraObj = parseBookingExtras(booking.extras);
  extraObj.packageId = booking.id;
  extraObj.notify = notice.channels;
  extraObj.waLink = notice.waLink;
  extraObj.number = notice.number;
  if (extraObj.package && typeof extraObj.package === "object") {
    extraObj.package = { ...(extraObj.package as Record<string, unknown>), packageId: booking.id };
  }

  for (const slice of extraSlices) {
    const extraListing = await fetchListingByKey(slice.listingId);
    const extraStay = extraListing ? await loadBookableStay(extraListing.slug) : null;
    if (!extraListing || extraListing.kind !== "STAY" || !isPublishedLive(extraListing) || !extraStay || !stayQuoteInput) continue;
    const extraQuote = quoteStay(extraStay, {
      ...stayQuoteInput,
      checkin: slice.checkin,
      checkout: slice.checkout,
      roomId: slice.roomId,
      ratePlanId: slice.ratePlanId,
      airportTransfer: false,
    });
    await prisma.booking.create({
      data: {
        userId: session.user.id,
        listingId: extraListing.id,
        startDate: slice.checkin,
        endDate: slice.checkout,
        guests: Number(body.guests) || Number(body.adults) || 1,
        extras: JSON.stringify({
          packageId: booking.id,
          roomId: extraQuote.room.id,
          ratePlanId: extraQuote.rate.id,
          rooms: extraQuote.rooms,
          specialRequests: String(body.specialRequests ?? ""),
          terms: true,
          quote: { start: extraQuote.start, total: extraQuote.total, taxes: extraQuote.taxes, grand: extraQuote.grand, rules: extraQuote.rulesApplied },
          package: extraObj.package,
        }),
        payment: String(body.payment ?? "property"),
        phone: String(body.phone ?? ""),
        total: extraQuote.grand,
      },
    });
  }
  const saved = await prisma.booking.update({
    where: { id: booking.id },
    data: { extras: JSON.stringify(extraObj) },
    include: { listing: true },
  });

  return NextResponse.json({
    ...toBookingDTO(saved),
    notify: notice.channels,
    waLink: notice.waLink,
  });
}
