import { prisma } from "@/lib/prisma";

export type OwnerBookingRow = {
  id: string;
  startDate: string;
  endDate: string;
  guests: number;
  phone: string;
  total: number;
  status: string;
  payment: string;
  createdAt: Date | string;
  listingId: string;
  listingName: string;
  slug: string;
  kind: string;
  city: string;
  cover: string;
  guestName: string;
  guestEmail: string;
  extras: string;
  reviewRating: number | null;
  reviewBody: string | null;
};

export async function fetchOwnerBookings(ownerId: string): Promise<OwnerBookingRow[]> {
  return prisma.$queryRaw<OwnerBookingRow[]>`
    SELECT
      b.id AS id,
      b.startDate AS "startDate",
      b.endDate AS "endDate",
      b.guests AS guests,
      b.phone AS phone,
      b.total AS total,
      b.status AS status,
      b.payment AS payment,
      b.createdAt AS "createdAt",
      l.id AS "listingId",
      l.name AS "listingName",
      l.slug AS slug,
      l.kind AS kind,
      l.city AS city,
      l.cover AS cover,
      u.name AS "guestName",
      u.email AS "guestEmail",
      b.extras AS extras,
      r.rating AS "reviewRating",
      r.body AS "reviewBody"
    FROM Booking b
    INNER JOIN Listing l ON l.id = b.listingId
    INNER JOIN "user" u ON u.id = b.userId
    LEFT JOIN Review r ON r.listingId = l.id AND r.userId = b.userId
    WHERE l.ownerId = ${ownerId}
    ORDER BY b.startDate DESC, b.createdAt DESC
  `;
}
