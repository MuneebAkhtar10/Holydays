"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSerai } from "@/lib/store";
import { countries, countryByCode, filterPlaces, placeLabel } from "@/lib/places";
import { ChevronIcon, PinIcon } from "@/components/icons";

export function PlacePicker() {
  const { search, setSearch } = useSerai();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCountry, setActiveCountry] = useState(search.country || "PK");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const list = useMemo(() => filterPlaces(query), [query]);

  useEffect(() => {
    if (list.length && !list.some((c) => c.code === activeCountry)) {
      setActiveCountry(list[0].code);
    }
  }, [list, activeCountry]);
  const selected = countryByCode(activeCountry) ?? list[0] ?? countries[0];
  const label = placeLabel(search.country, search.city) || "Country and city";

  const pickCountry = (code: string) => {
    setActiveCountry(code);
    setSearch({ country: code, city: "", q: countryByCode(code)?.name ?? "" });
  };

  const pickCity = (city: string) => {
    setSearch({ country: activeCountry, city, q: city });
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={`relative ${open ? "z-40" : ""}`} ref={box}>
      <button
        type="button"
        className="place-field"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <PinIcon className="h-5 w-5 shrink-0 text-brass" />
        <span className={`min-w-0 flex-1 truncate text-left ${search.city || search.country ? "text-sand" : "text-mist"}`}>
          {label}
        </span>
        <ChevronIcon className="h-4 w-4 text-mist" />
      </button>
      {open && (
        <div className="place-panel">
          <input
            autoFocus
            className="auth-field mt-0"
            placeholder="Search country or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-3 grid max-h-80 gap-0 overflow-hidden rounded-xl border border-brass/20 sm:grid-cols-[160px_minmax(0,1fr)]">
            <ul className="max-h-80 overflow-auto border-b border-brass/20 bg-ink sm:border-b-0 sm:border-r">
              {list.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2.5 text-left text-sm ${
                      activeCountry === c.code ? "bg-brass/15 text-sand" : "text-mist hover:bg-ink-2 hover:text-sand"
                    }`}
                    onClick={() => pickCountry(c.code)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
            <ul className="max-h-80 overflow-auto bg-ink-2">
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left text-sm text-brass hover:bg-ink"
                  onClick={() => {
                    setSearch({ country: selected.code, city: "", q: selected.name });
                    setOpen(false);
                  }}
                >
                  All of {selected.name}
                </button>
              </li>
              {selected.cities
                .filter((city) => !query || city.toLowerCase().includes(query.toLowerCase()) || selected.name.toLowerCase().includes(query.toLowerCase()))
                .map((city) => (
                  <li key={city}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2.5 text-left text-sm ${
                        search.city === city ? "bg-flame/15 text-sand" : "text-sand/90 hover:bg-ink"
                      }`}
                      onClick={() => pickCity(city)}
                    >
                      {city}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
