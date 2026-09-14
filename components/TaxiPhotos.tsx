"use client";

import { ZoomableImage } from "@/components/ZoomableImage";

type Size = "sm" | "md" | "lg";

const SIZE: Record<
  Size,
  { face: string; car: string; cars: number; wrap: string }
> = {
  sm: { face: "h-9 w-9", car: "h-9 w-14", cars: 1, wrap: "gap-2" },
  md: { face: "h-14 w-14", car: "h-14 w-[5.5rem]", cars: 1, wrap: "gap-2.5" },
  lg: { face: "h-[72px] w-[72px]", car: "h-[72px] w-[108px]", cars: 2, wrap: "gap-2.5" },
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function taxiCarPhotos(input: {
  vehiclePhoto?: string;
  vehiclePhotos?: string[];
  cover?: string;
  driverPhoto?: string;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...(input.vehiclePhotos ?? []), input.vehiclePhoto, input.cover]) {
    const next = String(url || "").trim();
    if (!next || next === input.driverPhoto || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

export function TaxiPhotos({
  driver,
  driverPhoto,
  vehicle,
  vehiclePhoto,
  vehiclePhotos,
  cover,
  size = "md",
  className = "",
}: {
  driver: string;
  driverPhoto?: string;
  vehicle: string;
  vehiclePhoto?: string;
  vehiclePhotos?: string[];
  cover?: string;
  size?: Size;
  className?: string;
}) {
  const dim = SIZE[size];
  const cars = taxiCarPhotos({ vehiclePhoto, vehiclePhotos, cover, driverPhoto }).slice(0, dim.cars);
  const face = String(driverPhoto || "").trim();

  return (
    <div className={`flex shrink-0 items-center ${dim.wrap} ${className}`}>
      {face ? (
        <ZoomableImage
          src={face}
          alt={driver || "Driver"}
          className={`${dim.face} shrink-0 overflow-hidden rounded-full border border-brass/25 bg-ink/40`}
        />
      ) : (
        <span
          className={`grid ${dim.face} shrink-0 place-items-center rounded-full border border-brass/25 bg-ink/40 text-[10px] font-medium text-mist`}
          aria-label={driver || "Driver"}
        >
          {initials(driver)}
        </span>
      )}
      {cars.length ? (
        cars.map((src) => (
          <ZoomableImage
            key={src}
            src={src}
            alt={vehicle || "Vehicle"}
            className={`${dim.car} shrink-0 overflow-hidden rounded-xl border border-brass/25 bg-ink/40`}
          />
        ))
      ) : (
        <span className={`${dim.car} shrink-0 rounded-xl border border-brass/25 bg-ink/30`} aria-hidden />
      )}
    </div>
  );
}
