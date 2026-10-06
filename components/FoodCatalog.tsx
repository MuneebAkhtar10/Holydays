"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSerai } from "@/lib/store";
import { kindPath, unitLabel } from "@/lib/marketplace";
import { pilgrimCountries, pilgrimCountryForPlace, pilgrimCountryName, type PilgrimCountry } from "@/lib/pilgrim";
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

export function FoodCatalog() {
  const { money } = useSerai();
  const [items, setItems] = useState<Listing[]>([]);
  const [ready, setReady] = useState(false);
  const [country, setCountry] = useState<PilgrimCountry | "all">("all");
  const [city, setCity] = useState("all");
  const [unit, setUnit] = useState("all");
  const [sort, setSort] = useState<"default" | "low" | "high">("default");

  useEffect(() => {
    fetch("/api/listings?kind=RESTAURANT", { cache: "no-store" })
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

  const withCountry = useMemo(
    () => items.map((item) => ({ item, country: pilgrimCountryForPlace(item.city, item.region) })),
    [items],
  );
  const scoped = useMemo(
    () => (country === "all" ? withCountry : withCountry.filter((x) => x.country === country)),
    [withCountry, country],
  );
  const cityOptions = useMemo(() => Array.from(new Set(scoped.map((x) => x.item.city))).sort(), [scoped]);
  const unitOptions = useMemo(() => Array.from(new Set(items.map((i) => i.priceUnit))).sort(), [items]);

  const filtered = useMemo(() => {
    const rows = withCountry.filter(({ item, country: c }) => {
      if (country !== "all" && c !== country) return false;
      if (city !== "all" && item.city !== city) return false;
      if (unit !== "all" && item.priceUnit !== unit) return false;
      return true;
    });
    if (sort === "low") return [...rows].sort((a, b) => a.item.price - b.item.price);
    if (sort === "high") return [...rows].sort((a, b) => b.item.price - a.item.price);
    return rows;
  }, [withCountry, country, city, unit, sort]);

  const selectClass = "mt-1 w-full rounded-xl bg-ink/30 px-3 py-2 text-sm text-sand outline-none ring-1 ring-sand/[0.08]";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <p className="font-urdu text-brass">کھانا</p>
      <h1 className="font-display mt-1 text-3xl">Food</h1>
      <p className="mt-1.5 max-w-xl text-sm text-mist">
        Meals near the haram. Book food for your Ziyarat days, charged per meal or per person.
      </p>

      <div className="mt-5 rounded-2xl border border-brass/30 bg-ink-2/70 p-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-brass">Filter meals</p>
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
            Charged
            <select className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="all">Per meal or person</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  Per {unitLabel[u] ?? u}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
            Sort
            <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as "default" | "low" | "high")}>
              <option value="default">Featured</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </label>
        </div>
      </div>

      {!ready ? (
        <PageLoader compact label="Loading meals" />
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-mist">No meals match these filters.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ item, country: c }) => (
            <FoodCard key={item.id} item={item} country={c} money={money} />
          ))}
        </div>
      )}
    </div>
  );
}

function FoodCard({
  item,
  country,
  money,
}: {
  item: Listing;
  country: PilgrimCountry | null;
  money: (n: number) => string;
}) {
  return (
    <Link
      href={`/${kindPath.RESTAURANT}/${item.slug}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-brass/20 bg-ink-2 transition-colors hover:border-brass/40"
    >
      <div className="relative h-36">
        <Image src={item.cover || "/images/hero-hunza-dusk.png"} alt={item.name} fill className="object-cover" />
        {country && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-sand backdrop-blur">
            {pilgrimCountryName(country)}
          </span>
        )}
        <span className="absolute right-2.5 top-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-brass backdrop-blur">
          Per {unitLabel[item.priceUnit] ?? item.priceUnit}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {item.nastaliq && <p className="font-urdu text-xs text-brass">{item.nastaliq}</p>}
        <h2 className="font-display mt-0.5 text-xl leading-tight">{item.name}</h2>
        <p className="mt-1 text-sm text-mist">
          {item.city}
          {country ? ` · ${pilgrimCountryName(country)}` : item.region ? ` · ${item.region}` : ""}
        </p>
        {item.description && <p className="mt-2 line-clamp-2 text-sm text-sand/80">{item.description}</p>}

        <div className="mt-auto flex items-end justify-between pt-3">
          <p className="font-display text-lg leading-none">
            {money(item.price)}{" "}
            <span className="text-xs font-sans font-normal text-mist">/ {unitLabel[item.priceUnit] ?? item.priceUnit}</span>
          </p>
          <p className="flex items-center gap-1 text-xs text-mist">
            <StarIcon className="h-3.5 w-3.5 text-brass" />
            {(item.reviewCount ?? 0) > 0 ? `${item.reviewAvg} · ${item.reviewCount}` : "New"}
          </p>
        </div>
      </div>
    </Link>
  );
}
