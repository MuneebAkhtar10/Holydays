"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSerai } from "@/lib/store";
import { readJson } from "@/lib/readJson";
import { formatDay } from "@/lib/format";
import { PageLoader } from "@/components/PageLoader";
import { BookingReviewForm } from "@/components/ListingReviews";
import type { BookingDTO } from "@/lib/booking-dto";
import type { BookingBucket } from "@/lib/booking-view";
import { kindLabel, type ListingKind } from "@/lib/marketplace";
import { CancelBookingModal } from "@/components/CancelBookingModal";

type TripGroup = { key: string; primary: BookingDTO; bookings: BookingDTO[]; isPackage: boolean };

function groupTrips(bookings: BookingDTO[]): TripGroup[] {
  const byKey = new Map<string, BookingDTO[]>();
  for (const b of bookings) {
    const key = String(b.extra?.packageId ?? "") || b.id;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(b);
  }
  return Array.from(byKey.entries()).map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const primary = sorted.find((b) => b.id === key) ?? sorted[0];
    return { key, primary, bookings: sorted, isPackage: Boolean(primary.extra?.package) };
  });
}

function TripStatusBadge({ status, bucket }: { status: string; bucket: BookingBucket }) {
  let tone = "bg-sage/15 text-sage";
  let dot = "bg-sage";
  let label: string = bucket;

  if (status === "cancelled") {
    tone = "bg-sand/10 text-mist";
    dot = "bg-mist";
    label = "Cancelled";
  } else if (status === "declined") {
    tone = "bg-sand/10 text-mist";
    dot = "bg-mist";
    label = "Declined";
  } else if (status === "cancel_requested") {
    tone = "bg-rose/15 text-rose";
    dot = "bg-rose";
    label = "Cancellation requested";
  } else if (status === "pending_payment") {
    tone = "bg-brass/15 text-brass";
    dot = "bg-brass";
    label = "Awaiting payment";
  } else if (status === "pending_driver") {
    tone = "bg-brass/15 text-brass";
    dot = "bg-brass";
    label = "Awaiting driver";
  } else if (bucket === "completed") {
    tone = "bg-brass/15 text-brass";
    dot = "bg-brass";
    label = "Completed";
  } else if (bucket === "current") {
    label = "Current stay";
  } else {
    label = "Upcoming";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

const buckets: { id: BookingBucket | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "current", label: "Current hotels" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export default function TripsPage() {
  const { wishlist, toggleWish, money } = useSerai();
  const { status } = useSession();
  const [savedListings, setSavedListings] = useState<{ id: string; name: string; city: string; cover: string; price: number }[]>([]);
  const [bookings, setBookings] = useState<BookingDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | ListingKind>("all");
  const [statusFilter, setStatusFilter] = useState<BookingBucket | "all">("all");
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{ ids: string[]; title: string } | null>(null);

  const load = async () => {
    const res = await fetch("/api/bookings");
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];
    setBookings(Array.isArray(data) ? data : []);
    setReady(true);
  };

  useEffect(() => {
    if (status !== "authenticated") {
      if (status !== "loading") setReady(true);
      return;
    }
    setReady(false);
    void load();
  }, [status]);

  useEffect(() => {
    if (!wishlist.length) {
      setSavedListings([]);
      return;
    }
    fetch("/api/listings?kind=STAY", { cache: "no-store" })
      .then((r) => readJson<{ slug: string; name: string; city: string; cover: string; price: number }[]>(r))
      .then((d) => {
        const rows = Array.isArray(d) ? d : [];
        setSavedListings(
          rows
            .filter((s) => wishlist.includes(s.slug))
            .map((s) => ({ id: s.slug, name: s.name, city: s.city, cover: s.cover, price: s.price })),
        );
      })
      .catch(() => setSavedListings([]));
  }, [wishlist]);

  const shownGroups = groupTrips(bookings).filter((g) => {
    if (kindFilter !== "all" && g.primary.listing.kind !== kindFilter) return false;
    if (statusFilter === "all") return true;
    return g.primary.bucket === statusFilter;
  });

  if (status === "loading" || (status === "authenticated" && !ready)) {
    return <PageLoader label="Loading your trips" />;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">My bookings</p>
      <h1 className="font-display mt-1 text-3xl">Your trips</h1>
      <p className="mt-1.5 max-w-xl text-sm text-mist">Upcoming, current, completed, and cancelled hotels — with invoices, changes, and help.</p>

      {status !== "authenticated" && (
        <div className="mt-10 rounded-2xl border border-brass/30 bg-ink-2 p-8">
          <p className="text-sand">Sign in to see bookings.</p>
          <Link href="/login?callbackUrl=/trips" className="btn-primary mt-5 inline-flex">
            Sign in
          </Link>
        </div>
      )}

      {status === "authenticated" && (
        <section className="mt-5">
          <div className="rounded-2xl border border-brass/30 bg-ink-2/70 p-3">
            <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-brass">Filters</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All types"],
                  ["STAY", "Hotels"],
                  ["TAXI", "Taxis"],
                  ["ATTRACTION", "Ziyarat"],
                  ["RESTAURANT", "Food"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className="filter-chip" data-on={kindFilter === id} onClick={() => setKindFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {buckets.map((b) => (
                <button key={b.id} type="button" className="filter-chip" data-on={statusFilter === b.id} onClick={() => setStatusFilter(b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <h2 className="font-display mt-6 text-2xl">{buckets.find((b) => b.id === statusFilter)?.label}</h2>
          {shownGroups.length === 0 ? (
            <p className="mt-4 text-mist">No bookings match these filters.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {shownGroups.map((g) => {
                const { primary, bookings: group, isPackage } = g;
                const isMultiHotel = group.length > 1;
                const groupTotal = group.reduce((s, b) => s + b.total, 0);
                const tripStart = group.reduce((min, b) => (b.startDate < min ? b.startDate : min), group[0].startDate);
                const tripEnd = group.reduce((max, b) => (b.endDate > max ? b.endDate : max), group[0].endDate);
                const unread = group.reduce((s, b) => s + (b.unreadFromHost ?? 0), 0);
                const anyLive = group.some(
                  (b) => (b.status === "confirmed" || b.status === "pending_driver") && b.bucket !== "completed",
                );
                const ids = group.map((b) => b.id);
                const inactive = primary.status === "cancelled" || primary.status === "declined";
                return (
                  <article
                    key={g.key}
                    className={`overflow-hidden rounded-xl border bg-ink-2 transition-opacity sm:flex sm:items-center ${
                      inactive ? "border-sand/10 opacity-60" : "border-brass/30"
                    }`}
                  >
                    <div className="relative h-32 shrink-0 sm:h-24 sm:w-32">
                      <Image
                        src={primary.listing.cover || "/images/hero-hunza-dusk.png"}
                        alt={primary.listing.name}
                        fill
                        className={`object-cover ${inactive ? "grayscale" : ""}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TripStatusBadge status={primary.status} bucket={primary.bucket} />
                        <span className="inline-flex items-center rounded-full bg-brass/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-brass">
                          {isPackage ? "Package" : kindLabel[primary.listing.kind] ?? primary.listing.kind}
                        </span>
                        {unread > 0 && (
                          <span className="rounded-full bg-rose px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-bone">
                            {unread} new
                          </span>
                        )}
                        <span className="ml-auto font-mono text-[10px] tracking-[0.1em] text-mist">{primary.number}</span>
                      </div>
                      {isPackage ? (
                        <>
                          <h3 className="font-display mt-1.5 truncate text-lg leading-tight text-sand">
                            {isMultiHotel
                              ? group.map((b, i) => (
                                  <span key={b.id}>
                                    {b.listing.name}
                                    {i < group.length - 1 && <span className="mx-1.5 text-brass/60">→</span>}
                                  </span>
                                ))
                              : `${primary.listing.name} · Ziyarat package`}
                          </h3>
                          <p className="mt-0.5 text-sm text-mist">
                            {formatDay(tripStart)} — {formatDay(tripEnd)} · <span className="font-medium text-sand">{money(groupTotal)}</span>
                            {isMultiHotel ? ` · ${group.length} hotels` : ""}
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-display mt-1.5 truncate text-lg leading-tight text-sand">{primary.listing.name}</h3>
                          <p className="mt-0.5 text-sm text-mist">
                            {formatDay(primary.startDate)} — {formatDay(primary.endDate)} ·{" "}
                            <span className="font-medium text-sand">{money(primary.total)}</span>
                            {primary.listing.city ? ` · ${primary.listing.city}` : ""}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-sand/[0.06] px-4 py-3 sm:border-t-0 sm:border-l sm:py-3">
                      <Link href={`/bookings/${primary.id}`} className="btn-primary px-3 py-1.5 text-sm">
                        Details
                      </Link>
                      <Link href={`/bookings/${primary.id}/invoice`} className="btn-ghost px-3 py-1.5 text-sm text-sand">
                        Invoice
                      </Link>
                      {anyLive && (
                        <button
                          type="button"
                          className="btn-ghost px-3 py-1.5 text-sm text-sand"
                          onClick={() =>
                            setCancelModal({
                              ids,
                              title: isMultiHotel ? "Cancel the whole package?" : `Cancel ${primary.listing.name}?`,
                            })
                          }
                        >
                          {isMultiHotel ? "Cancel package" : "Cancel"}
                        </button>
                      )}
                      {!isMultiHotel && primary.bucket === "completed" && primary.status !== "cancelled" && (
                        primary.myReview ? (
                          <span className="text-sm text-brass">Reviewed · {primary.myReview.rating}/5</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost px-3 py-1.5 text-sm text-sand"
                            onClick={() => setReviewFor(reviewFor === primary.id ? null : primary.id)}
                          >
                            {reviewFor === primary.id ? "Close review" : "Review"}
                          </button>
                        )
                      )}
                    </div>
                    {reviewFor === primary.id && !primary.myReview && (
                      <div className="w-full px-4 pb-4 sm:px-0">
                        <BookingReviewForm
                          listingId={primary.listing.slug}
                          onPosted={() => {
                            setReviewFor(null);
                            void load();
                          }}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-2xl">Saved hotels</h2>
        {savedListings.length === 0 ? (
          <p className="mt-3 text-sm text-mist">No saved hotels yet. Heart a listing on a hotel page to keep it here.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {savedListings.map((s) => (
              <article key={s.id} className="overflow-hidden rounded-xl border border-brass/30 bg-ink-2 sm:flex sm:items-center">
                <div className="relative h-24 sm:h-20 sm:w-28 sm:shrink-0">
                  <Image src={s.cover} alt={s.name} fill className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-display truncate text-lg">{s.name}</p>
                    <p className="text-sm text-mist">
                      {s.city} · {money(s.price)} / night
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/stay/${s.id}`} className="btn-primary px-3 py-1.5 text-sm">
                      View
                    </Link>
                    <button type="button" className="btn-ghost px-3 py-1.5 text-sm text-sand" onClick={() => toggleWish(s.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
