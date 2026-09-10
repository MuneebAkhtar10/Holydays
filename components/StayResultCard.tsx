"use client";

import Image from "next/image";
import Link from "next/link";
import { useSerai } from "@/lib/store";
import { FACILITY_LABEL, PROPERTY_LABEL, type SearchStay } from "@/lib/search-index";
import { StarIcon } from "@/components/StarIcon";

const cancelCopy = {
  free: "Free cancellation",
  partial: "Partial refund",
  strict: "Non-refundable",
};

export function StayResultCard({
  stay,
  active,
  onHover,
}: {
  stay: SearchStay;
  active?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const { search, wishlist, toggleWish, money } = useSerai();
  const qs = new URLSearchParams({
    checkin: search.checkin,
    checkout: search.checkout,
    guests: String((search.adults || 0) + (search.children || 0) || search.guests),
    rooms: String(search.rooms || 1),
    adults: String(search.adults || 2),
    children: String(search.children || 0),
    ages: (search.childAges || []).join(","),
  });
  const shown = stay.facilities.slice(0, 5);

  return (
    <article
      id={`stay-card-${stay.id}`}
      className={`overflow-hidden rounded-2xl border bg-ink-2 md:grid md:grid-cols-[220px_minmax(0,1fr)_210px] ${
        active ? "border-flame ring-1 ring-flame/40" : "border-brass/30"
      }`}
      onMouseEnter={() => onHover?.(stay.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Link href={`/stay/${stay.id}?${qs}`} className="relative block h-48 md:h-full min-h-[180px]">
        <Image src={stay.cover} alt={stay.name} fill className="object-cover" />
        {stay.offers[0] && (
          <span className="absolute left-3 top-3 rounded-full bg-flame px-2.5 py-1 text-[10px] uppercase tracking-widest text-ink">
            {stay.offers[0]}
          </span>
        )}
      </Link>
      <div className="p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-brass">
          {PROPERTY_LABEL[stay.kind]} · {stay.stars}★
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <Link href={`/stay/${stay.id}?${qs}`} className="font-display text-2xl leading-tight hover:text-flame">
            {stay.name}
          </Link>
          <button type="button" className="text-brass" onClick={() => toggleWish(stay.id)} aria-label="Save">
            {wishlist.includes(stay.id) ? "♥" : "♡"}
          </button>
        </div>
        <p className="mt-1 text-sm text-mist">
          {stay.city}, {stay.region} · {stay.landmarkKm} km from {stay.landmark}
        </p>
        <p className="mt-1 text-xs text-mist">{stay.airportKm} km from {stay.airport}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-sand">
          <StarIcon className="h-4 w-4 text-brass" />
          {stay.reviewAvg} · {stay.reviewCount} reviews
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {shown.map((f) => (
            <span key={f} className="rounded-full border border-brass/25 px-2 py-0.5 text-[11px] text-mist">
              {FACILITY_LABEL[f]}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-sage">
          {cancelCopy[stay.cancellation]}
          {stay.meals.includes("breakfast") ? " · Breakfast" : ""}
          {stay.payAtProperty ? " · Pay at property" : ""}
          {` · ${stay.roomsLeft} rooms left`}
        </p>
      </div>
      <div className="flex flex-col justify-between border-t border-brass/20 p-5 md:border-l md:border-t-0">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist">From</p>
          <p className="font-display text-2xl">{money(stay.start)}</p>
          <p className="text-xs text-mist">/ night</p>
          <p className="mt-3 text-sm text-sand">
            {stay.nights} night{stay.nights === 1 ? "" : "s"} · {money(stay.total)}
          </p>
          <p className="text-xs text-mist">+ {money(stay.taxes)} taxes & fees</p>
        </div>
        <Link href={`/stay/${stay.id}?${qs}`} className="btn-primary mt-4 w-full">
          See availability
        </Link>
      </div>
    </article>
  );
}
