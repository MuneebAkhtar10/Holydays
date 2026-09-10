"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ListingForm } from "@/components/ListingForm";
import { PageLoader } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Record<string, unknown> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    fetch(`/api/listings/${id}`)
      .then((r) => readJson<Record<string, unknown>>(r))
      .then((d) => {
        setListing(d);
        setReady(true);
      })
      .catch(() => {
        setListing(null);
        setReady(true);
      });
  }, [id]);

  if (!ready) return <PageLoader label="Loading listing" />;
  if (!listing || listing.error) return <div className="p-10 text-mist">This listing is not on the map.</div>;

  return (
    <div className="px-5 py-10">
      <ListingForm
        kind={String(listing.kind)}
        initial={{
          id: String(listing.id),
          name: String(listing.name),
          nastaliq: String(listing.nastaliq ?? ""),
          city: String(listing.city),
          region: String(listing.region),
          cover: String(listing.cover),
          description: String(listing.description),
          price: Number(listing.price),
          priceUnit: String(listing.priceUnit),
          published: Boolean(listing.published),
          meta: listing.meta as never,
        }}
        onSaved={() => router.push("/owner")}
        onClose={() => router.push("/owner")}
      />
    </div>
  );
}
