"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { datesInclusive, formatDay, formatTime } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { airportLabelOf, airportPickupTitle, taxisFor, tripTitle, type PackageTaxi, type PilgrimCountry, type TaxiPick } from "@/lib/package-plan";
import { airportForCity, pilgrimAirports } from "@/lib/pilgrim";
import { CheckIcon, ChevronIcon, PlusIcon } from "@/components/icons";
import { ZoomableImage } from "@/components/ZoomableImage";
import { TaxiPhotos, taxiCarPhotos } from "@/components/TaxiPhotos";

function routeKey(t: PackageTaxi) {
  return `${t.origin.trim().toLowerCase()}→${t.destination.trim().toLowerCase()}`;
}

function newSlotId() {
  return `trip-${Math.random().toString(36).slice(2, 10)}`;
}

/** Half-hour times for airport pick-ups and drop-offs, the whole day. */
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

type RouteGroup = {
  key: string;
  title: string;
  cover: string;
  plan: string;
  from: number;
  hours: string;
  drivers: PackageTaxi[];
  leg?: "in" | "out";
};

function groupAirportRoutes(items: PackageTaxi[], hotel: string): RouteGroup[] {
  const byAir = new Map<string, PackageTaxi[]>();
  for (const t of items) {
    const air = airportLabelOf(t);
    const list = byAir.get(air) ?? [];
    list.push(t);
    byAir.set(air, list);
  }
  const groups: RouteGroup[] = [];
  for (const [air, drivers] of byAir) {
    const from = Math.min(...drivers.map((d) => d.privateRate));
    const cover = drivers[0]?.cover ?? "";
    groups.push({
      key: `in::${air}`,
      title: `${air} → ${hotel}`,
      cover,
      plan: `On arrival we drop you at ${hotel}.`,
      from,
      hours: "Airport pickup",
      drivers,
      leg: "in",
    });
    groups.push({
      key: `out::${air}`,
      title: `${hotel} → ${air}`,
      cover,
      plan: `On departure we pick you up at ${hotel}.`,
      from,
      hours: "Airport drop",
      drivers,
      leg: "out",
    });
  }
  return groups;
}

function groupRoutes(items: PackageTaxi[]): RouteGroup[] {
  const map = new Map<string, RouteGroup>();
  for (const t of items) {
    const key = routeKey(t);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        title: tripTitle(t),
        cover: t.cover,
        plan: t.itinerary.map((s) => s.place).join(" → "),
        from: t.privateRate,
        hours: t.hours,
        drivers: [t],
      });
      continue;
    }
    existing.drivers.push(t);
    existing.from = Math.min(existing.from, t.privateRate);
  }
  return [...map.values()];
}

