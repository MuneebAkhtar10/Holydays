"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSerai } from "@/lib/store";
import { kindPath } from "@/lib/marketplace";
import { listingToZiyarat, type ZiyaratStop } from "@/lib/package-plan";
import { pilgrimCountries, pilgrimCountryName, type PilgrimCountry } from "@/lib/pilgrim";
import { PageLoader } from "@/components/PageLoader";
import { StarIcon } from "@/components/StarIcon";
import { readJson } from "@/lib/readJson";

type Listing = {
  id: string;
  slug: string;
  name: string;
  nastaliq: string;
  city: string;
  region: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  reviewAvg?: number;
  reviewCount?: number;
  meta?: unknown;
};

export function ZiyaratCatalog() {
  const { money } = useSerai();
  const [items, setItems] = useState<Listing[]>([]);
  const [ready, setReady] = useState(false);
  const [country, setCountry] = useState<PilgrimCountry | "all">("all");
  const [city, setCity] = useState("all");
  const [duration, setDuration] = useState("all");
  const [entry, setEntry] = useState<"all" | "free" | "paid">("all");

  useEffect(() => {
    fetch("/api/listings?kind=ATTRACTION", { cache: "no-store" })
      .then((r) => readJson<Listing[]>(r))
      .then((d) => {
        setItems(Array.isArray(d) ? d : []);
        setReady(true);
      })
      .catch(() => {
        setItems([]);
        setReady(true);
      });
  }, []);

  const withStop = useMemo(() => items.map((item) => ({ item, stop: listingToZiyarat(item) })), [items]);

  const scoped = useMemo(
    () => (country === "all" ? withStop : withStop.filter((x) => x.stop.country === country)),
    [withStop, country],
  );
  const cityOptions = useMemo(() => Array.from(new Set(scoped.map((x) => x.stop.city))).sort(), [scoped]);
  const durationOptions = useMemo(() => Array.from(new Set(withStop.map((x) => x.stop.hours))).sort(), [withStop]);

  const filtered = useMemo(
    () =>
      withStop.filter(({ stop }) => {
        if (country !== "all" && stop.country !== country) return false;
        if (city !== "all" && stop.city !== city) return false;
        if (duration !== "all" && stop.hours !== duration) return false;
        if (entry === "free" && stop.price > 0) return false;
        if (entry === "paid" && stop.price <= 0) return false;
        return true;
      }),
    [withStop, country, city, duration, entry],
  );

  const selectClass = "mt-1 w-full rounded-xl bg-ink/30 px-3 py-2 text-sm text-sand outline-none ring-1 ring-sand/[0.08]";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <p className="font-urdu text-brass">زیارت</p>
      <h1 className="font-display mt-1 text-3xl">Ziyarat</h1>
      <p className="mt-1.5 max-w-xl text-sm text-mist">
        Shrine plans for Saudi Arabia, Iraq, and Iran. Pick a visit and it folds into your hotel package at checkout.
      </p>

      <div className="mt-5 rounded-2xl border border-brass/30 bg-ink-2/70 p-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-brass">Filter visits</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="filter-chip"
            data-on={country === "all"}
            onClick={() => {
              setCountry("all");
              setCity("all");
            }}
          >
            All countries
          </button>
          {pilgrimCountries.map((c) => (
            <button
              key={c.code}
              type="button"
              className="filter-chip"
              data-on={country === c.code}
              onClick={() => {
                setCountry(c.code);
                setCity("all");
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
            City
            <select className={selectClass} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="all">Any city</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
            Duration
            <select className={selectClass} value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="all">Any length</option>
              {durationOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
            Entry
            <select className={selectClass} value={entry} onChange={(e) => setEntry(e.target.value as "all" | "free" | "paid")}>
              <option value="all">Free & guided</option>
              <option value="free">Free entry</option>
              <option value="paid">Guided / paid</option>
            </select>
          </label>
        </div>
      </div>

      {!ready ? (
        <PageLoader compact label="Loading visits" />
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-mist">No visits match these filters.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ item, stop }) => (
            <ZiyaratCard key={item.id} item={item} stop={stop} money={money} />
          ))}
        </div>
      )}
    </div>
  );
}

function ZiyaratCard({
  item,
  stop,
  money,
}: {
  item: Listing;
  stop: ZiyaratStop;
  money: (n: number) => string;
}) {
  const free = stop.price <= 0;
  return (
    <Link
      href={`/${kindPath.ATTRACTION}/${item.slug}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-brass/20 bg-ink-2 transition-colors hover:border-brass/40"
    >
      <div className="relative h-36">
        <Image src={item.cover || "/images/hero-hunza-dusk.png"} alt={item.name} fill className="object-cover" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-sand backdrop-blur">
          {pilgrimCountryName(stop.country)}
        </span>
        <span className="absolute right-2.5 top-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-brass backdrop-blur">
          {stop.hours}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {item.nastaliq && <p className="font-urdu text-xs text-brass">{item.nastaliq}</p>}
        <h2 className="font-display mt-0.5 text-xl leading-tight">{item.name}</h2>
        <p className="mt-1 text-sm text-mist">
          {stop.city} · {pilgrimCountryName(stop.country)}
        </p>
        {item.description && <p className="mt-2 line-clamp-2 text-sm text-sand/80">{item.description}</p>}

        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            {free ? (
              <p className="font-display text-lg leading-none">Free entry</p>
            ) : (
              <p className="font-display text-lg leading-none">
                {money(stop.price)} <span className="text-xs font-sans font-normal text-mist">/ person</span>
              </p>
            )}
            <p className="mt-1 text-xs text-mist">{free ? "Walking plan included" : "Guided visit"}</p>
          </div>
          <p className="flex items-center gap-1 text-xs text-mist">
            <StarIcon className="h-3.5 w-3.5 text-brass" />
            {(item.reviewCount ?? 0) > 0 ? `${item.reviewAvg} · ${item.reviewCount}` : "New"}
          </p>
        </div>
      </div>
    </Link>
  );
}
