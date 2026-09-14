"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSerai } from "@/lib/store";
import { kindPath } from "@/lib/marketplace";
import { listingToTaxi, tripTitle, type PackageTaxi } from "@/lib/package-plan";
import { pilgrimCountries, pilgrimCountryForPlace, type PilgrimCountry } from "@/lib/pilgrim";
import { PageLoader } from "@/components/PageLoader";
import { StarIcon } from "@/components/StarIcon";
import { readJson } from "@/lib/readJson";
import { TaxiPhotos } from "@/components/TaxiPhotos";

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

export function TaxiCatalog() {
  const { money } = useSerai();
  const [items, setItems] = useState<Listing[]>([]);
  const [ready, setReady] = useState(false);
  const [country, setCountry] = useState<PilgrimCountry | "all">("all");
  const [from, setFrom] = useState("all");
  const [to, setTo] = useState("all");
  const [service, setService] = useState<"all" | "airport" | "ziyarat">("all");

  useEffect(() => {
    fetch("/api/listings?kind=TAXI", { cache: "no-store" })
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

  const withTaxi = useMemo(() => items.map((item) => ({ item, taxi: listingToTaxi(item) })), [items]);

  const fromOptions = useMemo(() => {
    const scoped = country === "all" ? withTaxi : withTaxi.filter((x) => x.taxi.country === country);
    return Array.from(new Set(scoped.map((x) => x.taxi.origin))).sort();
  }, [withTaxi, country]);

  const toOptions = useMemo(() => {
    const scoped = country === "all" ? withTaxi : withTaxi.filter((x) => x.taxi.country === country);
    return Array.from(new Set(scoped.map((x) => x.taxi.destination))).sort();
  }, [withTaxi, country]);

  const filtered = useMemo(() => {
    return withTaxi.filter(({ taxi }) => {
      if (country !== "all" && taxi.country !== country) return false;
      if (from !== "all" && taxi.origin !== from) return false;
      if (to !== "all" && taxi.destination !== to) return false;
      if (service !== "all" && taxi.service !== service) return false;
      return true;
    });
  }, [withTaxi, country, from, to, service]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <p className="font-urdu text-brass">کرایہ</p>
      <h1 className="font-display mt-1 text-3xl">Taxis</h1>
      <p className="mt-1.5 max-w-xl text-sm text-mist">
        Pick a trip with a real itinerary. Rate is per person first; private books the whole vehicle.
      </p>

      <div className="mt-5 rounded-2xl border border-brass/30 bg-ink-2/70 p-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-brass">Filter routes</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="filter-chip" data-on={country === "all"} onClick={() => { setCountry("all"); setFrom("all"); setTo("all"); }}>
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
                setFrom("all");
                setTo("all");
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
            From
            <select
              className="mt-1 w-full rounded-xl bg-ink/30 px-3 py-2 text-sm text-sand outline-none ring-1 ring-sand/[0.08]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              <option value="all">Any city</option>
              {fromOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
            To
            <select
              className="mt-1 w-full rounded-xl bg-ink/30 px-3 py-2 text-sm text-sand outline-none ring-1 ring-sand/[0.08]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              <option value="all">Any city</option>
              {toOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
            Service
            <select
              className="mt-1 w-full rounded-xl bg-ink/30 px-3 py-2 text-sm text-sand outline-none ring-1 ring-sand/[0.08]"
              value={service}
              onChange={(e) => setService(e.target.value as "all" | "airport" | "ziyarat")}
            >
              <option value="all">Airport & day trips</option>
              <option value="airport">Airport transfer</option>
              <option value="ziyarat">Day trip</option>
            </select>
          </label>
        </div>
      </div>

      {!ready ? (
        <PageLoader compact label="Loading trips" />
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-mist">No trips match these filters.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ item, taxi }) => (
            <TaxiCard key={item.id} item={item} taxi={taxi} money={money} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaxiCard({
  item,
  taxi,
  money,
}: {
  item: Listing;
  taxi: PackageTaxi;
  money: (n: number) => string;
}) {
  const countryName = pilgrimCountryForPlace(item.city, item.region);
  return (
    <Link
      href={`/${kindPath.TAXI}/${item.slug}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-brass/20 bg-ink-2 transition-colors hover:border-brass/40"
    >
      <div className="relative h-36">
        <Image src={item.cover || "/images/hero-hunza-dusk.png"} alt={item.name} fill className="object-cover" />
        {countryName && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-sand backdrop-blur">
            {countryName}
          </span>
        )}
        <span className="absolute right-2.5 top-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-brass backdrop-blur">
          {taxi.service === "airport" ? "Airport" : "Day trip"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {item.nastaliq && <p className="font-urdu text-xs text-brass">{item.nastaliq}</p>}
        <h2 className="font-display mt-0.5 text-xl leading-tight">{tripTitle(taxi)}</h2>
        <p className="mt-1 text-sm text-mist">
          {taxi.origin} → {taxi.destination} · {taxi.hours}
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink/25 px-2.5 py-2">
          <TaxiPhotos
            driver={taxi.driver}
            driverPhoto={taxi.driverPhoto}
            vehicle={taxi.vehicle}
            vehiclePhoto={taxi.vehiclePhoto}
            vehiclePhotos={taxi.vehiclePhotos}
            cover={taxi.cover}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-sand">{taxi.driver}</p>
            <p className="truncate text-[11px] text-mist">{taxi.vehicle}</p>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className="font-display text-lg leading-none">
              {money(taxi.ratePerPerson)} <span className="text-xs font-sans font-normal text-mist">/ person</span>
            </p>
            <p className="mt-1 text-xs text-mist">Private {money(taxi.privateRate)}</p>
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
