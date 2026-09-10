"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { GALLERY_LABEL, gallerySets, type GalleryCategory } from "@/lib/property-details";
import type { Stay } from "@/lib/types";

const TABS: GalleryCategory[] = ["property", "room", "bathroom", "facilities", "360", "video"];

export function PropertyGallery({ stay }: { stay: Stay }) {
  const sets = gallerySets(stay);
  const [tab, setTab] = useState<GalleryCategory>("property");
  const [open, setOpen] = useState<number | null>(null);
  const [play, setPlay] = useState(0);
  const pan = useRef({ x: 40, dragging: false, start: 0, origin: 40 });
  const [panX, setPanX] = useState(40);
  const list = sets[tab];

  useEffect(() => {
    if (tab !== "video") return;
    const t = setInterval(() => setPlay((p) => (p + 1) % list.length), 2200);
    return () => clearInterval(t);
  }, [tab, list.length]);

  const hero = tab === "video" ? list[play] : list[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${tab === id ? "border-flame bg-flame/15 text-sand" : "border-brass/30 text-mist hover:text-sand"}`}
            onClick={() => {
              setTab(id);
              setOpen(null);
            }}
          >
            {GALLERY_LABEL[id]}
          </button>
        ))}
      </div>

      {tab === "360" ? (
        <div
          className="relative mt-3 h-[52vh] min-h-[320px] cursor-grab overflow-hidden rounded-2xl border border-brass/25 active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            pan.current = { x: panX, dragging: true, start: e.clientX, origin: panX };
          }}
          onPointerMove={(e) => {
            if (!pan.current.dragging) return;
            const next = Math.max(0, Math.min(70, pan.current.origin + (pan.current.start - e.clientX) / 8));
            setPanX(next);
          }}
          onPointerUp={() => {
            pan.current.dragging = false;
          }}
        >
          <Image
            src={list[0]}
            alt="360° tour"
            fill
            className="max-w-none object-cover"
            style={{ objectPosition: `${panX}% 50%`, transform: "scale(1.35)" }}
          />
          <p className="absolute left-4 top-4 rounded-full bg-ink/70 px-3 py-1 text-[10px] uppercase tracking-widest text-brass">
            Drag to look around · stills, not a full scan
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <button type="button" className="relative min-h-[280px] overflow-hidden rounded-2xl md:min-h-[420px]" onClick={() => setOpen(0)}>
            <Image src={hero} alt={`${stay.name} ${GALLERY_LABEL[tab]}`} fill className="object-cover" priority />
            {tab === "video" && (
              <span className="absolute inset-0 grid place-items-center bg-ink/25">
                <span className="rounded-full border border-sand/50 bg-ink/70 px-4 py-2 text-sm text-sand">Property film</span>
              </span>
            )}
          </button>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {list.slice(1, 5).map((src, i) => (
              <button key={`${src}-${i}`} type="button" className="relative min-h-[96px] overflow-hidden rounded-xl md:min-h-[132px]" onClick={() => setOpen(i + 1)}>
                <Image src={src} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {open != null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/92 p-6"
          onClick={() => setOpen(null)}
        >
          <Image src={list[open] ?? hero} alt="" width={1400} height={900} className="max-h-[90vh] w-auto object-contain" />
          <div className="absolute bottom-8 flex gap-2">
            {list.map((src, i) => (
              <button
                key={`${src}-lb-${i}`}
                type="button"
                className={`h-14 w-20 overflow-hidden border ${open === i ? "border-brass" : "border-transparent"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(i);
                }}
              >
                <Image src={src} alt="" width={80} height={56} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
