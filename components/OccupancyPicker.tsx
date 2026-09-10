"use client";

import { useEffect, useRef, useState } from "react";
import { GuestsIcon } from "@/components/icons";
import { useSerai } from "@/lib/store";

export function OccupancyPicker() {
  const { search, setSearch } = useSerai();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const rooms = search.rooms || 1;
  const adults = search.adults || 1;
  const children = search.children || 0;
  const label = `${rooms} room${rooms === 1 ? "" : "s"} · ${adults} adult${adults === 1 ? "" : "s"}${
    children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""
  }`;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const stepper = (key: "rooms" | "adults" | "children", min: number, max: number) => (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-sand capitalize">{key === "children" ? "Children" : key}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-full border border-brass/40 text-sand"
          onClick={() => setSearch({ [key]: Math.max(min, (search[key] || min) - 1) })}
        >
          −
        </button>
        <span className="w-6 text-center text-sm">{search[key] || 0}</span>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-full border border-brass/40 text-sand"
          onClick={() => setSearch({ [key]: Math.min(max, (search[key] || 0) + 1) })}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative" ref={box}>
      <button type="button" className="place-field mt-2" onClick={() => setOpen((v) => !v)}>
        <GuestsIcon className="h-4 w-4 shrink-0 text-brass" />
      <span className="min-w-0 flex-1 truncate text-left text-sm text-sand">{label}</span>
      </button>
      {open && (
        <div className="place-panel right-0 w-[min(22rem,calc(100vw-2.5rem))]">
          {stepper("rooms", 1, 8)}
          {stepper("adults", 1, 16)}
          {stepper("children", 0, 8)}
          {search.children > 0 && (
            <div className="mt-2 border-t border-brass/20 pt-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Child ages</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {search.childAges.map((age, i) => (
                  <label key={i} className="auth-label mt-0">
                    Child {i + 1}
                    <select
                      className="auth-field"
                      value={age}
                      onChange={(e) => {
                        const childAges = [...search.childAges];
                        childAges[i] = Number(e.target.value);
                        setSearch({ childAges });
                      }}
                    >
                      {Array.from({ length: 18 }, (_, n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-mist">{search.guests} guests in total</p>
        </div>
      )}
    </div>
  );
}
