import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isPastBooking } from "@/lib/format";
import { fetchAllBookings } from "@/lib/owner-bookings";
import { buildOwnerDetail } from "@/lib/owner-booking-detail";
import { asMessages, chatReadOf, parseBookingExtras, unreadCount } from "@/lib/booking-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SentEmail = { type: string; at: string; to: string };

/** Every booking on the marketplace, with its chat, money trail and partner — the admin booking desk. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") || "";
    const bucketWanted = url.searchParams.get("bucket") || "all";
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    const rows = await fetchAllBookings();
    const mapped = rows.map((b) => {
      const status = String(b.status);
      const past = isPastBooking(String(b.endDate), String(b.startDate));
      const extra = parseBookingExtras(String(b.extras ?? ""));
      const messages = asMessages(extra);
      const bucket =
        status === "cancelled" || status === "declined"
          ? "cancelled"
          : status === "cancel_requested"
            ? "cancel_requested"
            : status === "pending_payment" || status === "pending_driver"
              ? "pending"
              : past
                ? "past"
                : "upcoming";
      const last = messages[messages.length - 1];
      const emails = (Array.isArray(extra.emails) ? extra.emails : []) as SentEmail[];
      const detail = buildOwnerDetail(b);
      return {
        id: b.id,
        number: detail.number,
        startDate: String(b.startDate),
        endDate: String(b.endDate),
        guests: Number(b.guests),
        phone: b.phone || "",
        total: Number(b.total),
        status,
        bucket,
        payment: String(b.payment),
        createdAt: typeof b.createdAt === "string" ? b.createdAt : b.createdAt.toISOString(),
        cancelReason: String(extra.cancelReason ?? ""),
        cancelDecidedBy: String(extra.cancelDecidedBy ?? ""),
        packageId: String(extra.packageId ?? "") || b.id,
        isPackage: Boolean(extra.package),
        messages,
        unreadFromGuest: unreadCount(messages, chatReadOf(extra).owner, "guest"),
        lastPreview: last ? last.message : "",
        lastAt: last?.at ?? "",
        lastFrom: last?.from ?? null,
        emails: emails.map((e) => ({ type: String(e.type ?? ""), at: String(e.at ?? ""), to: String(e.to ?? "") })),
        listing: { id: b.listingId, name: b.listingName, slug: b.slug, kind: b.kind, city: b.city, cover: b.cover },
        guest: { id: b.userId, name: b.guestName, email: b.guestEmail },
        owner: { id: b.ownerId, name: b.ownerName, email: b.ownerEmail },
        detail,
      };
    });

    const filtered = mapped.filter((b) => {
      if (kind && b.listing.kind !== kind) return false;
      if (bucketWanted !== "all" && b.bucket !== bucketWanted) return false;
      if (q) {
        const hay = `${b.number} ${b.listing.name} ${b.listing.city} ${b.guest.name} ${b.guest.email} ${b.owner.name} ${b.owner.email} ${b.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return NextResponse.json({
      bookings: filtered,
      totals: {
        all: mapped.length,
        upcoming: mapped.filter((b) => b.bucket === "upcoming").length,
        pending: mapped.filter((b) => b.bucket === "pending").length,
        cancel_requested: mapped.filter((b) => b.bucket === "cancel_requested").length,
        past: mapped.filter((b) => b.bucket === "past").length,
        cancelled: mapped.filter((b) => b.bucket === "cancelled").length,
        unread: mapped.reduce((n, b) => n + (b.bucket === "cancelled" ? 0 : b.unreadFromGuest), 0),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/bookings", err);
    return NextResponse.json({ error: "Could not load bookings." }, { status: 500 });
  }
}
