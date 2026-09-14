"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GoogleStayMap } from "@/components/GoogleStayMap";
import { SearchPass } from "@/components/SearchPass";
import { SearchFilters } from "@/components/SearchFilters";
import { StayResultCard } from "@/components/StayResultCard";
import { PinIcon, FilterIcon } from "@/components/icons";
import { PageLoader } from "@/components/PageLoader";
import { useSerai } from "@/lib/store";
import { countryByCode } from "@/lib/places";
import {
  SORT_OPTIONS,
  applyFilters,
  catalogStays,
  defaultFilters,
  type FilterState,
  type SearchStay,
  type SortKey,
} from "@/lib/search-index";
import { listingToSearchStay, type ListingCard } from "@/lib/listing-meta";
import { readJson } from "@/lib/readJson";

function SearchInner() {
  const params = useSearchParams();
  const { search, setSearch } = useSerai();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sort, setSort] = useState<SortKey>("rec");
  const [openFilters, setOpenFilters] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [live, setLive] = useState<SearchStay[]>([]);

  useEffect(() => {
    const children = Number(params.get("children") || 0);
    const ages = (params.get("ages") ?? "")
      .split(",")
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    const patch: Parameters<typeof setSearch>[0] = {
      q: params.get("q") ?? "",
      city: params.get("city") ?? "",
      country: params.get("country") ?? "",
      vibe: params.get("vibe") ?? "",
      landmark: params.get("landmark") ?? "",
      airport: params.get("airport") ?? "",
      rooms: Number(params.get("rooms") || 1),
      adults: Number(params.get("adults") || 2),
      children,
      childAges: ages.length ? ages : Array.from({ length: children }, () => 8),
    };
    const checkin = params.get("checkin");
    const checkout = params.get("checkout");
    if (checkin) patch.checkin = checkin;
    if (checkout) patch.checkout = checkout;
    setSearch(patch);
  }, [params, setSearch]);

  useEffect(() => {
    fetch("/api/listings?kind=STAY", { cache: "no-store" })
      .then((r) => readJson<ListingCard[]>(r))
      .then((d) => {
        const rows = Array.isArray(d) ? d : [];
        setLive(rows.map((l) => listingToSearchStay(l, search.checkin, search.checkout, {
          rooms: search.rooms || 1,
          adults: search.adults || 2,
          children: search.children || 0,
          childAges: search.childAges || [],
        })));
      })
      .catch(() => setLive([]));
  }, [search.checkin, search.checkout, search.rooms, search.adults, search.children, search.childAges]);

  const merged = useMemo(() => {
    const catalog = catalogStays(search.checkin, search.checkout, {
      rooms: search.rooms || 1,
      adults: search.adults || 2,
      children: search.children || 0,
      childAges: search.childAges || [],
    });
    return [...live.filter((s) => !catalog.some((c) => c.id === s.id)), ...catalog];
  }, [search, live]);
  const list = useMemo(() => applyFilters(merged, search, filters, sort), [merged, search, filters, sort]);
  const matchesIgnoringGuests = useMemo(
    () => applyFilters(merged, search, filters, sort, { ignoreCapacity: true }).length > 0,
    [merged, search, filters, sort],
  );

  const hasPlace = Boolean(search.city || search.q || search.landmark || search.airport);
  const place =
    search.landmark ||
    search.airport ||
    (search.city
      ? `${search.city}, ${countryByCode(search.country)?.name ?? search.country}`
      : hasPlace
        ? search.q || countryByCode(search.country)?.name || "Saudi Arabia, Iraq & Iran"
        : "Saudi Arabia, Iraq & Iran");

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8">
      <SearchPass compact />
      <div className="mt-8 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className={`h-fit rounded-2xl border border-brass/30 bg-ink-2/70 p-4 xl:sticky xl:top-24 ${openFilters ? "" : "hidden xl:block"}`}>
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-brass">
              <FilterIcon className="h-4 w-4" /> Filters
            </p>
            <button type="button" className="text-xs text-mist hover:text-sand" onClick={() => setFilters(defaultFilters())}>
              Reset
            </button>
          </div>
          <SearchFilters value={filters} onChange={setFilters} />
        </aside>

        <div>
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-sand">
                {list.length} {list.length === 1 ? "hotel" : "hotels"} in {place}
              </p>
              <p className="mt-1 text-xs text-mist">
                {search.rooms} room{search.rooms === 1 ? "" : "s"} · {search.adults} adult{search.adults === 1 ? "" : "s"}
                {search.children ? ` · ${search.children} children` : ""} · {search.checkin} → {search.checkout}
              </p>
            </div>
            <div className="flex h-11 shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-brass/35 bg-ink-2 px-4 text-sm text-sand xl:hidden"
                data-on={openFilters}
                onClick={() => setOpenFilters((v) => !v)}
              >
                <FilterIcon className="h-4 w-4" /> Filters
              </button>
              <label className="relative inline-flex h-11 min-w-[13rem] items-center">
                <span className="sr-only">Sort</span>
                <select
                  className="h-11 w-full appearance-none rounded-full border border-brass/35 bg-ink-2 pl-4 pr-10 text-sm text-sand outline-none focus:border-brass"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 text-mist" aria-hidden>
                  ▾
                </span>
              </label>
            </div>
          </div>

          {search.mapX != null || search.mapBounds ? (
            <p className="mb-4 text-sm text-brass">
              {search.mapBounds ? "Showing properties in the map area. " : "Sorted by map pin. "}
              <button
                type="button"
                className="underline"
                onClick={() => setSearch({ mapX: null, mapY: null, mapBounds: null })}
              >
                Clear map search
              </button>
            </p>
          ) : null}

          {list.length === 0 ? (
            <div className="rounded-2xl border border-brass/30 bg-ink-2 p-12">
              <p className="font-display text-3xl">No hotels match.</p>
              <p className="mt-2 text-mist">
                {matchesIgnoringGuests
                  ? `No room here fits ${search.adults + search.children} guest${search.adults + search.children === 1 ? "" : "s"} in ${search.rooms} room${search.rooms === 1 ? "" : "s"}. Try adding another room, or search with fewer guests.`
                  : search.country
                    ? `No hotels in ${countryByCode(search.country)?.name ?? "this country"} yet. Partners add them from the desk; admin approves.`
                    : "Widen the price, drop a filter, or pick another city."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((s) => (
                <StayResultCard
                  key={s.id}
                  stay={s}
                  active={hovered === s.id || picked === s.id}
                  onHover={setHovered}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] xl:block">
          <GoogleStayMap
            className="h-full"
            stays={list.map((s) => ({ id: s.id, name: s.name, city: s.city, address: s.address, lat: s.lat, lng: s.lng }))}
            active={picked ?? hovered ?? list[0]?.id}
            onSelect={(id) => {
              setPicked(id);
              document.getElementById(`stay-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        </aside>
      </div>

      <button
        type="button"
        className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-flame px-5 py-3 text-sm text-ink shadow-lg xl:hidden"
        onClick={() => setShowMap(true)}
      >
        <PinIcon className="h-4 w-4" /> Map
      </button>

      {showMap && (
        <div className="fixed inset-0 z-40 bg-ink xl:hidden">
          <button type="button" className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-bone px-4 py-2 text-sm text-ink" onClick={() => setShowMap(false)}>
            Show list
          </button>
          <GoogleStayMap
            className="h-full"
            stays={list.map((s) => ({ id: s.id, name: s.name, city: s.city, address: s.address, lat: s.lat, lng: s.lng }))}
            active={picked ?? hovered ?? list[0]?.id}
            onSelect={(id) => {
              setPicked(id);
              setShowMap(false);
              setTimeout(() => document.getElementById(`stay-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<PageLoader label="Unfolding the map" />}>
      <SearchInner />
    </Suspense>
  );
}
