"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSerai } from "@/lib/store";
import { vibes } from "@/lib/stays";
import { DestinationSearch } from "@/components/DestinationSearch";
import { OccupancyPicker } from "@/components/OccupancyPicker";
import { CalendarIcon } from "@/components/icons";
import { pushRecent } from "@/lib/search-index";
import { localTodayIso, minCheckoutIso } from "@/lib/format";

export function SearchPass({ compact = false, stayCity }: { compact?: boolean; stayCity?: string }) {
  const { search, setSearch, t } = useSerai();
  const router = useRouter();
  const [stamped, setStamped] = useState(false);

  const go = () => {
    setStamped(true);
    if (stayCity) {
      const destination = (search.q || search.city || "").trim().toLowerCase();
      if (destination === stayCity.trim().toLowerCase()) {
        // Same destination as this hotel — stay on the page, just refresh the URL so dates/guests take effect.
        const p = new URLSearchParams(window.location.search);
        p.set("checkin", search.checkin);
        p.set("checkout", search.checkout);
        p.set("guests", String(search.guests));
        p.set("rooms", String(search.rooms));
        p.set("adults", String(search.adults));
        p.set("children", String(search.children));
        if (search.childAges.length) p.set("ages", search.childAges.join(","));
        router.replace(`${window.location.pathname}?${p.toString()}`, { scroll: false });
        window.setTimeout(() => setStamped(false), 1000);
        return;
      }
    }
    if (search.city || search.q) {
      pushRecent({
        id: `go-${search.city || search.q}`,
        group: "recent",
        kind: search.landmark ? "landmark" : search.airport ? "airport" : "destination",
        label: search.q || search.city,
        sub: "Recent search",
        city: search.city,
        country: search.country || "",
      });
    }
    const p = new URLSearchParams();
    if (search.country && (search.city || search.q || search.landmark || search.airport)) p.set("country", search.country);
    if (search.city) p.set("city", search.city);
    if (search.q) p.set("q", search.q);
    else if (search.city) p.set("q", search.city);
    if (search.vibe) p.set("vibe", search.vibe);
    if (search.landmark) p.set("landmark", search.landmark);
    if (search.airport) p.set("airport", search.airport);
    p.set("checkin", search.checkin);
    p.set("checkout", search.checkout);
    p.set("guests", String(search.guests));
    p.set("rooms", String(search.rooms));
    p.set("adults", String(search.adults));
    p.set("children", String(search.children));
    if (search.childAges.length) p.set("ages", search.childAges.join(","));
    setTimeout(() => router.push(`/search?${p.toString()}`), 180);
  };

  return (
    <div className={`relative overflow-visible ${compact ? "" : "rise"}`}>
      <div className="relative overflow-visible rounded-2xl border border-brass/40 bg-ink-2 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.28em] text-brass">Boarding pass</p>
        </div>
        <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(16rem,1.4fr)_minmax(15rem,1.1fr)_minmax(12rem,0.9fr)_auto]">
          <label className="relative z-20 block min-w-0">
            <span className="text-[11px] uppercase tracking-widest text-mist">{t.destination}</span>
            <div className="mt-2">
              <DestinationSearch />
            </div>
          </label>
          <label className="block min-w-0">
            <span className="text-[11px] uppercase tracking-widest text-mist">Check-in / check-out</span>
            <div className="mt-2 flex min-h-[3.15rem] items-center gap-2 rounded-2xl border border-brass/28 bg-ink px-3 py-2">
              <CalendarIcon className="h-4 w-4 shrink-0 text-brass" />
              <input type="date" className="min-w-0 flex-1 bg-transparent text-sm text-sand outline-none" min={localTodayIso()} value={search.checkin || ""} onChange={(e) => setSearch({ checkin: e.target.value })} />
              <span className="text-mist">–</span>
              <input type="date" className="min-w-0 flex-1 bg-transparent text-sm text-sand outline-none" min={minCheckoutIso(search.checkin)} value={search.checkout || ""} onChange={(e) => setSearch({ checkout: e.target.value })} />
            </div>
          </label>
          <label className="block min-w-0">
            <span className="text-[11px] uppercase tracking-widest text-mist">Rooms & guests</span>
            <OccupancyPicker />
          </label>
          <button type="button" onClick={go} className="btn-primary h-[3.15rem] w-full px-5 xl:w-auto">
            {t.search}
          </button>
        </div>
        {stayCity ? null : (
          <div className="mt-5 flex flex-wrap gap-2">
            {vibes.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSearch({ vibe: search.vibe === v ? "" : v })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  search.vibe === v ? "border-flame bg-flame/20 text-sand" : "border-brass/30 text-mist hover:text-sand"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      {stamped && (
        <div className="stamp pointer-events-none absolute -right-2 -top-4 rotate-[-8deg] border-2 border-flame px-3 py-2 font-display text-flame">
          HOLYDAYS
        </div>
      )}
    </div>
  );
}
