"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { datesInclusive, formatDay } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { airportLabelOf, airportPickupTitle, taxisFor, tripTitle, type PackageTaxi, type PilgrimCountry, type TaxiPick } from "@/lib/package-plan";
import { airportForCity } from "@/lib/pilgrim";
import { ChevronIcon } from "@/components/icons";
import { ZoomableImage } from "@/components/ZoomableImage";
import { TaxiPhotos, taxiCarPhotos } from "@/components/TaxiPhotos";

function routeKey(t: PackageTaxi) {
  return `${t.origin.trim().toLowerCase()}→${t.destination.trim().toLowerCase()}`;
}

function newSlotId() {
  return `trip-${Math.random().toString(36).slice(2, 10)}`;
}

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
      plan: `On arrival we drop you at ${hotel}. One taxi listing covers every hotel in this city.`,
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

function Stage({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] ${active ? "text-sand" : "text-mist"}`}>
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
          active ? "bg-flame text-ink" : done ? "bg-flame/20 text-sand" : "bg-sand/5 text-mist"
        }`}
      >
        {done && !active ? "✓" : n}
      </span>
      {label}
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
      <p className="mt-1 max-w-xl text-sm text-mist">{blurb}</p>

      {mine.length > 0 && (
        <ul className="mt-4 space-y-2">
          {mine.map((p) => {
            const t = items.find((x) => x.id === p.id);
            if (!t) return null;
            return (
              <li key={p.slotId} className={`${card} flex items-center gap-3 p-3`}>
                <TaxiPhotos
                  driver={t.driver}
                  driverPhoto={t.driverPhoto}
                  vehicle={t.vehicle}
                  vehiclePhoto={t.vehiclePhoto}
                  vehiclePhotos={t.vehiclePhotos}
                  cover={t.cover}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display truncate text-lg leading-tight">
                    {airport && stayName ? airportPickupTitle(t, stayName, p.leg === "out" ? "out" : "in") : tripTitle(t)}
                  </p>
                  <p className="text-sm text-mist">
                    {formatDay(p.date)} · {t.driver} · {t.vehicle}
                  </p>
                </div>
                <p className="text-sm text-sand">{money(t.privateRate)}</p>
                <button type="button" className="text-xs text-mist underline" onClick={() => setMine(mine.filter((x) => x.slotId !== p.slotId))}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div className={`${card} mt-5 p-4 md:p-5`}>
          <ol className="flex flex-wrap gap-5">
            <Stage n={1} label="Trip" active={draft === "route"} done={Boolean(route)} />
            <Stage n={2} label="Date" active={draft === "date"} done={draft === "vehicle"} />
            <Stage n={3} label="Vehicle" active={draft === "vehicle"} done={false} />
          </ol>

          {draft === "route" && (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-mist">Choose one trip. You will pick a date and vehicle next.</p>
              {routes.map((r) => (
                <article key={r.key} className={nest}>
                  <div className="flex flex-wrap gap-3">
                    {r.drivers[0] ? (
                      <TaxiPhotos
                        driver={r.drivers[0].driver}
                        driverPhoto={r.drivers[0].driverPhoto}
                        vehicle={r.drivers[0].vehicle}
                        vehiclePhoto={r.drivers[0].vehiclePhoto}
                        vehiclePhotos={r.drivers[0].vehiclePhotos}
                        cover={r.cover}
                        size="lg"
                      />
                    ) : (
                      <div className="relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-xl">
                        <Image src={r.cover} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg leading-tight">{r.title}</p>
                      <p className="mt-1 text-sm text-mist">
                        {r.drivers.length} vehicle{r.drivers.length === 1 ? "" : "s"} · from {money(r.from)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <MoreInfo open={infoRoute === r.key} onToggle={() => setInfoRoute(infoRoute === r.key ? null : r.key)}>
                          {r.hours ? <p>{r.hours}</p> : null}
                          <p className="mt-1">{r.plan || "Stops confirmed with the driver."}</p>
                        </MoreInfo>
                        {r.drivers[0] ? (
                          <Link
                            href={`/taxis/${r.drivers[0].id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-mist underline hover:text-sand"
                          >
                            View details
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-primary self-start rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.12em]"
                      onClick={() => {
                        setRouteId(r.key);
                        setDate(suggestedDay(r.leg ?? airportLeg));
                        setPendingDate(null);
                        setDraft("date");
                      }}
                    >
                      Select
                    </button>
                  </div>
                </article>
              ))}
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
                  ? (route.leg ?? airportLeg) === "out"
                    ? `Drop-off defaults to your last day (${formatDay(lastDay)}).`
                    : `Pick-up defaults to your first day (${formatDay(firstDay)}).`
                  : "Pick a day during your hotel stay."}
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
              <button type="button" className="btn-primary mt-4 rounded-full" disabled={!date || Boolean(pendingDate)} onClick={() => setDraft("vehicle")}>
                Continue to vehicles
              </button>
            </div>
          )}

          {draft === "vehicle" && route && (
            <div className="mt-5">
              <button type="button" className="text-sm text-mist" onClick={() => setDraft("date")}>
                ← Change date
              </button>
              <p className="font-display mt-2 text-2xl">{route.title}</p>
              <p className="text-sm text-mist">{formatDay(date)} · choose one private car</p>
              <div className="mt-3 space-y-3">
                {route.drivers.map((t) => (
                  <article key={t.id} className={nest}>
                    <div className="flex flex-wrap gap-3">
                      <TaxiPhotos
                        driver={t.driver}
                        driverPhoto={t.driverPhoto}
                        vehicle={t.vehicle}
                        vehiclePhoto={t.vehiclePhoto}
                        vehiclePhotos={t.vehiclePhotos}
                        cover={t.cover}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1">
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
                        className="btn-primary self-start rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.12em]"
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
        <button type="button" className="btn-ghost mt-4 w-full rounded-2xl py-3.5 text-sm" onClick={begin}>
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
  const items = useMemo(() => {
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
  return (
    <TripComposer
      title={title || (airportLeg === "in" ? "Airport pick up" : airportLeg === "out" ? "Airport drop off" : "Airport transfer")}
      blurb={
        blurb ||
        (airportLeg === "in"
          ? `On arrival we pick you up and drop you at ${stayName}.`
          : airportLeg === "out"
            ? `Back to airport from ${stayName}.`
            : `One taxi for ${city} covers every hotel. Arrival drops you at ${stayName}; departure picks you up there.`)
      }
      addLabel={airportLeg === "out" ? "Add another drop off" : airportLeg === "in" ? "Add another pick up" : "Add another transfer"}
      items={items}
      picks={picks}
      start={start}
      end={end}
      onChange={onChange}
      empty="No airport cars listed for this city yet. Partners add one transfer taxi per city."
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
        "Add one ziyarat at a time. Choose the trip, the day it should run, then the driver and vehicle. If the trip ends in another city, we will ask whether you need a hotel there."
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
