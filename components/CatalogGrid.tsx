"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSerai } from "@/lib/store";
import { kindPath, unitLabel, type ListingKind } from "@/lib/marketplace";
import { listingToTaxi, tripTitle } from "@/lib/package-plan";
import { PageLoader } from "@/components/PageLoader";
import { StarIcon } from "@/components/StarIcon";
import { readJson } from "@/lib/readJson";

type Listing = {
  id: string;
  slug: string;
  kind: ListingKind;
  name: string;
  nastaliq: string;
  city: string;
  region: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  reviewAvg?: number;
  reviewCount?: number;
  meta?: unknown;
};

export function CatalogGrid({ kind, title, urdu, blurb }: { kind: ListingKind; title: string; urdu: string; blurb: string }) {
  const { money } = useSerai();
  const [items, setItems] = useState<Listing[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    fetch(`/api/listings?kind=${kind}`, { cache: "no-store" })
      .then((r) => readJson<Listing[]>(r))
      .then((d) => {
        setItems(Array.isArray(d) ? d : []);
        setReady(true);
      })
      .catch(() => {
        setItems([]);
        setReady(true);
      });
  }, [kind]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="font-urdu text-brass">{urdu}</p>
      <h1 className="font-display mt-2 text-5xl">{title}</h1>
      <p className="mt-3 max-w-xl text-mist">{blurb}</p>
      {!ready ? (
        <PageLoader compact label="Loading listings" />
      ) : (
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <Link key={item.id} href={`/${kindPath[kind]}/${item.slug}`} className="overflow-hidden border border-brass/20">
            <div className="relative h-56">
              <Image src={item.cover} alt={item.name} fill className="object-cover" />
            </div>
            <div className="p-5">
              <p className="font-urdu text-sm text-brass">{item.nastaliq}</p>
              <h2 className="font-display text-3xl">{kind === "TAXI" ? tripTitle(listingToTaxi(item)) : item.name}</h2>
              <p className="mt-1 text-sm text-mist">
                {kind === "TAXI"
                  ? (() => {
                      const t = listingToTaxi(item);
                      return `${t.origin} → ${t.destination} · ${t.hours}`;
                    })()
                  : `${item.city}, ${item.region}`}
              </p>
              <p className="mt-3 line-clamp-2 text-sm text-sand/80">{item.description}</p>
              <p className="font-display mt-4 text-xl">
                {kind === "TAXI" ? (
                  <>
                    {money(listingToTaxi(item).ratePerPerson)}{" "}
                    <span className="text-sm text-mist">/ person</span>
                    <span className="mt-1 block text-sm font-sans font-normal text-mist">
                      Private {money(listingToTaxi(item).privateRate)}
                    </span>
                  </>
                ) : (
                  <>
                    {money(item.price)} <span className="text-sm text-mist">/ {unitLabel[item.priceUnit]}</span>
                  </>
                )}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-mist">
                <StarIcon className="h-4 w-4 text-brass" />
                {(item.reviewCount ?? 0) > 0 ? `${item.reviewAvg} · ${item.reviewCount} reviews` : "No reviews yet"}
              </p>
            </div>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}
