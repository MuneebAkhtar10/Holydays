import { prisma } from "@/lib/prisma";

export type AdminListingRow = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  city: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  status: string;
  rejectReason: string;
  ownerName: string;
  ownerEmail: string;
};

export async function fetchAdminListings(status: string): Promise<AdminListingRow[]> {
  const filter = status === "all" ? "%" : status;
  return prisma.$queryRaw<AdminListingRow[]>`
    SELECT
      l.id AS id,
      l.slug AS slug,
      l.kind AS kind,
      l.name AS name,
      l.city AS city,
      l.cover AS cover,
      l.description AS description,
      l.price AS price,
      l.priceUnit AS "priceUnit",
      COALESCE(l.status, 'pending') AS status,
      COALESCE(l.rejectReason, '') AS "rejectReason",
      u.name AS "ownerName",
      u.email AS "ownerEmail"
    FROM Listing l
    INNER JOIN "user" u ON u.id = l.ownerId
    WHERE (${filter} = '%' OR COALESCE(l.status, 'pending') = ${filter})
    ORDER BY l.updatedAt DESC
  `;
}

export async function setListingModeration(id: string, status: "approved" | "rejected" | "pending", rejectReason: string) {
  const published = status === "approved";
  const reason = status === "rejected" ? rejectReason : "";
  await prisma.$executeRaw`
    UPDATE Listing
    SET status = ${status},
        published = ${published},
        rejectReason = ${reason},
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${id} OR slug = ${id}
  `;
}
