import { asMessages, bookingBucket, bookingNumber, chatReadOf, listingContact, parseBookingExtras, unreadCount, type BookingBucket, type BookingMessage } from "@/lib/booking-view";
import { kindPath, type ListingKind } from "@/lib/marketplace";
import { isPastBooking } from "@/lib/format";

export type BookingDTO = {
  id: string;
  number: string;
  startDate: string;
  endDate: string;
  guests: number;
  extras: string;
  extra: Record<string, unknown>;
  messages: BookingMessage[];
  unreadFromHost: number;
  payment: string;
  phone: string;
  total: number;
  status: string;
  createdAt: string;
  bucket: BookingBucket;
  past: boolean;
  guestName?: string;
  guestEmail?: string;
  listing: {
    id: string;
    slug: string;
    name: string;
    cover: string;
    city: string;
    region: string;
    kind: ListingKind;
    path: string;
    phone: string;
    email: string;
    address: string;
    checkIn: string;
    checkOut: string;
    hostName: string;
    hostPhone: string;
    hostEmail: string;
    hostContactHours: string;
    hostContactRevealed: boolean;
  };
  myReview?: { id: string; rating: number; body: string } | null;
};

export function toBookingDTO(row: {
  id: string;
  startDate: string;
  endDate: string;
  guests: number;
  extras: string;
  payment: string;
  phone: string;
  total: number;
  status: string;
  createdAt: Date | string;
  user?: { name?: string | null; email?: string | null } | null;
  listing: {
    id: string;
    slug: string;
    name: string;
    cover: string;
    city: string;
    region: string;
    kind: string;
    meta?: string | null;
  };
  myReview?: { id: string; rating: number; body: string } | null;
}): BookingDTO {
  const extra = parseBookingExtras(row.extras);
  const messages = asMessages(extra);
  const contact = listingContact(row.listing.meta);
  const kind = row.listing.kind as ListingKind;
  const hostContactRevealed = row.status === "confirmed";
  return {
    id: row.id,
    number: bookingNumber(row.id),
    startDate: row.startDate,
    endDate: row.endDate,
    guests: row.guests,
    extras: row.extras,
    extra,
    messages,
    unreadFromHost: unreadCount(messages, chatReadOf(extra).guest, "owner"),
    payment: row.payment,
    phone: row.phone,
    total: row.total,
    status: row.status,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
    bucket: bookingBucket(row),
    past: isPastBooking(row.endDate, row.startDate),
    guestName: row.user?.name ?? undefined,
    guestEmail: row.user?.email ?? undefined,
    listing: {
      id: row.listing.id,
      slug: row.listing.slug,
      name: row.listing.name,
      cover: row.listing.cover,
      city: row.listing.city,
      region: row.listing.region,
      kind,
      path: `/${kindPath[kind]}/${row.listing.slug}`,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      checkIn: contact.checkIn,
      checkOut: contact.checkOut,
      hostName: contact.hostName,
      hostPhone: hostContactRevealed ? contact.hostPhone : "",
      hostEmail: hostContactRevealed ? contact.hostEmail : "",
      hostContactHours: contact.hostContactHours,
      hostContactRevealed,
    },
    myReview: row.myReview ?? null,
  };
}
