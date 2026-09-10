"use client";

import Image from "next/image";
import Link from "next/link";
import type { Stay } from "@/lib/types";
import { useSerai } from "@/lib/store";

export function StayCard({ stay }: { stay: Stay }) {
  const { wishlist, toggleWish, search, money } = useSerai();
  const qs = new URLSearchParams({
    checkin: search.checkin,
    checkout: search.checkout,
    guests: String(search.guests),
  });

  return (
    <article className="paper group overflow-hidden">
      <div className="relative aspect-[16/10]">
        <Image src={stay.cover} alt={stay.name} fill className="object-cover transition duration-700 group-hover:scale-105" />
        <button
          type="button"
          onClick={() => toggleWish(stay.id)}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-ink/50 text-sand"
          aria-label="Save"
        >
          {wishlist.includes(stay.id) ? "♥" : "♡"}
        </button>
        <span className="absolute bottom-3 left-3 bg-ink/70 px-2 py-1 text-[10px] uppercase tracking-widest text-brass">
          {stay.climate}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/stay/${stay.id}?${qs}`} className="font-display text-2xl leading-tight hover:text-flame">
              {stay.name}
            </Link>
            <p className="font-urdu mt-1 text-sm text-brass">{stay.nastaliq}</p>
            <p className="mt-1 text-sm text-ink/60">
              {stay.city}, {stay.region}
            </p>
          </div>
          <p className="font-display text-lg">{money(stay.price)}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {stay.vibes.map((v) => (
            <span key={v} className="rounded-full bg-ink/[0.04] px-2.5 py-0.5 text-[11px] text-ink/70">
              {v}
            </span>
          ))}
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-ink/70">“{stay.stories[0]?.body}”</p>
        <p className="mt-3 text-[11px] uppercase tracking-widest text-sage">Story score {stay.storyScore}</p>
      </div>
    </article>
  );
}
