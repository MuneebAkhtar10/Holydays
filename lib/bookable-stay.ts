import { stayById } from "@/lib/stays";
import { hydrateCatalogStay } from "@/lib/search-index";
import { listingToStay, type ListingCard } from "@/lib/listing-meta";
import { fetchListingByKey } from "@/lib/listing-query";
import type { Stay } from "@/lib/types";

export async function loadBookableStay(id: string): Promise<Stay | null> {
  const catalog = stayById(id);
  if (catalog) return hydrateCatalogStay(catalog);
  const listing = await fetchListingByKey(id);
  if (!listing || listing.kind !== "STAY") return null;
  return listingToStay(listing as ListingCard);
}