function Stage({ n, label, active, done, last }: { n: number; label: string; active: boolean; done: boolean; last?: boolean }) {
  return (
    <li className={`flex flex-1 items-center gap-2 text-[11px] uppercase tracking-[0.12em] ${active ? "text-sand" : "text-mist"}`}>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          active ? "bg-flame text-ink" : done ? "bg-flame/25 text-sand" : "bg-sand/[0.06] text-mist"
        }`}
      >
        {done && !active ? <CheckIcon className="h-3 w-3" /> : n}
      </span>
      <span className="whitespace-nowrap">{label}</span>
      {!last ? <span className={`hidden h-px flex-1 sm:block ${done ? "bg-flame/30" : "bg-sand/10"}`} /> : null}
    </li>
  );
}

function MoreInfo({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <button type="button" className="inline-flex items-center gap-1.5 rounded-full py-1 text-xs text-mist hover:text-sand" onClick={onToggle}>
        More info
        <ChevronIcon open={open} className="h-3.5 w-3.5" />
      </button>
      {open ? <div className="mt-2 text-xs leading-relaxed text-mist">{children}</div> : null}
    </div>
  );
}

const card = "pane overflow-hidden";
const nest = "inset-card";

function TripComposer({
  title,
  blurb,
  addLabel,
  items,
  picks,
  start,
  end,
  onChange,
  empty,
  stayName,
  airport,
  airportLeg,
  onAdded,
  beforeList,
}: {
  title: string;
  blurb: string;
  addLabel: string;
  items: PackageTaxi[];
  picks: TaxiPick[];
  start: string;
  end: string;
  onChange: (next: TaxiPick[]) => void;
  empty: string;
  stayName?: string;
  airport?: boolean;
  airportLeg?: "in" | "out";
  onAdded?: (taxi: PackageTaxi, pick: TaxiPick) => void;
  /** Rendered under the blurb, above the list — used for the airport picker. */
  beforeList?: ReactNode;
}) {
  const { money } = useSerai();
  const routes = useMemo(() => {
    const all = airport && stayName ? groupAirportRoutes(items, stayName) : groupRoutes(items);
    if (!airportLeg) return all;
    return all.filter((r) => r.leg === airportLeg);
  }, [airport, airportLeg, items, stayName]);
  const days = useMemo(() => datesInclusive(start, end), [start, end]);
  const mine = picks.filter((p) => {
    if (!items.some((t) => t.id === p.id)) return false;
    if (!airportLeg) return true;
    return (p.leg ?? "in") === airportLeg;
  });
  const others = picks.filter((p) => !mine.some((m) => m.slotId === p.slotId));
  const [draft, setDraft] = useState<"route" | "date" | "vehicle" | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [date, setDate] = useState(start);
  const [infoRoute, setInfoRoute] = useState<string | null>(null);
  const [infoCar, setInfoCar] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [time, setTime] = useState("");

  const firstDay = days[0] || start;
  const lastDay = days[days.length - 1] || end;
  const suggestedDay = (leg?: "in" | "out") => (leg === "out" ? lastDay : firstDay);
  const route = routes.find((r) => r.key === routeId) ?? null;
  const setMine = (next: TaxiPick[]) => onChange([...others, ...next]);
  const defaultDay = suggestedDay(route?.leg ?? airportLeg);

  const begin = () => {
    setRouteId(null);
    setDate(suggestedDay(airportLeg));
    setPendingDate(null);
    setTime("");
    setInfoRoute(null);
    setInfoCar(null);
    setDraft("route");
  };

  const pickAirportDate = (next: string) => {
    if (!airport || next === defaultDay) {
      setDate(next);
      return;
    }
    setPendingDate(next);
  };

  const confirmVehicle = (t: PackageTaxi) => {
    const pick: TaxiPick = {
      slotId: newSlotId(),
      id: t.id,
      seats: t.seats,
      mode: "private",
      date: date || start,
      time: airport && time ? time : undefined,
      leg: route?.leg ?? airportLeg,
      hotelName: stayName,
    };
    setMine([...mine, pick]);
    onAdded?.(t, pick);
    setDraft(null);
    setRouteId(null);
    setInfoCar(null);
  };

  if (items.length === 0) {
    return (
      <div className="mt-4">
        <h2 className="font-display text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-mist">{empty}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-[0.28em] text-brass">Private car</p>
      <h2 className="font-display mt-1 text-3xl">{title}</h2>
      {blurb ? <p className="mt-1 max-w-xl text-sm text-mist">{blurb}</p> : null}

      {beforeList}

      {mine.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {mine.map((p) => {
            const t = items.find((x) => x.id === p.id);
            if (!t) return null;
            return (
              <li key={p.slotId} className={`${card} flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:flex-nowrap`}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                <TaxiPhotos
                  driver={t.driver}
                  driverPhoto={t.driverPhoto}
                  vehicle={t.vehicle}
                  vehiclePhoto={t.vehiclePhoto}
                  vehiclePhotos={t.vehiclePhotos}
                  cover={t.cover}
                  size="sm"
                />
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <p className="font-display truncate text-lg leading-tight">
                    {airport && stayName ? airportPickupTitle(t, stayName, p.leg === "out" ? "out" : "in") : tripTitle(t)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-mist">
                    <span className="font-semibold text-sand">
                      {formatDay(p.date)}
                      {p.time ? ` · ${formatTime(p.time)}` : ""}
                    </span>
                    <span className="text-brass/50">·</span>
                    <span className="truncate">
                      {t.driver} · {t.vehicle}
                    </span>
                  </p>
                </div>
                <p className="ml-auto shrink-0 font-display text-lg leading-none text-sand sm:ml-0">{money(t.privateRate)}</p>
                <button
                  type="button"
                  aria-label="Remove this trip"
                  title="Remove this trip"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-mist ring-1 ring-sand/15 transition-colors hover:bg-rose/15 hover:text-rose hover:ring-rose/40"
                  onClick={() => setMine(mine.filter((x) => x.slotId !== p.slotId))}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div className={`${card} mt-5 p-4 md:p-5`}>
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Stage n={1} label={airport ? "Route" : "Trip"} active={draft === "route"} done={Boolean(route)} />
            <Stage n={2} label={airport ? "Day & time" : "Date"} active={draft === "date"} done={draft === "vehicle"} />
            <Stage n={3} label="Vehicle" active={draft === "vehicle"} done={false} last />
          </ol>

          {draft === "route" && (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-mist">Pick a route, then a day and a car.</p>
              {routes.map((r) => {
                const shot = r.drivers[0] ? taxiCarPhotos(r.drivers[0])[0] : r.cover;
                const choose = () => {
                  setRouteId(r.key);
                  setDate(suggestedDay(r.leg ?? airportLeg));
                  setPendingDate(null);
                  setDraft("date");
                };
                return (
                  <article
                    key={r.key}
                    className={`${nest} group transition-colors hover:border-brass/55 focus-within:border-brass/55`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* The vehicle, not the driver — the driver is chosen two steps later. */}
                      <div className="relative h-16 w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-ink/30 ring-1 ring-brass/20">
                        <Image src={shot || "/images/hero-hunza-dusk.png"} alt="" fill sizes="88px" className="object-cover" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg leading-snug">{r.title}</h3>
                        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="text-mist">from</span>
                          <span className="font-display text-xl leading-none text-sand">{money(r.from)}</span>
                          <span className="text-mist">
                            · {r.drivers.length} vehicle{r.drivers.length === 1 ? "" : "s"}
                          </span>
                        </p>
                        {r.hours ? (
                          <span className="mt-2 inline-flex rounded-full bg-sand/[0.07] px-2.5 py-1 text-[11px] font-semibold text-mist ring-1 ring-sand/10">
                            {r.hours}
                          </span>
                        ) : null}
                      </div>

                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-sand/[0.07] pt-2.5">
                      <MoreInfo open={infoRoute === r.key} onToggle={() => setInfoRoute(infoRoute === r.key ? null : r.key)}>
                        <p>{r.plan || "Stops confirmed with the driver."}</p>
                      </MoreInfo>
                      {r.drivers[0] ? (
                        <Link
                          href={`/taxis/${r.drivers[0].id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-mist underline decoration-brass/40 underline-offset-4 hover:text-sand"
                        >
                          View details
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="btn-primary ml-auto w-full justify-center rounded-full px-6 py-2 text-[11px] uppercase tracking-[0.12em] sm:w-auto"
                        onClick={choose}
                      >
                        Select
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {draft === "date" && route && (
            <div className="mt-5">
              <button type="button" className="text-sm text-mist" onClick={() => setDraft("route")}>
                ← Change trip
              </button>
              <p className="font-display mt-2 text-2xl">{route.title}</p>
              <p className="mt-1 text-sm text-mist">
                {airport
                  ? `Defaults to ${formatDay((route.leg ?? airportLeg) === "out" ? lastDay : firstDay)}.`
                  : "Pick a day during your stay."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm ${date === d ? "bg-flame text-ink" : "bg-ink text-sand ring-1 ring-brass/25"}`}
                    onClick={() => (airport ? pickAirportDate(d) : setDate(d))}
                  >
                    {formatDay(d)}
                  </button>
                ))}
              </div>
              {pendingDate ? (
                <div className="mt-4 rounded-2xl border border-brass/35 bg-ink p-4">
                  <p className="font-display text-xl">Change this date?</p>
                  <p className="mt-2 text-sm text-mist">
                    {(route.leg ?? airportLeg) === "out"
                      ? `Airport drop-off is usually ${formatDay(lastDay)}, the last day of your stay. Use ${formatDay(pendingDate)} instead?`
                      : `Airport pick-up is usually ${formatDay(firstDay)}, the first day of your stay. Use ${formatDay(pendingDate)} instead?`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary rounded-full"
                      onClick={() => {
                        setDate(pendingDate);
                        setPendingDate(null);
                      }}
                    >
                      Yes, use {formatDay(pendingDate)}
                    </button>
                    <button type="button" className="btn-ghost rounded-full" onClick={() => setPendingDate(null)}>
                      Keep {formatDay(defaultDay)}
                    </button>
                  </div>
                </div>
              ) : null}
              {airport && (
                <div className="mt-5 max-w-xs">
                  <label className="auth-label">
                    {(route.leg ?? airportLeg) === "out" ? "Pick-up time at your hotel" : "Pick-up time at the airport"}
                    <select className="auth-field" value={time} onChange={(e) => setTime(e.target.value)}>
                      <option value="">Select a time</option>
                      {TIME_SLOTS.map((t) => (
                        <option key={t} value={t}>
                          {formatTime(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-1 text-xs text-mist">
                    {(route.leg ?? airportLeg) === "out" ? "Allow time before your flight." : "Use your landing time — the driver waits at arrivals."}
                  </p>
                </div>
              )}
              <button
                type="button"
                className="btn-primary mt-4 rounded-full"
                disabled={!date || Boolean(pendingDate) || (airport && !time)}
                onClick={() => setDraft("vehicle")}
              >
                {airport && !time ? "Choose a time to continue" : "Continue to vehicles"}
              </button>
            </div>
          )}

          {draft === "vehicle" && route && (
            <div className="mt-5">
              <button type="button" className="text-sm text-mist" onClick={() => setDraft("date")}>
                ← Change date
              </button>
              <p className="font-display mt-2 text-2xl">{route.title}</p>
              <p className="text-sm text-mist">
                {formatDay(date)}
                {airport && time ? ` at ${formatTime(time)}` : ""} · choose one private car
              </p>
              <div className="mt-3 space-y-3">
                {route.drivers.map((t) => (
                  <article key={t.id} className={nest}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <TaxiPhotos
                        driver={t.driver}
                        driverPhoto={t.driverPhoto}
                        vehicle={t.vehicle}
                        vehiclePhoto={t.vehiclePhoto}
                        vehiclePhotos={t.vehiclePhotos}
                        cover={t.cover}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1 sm:min-w-[10rem]">
                        <p className="font-medium">{t.driver}</p>
                        <p className="text-sm text-mist">
                          {t.vehicle}
                          {t.model ? ` · ${t.model}` : ""}
                        </p>
                        <p className="mt-1 text-lg text-sand">{money(t.privateRate)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <MoreInfo open={infoCar === t.id} onToggle={() => setInfoCar(infoCar === t.id ? null : t.id)}>
                            <p>
                              {t.seats} seats · {t.hours || "Full day"}
                            </p>
                            <p className="mt-1">{t.itinerary.map((s) => s.place).join(" → ") || t.blurb}</p>
                            {taxiCarPhotos(t).slice(2).length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {taxiCarPhotos(t)
                                  .slice(2)
                                  .map((src) => (
                                    <ZoomableImage
                                      key={src}
                                      src={src}
                                      alt={t.vehicle}
                                      className="h-14 w-[5.5rem] overflow-hidden rounded-xl border border-brass/25 bg-ink/40"
                                    />
                                  ))}
                              </div>
                            ) : null}
                          </MoreInfo>
                          <Link href={`/taxis/${t.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-mist underline hover:text-sand">
                            View details
                          </Link>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-primary w-full rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.12em] sm:w-auto sm:self-start"
                        onClick={() => confirmVehicle(t)}
                      >
                        Use this car
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="mt-4 text-xs text-mist" onClick={() => setDraft(null)}>
            Cancel this trip
          </button>
        </div>
      )}

      {!draft && (
        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brass/35 bg-sand/[0.02] py-4 text-sm font-semibold text-sand transition-colors hover:border-brass/60 hover:bg-flame/[0.06]"
          onClick={begin}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-flame/20 text-brass">
            <PlusIcon className="h-3 w-3" />
          </span>
          {mine.length ? addLabel : "Choose a trip"}
        </button>
      )}
    </div>
  );
}

export function AirportTransferStep({
  country,
  city,
  cities,
  stayName,
  catalog,
  picks,
  start,
  end,
  onChange,
  airportLeg,
  title,
  blurb,
}: {
  country: PilgrimCountry | null;
  city: string;
  /** Other cities visited on this trip — airports serving any of them are offered too, not just `city`. */
  cities?: string[];
  stayName: string;
  catalog: PackageTaxi[];
  picks: TaxiPick[];
  start: string;
  end: string;
  onChange: (next: TaxiPick[]) => void;
  airportLeg?: "in" | "out";
  title?: string;
  blurb?: string;
}) {
  // Cars that already serve this trip's hotel cities
  const nearItems = useMemo(() => {
    const candidateCities = Array.from(new Set([city, ...(cities ?? [])].map((c) => c.trim()).filter(Boolean)));
    const needles = candidateCities.map((c) => c.toLowerCase());
    const airCities = candidateCities.map((c) => (country ? airportForCity(country, c).city : c).trim().toLowerCase());
    return taxisFor(catalog, country, city).filter((t) => {
      if (t.service !== "airport") return false;
      return (
        t.cities.some((c) => {
          const n = c.toLowerCase();
          return needles.includes(n) || airCities.includes(n);
        }) ||
        needles.some((n) => t.origin.toLowerCase().includes(n)) ||
        airCities.some((n) => t.origin.toLowerCase().includes(n)) ||
        needles.some((n) => airportLabelOf(t).toLowerCase().includes(n))
      );
    });
  }, [catalog, country, city, cities]);

  // The guest may land (or fly out) at a different airport than the hotel's city, e.g. land in Jeddah, stay in Madinah.
  const airports = useMemo(() => {
    const labels = country ? pilgrimAirports[country].map((a) => a.label) : [];
    for (const t of catalog) if (t.service === "airport" && (!country || t.country === country)) labels.push(airportLabelOf(t));
    return Array.from(new Set(labels)).map((label) => ({
      label,
      cars: catalog.filter((t) => t.service === "airport" && (!country || t.country === country) && airportLabelOf(t) === label),
    }));
  }, [catalog, country]);
  const [chosen, setChosen] = useState<string>("near");
  const firstWithCars = airports.find((a) => a.cars.length)?.label ?? "near";
  const active = chosen === "near" && !nearItems.length ? firstWithCars : chosen;
  const items = active === "near" ? nearItems : airports.find((a) => a.label === active)?.cars ?? [];
  const farAway = active !== "near" && !nearItems.some((t) => airportLabelOf(t) === active);
  const verb = airportLeg === "out" ? "Flying out from" : "Landing at";

  const options = [
    { id: "near", label: `Near ${city}`, count: nearItems.length },
    ...airports.map((a) => ({ id: a.label, label: a.label, count: a.cars.length })),
  ].filter((o) => o.id !== "near" || nearItems.length > 0);

  const picker = (
    <div className="mt-4 rounded-2xl border border-brass/30 bg-flame/[0.06] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brass">{verb}</p>
      <p className="mt-0.5 text-sm text-mist">
        {airportLeg === "out"
          ? "Choose the airport you fly out from. Cars are listed for each one."
          : "Choose the airport your flight arrives at. Cars are listed for each one."}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => {
          const on = active === o.id;
          const empty = o.count === 0;
          return (
            <button
              key={o.id}
              type="button"
              disabled={empty}
              aria-pressed={on}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                on
                  ? "border-flame bg-flame/20 text-sand shadow-[0_0_0_3px_rgba(197,164,106,0.14)]"
                  : empty
                    ? "cursor-not-allowed border-sand/10 bg-ink/10 text-mist/55"
                    : "border-brass/25 bg-ink/20 text-sand hover:border-brass/60 hover:bg-flame/10"
              }`}
              onClick={() => setChosen(o.id)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{o.label}</span>
                <span className={`block text-xs ${on ? "text-brass" : "text-mist"}`}>
                  {empty ? "No cars listed" : `${o.count} car${o.count === 1 ? "" : "s"}`}
                </span>
              </span>
              {on ? <CheckIcon className="h-4 w-4 shrink-0 text-brass" /> : null}
            </button>
          );
        })}
      </div>
      {farAway && (
        <p className="mt-3 rounded-xl border border-brass/25 bg-ink/25 px-3.5 py-2.5 text-sm text-sand">
          {airportLeg === "out"
            ? `You leave ${stayName} for ${active}.`
            : `You land at ${active} and are driven to ${stayName}.`}{" "}
          <span className="text-mist">A transfer between cities — the driver confirms the pick-up time after booking.</span>
        </p>
      )}
    </div>
  );

  return (
    <TripComposer
      key={active}
      beforeList={picker}
      title={title || (airportLeg === "in" ? "Airport pick up" : airportLeg === "out" ? "Airport drop off" : "Airport transfer")}
      blurb={blurb ?? ""}
      addLabel={airportLeg === "out" ? "Add another drop off" : airportLeg === "in" ? "Add another pick up" : "Add another transfer"}
      items={items}
      picks={picks}
      start={start}
      end={end}
      onChange={onChange}
      empty="No airport cars are listed for this country yet. Partners add transfer taxis for each airport."
      stayName={stayName}
      airport
      airportLeg={airportLeg}
    />
  );
}

export function DayTripsStep({
  country,
  city,
  catalog,
  picks,
  start,
  end,
  onChange,
  cities,
  onTripAdded,
  title,
  blurb,
}: {
  country: PilgrimCountry | null;
  city: string;
  catalog: PackageTaxi[];
  picks: TaxiPick[];
  start: string;
  end: string;
  onChange: (next: TaxiPick[]) => void;
  cities?: string[];
  onTripAdded?: (taxi: PackageTaxi, pick: TaxiPick) => void;
  title?: string;
  blurb?: string;
}) {
  const items = useMemo(
    () =>
      taxisFor(catalog, country, city).filter((t) => {
        if (t.service === "airport") return false;
        const from = (cities?.length ? cities : [city]).map((c) => c.trim().toLowerCase()).filter(Boolean);
        if (!from.length) return true;
        // Only trips that actually depart from one of our current cities — not ones that merely pass through.
        const origin = t.origin.trim().toLowerCase();
        return from.some((c) => origin === c || origin.includes(c));
      }),
    [catalog, country, city, cities],
  );
  return (
    <TripComposer
      title={title || "Day trips"}
      blurb={
        blurb ||
        "Add one visit at a time: the route, the day, then the car."
      }
      addLabel="Add another day trip"
      items={items}
      picks={picks}
      start={start}
      end={end}
      onChange={onChange}
      empty="No day-trip cars listed for this country yet."
      onAdded={onTripAdded}
    />
  );
}

export function ItineraryStep(props: {
  country: PilgrimCountry | null;
  city: string;
  catalog: PackageTaxi[];
  picks: TaxiPick[];
  start?: string;
  end?: string;
  party?: number;
  onChange: (next: TaxiPick[]) => void;
}) {
  return <DayTripsStep {...props} start={props.start ?? ""} end={props.end ?? ""} />;
}
