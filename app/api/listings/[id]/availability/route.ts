import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { datesOverlap } from "@/lib/format";
import { fetchListingByKey } from "@/lib/listing-query";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const checkin = url.searchParams.get("checkin") || "";
    const checkout = url.searchParams.get("checkout") || checkin;
    if (!id || !checkin) return NextResponse.json({ error: "Missing dates" }, { status: 400 });

    const listing = await fetchListingByKey(id);
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const bookings = await prisma.booking.findMany({
      where: { listingId: listing.id, status: "confirmed" },
      select: { startDate: true, endDate: true },
    });
    const overlapping = bookings.filter((b) => datesOverlap(checkin, checkout, b.startDate, b.endDate)).length;

    return NextResponse.json({ overlapping });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not check availability" }, { status: 500 });
  }
}
