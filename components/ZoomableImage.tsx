"use client";

import Image from "next/image";
import { useState } from "react";

export function ZoomableImage({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`relative block cursor-zoom-in ${className ?? ""}`}
        aria-label={`View larger ${alt}`}
      >
        <Image src={src} alt={alt} fill className={imgClassName ?? "object-cover"} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <button
            type="button"
            className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-ink-2 text-lg text-sand"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            aria-label="Close"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}
