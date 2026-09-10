"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointer } from "react";
import { LocateIcon, MinusIcon, PlusIcon, PinIcon } from "@/components/icons";
import { clusterCell, clusterItems, inPakistan, pinPrice, projectLatLng } from "@/lib/map-geo";
import { MAP_POIS } from "@/lib/map-places";
import { QUICK_CITIES, suggest, suggestionPatch, type Suggestion } from "@/lib/search-index";
import { useSerai } from "@/lib/store";
import type { Stay } from "@/lib/types";

export type MapStay = Stay & {
  start?: number;
  reviewAvg?: number;
  reviewCount?: number;
  airport?: string;
  airportKm?: number;
  landmark?: string;
  landmarkKm?: number;
  centerKm?: number;
};

function nightly(s: MapStay) {
  return s.start ?? s.price;
}

export function MapCanvas({
  stays,
  active,
  hovered,
  interactive = false,
  showPlaces = false,
  onHover,
  onSelect,
  onPlace,
  fitKey,
}: {
  stays: MapStay[];
  active?: string;
  hovered?: string;
  interactive?: boolean;
  showPlaces?: boolean;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  onPlace?: (item: Suggestion) => void;
  fitKey?: string;
}) {
  const { search, setSearch, money, currency } = useSerai();
  const searchCity = search.city;
  const root = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [size, setSize] = useState({ w: 380, h: 520 });
  const [preview, setPreview] = useState<string | null>(null);
  const [poiId, setPoiId] = useState<string | null>(null);
  const [you, setYou] = useState<{ x: number; y: number } | null>(null);
  const [locError, setLocError] = useState("");
  const [find, setFind] = useState("");
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const dragged = useRef(false);

  const measure = useCallback(() => {
    const el = root.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
  }, []);

  const clampPan = useCallback((nx: number, ny: number, z: number) => {
    const { w, h } = size;
    const minX = w - w * z - 40;
    const minY = h - h * z - 40;
    return { tx: Math.min(40, Math.max(minX, nx)), ty: Math.min(40, Math.max(minY, ny)) };
  }, [size]);

  const viewRef = useRef({ zoom: 1, tx: 0, ty: 0 });
  viewRef.current = { zoom, tx, ty };

  useEffect(() => {
    measure();
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const el = root.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, tx: ox, ty: oy } = viewRef.current;
      const rect = el.getBoundingClientRect();
      const next = Math.min(4, Math.max(1, z + (e.deltaY > 0 ? -0.18 : 0.18)));
      const k = next / z;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const pan = clampPan(cx - (cx - ox) * k, cy - (cy - oy) * k, next);
      setZoom(next);
      setTx(pan.tx);
      setTy(pan.ty);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, clampPan]);

  const fit = useCallback(
    (pts: { x: number; y: number }[]) => {
      const { w, h } = size;
      if (!w || !pts.length) {
        setZoom(1);
        setTx(0);
        setTy(0);
        return;
      }
      const pad = 10;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const x0 = Math.min(...xs) - pad;
      const y0 = Math.min(...ys) - pad;
      const x1 = Math.max(...xs) + pad;
      const y1 = Math.max(...ys) + pad;
      const nextZoom = Math.min(3.4, Math.max(1, 0.9 / Math.max((x1 - x0) / 100, (y1 - y0) / 100, 0.32)));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      setZoom(nextZoom);
      setTx(w * 0.5 - (cx / 100) * w * nextZoom);
      setTy(h * 0.5 - (cy / 100) * h * nextZoom);
    },
    [size],
  );

  useEffect(() => {
    if (!interactive) return;
    fit(stays.map((s) => s.pin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, size.w, size.h, interactive]);

  const clusters = useMemo(() => {
    const cell = interactive && zoom < 1.2 ? clusterCell(1) : 0;
    return clusterItems(stays, cell);
  }, [stays, interactive, zoom]);

  const pois = useMemo(() => {
    if (!showPlaces) return [];
    return MAP_POIS.filter((p) => {
      if (!active) return true;
      const stay = stays.find((s) => s.id === active);
      if (stay && Math.hypot(p.pin.x - stay.pin.x, p.pin.y - stay.pin.y) > 16) return false;
      return true;
    });
  }, [showPlaces, stays, active]);

  const selected = stays.find((s) => s.id === (preview || active));
  const poi = MAP_POIS.find((p) => p.id === poiId);

  const setView = (z: number, nx: number, ny: number) => {
    const next = clampPan(nx, ny, z);
    setZoom(z);
    setTx(next.tx);
    setTy(next.ty);
  };

  const zoomBy = (delta: number, cx = size.w / 2, cy = size.h / 2) => {
    const next = Math.min(4, Math.max(1, zoom + delta));
    const k = next / zoom;
    setView(next, cx - (cx - tx) * k, cy - (cy - ty) * k);
  };

  const onPointerDown = (e: ReactPointer<HTMLDivElement>) => {
    if (!interactive) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
    dragged.current = false;
  };

  const onPointerMove = (e: ReactPointer<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 4) dragged.current = true;
    setView(zoom, drag.current.tx + dx, drag.current.ty + dy);
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const locate = () => {
    setLocError("");
    if (!navigator.geolocation) {
      setLocError("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!inPakistan(latitude, longitude)) {
          setLocError("You’re outside the map. Showing Pakistan overview.");
          fit(stays.map((s) => s.pin));
          return;
        }
        const pin = projectLatLng(latitude, longitude);
        setYou(pin);
        const z = 2.4;
        setView(z, size.w * 0.5 - (pin.x / 100) * size.w * z, size.h * 0.5 - (pin.y / 100) * size.h * z);
      },
      () => setLocError("Could not read your location."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const highlight = hovered || preview || active;

  return (
    <div ref={root} className="relative h-full min-h-[420px] overflow-hidden bg-ink">
      <div
        className={`absolute inset-0 origin-top-left touch-none ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transformOrigin: "0 0" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative h-full w-full" style={{ width: size.w, height: size.h }}>
          <Image src="/images/pakistan-map.png" alt="Illustrated map of Pakistan" fill className="object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />

          {pois.map((p) => (
            <button
              key={p.id}
              type="button"
              className="absolute z-[2] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.pin.x}%`, top: `${p.pin.y}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setPoiId(p.id);
                setPreview(null);
              }}
              title={p.title}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] shadow-md ${
                  p.kind === "airport"
                    ? "border-sand/40 bg-ink text-sand"
                    : p.kind === "restaurant"
                      ? "border-flame/50 bg-ink-2 text-flame"
                      : p.kind === "transit"
                        ? "border-sage/50 bg-ink-2 text-sage"
                        : "border-brass/50 bg-ink-2 text-brass"
                }`}
              >
                {p.kind === "airport" ? "✈" : p.kind === "restaurant" ? "🍽" : p.kind === "transit" ? "🚋" : "◆"}
              </span>
            </button>
          ))}

          {you && (
            <span
              className="absolute z-[4] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4aa3ff] ring-4 ring-[#4aa3ff]/30"
              style={{ left: `${you.x}%`, top: `${you.y}%` }}
              title="You are here"
            />
          )}

          {clusters.map((c) => {
              if (c.kind === "group") {
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="absolute z-[3] -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${c.pin.x}%`, top: `${c.pin.y}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!interactive) return;
                      const z = Math.min(4, zoom + 0.7);
                      setView(z, size.w * 0.5 - (c.pin.x / 100) * size.w * z, size.h * 0.5 - (c.pin.y / 100) * size.h * z);
                    }}
                  >
                    <span className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-flame text-[10px] leading-tight text-ink shadow-lg">
                      {c.count}
                      <span className="text-[8px] opacity-90">{pinPrice(c.from, currency)}</span>
                    </span>
                  </button>
                );
              }
              const s = c.item;
              const on = highlight === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className="absolute z-[3] -translate-x-1/2 -translate-y-full"
                  style={{ left: `${s.pin.x}%`, top: `${s.pin.y}%` }}
                  onMouseEnter={() => onHover?.(s.id)}
                  onMouseLeave={() => onHover?.(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragged.current) return;
                    setPreview(s.id);
                    setPoiId(null);
                    onSelect?.(s.id);
                  }}
                >
                  <span
                    className={`block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-md ${
                      on ? "bg-flame text-ink" : "bg-bone text-ink"
                    }`}
                  >
                    {pinPrice(nightly(s), currency)}
                  </span>
                  <span className={`mx-auto mt-0.5 block h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent ${on ? "border-t-flame" : "border-t-bone"}`} />
                </button>
              );
            })}
        </div>
      </div>

      {interactive && (
        <>
          <div
            className="absolute left-3 right-14 top-3 z-20 rounded-xl border border-brass/30 bg-ink/90 p-2 shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 rounded-lg bg-ink px-2">
              <PinIcon className="h-4 w-4 shrink-0 text-brass" />
              <input
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-sand outline-none placeholder:text-mist"
                placeholder="Jump to a city or hotel"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const hit = suggest(find)[0];
                  if (!hit) return;
                  setSearch(suggestionPatch(hit));
                  setFind("");
                  onPlace?.(hit);
                }}
              />
            </div>
            {find.trim() && (
              <ul className="mt-1 max-h-40 overflow-auto">
                {suggest(find)
                  .slice(0, 7)
                  .map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-1.5 text-left hover:bg-ink-2"
                        onClick={() => {
                          setSearch(suggestionPatch(item));
                          setFind("");
                          onPlace?.(item);
                        }}
                      >
                        <span className="block text-sm text-sand">{item.label}</span>
                        <span className="block text-[11px] text-mist">{item.sub}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {QUICK_CITIES.map((city) => (
                <button
                  key={city}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    searchCity === city ? "border-flame bg-flame/20 text-sand" : "border-brass/30 text-mist hover:text-sand"
                  }`}
                  onClick={() => {
                    const item: Suggestion = {
                      id: `city-${city}`,
                      group: "cities",
                      kind: "city",
                      label: city,
                      sub: "City",
                      city,
                      country: "PK",
                    };
                    setSearch(suggestionPatch(item));
                    setFind("");
                    onPlace?.(item);
                  }}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
          <div className="absolute right-3 top-3 z-20 flex flex-col gap-1">
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-brass/30 bg-ink/85" onClick={() => zoomBy(0.35)} aria-label="Zoom in">
              <PlusIcon className="h-4 w-4" />
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-brass/30 bg-ink/85" onClick={() => zoomBy(-0.35)} aria-label="Zoom out">
              <MinusIcon className="h-4 w-4" />
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-brass/30 bg-ink/85" onClick={locate} aria-label="Current location">
              <LocateIcon className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {locError && (
        <p className="absolute bottom-3 left-3 right-3 z-10 rounded-lg border border-brass/30 bg-ink/90 px-3 py-2 text-xs text-mist">{locError}</p>
      )}

      {selected && (preview || (!interactive && active)) && (
        <div className="absolute bottom-3 left-3 right-3 z-10 overflow-hidden rounded-xl border border-brass/35 bg-ink/95 shadow-xl">
          {interactive && (
            <button type="button" className="absolute right-2 top-2 z-[1] text-mist" onClick={() => setPreview(null)} aria-label="Close">
              ×
            </button>
          )}
          <Link href={`/stay/${selected.id}`} className="grid grid-cols-[96px_minmax(0,1fr)]" onClick={(e) => e.stopPropagation()}>
            <span className="relative h-full min-h-[96px]">
              <Image src={selected.cover} alt="" fill className="object-cover" />
            </span>
            <span className="p-3 pr-8">
              <span className="block font-display text-lg leading-tight">{selected.name}</span>
              <span className="mt-0.5 block text-xs text-mist">
                {selected.city} · {money(nightly(selected))} / night
              </span>
              {selected.reviewAvg != null && (
                <span className="mt-1 block text-xs text-sand">
                  {selected.reviewAvg} · {selected.reviewCount} reviews
                </span>
              )}
              <span className="mt-2 block space-y-0.5 text-[11px] text-mist">
                {selected.centerKm != null && <span className="block">{selected.centerKm} km from centre</span>}
                {selected.landmark && (
                  <span className="block">
                    {selected.landmarkKm} km to {selected.landmark}
                  </span>
                )}
                {selected.airport && (
                  <span className="block">
                    {selected.airportKm} km to {selected.airport}
                  </span>
                )}
              </span>
            </span>
          </Link>
        </div>
      )}

      {poi && !preview && (
        <div className="absolute bottom-3 left-3 right-3 z-10 rounded-xl border border-brass/35 bg-ink/95 p-3 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-brass">{poi.kind}</p>
              <p className="font-display text-lg leading-tight">{poi.title}</p>
              <p className="mt-1 text-xs text-mist">{poi.sub}</p>
              {poi.walk && <p className="mt-1 text-xs text-sand">{poi.walk}</p>}
              {poi.extra && <p className="mt-1 text-xs text-sage">{poi.extra}</p>}
            </div>
            <button type="button" className="text-mist" onClick={() => setPoiId(null)} aria-label="Close">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
