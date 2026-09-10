import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingIcs, bookingNumber, listingContact, bookingPublicUrl } from "@/lib/booking-view";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { listing: true } });
  if (!booking || booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const contact = listingContact(booking.listing.meta);
  const ics = bookingIcs({
    id: booking.id,
    number: bookingNumber(booking.id),
    name: booking.listing.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    address: contact.address || `${booking.listing.city}, Pakistan`,
    url: bookingPublicUrl(origin, booking.id),
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${bookingNumber(booking.id)}.ics"`,
    },
  });
}
