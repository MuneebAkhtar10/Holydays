"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDaysIso, datesOverlap, formatDay, formatTime, inclusiveDays, isPastBooking, localTodayIso, MAX_VISIT_DAYS, minCheckoutIso } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { defaultDates } from "@/lib/format";
import { kindLabel, unitLabel, type ListingKind } from "@/lib/marketplace";
import { listingToTaxi, tripTitle } from "@/lib/package-plan";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { ListingReviews, type ReviewItem } from "@/components/ListingReviews";
import { StarIcon } from "@/components/StarIcon";
import { readJson } from "@/lib/readJson";
import { guideAmount, guideFeeOf, guideUnitOf, independentTripTotal } from "@/lib/trip-total";
import { parseBookingExtras } from "@/lib/booking-view";
import { CancelBookingModal } from "@/components/CancelBookingModal";
import { TaxiPhotos, taxiCarPhotos } from "@/components/TaxiPhotos";
import { ZoomableImage } from "@/components/ZoomableImage";

type Booking = {
  id: string;
  startDate: string;
  endDate: string;
  total: number;
  guests: number;
  status: string;
  extras?: string;
};

type Listing = {
  id: string;
  slug: string;
  kind: string;
  ownerId?: string;
  name: string;
  nastaliq: string;
  city: string;
  region: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  status?: string;
  rejectReason?: string;
  myBookings?: Booking[];
  reviews?: ReviewItem[];
  reviewAvg?: number;
  reviewCount?: number;
  canReview?: boolean;
  meta?: unknown;
};

