"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PinIcon } from "@/components/icons";
import { useSerai } from "@/lib/store";
import { pushRecent, readRecent, suggest, suggestionPatch, type Suggestion } from "@/lib/search-index";

const GROUP_TITLE: Record<Suggestion["group"], string> = {
  recent: "Recent searches",
  popular: "Popular destinations",
  trending: "Trending destinations",
  nearby: "Nearby destinations",
  airports: "Airports",
  landmarks: "Landmarks",
  properties: "Property names",
  cities: "Cities",
};

const GROUP_ORDER: Suggestion["group"][] = [
  "recent",
  "popular",
  "trending",
  "nearby",
  "cities",
  "airports",
  "landmarks",
  "properties",
];

export function DestinationSearch({ compact = false }: { compact?: boolean }) {
  const { search, setSearch } = useSerai();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [recent, setRecent] = useState<Suggestion[]>([]);
  const box = useRef<HTMLDivElement>(null);

  const shown = typing ? query : search.q || search.city || search.landmark || search.airport || "";

  useEffect(() => {
    setRecent(readRecent());
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
        setTyping(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const grouped = useMemo(() => {
    const hits = suggest(query);
    const withRecent = query.trim() ? hits : [...recent.map((r) => ({ ...r, group: "recent" as const })), ...hits];
    const map = new Map<Suggestion["group"], Suggestion[]>();
    for (const item of withRecent) {
      const list = map.get(item.group) ?? [];
      if (!list.some((x) => x.id === item.id)) list.push(item);
      map.set(item.group, list);
    }
    return GROUP_ORDER.map((g) => [g, (map.get(g) ?? []).slice(0, g === "properties" ? 8 : 6)] as const).filter(([, list]) => list.length);
  }, [query, recent]);

  const pick = (item: Suggestion) => {
    pushRecent(item);
    setRecent(readRecent());
    setSearch(suggestionPatch(item));
    setQuery(item.label);
    setTyping(false);
    setOpen(false);
  };

  const commitFreeform = () => {
    const first = grouped.flatMap(([, list]) => list)[0];
    if (first && query.trim()) {
      pick(first);
      return;
    }
    const text = query.trim();
    if (!text) return;
    setSearch({
      q: text,
      city: text,
      landmark: "",
      airport: "",
      mapX: null,
      mapY: null,
      mapBounds: null,
    });
    setTyping(false);
    setOpen(false);
  };

  return (
    <div className={`relative ${open ? "z-50" : ""}`} ref={box}>
      <div className={`place-field ${compact ? "mt-0 py-2" : ""}`}>
        <PinIcon className="h-5 w-5 shrink-0 text-brass" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-sand outline-none placeholder:text-mist"
          placeholder="Najaf, Mashhad, Makkah…"
          value={shown}
          onFocus={() => {
            setTyping(true);
            setQuery(search.q || search.city || search.landmark || search.airport || "");
            setOpen(true);
          }}
          onChange={(e) => {
            setTyping(true);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitFreeform();
            }
            if (e.key === "Escape") {
              setOpen(false);
              setTyping(false);
            }
          }}
        />
      </div>
      {open && (
        <div className={`place-panel ${compact ? "max-h-[min(22rem,50vh)]" : "max-h-[min(28rem,70vh)]"} overflow-auto`}>
          <div className="space-y-4">
            {grouped.map(([group, list]) => (
              <div key={group}>
                <p className="px-1 text-[10px] uppercase tracking-[0.18em] text-brass">{GROUP_TITLE[group]}</p>
                <ul className="mt-1">
                  {list.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-ink" onClick={() => pick(item)}>
                        <span className="block text-sm text-sand">{item.label}</span>
                        <span className="block text-xs text-mist">{item.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!grouped.length && <p className="px-2 py-4 text-sm text-mist">No matches. Try Najaf, Mashhad, or Makkah, then press Enter.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
