import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toBookingDTO } from "@/lib/booking-dto";
import { readPassToken } from "@/lib/booking-pass";
import { bookingIsPaid } from "@/lib/booking-invoice";
import { formatDay, formatTime, nightsBetween } from "@/lib/format";
import { kindLabel, type ListingKind } from "@/lib/marketplace";
import { parseListingMeta } from "@/lib/listing-meta";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const longDay = (iso: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—";

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">{label}</p>
      <p className="mt-0.5 text-sand">{value}</p>
    </div>
  );
}

export default async function PassPage({ params }: Props) {
  const { token } = await params;
  const bookingId = readPassToken(decodeURIComponent(token));

  if (!bookingId) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-5">
        <h1 className="font-display text-3xl">This pass is not valid</h1>
        <p className="mt-3 text-mist">
          This code could not be verified. Ask the guest to reopen their booking on HolyDays and present the pass again.
        </p>
      </div>
    );
  }

  const row = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { include: { owner: true } }, user: true },
  });

  if (!row) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-5">
        <h1 className="font-display text-3xl">Booking not found</h1>
        <p className="mt-3 text-mist">This pass points at a booking that no longer exists.</p>
      </div>
    );
  }

  const b = toBookingDTO(row);
  const session = await getServerSession(authOptions);
  // The partner whose listing this is, or an admin, may see the guest's contact details and requests.
  const isStaff = session?.user?.role === "ADMIN" || (session?.user?.id != null && session.user.id === row.listing.ownerId);
  const meta = parseListingMeta(row.listing.meta);
  const extra = b.extra;
  const stay = b.listing.kind === "STAY";
  const nights = nightsBetween(b.startDate, b.endDate);
  const paid = bookingIsPaid(b);
  const cancelled = b.status === "cancelled" || b.status === "declined";
  const pending = b.status === "pending_payment" || b.status === "pending_driver";
  const visit = extra.visit as { days?: number } | undefined;

  const banner = cancelled
    ? { label: "Cancelled — do not admit", cls: "border-rose/50 bg-rose/15 text-rose" }
    : pending
      ? { label: b.status === "pending_payment" ? "Payment outstanding" : "Awaiting driver confirmation", cls: "border-amber-500/50 bg-amber-500/15 text-amber-500" }
      : { label: "Valid booking", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-500" };

  // The guest's full name is for staff; everyone else sees it shortened.
  const parts = (b.guestName || "Guest").trim().split(/\s+/);
  const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <BrandLogo size="sm" />
        <p className="text-[11px] uppercase tracking-[0.2em] text-brass">Booking pass</p>
      </div>

      <div className={`mt-5 rounded-2xl border-2 px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.1em] ${banner.cls}`}>
        {banner.label}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-brass/25 bg-ink-2">
        <div className="relative h-32">
          <Image src={b.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill sizes="(min-width: 640px) 36rem, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-brass">{kindLabel[b.listing.kind as ListingKind] ?? b.listing.kind}</p>
            <h1 className="font-display text-2xl leading-tight text-bone">{b.listing.name}</h1>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink/30 px-3.5 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">Booking</span>
            <span className="font-display text-xl tracking-wide text-sand">{b.number}</span>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact label="Guest" value={isStaff ? b.guestName : shortName} />
            <Fact label="Party" value={`${b.guests} guest${b.guests === 1 ? "" : "s"}`} />
            <Fact
              label={stay ? "Check-in" : "Date"}
              value={`${longDay(b.startDate)}${stay && meta.checkIn ? ` · from ${meta.checkIn}` : ""}${extra.reservation && extra.time ? ` · ${formatTime(String(extra.time))}` : ""}`}
            />
            <Fact
              label={stay ? "Check-out" : "Ends"}
              value={b.endDate === b.startDate ? "Same day" : `${longDay(b.endDate)}${stay && meta.checkOut ? ` · by ${meta.checkOut}` : ""}`}
            />
            <Fact
              label="Length"
              value={stay ? `${nights} night${nights === 1 ? "" : "s"}` : visit?.days ? `${visit.days} day${visit.days === 1 ? "" : "s"}` : undefined}
            />
            <Fact label="Room" value={stay ? String(extra.roomLabel ?? "") || undefined : undefined} />
            <Fact label="City" value={b.listing.city} />
            <Fact label="Payment" value={paid ? "Paid online" : "Due on arrival"} />
          </dl>

          {isStaff ? (
            <div className="rounded-xl border border-brass/25 bg-brass/[0.07] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">Staff view</p>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <Fact label="Email" value={b.guestEmail} />
                <Fact label="Phone" value={b.phone} />
              </dl>
              {String(extra.specialRequests ?? extra.requests ?? "").trim() ? (
                <p className="mt-2 text-sm italic text-sand/90">“{String(extra.specialRequests ?? extra.requests)}”</p>
              ) : null}
              <Link href="/owner?tab=bookings" className="btn-ghost mt-3 inline-flex px-3 py-1.5 text-xs">
                Open in partner desk
              </Link>
            </div>
          ) : (
            <p className="rounded-xl bg-ink/30 px-3.5 py-2.5 text-xs text-mist">
              Staff: sign in with the partner account for this listing to view the guest&apos;s contact details and requests.
            </p>
          )}

          <p className="text-xs text-mist">
            Booked {formatDay(b.createdAt.slice(0, 10))}. Verified against HolyDays records at the time of scanning, so a cancelled
            reservation can never present as valid.
          </p>
        </div>
      </div>
    </div>
  );
}
