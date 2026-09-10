"use client";

import { mapsDirectionsUrl, mapsEmbedUrl, mapsSearchUrl, hasCoords } from "@/lib/google-maps";

export type MapStay = {
  id: string;
  name: string;
  city?: string;
  address?: string;
  lat: number;
  lng: number;
};

export function GoogleStayMap({
  stays,
  active,
  onSelect,
  className = "",
}: {
  stays: MapStay[];
  active?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const located = stays.filter((s) => hasCoords(s.lat, s.lng));
  const current = located.find((s) => s.id === active) ?? located[0];

  if (!current) {
    return (
      <div className={`grid place-items-center rounded-2xl border border-brass/25 bg-ink-2 text-sm text-mist ${className}`}>
        Map pin coming once this listing has coordinates.
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-brass/25 bg-ink-2 ${className}`}>
      <div className="relative min-h-[280px] w-full flex-1 bg-ink">
        <iframe
          title={`Google Map · ${current.name}`}
          src={mapsEmbedUrl(current.lat, current.lng)}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="font-display text-xl text-sand">{current.name}</p>
          <p className="mt-1 text-sm text-mist">{current.address || current.city}</p>
          <p className="mt-1 font-mono text-xs text-brass">
            {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary text-sm" href={mapsDirectionsUrl(current.lat, current.lng)} target="_blank" rel="noreferrer">
            Directions
          </a>
          <a className="btn-ghost text-sm text-sand" href={mapsSearchUrl(current.lat, current.lng, current.name)} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        </div>
        {located.length > 1 && (
          <ul className="max-h-40 space-y-1 overflow-auto">
            {located.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(s.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${s.id === current.id ? "bg-flame/20 text-sand" : "text-mist hover:bg-ink hover:text-sand"}`}
                >
                  <span className="block">{s.name}</span>
                  <span className="block text-xs opacity-80">{s.city}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