function TaxiItinerary({ listing }: { listing: Listing }) {
  const { money } = useSerai();
  const taxi = listingToTaxi({
    slug: listing.slug,
    name: listing.name,
    nastaliq: listing.nastaliq,
    city: listing.city,
    region: listing.region,
    cover: listing.cover,
    description: listing.description,
    price: listing.price,
    meta: listing.meta,
  });
  return (
    <div className="mt-10 max-w-xl">
      <h2 className="font-display text-2xl">{tripTitle(taxi)}</h2>
      <p className="mt-1 text-sm text-mist">
        {taxi.vehicle}
        {taxi.model ? ` · ${taxi.model}` : ""} · {taxi.hours} · {taxi.vacant} of {taxi.seats} seats open
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brass/20 bg-ink-2 px-3 py-3">
        <TaxiPhotos
          driver={taxi.driver}
          driverPhoto={taxi.driverPhoto}
          vehicle={taxi.vehicle}
          vehiclePhoto={taxi.vehiclePhoto}
          vehiclePhotos={taxi.vehiclePhotos}
          cover={taxi.cover}
          size="lg"
          showVehicle={false}
        />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-brass">Driver</p>
          <p className="truncate text-sm font-medium text-sand">{taxi.driver}</p>
          <p className="truncate text-xs text-mist">
            {taxi.vehicle}
            {taxi.model ? ` · ${taxi.model}` : ""}
          </p>
        </div>
      </div>
      <ol className="mt-5 space-y-2 border-l border-brass/30 pl-4">
        {taxi.itinerary.map((stop, i) => (
          <li key={`${stop.place}-${i}`}>
            <p className="text-sand">
              {stop.time ? <span className="font-mono text-brass">{stop.time} · </span> : null}
              {stop.place}
            </p>
            {stop.note ? <p className="text-sm text-mist">{stop.note}</p> : null}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm text-mist">
        Shared {money(taxi.ratePerPerson)} / person · Private vehicle {money(taxi.privateRate)}. This is a one-day Ziyarat — pick the day on the right.
      </p>
    </div>
  );
}

const SLOTS = Array.from({ length: 26 }, (_, i) => {
  const m = 11 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

const reservationTime = (b: { extras?: string }) => String(parseBookingExtras(b.extras).time ?? "");

export function ListingBook({ fallbackSlug }: { fallbackSlug?: string }) {
  const { money, currency } = useSerai();
  const { id } = useParams<{ id: string }>();
  const slug = fallbackSlug || id;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [miss, setMiss] = useState("This listing is not on the map.");
  const dates = defaultDates();
  const [start, setStart] = useState(dates.checkin);
  const [end, setEnd] = useState(dates.checkout);
  const [guests, setGuests] = useState(2);
  const [taxiMode, setTaxiMode] = useState<"shared" | "private" | "custom">("shared");
  const [customHours, setCustomHours] = useState(6);
  const [customNote, setCustomNote] = useState("");
  const [phone, setPhone] = useState("");
  const [slot, setSlot] = useState("19:30");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"property" | "card">("property");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{ ids: string[]; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const load = async () => {
    if (!slug) {
      setListing(null);
      setReady(true);
      return;
    }
    try {
      const res = await fetch(`/api/listings/${slug}`, { cache: "no-store" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : { error: "Empty response" };
      if (data.error) {
        setListing(null);
        setMiss(data.error);
      } else {
        setListing(data);
        setMiss("");
      }
    } catch {
      setListing(null);
      setMiss("This listing is not on the map.");
    }
    setReady(true);
  };

  useEffect(() => {
    setReady(false);
    setListing(null);
    void load();
  }, [slug]);

  useEffect(() => {
    if (listing?.kind === "RESTAURANT") setStart(addDaysIso(localTodayIso(), 1));
    if (listing?.kind === "ATTRACTION") setEnd(start);
  }, [listing?.kind]);

  const bookings = listing?.myBookings ?? [];
  const clash = useMemo(
    () =>
      bookings.find(
        (b) =>
          !isPastBooking(b.endDate, b.startDate) &&
          (listing?.kind === "RESTAURANT"
            ? b.startDate === start && reservationTime(b) === slot
            : datesOverlap(start, listing?.kind === "TAXI" ? start : end || start, b.startDate, b.endDate)),
      ),
    [bookings, start, end, slot, listing?.kind],
  );

  if (!ready) return <PageLoader label="Loading listing" />;
  if (!listing) return <div className="p-10 text-mist">{miss}</div>;

  const mine = Boolean(session?.user?.id && listing.ownerId === session.user.id);
  const asAdmin = session?.user?.role === "ADMIN";
  const urdu = /[\u0600-\u06FF]/.test(listing.nastaliq || "");
  const place = [listing.city, listing.region].filter(Boolean).join(", ");

  const taxi =
    listing.kind === "TAXI"
      ? listingToTaxi({
          slug: listing.slug,
          name: listing.name,
          nastaliq: listing.nastaliq,
          city: listing.city,
          region: listing.region,
          cover: listing.cover,
          description: listing.description,
          price: listing.price,
          meta: listing.meta,
        })
      : null;
  const oneDay = listing.kind === "TAXI";
  const ziyarat = listing.kind === "ATTRACTION";
  const reservation = listing.kind === "RESTAURANT";
  const guideFee = ziyarat ? guideFeeOf(listing.meta) : 0;
  const guideGroup = ziyarat && guideUnitOf(listing.meta) === "group";
  const lastDay = ziyarat ? (end < start ? start : end) : start;
  const visitDays = ziyarat ? inclusiveDays(start, lastDay) : 1;
  const tripTotal = independentTripTotal({
    kind: listing.kind,
    price: listing.price,
    priceUnit: listing.priceUnit,
    guests,
    taxi,
    taxiMode,
    days: visitDays,
    guideFee,
    guideFeeUnit: guideGroup ? "group" : "person",
  });
  const freeVisit = ziyarat && tripTotal <= 0;
  const perPerson = listing.priceUnit === "person";
  const visitFee = (perPerson ? Number(listing.price) * guests : Number(listing.price)) * visitDays;
  const guideTotal = guideAmount(guideFee, guideGroup ? "group" : "person", guests, visitDays);
  const canPayNow = taxiMode !== "custom" && tripTotal > 0;
  const payingNow = canPayNow && payMethod === "card";

  const book = async () => {
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setError("");
    if (taxi && taxiMode === "shared" && guests > taxi.vacant) {
      setError(`You cannot book more than ${taxi.vacant} seat${taxi.vacant === 1 ? "" : "s"} — only ${taxi.vacant} of ${taxi.seats} seats are open on this trip.`);
      return;
    }
    setOverlay(taxiMode === "custom" ? "Sending request" : payingNow ? "Opening card payment" : "Confirming booking");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: listing.slug,
        startDate: start,
        endDate: ziyarat ? lastDay : oneDay || reservation ? start : end,
        guests,
        phone,
        payment: payingNow ? "card" : "property",
        currency,
        total: tripTotal,
        customTaxi: taxi && taxiMode === "custom",
        extras: reservation
          ? JSON.stringify({ time: slot, requests: notes.trim() })
          : taxi
          ? JSON.stringify(
              taxiMode === "custom" ? { taxiMode, hours: customHours, note: customNote } : { taxiMode },
            )
          : undefined,
      }),
    });
    const data = await readJson<{ error?: string; id?: string; payUrl?: string }>(res);
    if (!res.ok) {
      setOverlay(null);
      setError(data?.error || "Could not book");
      return;
    }
    if (data?.payUrl) {
      window.location.assign(data.payUrl);
      return;
    }
    router.push(`/booked/${data?.id || listing.slug}`);
  };

  const paymentBlock = canPayNow ? (
<div>
                <p className="auth-label">Payment</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={payMethod === "card"}
                    className={`rounded-xl border px-3 py-3 text-left text-sm ${payMethod === "card" ? "border-flame bg-flame/10" : "border-brass/30"}`}
                    onClick={() => setPayMethod("card")}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.14em] text-brass">Pay now</span>
                    <span className="mt-1 block text-sand">Card · {money(tripTotal)}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={payMethod === "property"}
                    className={`rounded-xl border px-3 py-3 text-left text-sm ${payMethod === "property" ? "border-flame bg-flame/10" : "border-brass/30"}`}
                    onClick={() => setPayMethod("property")}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.14em] text-brass">Pay later</span>
                    <span className="mt-1 block text-sand">{taxi ? "Pay the driver" : listing.kind === "RESTAURANT" ? "Pay at the restaurant" : "Pay on the day"}</span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-mist">
                  {payingNow
                    ? "You will pay securely on Stripe. The booking is confirmed after the charge succeeds."
                    : ziyarat
                      ? "Your booking is confirmed now. No card is charged; you pay on the day."
                      : "No card is charged now."}
                </p>
              </div>
  ) : null;

  const today = localTodayIso();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const slots = SLOTS.filter((t) => start !== today || Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) > nowMinutes + 30);
  const slotValue = slots.includes(slot) ? slot : slots[0] ?? slot;

  const reservationForm = (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (slotValue !== slot) setSlot(slotValue);
        void book();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="auth-label">
          Date
          <input type="date" className="auth-field" min={today} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="auth-label">
          Time
          <select className="auth-field" value={slotValue} onChange={(e) => setSlot(e.target.value)} disabled={slots.length === 0}>
            {slots.length === 0 && <option>No times left today</option>}
            {slots.map((t) => (
              <option key={t} value={t}>
                {formatTime(t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <p className="auth-label">Party size</p>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-brass/25 bg-ink/25 px-3 py-2">
          <button
            type="button"
            aria-label="Fewer guests"
            className="btn-ghost px-3! py-1! text-lg! leading-none"
            disabled={guests <= 1}
            onClick={() => setGuests((g) => Math.max(1, g - 1))}
          >
            −
          </button>
          <span className="text-sand">
            {guests} {guests === 1 ? "guest" : "guests"}
          </span>
          <button
            type="button"
            aria-label="More guests"
            className="btn-ghost px-3! py-1! text-lg! leading-none"
            disabled={guests >= 20}
            onClick={() => setGuests((g) => Math.min(20, g + 1))}
          >
            +
          </button>
        </div>
      </div>
      <label className="auth-label">
        Phone
        <input className="auth-field" placeholder="03xx xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="auth-label">
        Special requests <span className="normal-case tracking-normal text-mist">(optional)</span>
        <textarea
          className="auth-field min-h-16"
          maxLength={300}
          placeholder="Occasion, allergies, high chair…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {paymentBlock}
      <div className="rounded-xl bg-ink/30 px-3 py-2.5 text-sm">
        <p className="text-sand">
          {start ? new Date(`${start}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "—"}
          {slotValue ? ` · ${formatTime(slotValue)}` : ""} · {guests} {guests === 1 ? "guest" : "guests"}
        </p>
        <p className="mt-0.5 text-mist">Total {money(tripTotal)}</p>
      </div>
      {clash && (
        <p className="text-sm text-rose">You already have a reservation here at that date and time. Pick another time or cancel it first.</p>
      )}
      {error && <p className="text-sm text-rose">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={Boolean(clash) || Boolean(overlay) || slots.length === 0}>
        {status !== "authenticated" ? "Sign in to reserve" : payingNow ? `Reserve & pay · ${money(tripTotal)}` : "Reserve a table"}
      </button>
    </form>
  );

  const decideListing = async (next: "approved" | "rejected") => {
    if (next === "rejected") {
      setRejecting(true);
      return;
    }
    setOverlay("Approving listing");
    await fetch(`/api/admin/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setOverlay(null);
    await load();
  };

  const submitReject = async () => {
    setOverlay("Rejecting listing");
    await fetch(`/api/admin/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", rejectReason: rejectReason || "Does not meet Serai standards." }),
    });
    setOverlay(null);
    setRejecting(false);
    setRejectReason("");
    await load();
  };

  return (
    <div>
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <div className="relative h-[58vh] min-h-[380px] overflow-hidden">
        {taxi ? (
          <ZoomableImage
            src={taxiCarPhotos(taxi)[0] || listing.cover || "/images/hero-hunza-dusk.png"}
            sources={taxiCarPhotos(taxi)}
            alt={taxi.vehicle || listing.name}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <Image src={listing.cover || "/images/hero-hunza-dusk.png"} alt={listing.name} fill priority className="object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/25" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-10">
          <p className="inline-flex rounded-full border border-brass/40 bg-ink/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-brass backdrop-blur">
            {kindLabel[listing.kind as ListingKind] ?? listing.kind}
          </p>
          {urdu && <p className="font-urdu mt-3 text-xl text-brass">{listing.nastaliq}</p>}
          <h1 className="font-display mt-2 max-w-3xl text-4xl leading-tight md:text-6xl">{listing.name}</h1>
          {place && <p className="mt-2 text-mist">{place}</p>}
          {(listing.reviewCount ?? 0) > 0 && (
            <p className="mt-2 flex items-center gap-2 text-sm text-sand">
              <StarIcon className="h-4 w-4 text-brass" />
              {listing.reviewAvg} · {listing.reviewCount} review{listing.reviewCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div>
          {(mine || asAdmin) && listing.status && listing.status !== "approved" && (
            <div className="mb-8 rounded-2xl border border-brass/35 bg-ink-2/70 px-5 py-4 text-sm text-sand">
              <p>Status: {listing.status === "rejected" ? "Rejected by admin" : "Waiting for admin approval"}. Guests cannot see this yet.</p>
              {listing.status === "rejected" && listing.rejectReason && (
                <p className="mt-1 text-rose">{listing.rejectReason}</p>
              )}
              {asAdmin && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {listing.status !== "approved" && (
                    <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => decideListing("approved")}>
                      Approve & publish
                    </button>
                  )}
                  {listing.status !== "rejected" && !rejecting && (
                    <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setRejecting(true)}>
                      Reject
                    </button>
                  )}
                  {rejecting && (
                    <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                      <input
                        className="auth-field flex-1"
                        placeholder="Rejection reason (optional)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => void submitReject()}>
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1.5 text-sm"
                        onClick={() => {
                          setRejecting(false);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {mine && (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brass/35 bg-ink-2/70 px-5 py-4">
              <p className="text-sm text-sand">This is your listing. Guests see the card on the right once admin approves it.</p>
              <Link href={`/owner/${listing.id}`} className="btn-primary">
                Edit listing
              </Link>
            </div>
          )}
          <p className="max-w-2xl text-lg leading-relaxed text-sand/90">
            {listing.description?.trim() || "No description yet."}
          </p>
          {listing.kind === "TAXI" && (
            <TaxiItinerary listing={listing} />
          )}
          <ListingReviews
            listingId={listing.slug}
            reviews={listing.reviews ?? []}
            avg={listing.reviewAvg ?? 0}
            count={listing.reviewCount ?? 0}
            canReview={Boolean(listing.canReview)}
            onPosted={() => void load()}
          />
          {bookings.length > 0 && (
            <div className="mt-10 max-w-xl">
              <h2 className="font-display text-2xl">{oneDay || ziyarat ? "Your trips" : "Your dates on this listing"}</h2>
              <ul className="mt-4 space-y-3">
                {bookings.map((b) => {
                  const past = isPastBooking(b.endDate, b.startDate);
                  return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brass/25 px-4 py-3">
                    <p className="text-sm text-sand">
                      {b.startDate === b.endDate
                        ? formatDay(b.startDate)
                        : `${formatDay(b.startDate)} — ${formatDay(b.endDate)}`}
                      {reservation && reservationTime(b) ? ` · ${formatTime(reservationTime(b))}` : ""}{" "}
                      · {money(b.total)}
                      {past ? " · Completed" : ""}
                    </p>
                    {!past && (
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => setCancelModal({ ids: [b.id], title: `Cancel ${listing.name}?` })}
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-brass/30 bg-ink-2 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          {reservation && <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-brass">Reserve a table</p>}
          {taxi && taxiMode === "custom" ? (
            <p className="font-display text-2xl">Customize this trip</p>
          ) : ziyarat && Number(listing.price) <= 0 ? (
            guideFee > 0 ? (
              <div>
                <p className="font-display text-3xl">
                  {money(guideFee)} <span className="text-base text-mist">{guideGroup ? "/ day · whole group" : "/ guest · per day"}</span>
                </p>
                <p className="mt-1 text-sm text-mist">
                  Entry is free. The fee is for your guide,{" "}
                  {guideGroup ? "one flat amount for each day, however many guests you bring." : "charged for each guest on every day you book."}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-display text-3xl">Free visit</p>
                <p className="mt-1 text-sm text-mist">No charge for this Ziyarat. Reserve your day or days so the host expects you.</p>
              </div>
            )
          ) : (
            <p className="font-display text-3xl">
              {money(taxi ? (taxiMode === "private" ? taxi.privateRate : taxi.ratePerPerson) : listing.price)}{" "}
              <span className="text-base text-mist">
                / {taxi ? (taxiMode === "private" ? "vehicle" : "person") : unitLabel[listing.priceUnit] ?? listing.priceUnit}
                {ziyarat ? " · per day" : ""}
              </span>
            </p>
          )}
          {taxi ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-brass/20 bg-ink/25 px-3 py-2.5">
              <TaxiPhotos
                driver={taxi.driver}
                driverPhoto={taxi.driverPhoto}
                vehicle={taxi.vehicle}
                vehiclePhoto={taxi.vehiclePhoto}
                vehiclePhotos={taxi.vehiclePhotos}
                cover={taxi.cover}
                size="md"
                showVehicle={false}
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] text-brass">Driver</p>
                <p className="truncate text-sm font-medium text-sand">{taxi.driver}</p>
                <p className="truncate text-xs text-mist">
                  {taxi.vehicle}
                  {taxi.model ? ` · ${taxi.model}` : ""}
                </p>
              </div>
            </div>
          ) : null}
          {asAdmin ? (
            <p className="mt-4 rounded-xl bg-ink/30 px-4 py-3 text-sm text-mist">
              Admin preview — this is how guests see the listing. Booking is turned off for admin accounts.
            </p>
          ) : listing.status && listing.status !== "approved" ? (
            <p className="mt-4 rounded-xl bg-ink/30 px-4 py-3 text-sm text-mist">
              Booking opens once this listing is approved and live.
            </p>
          ) : (
          reservation ? (
            reservationForm
          ) : (
          <>
          <p className="mt-2 text-sm text-mist">
            {ziyarat
              ? "Choose the day you will go. Staying longer? Pick a last day and every day in between is booked."
              : oneDay
                ? "This is a single-day trip. Pick the day you will go."
                : "You can book more than once — just choose dates that do not overlap."}
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void book();
            }}
          >
            {taxi && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${taxiMode === "shared" ? "border-flame bg-flame/10" : "border-brass/30"}`}
                  onClick={() => setTaxiMode("shared")}
                >
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-brass">Shared</span>
                  <span className="mt-1 block text-sand">{money(taxi.ratePerPerson)} / person</span>
                </button>
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${taxiMode === "private" ? "border-flame bg-flame/10" : "border-brass/30"}`}
                  onClick={() => setTaxiMode("private")}
                >
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-brass">Private</span>
                  <span className="mt-1 block text-sand">{money(taxi.privateRate)} full vehicle</span>
                </button>
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${taxiMode === "custom" ? "border-flame bg-flame/10" : "border-brass/30"}`}
                  onClick={() => setTaxiMode("custom")}
                >
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-brass">Customize</span>
                  <span className="mt-1 block text-sand">Any duration, any route</span>
                </button>
              </div>
            )}
            {taxiMode === "custom" && (
              <div className="space-y-3 rounded-xl border border-brass/25 bg-ink/20 p-3">
                <p className="text-xs text-mist">Hire this driver for as long as you need — no fixed route or stops. How much time do you need?</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[6, 12, 24].map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`rounded-lg border px-2 py-2 text-center text-xs ${customHours === h ? "border-flame bg-flame/10 text-sand" : "border-brass/25 text-mist"}`}
                      onClick={() => setCustomHours(h)}
                    >
                      {h === 24 ? "Full day" : `${h}h`}
                    </button>
                  ))}
                  <label className="rounded-lg border border-brass/25 px-1.5 py-1 text-center text-xs text-mist">
                    <input
                      type="number"
                      min={1}
                      className="w-full bg-transparent text-center text-sand outline-none"
                      value={customHours}
                      onChange={(e) => setCustomHours(Math.max(1, Number(e.target.value) || 1))}
                    />
                    hrs
                  </label>
                </div>
                <label className="auth-label">
                  Where do you want to go? (optional)
                  <textarea
                    className="auth-field min-h-16"
                    placeholder="e.g. shrine visits across the city, waiting time between stops"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                  />
                </label>
                <p className="rounded-lg bg-flame/10 px-3 py-2 text-xs text-sand">
                  There's no fixed price for a custom trip — it depends on where you go. Once this request is sent, contact {taxi?.driver || "the driver"} directly to agree on a rate.
                </p>
              </div>
            )}
            {ziyarat ? (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="auth-label">
                    First day
                    <input
                      type="date"
                      className="auth-field"
                      min={localTodayIso()}
                      value={start}
                      onChange={(e) => {
                        setStart(e.target.value);
                        if (end < e.target.value) setEnd(e.target.value);
                      }}
                    />
                  </label>
                  <label className="auth-label">
                    Last day
                    <input
                      type="date"
                      className="auth-field"
                      min={start}
                      max={addDaysIso(start, MAX_VISIT_DAYS - 1)}
                      value={lastDay}
                      onChange={(e) => setEnd(e.target.value < start ? start : e.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {[1, 2, 3, 5, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="filter-chip"
                      data-on={visitDays === n}
                      onClick={() => setEnd(addDaysIso(start, n - 1))}
                    >
                      {n} {n === 1 ? "day" : "days"}
                    </button>
                  ))}
                  <span className="ml-auto text-xs text-mist">
                    {visitDays} {visitDays === 1 ? "day" : "days"} · up to {MAX_VISIT_DAYS}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <label className="auth-label">
                  {oneDay ? "Trip day" : "Date"}
                  <input type="date" className="auth-field" min={localTodayIso()} value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
                {!oneDay && (
                  <label className="auth-label">
                    Until
                    <input type="date" className="auth-field" min={minCheckoutIso(start)} value={end} onChange={(e) => setEnd(e.target.value < minCheckoutIso(start) ? minCheckoutIso(start) : e.target.value)} />
                  </label>
                )}
              </>
            )}
            {ziyarat && (
              <div>
                <p className="auth-label">Guests</p>
                <div className="mt-2 flex items-center justify-between rounded-xl border border-brass/25 bg-ink/25 px-3 py-2">
                  <button type="button" aria-label="Fewer guests" className="btn-ghost px-3! py-1! text-lg! leading-none" disabled={guests <= 1} onClick={() => setGuests((g) => Math.max(1, g - 1))}>
                    −
                  </button>
                  <span className="text-sand">
                    {guests} {guests === 1 ? "guest" : "guests"}
                  </span>
                  <button type="button" aria-label="More guests" className="btn-ghost px-3! py-1! text-lg! leading-none" disabled={guests >= 50} onClick={() => setGuests((g) => Math.min(50, g + 1))}>
                    +
                  </button>
                </div>
              </div>
            )}
            {taxiMode !== "custom" && !ziyarat && (
              <label className="auth-label">
                Guests
                <input
                  type="number"
                  min={1}
                  max={taxi && taxiMode === "shared" ? taxi.vacant : undefined}
                  className="auth-field"
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                />
                {taxi && taxiMode === "shared" && (
                  <span className="mt-1 block text-xs text-mist">Only {taxi.vacant} of {taxi.seats} seats open on this trip.</span>
                )}
              </label>
            )}
            <label className="auth-label">
              Phone
              <input className="auth-field" placeholder="03xx xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            {ziyarat && (
              <div className="rounded-xl bg-ink/30 px-4 py-3 text-sm">
                <p className="text-sand">
                  {formatDay(start)}
                  {lastDay !== start ? ` — ${formatDay(lastDay)}` : ""} · {visitDays} {visitDays === 1 ? "day" : "days"} · {guests} {guests === 1 ? "guest" : "guests"}
                </p>
                {freeVisit ? (
                  <p className="mt-1 text-mist">Free visit · nothing to pay</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-1 text-xs text-mist">
                      {visitFee > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>
                            Visit · {money(listing.price)}
                            {perPerson ? ` × ${guests} ${guests === 1 ? "guest" : "guests"}` : ""} × {visitDays} {visitDays === 1 ? "day" : "days"}
                          </span>
                          <span className="tabular-nums text-sand">{money(visitFee)}</span>
                        </li>
                      )}
                      {guideTotal > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>
                            Guide · {money(guideFee)}
                            {guideGroup ? " flat" : ` × ${guests} ${guests === 1 ? "guest" : "guests"}`} × {visitDays} {visitDays === 1 ? "day" : "days"}
                          </span>
                          <span className="tabular-nums text-sand">{money(guideTotal)}</span>
                        </li>
                      )}
                    </ul>
                    <p className="mt-2 flex items-baseline justify-between border-t border-brass/15 pt-2 text-sand">
                      <span>Total</span>
                      <span className="font-display text-2xl">{money(tripTotal)}</span>
                    </p>
                  </>
                )}
              </div>
            )}
            {paymentBlock}
            {clash && (
              <p className="text-sm text-rose">
                {ziyarat
                  ? `You already have this Ziyarat on ${formatDay(clash.startDate)}${clash.endDate !== clash.startDate ? ` — ${formatDay(clash.endDate)}` : ""}. Pick other days or cancel that booking first.`
                  : oneDay
                  ? `You already have this trip on ${formatDay(clash.startDate)}. Pick another day or cancel that booking first.`
                  : `Those dates overlap ${formatDay(clash.startDate)} — ${formatDay(clash.endDate)}. Change dates or cancel that booking first.`}
              </p>
            )}
            {error && <p className="text-sm text-rose">{error}</p>}
            {taxi && (
              <p className="text-sm text-mist">
                {taxiMode === "custom"
                  ? `${customHours} hour${customHours === 1 ? "" : "s"} · rate agreed with the driver`
                  : `Total ${money(tripTotal)} · ${taxiMode === "shared" ? `${guests} guest${guests === 1 ? "" : "s"}` : "private vehicle"}`}
              </p>
            )}
            <button type="submit" className="btn-primary w-full" disabled={Boolean(clash) || Boolean(overlay)}>
              {status !== "authenticated"
                ? "Sign in to request"
                : taxiMode === "custom"
                  ? "Request this driver"
                  : payingNow
                    ? `Pay with card · ${money(tripTotal)}`
                    : ziyarat
                      ? freeVisit
                        ? visitDays > 1 ? `Reserve ${visitDays} days` : "Reserve this day"
                        : visitDays > 1 ? `Book ${visitDays} days · pay on the day` : "Book this day · pay on the day"
                      : oneDay
                        ? "Book this day"
                        : "Book these dates"}
            </button>
          </form>
          </>
          )
          )}
        </aside>
      </div>

      <CancelBookingModal
        open={Boolean(cancelModal)}
        bookingIds={cancelModal?.ids ?? []}
        title={cancelModal?.title}
        onClose={() => setCancelModal(null)}
        onCancelled={() => void load()}
      />
    </div>
  );
}
