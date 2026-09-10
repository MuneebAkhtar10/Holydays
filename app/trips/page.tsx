"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSerai } from "@/lib/store";
import { readJson } from "@/lib/readJson";
import { formatDay } from "@/lib/format";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { BookingReviewForm } from "@/components/ListingReviews";
import type { BookingDTO } from "@/lib/booking-dto";
import type { BookingBucket } from "@/lib/booking-view";
import { kindLabel, type ListingKind } from "@/lib/marketplace";

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
  const [busy, setBusy] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | ListingKind>("all");
  const [statusFilter, setStatusFilter] = useState<BookingBucket | "all">("all");
  const [reviewFor, setReviewFor] = useState<string | null>(null);

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

  const cancel = async (id: string) => {
    if (!confirm("Cancel this reservation?")) return;
    setBusy(id);
    setOverlay("Cancelling booking");
    await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    await load();
    setBusy(null);
    setOverlay(null);
  };

  const shown = bookings.filter((b) => {
    if (kindFilter !== "all" && b.listing.kind !== kindFilter) return false;
    if (statusFilter === "all") return true;
    return b.bucket === statusFilter;
  });

  if (status === "loading" || (status === "authenticated" && !ready)) {
    return <PageLoader label="Loading your trips" />;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">My bookings</p>
      <h1 className="font-display mt-2 text-5xl">Your trips</h1>
      <p className="mt-3 max-w-xl text-mist">Upcoming, current, completed, and cancelled hotels — with invoices, changes, and help.</p>

      {status !== "authenticated" && (
        <div className="mt-10 rounded-2xl border border-brass/30 bg-ink-2 p-8">
          <p className="text-sand">Sign in to see bookings.</p>
          <Link href="/login?callbackUrl=/trips" className="btn-primary mt-5 inline-flex">
            Sign in
          </Link>
        </div>
      )}

      {status === "authenticated" && (
        <section className="mt-10">
          <div className="rounded-2xl border border-brass/30 bg-ink-2/70 p-4">
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-brass">Filters</p>
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
          <h2 className="font-display mt-8 text-3xl">{buckets.find((b) => b.id === statusFilter)?.label}</h2>
          {shown.length === 0 ? (
            <p className="mt-4 text-mist">No bookings match these filters.</p>
          ) : (
            <div className="mt-6 grid gap-5">
              {shown.map((b) => (
                <article key={b.id} className="overflow-hidden rounded-2xl border border-brass/30 bg-ink-2 md:grid md:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="relative h-52 min-h-[200px] md:h-full">
                    <Image src={b.listing.cover || "/images/hero-hunza-dusk.png"} alt={b.listing.name} fill className="object-cover" />
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-brass/40 px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-brass">
                        {b.number}
                      </span>
                      {(b.unreadFromHost ?? 0) > 0 && (
                        <span className="rounded-full bg-rose px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-bone">
                          {b.unreadFromHost} new
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${
                          b.status === "cancelled" ? "border-mist text-mist" : "border-sage/40 text-sage"
                        }`}
                      >
                        {b.bucket}
                      </span>
                      <span className="rounded-full border border-brass/35 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-brass">
                        {kindLabel[b.listing.kind] ?? b.listing.kind}
                      </span>
                    </div>
                    <h3 className="font-display mt-4 text-3xl">{b.listing.name}</h3>
                    <p className="mt-2 text-mist">
                      {formatDay(b.startDate)} — {formatDay(b.endDate)} · {money(b.total)}
                      {b.listing.city ? ` · ${b.listing.city}` : ""}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link href={`/bookings/${b.id}`} className="btn-primary">
                        Booking details
                      </Link>
                      <Link href={`/bookings/${b.id}/invoice`} className="btn-ghost text-sand">
                        Invoice
                      </Link>
                      {b.status !== "cancelled" && b.bucket !== "completed" && (
                        <button type="button" className="btn-ghost text-sand" disabled={busy === b.id} onClick={() => cancel(b.id)}>
                          {busy === b.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                      {b.bucket === "completed" && b.status !== "cancelled" && (
                        b.myReview ? (
                          <span className="text-sm text-brass">Reviewed · {b.myReview.rating}/5</span>
                        ) : (
                          <button type="button" className="btn-ghost text-sand" onClick={() => setReviewFor(reviewFor === b.id ? null : b.id)}>
                            {reviewFor === b.id ? "Close review" : "Leave a review"}
                          </button>
                        )
                      )}
                    </div>
                    {reviewFor === b.id && !b.myReview && (
                      <BookingReviewForm
                        listingId={b.listing.slug}
                        onPosted={() => {
                          setReviewFor(null);
                          void load();
                        }}
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-16">
        <h2 className="font-display text-3xl">Saved hotels</h2>
        {savedListings.length === 0 ? (
          <p className="mt-4 text-mist">No saved hotels yet. Heart a listing on a hotel page to keep it here.</p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {savedListings.map((s) => (
              <article key={s.id} className="overflow-hidden rounded-2xl border border-brass/30 bg-ink-2">
                <div className="relative h-44">
                  <Image src={s.cover} alt={s.name} fill className="object-cover" />
                </div>
                <div className="p-5">
                  <p className="font-display text-2xl">{s.name}</p>
                  <p className="mt-1 text-sm text-mist">
                    {s.city} · {money(s.price)} / night
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/stay/${s.id}`} className="btn-primary">
                      View hotel
                    </Link>
                    <button type="button" className="btn-ghost text-sand" onClick={() => toggleWish(s.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
