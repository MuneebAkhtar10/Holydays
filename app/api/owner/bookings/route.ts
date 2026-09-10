import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isPastBooking } from "@/lib/format";
import { fetchOwnerBookings } from "@/lib/owner-bookings";
import { asMessages, chatReadOf, parseBookingExtras, unreadCount } from "@/lib/booking-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "OWNER" || !session.user.id) {
      return NextResponse.json({ error: "Owner only" }, { status: 403 });
    }

    const rows = await fetchOwnerBookings(session.user.id);
    return NextResponse.json(
      rows.map((b) => {
        const past = isPastBooking(String(b.endDate), String(b.startDate));
        const status = String(b.status);
        const bucket = status === "cancelled" ? "cancelled" : past ? "past" : "upcoming";
        const extra = parseBookingExtras(String(b.extras ?? ""));
        const messages = asMessages(extra);
        const unread = status === "cancelled" ? 0 : unreadCount(messages, chatReadOf(extra).owner, "guest");
        const last = messages[messages.length - 1];
        return {
          id: b.id,
          startDate: b.startDate,
          endDate: b.endDate,
          guests: Number(b.guests),
          phone: b.phone || "",
          total: Number(b.total),
          status,
          payment: b.payment,
          createdAt: b.createdAt,
          bucket,
          messages,
          unreadCount: unread,
          lastPreview: last ? last.message : "",
          lastAt: last?.at ?? "",
          lastFrom: last?.from ?? null,
          listing: {
            id: b.listingId,
            name: b.listingName,
            slug: b.slug,
            kind: b.kind,
            city: b.city,
            cover: b.cover,
          },
          guest: { name: b.guestName, email: b.guestEmail },
          review:
            b.reviewRating != null
              ? { rating: Number(b.reviewRating), body: b.reviewBody || "" }
              : null,
        };
      }),
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load bookings." }, { status: 500 });
  }
}
