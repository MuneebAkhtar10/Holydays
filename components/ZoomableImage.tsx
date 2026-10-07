"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function ZoomableImage({
  src,
  sources,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  sources?: string[];
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const shots = (sources?.length ? sources : [src]).filter(Boolean);
  const start = Math.max(0, shots.indexOf(src));
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i == null ? 0 : (i + 1) % shots.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i == null ? 0 : (i - 1 + shots.length) % shots.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shots.length]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(start);
        }}
        className={`relative block cursor-zoom-in ${className ?? ""}`}
        aria-label={`View larger ${alt}`}
      >
        <Image src={src} alt={alt} fill className={imgClassName ?? "object-cover"} />
      </button>
      {open != null && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-6"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-ink-2 text-lg text-sand"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(null);
            }}
            aria-label="Close"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shots[open] ?? src} alt={alt} className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain" />
          {shots.length > 1 ? (
            <div className="mt-4 flex max-w-[90vw] flex-wrap justify-center gap-2">
              {shots.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  className={`h-14 w-20 overflow-hidden rounded-lg border ${open === i ? "border-brass" : "border-transparent"}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(i);
                  }}
                >
                  <Image src={url} alt="" width={80} height={56} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
