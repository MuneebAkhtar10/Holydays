"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { datesOverlap, formatDay, isPastBooking } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { defaultDates } from "@/lib/format";
import { kindLabel, unitLabel, type ListingKind } from "@/lib/marketplace";
import { listingToTaxi, tripTitle } from "@/lib/package-plan";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { ListingReviews, type ReviewItem } from "@/components/ListingReviews";
import { StarIcon } from "@/components/StarIcon";
import { readJson } from "@/lib/readJson";
import { CancelBookingModal } from "@/components/CancelBookingModal";
import { TaxiPhotos } from "@/components/TaxiPhotos";

type Booking = {
  id: string;
  startDate: string;
  endDate: string;
  total: number;
  guests: number;
  status: string;
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
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sand">{taxi.driver}</p>
          <p className="truncate text-xs text-mist">{taxi.vehicle}</p>
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
        Shared {money(taxi.ratePerPerson)} / person · Private vehicle {money(taxi.privateRate)}. This is a one-day ziyarat — pick the day on the right.
      </p>
    </div>
  );
}

export function ListingBook({ fallbackSlug }: { fallbackSlug?: string }) {
  const { money } = useSerai();
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

  const bookings = listing?.myBookings ?? [];
  const clash = useMemo(
    () =>
      bookings.find(
        (b) =>
          !isPastBooking(b.endDate, b.startDate) &&
          datesOverlap(start, listing?.kind === "TAXI" || listing?.kind === "ATTRACTION" ? start : end || start, b.startDate, b.endDate),
      ),
    [bookings, start, end, listing?.kind],
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
  const oneDay = listing.kind === "TAXI" || listing.kind === "ATTRACTION";
  const tripTotal = taxi
    ? taxiMode === "custom"
      ? 0
      : taxiMode === "private"
        ? taxi.privateRate
        : taxi.ratePerPerson * Math.max(1, guests)
    : listing.price;

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
    setOverlay(taxiMode === "custom" ? "Sending request" : "Confirming booking");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: listing.slug,
        startDate: start,
        endDate: oneDay ? start : end,
        guests,
        phone,
        payment: "property",
        total: tripTotal,
        customTaxi: taxi && taxiMode === "custom",
        extras: taxi
          ? JSON.stringify(
              taxiMode === "custom" ? { taxiMode, hours: customHours, note: customNote } : { taxiMode },
            )
          : undefined,
      }),
    });
    const data = await readJson<{ error?: string; id?: string }>(res);
    if (!res.ok) {
      setOverlay(null);
      setError(data?.error || "Could not book");
      return;
    }
    router.push(`/booked/${data?.id || listing.slug}`);
  };

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
        <Image src={listing.cover || "/images/hero-hunza-dusk.png"} alt={listing.name} fill priority className="object-cover" />
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

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_360px]">
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
              <h2 className="font-display text-2xl">{oneDay ? "Your trips" : "Your dates on this listing"}</h2>
              <ul className="mt-4 space-y-3">
                {bookings.map((b) => {
                  const past = isPastBooking(b.endDate, b.startDate);
                  return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brass/25 px-4 py-3">
                    <p className="text-sm text-sand">
                      {oneDay || b.startDate === b.endDate
                        ? formatDay(b.startDate)
                        : `${formatDay(b.startDate)} — ${formatDay(b.endDate)}`}{" "}
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
          {taxi && taxiMode === "custom" ? (
            <p className="font-display text-2xl">Customize this trip</p>
          ) : (
            <p className="font-display text-3xl">
              {money(taxi ? (taxiMode === "private" ? taxi.privateRate : taxi.ratePerPerson) : listing.price)}{" "}
              <span className="text-base text-mist">
                / {taxi ? (taxiMode === "private" ? "vehicle" : "person") : unitLabel[listing.priceUnit] ?? listing.priceUnit}
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
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sand">{taxi.driver}</p>
                <p className="truncate text-xs text-mist">{taxi.vehicle}</p>
              </div>
            </div>
          ) : null}
          {listing.status && listing.status !== "approved" ? (
            <p className="mt-4 rounded-xl bg-ink/30 px-4 py-3 text-sm text-mist">
              Booking opens once this listing is approved and live.
            </p>
          ) : (
          <>
          <p className="mt-2 text-sm text-mist">
            {oneDay
              ? "This ziyarat is a single-day plan. Pick the day you will go."
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
            <label className="auth-label">
              {oneDay ? "Trip day" : "Date"}
              <input type="date" className="auth-field" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            {!oneDay && (
              <label className="auth-label">
                Until
                <input type="date" className="auth-field" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
            )}
            {taxiMode !== "custom" && (
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
            {clash && (
              <p className="text-sm text-rose">
                {oneDay
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
                  : oneDay
                    ? "Book this day"
                    : "Book these dates"}
            </button>
          </form>
          </>
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
