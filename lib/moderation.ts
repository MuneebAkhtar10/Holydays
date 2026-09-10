export const PUBLIC_LISTING = { status: "approved", published: true } as const;

export function withReviewStats<T extends { reviews?: { rating: number }[] }>(listing: T) {
  const reviews = listing.reviews ?? [];
  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  const { reviews: _drop, ...rest } = listing;
  return { ...rest, reviewCount: count, reviewAvg: avg };
}
