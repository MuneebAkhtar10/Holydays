import { prisma } from "@/lib/prisma";
import { isPilgrimPlace } from "@/lib/pilgrim";

export type ListingRecord = {
  id: string;
  slug: string;
  kind: string;
  ownerId: string;
  name: string;
  nastaliq: string;
  city: string;
  region: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  published: number | boolean;
  status: string;
  rejectReason: string;
  meta: string;
};

export type ReviewRecord = {
  id: string;
  rating: number;
  body: string;
  createdAt: Date | string;
  name: string;
};

async function listingSelect(whereSql: "owner" | "public" | "publicKind" | "one", arg: string) {
  const withMeta = async () => {
    if (whereSql === "one") {
      return prisma.$queryRaw<ListingRecord[]>`
        SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
          price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
          COALESCE(rejectReason, '') AS "rejectReason", COALESCE(meta, '{}') AS meta
        FROM Listing WHERE id = ${arg} OR slug = ${arg} LIMIT 1
      `;
    }
    if (whereSql === "owner") {
      return prisma.$queryRaw<ListingRecord[]>`
        SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
          price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
          COALESCE(rejectReason, '') AS "rejectReason", COALESCE(meta, '{}') AS meta
        FROM Listing WHERE ownerId = ${arg} ORDER BY updatedAt DESC
      `;
    }
    if (whereSql === "publicKind") {
      return prisma.$queryRaw<ListingRecord[]>`
        SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
          price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
          COALESCE(rejectReason, '') AS "rejectReason", COALESCE(meta, '{}') AS meta
        FROM Listing WHERE COALESCE(status, 'pending') = 'approved' AND kind = ${arg} ORDER BY name ASC
      `;
    }
    return prisma.$queryRaw<ListingRecord[]>`
      SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
        price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
        COALESCE(rejectReason, '') AS "rejectReason", COALESCE(meta, '{}') AS meta
      FROM Listing WHERE COALESCE(status, 'pending') = 'approved' ORDER BY name ASC
    `;
  };
  try {
    return await withMeta();
  } catch {
    if (whereSql === "one") {
      const rows = await prisma.$queryRaw<ListingRecord[]>`
        SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
          price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
          COALESCE(rejectReason, '') AS "rejectReason"
        FROM Listing WHERE id = ${arg} OR slug = ${arg} LIMIT 1
      `;
      return rows.map((r) => ({ ...r, meta: "{}" }));
    }
    if (whereSql === "owner") {
      const rows = await prisma.$queryRaw<ListingRecord[]>`
        SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
          price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
          COALESCE(rejectReason, '') AS "rejectReason"
        FROM Listing WHERE ownerId = ${arg} ORDER BY updatedAt DESC
      `;
      return rows.map((r) => ({ ...r, meta: "{}" }));
    }
    if (whereSql === "publicKind") {
      const rows = await prisma.$queryRaw<ListingRecord[]>`
        SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
          price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
          COALESCE(rejectReason, '') AS "rejectReason"
        FROM Listing WHERE COALESCE(status, 'pending') = 'approved' AND kind = ${arg} ORDER BY name ASC
      `;
      return rows.map((r) => ({ ...r, meta: "{}" }));
    }
    const rows = await prisma.$queryRaw<ListingRecord[]>`
      SELECT id, slug, kind, ownerId AS "ownerId", name, nastaliq, city, region, cover, description,
        price, priceUnit AS "priceUnit", published, COALESCE(status, 'pending') AS status,
        COALESCE(rejectReason, '') AS "rejectReason"
      FROM Listing WHERE COALESCE(status, 'pending') = 'approved' ORDER BY name ASC
    `;
    return rows.map((r) => ({ ...r, meta: "{}" }));
  }
}

export async function fetchListingByKey(idOrSlug: string): Promise<ListingRecord | null> {
  const rows = await listingSelect("one", idOrSlug);
  return rows[0] ?? null;
}

export async function fetchListingReviews(listingId: string): Promise<ReviewRecord[]> {
  try {
    return await prisma.$queryRaw<ReviewRecord[]>`
      SELECT r.id AS id, r.rating AS rating, r.body AS body, r.createdAt AS "createdAt", u.name AS name
      FROM Review r
      INNER JOIN "user" u ON u.id = r.userId
      WHERE r.listingId = ${listingId}
      ORDER BY r.createdAt DESC
    `;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function fetchReviewStatsMap() {
  try {
    const rows = await prisma.$queryRaw<{ listingId: string; count: bigint | number; avg: number }[]>`
      SELECT listingId AS "listingId", COUNT(*) AS count, AVG(rating) AS avg
      FROM Review
      GROUP BY listingId
    `;
    return Object.fromEntries(
      rows.map((r) => [
        r.listingId,
        { count: Number(r.count), avg: Math.round(Number(r.avg) * 10) / 10 },
      ]),
    ) as Record<string, { count: number; avg: number }>;
  } catch (err) {
    console.error(err);
    return {} as Record<string, { count: number; avg: number }>;
  }
}

export async function userHasReview(listingId: string, userId: string) {
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Review WHERE listingId = ${listingId} AND userId = ${userId} LIMIT 1
    `;
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}

export async function upsertGuestReview(listingId: string, userId: string, rating: number, body: string) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  await prisma.$executeRaw`
    INSERT INTO Review (id, listingId, userId, rating, body, createdAt)
    VALUES (${id}, ${listingId}, ${userId}, ${rating}, ${body}, CURRENT_TIMESTAMP)
    ON CONFLICT(listingId, userId) DO UPDATE SET
      rating = ${rating},
      body = ${body}
  `;
}

export function isPublishedLive(listing: Pick<ListingRecord, "status" | "published">) {
  return listing.status === "approved";
}

export async function fetchListingsForOwner(ownerId: string): Promise<ListingRecord[]> {
  return listingSelect("owner", ownerId);
}

export async function fetchPublicListings(kind: string | null): Promise<ListingRecord[]> {
  const rows = kind ? await listingSelect("publicKind", kind) : await listingSelect("public", "");
  return rows.filter((l) => isPilgrimPlace(l.city, l.region));
}
