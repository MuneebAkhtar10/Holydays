import { toBookingDTO } from "@/lib/booking-dto";
import { bookingInvoiceBreakdown, bookingIsPaid, type StoredPackage } from "@/lib/booking-invoice";
import { parseBookingExtras } from "@/lib/booking-view";
import { formatPKR, nightsBetween } from "@/lib/format";
import { guideAmount } from "@/lib/trip-total";
import { parseListingMeta } from "@/lib/listing-meta";
import { packagePrimaryAmount } from "@/lib/package-plan";
import { CANCEL_LABEL, MEAL_PLAN_LABEL, PAY_LABEL, BED_LABEL } from "@/lib/rooms";
import type { RefundOutlook } from "@/lib/refund-policy";
import type { OwnerBookingRow } from "@/lib/owner-bookings";

export type OwnerRoomLine = {
  name: string;
  count: number;
  rate: string;
  meal: string;
  cancellation: string;
  payment: string;
  sleeps?: number;
  size?: number;
  beds?: string;
};

export type OwnerInvoiceLine = { label: string; note?: string; amount: number; indent?: boolean; strong?: boolean };

export type OwnerDetail = {
  number: string;
  placedAt: string;
  nights: number;
  checkIn: string;
  checkOut: string;
  rooms: OwnerRoomLine[];
  extraBeds: number;
  cribs: number;
  airportTransfer: boolean;
  promo: string;
  requests: string;
  reservation?: { time: string };
  taxiMode?: string;
  /** Multi-day Ziyarat plan: days booked and the per-day rate. */
  visit?: { days: number; guests: number; rate: number; unit: string; guideFee: number; guideUnit: string; free: boolean };
  paid: boolean;
  refundOutlook: RefundOutlook;
  /** Set once a cancellation of a card-paid booking was approved. */
  refund: null | { percent: number; amountPkr: number; status: string; at: string };
  wasPaid: boolean;
  invoice: OwnerInvoiceLine[];
  invoiceTotal: number;
  package: null | {
    type: string;
    hotels: { name: string; city: string; checkin: string; checkout: string }[];
    meals: { breakfast: number; lunch: number; dinner: number };
    ziyarat: string[];
    transfers: { label: string; date: string; mode: string }[];
    insurance: boolean;
    esim: number;
  };
};

const FLOW_LABEL: Record<string, string> = { ziyarat: "Ziyarat package", package: "Custom multi-city package" };

/** Everything a partner needs to see about one booking: the exact rooms, the package type, and an itemised invoice for their own part. */
export function buildOwnerDetail(row: OwnerBookingRow): OwnerDetail {
  const extra = parseBookingExtras(row.extras);
  const meta = parseListingMeta(row.listingMeta);
  const nights = nightsBetween(row.startDate, row.endDate);
  const isStay = row.kind === "STAY";
  const pack = extra.package as (StoredPackage & { flow?: string; stays?: { name: string; city: string; checkin: string; checkout: string; amount: number }[] }) | undefined;

  // Rooms (a booking can hold several room types)
  const picks = Array.isArray(extra.picks) && extra.picks.length
    ? (extra.picks as { roomId: string; ratePlanId: string; rooms: number }[])
    : extra.roomId
      ? [{ roomId: String(extra.roomId), ratePlanId: String(extra.ratePlanId ?? ""), rooms: Number(extra.rooms) || 1 }]
      : [];
  const rooms: OwnerRoomLine[] = isStay
    ? picks.map((p) => {
        const room = meta.rooms.find((r) => r.id === p.roomId);
        const rate = room?.rates?.find((x) => x.id === p.ratePlanId) ?? room?.rates?.[0];
        return {
          name: room?.name || String(extra.roomLabel ?? "Room"),
          count: p.rooms || 1,
          rate: rate?.name || "Standard rate",
          meal: rate ? MEAL_PLAN_LABEL[rate.meal] : "",
          cancellation: rate ? CANCEL_LABEL[rate.cancellation] : "",
          payment: rate ? PAY_LABEL[rate.payment] : "",
          sleeps: room?.sleeps,
          size: room?.sizeSqm,
          beds: room?.beds?.map((b) => `${b.count} × ${BED_LABEL[b.kind]}`).join(", "),
        };
      })
    : [];
  if (isStay && !rooms.length && extra.roomLabel) {
    rooms.push({ name: String(extra.roomLabel), count: Number(extra.rooms) || 1, rate: "", meal: "", cancellation: "", payment: "", });
  }

  const dto = toBookingDTO({
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    guests: row.guests,
    extras: row.extras,
    payment: row.payment,
    phone: row.phone,
    total: row.total,
    status: row.status,
    createdAt: row.createdAt,
    user: { name: row.guestName, email: row.guestEmail },
    listing: { id: row.listingId, slug: row.slug, name: row.listingName, cover: row.cover, city: row.city, region: row.region, kind: row.kind, meta: row.listingMeta },
  });
  const paid = bookingIsPaid(dto);

  // Invoice for this partner's own listing
  const quote = extra.quote as { total?: number; taxes?: number; grand?: number } | undefined;
  const invoice: OwnerInvoiceLine[] = [];
  let invoiceTotal = row.total;

  if (isStay) {
    const roomText = rooms.map((r) => `${r.name}${r.count > 1 ? ` × ${r.count}` : ""}`).join(", ") || "Accommodation";
    const own = pack ? packagePrimaryAmount(row.total, { total: pack.total ?? 0, stays: (pack.stays ?? []) as never }) : row.total;
    const base = quote?.total ?? own - (quote?.taxes ?? 0);
    invoice.push({ label: "Room charges", note: `${roomText} · ${nights} night${nights === 1 ? "" : "s"}`, amount: base });
    if ((quote?.taxes ?? 0) > 0) invoice.push({ label: "Taxes & service charges", amount: quote!.taxes! });
    invoiceTotal = quote?.grand ?? own;
    if (pack) {
      const breakdown = bookingInvoiceBreakdown(dto);
      const mine = breakdown?.hotels.find((h) => h.id === "primary");
      const meals = mine?.mealLines ?? [];
      if (meals.length) {
        invoice.push({ label: "Package meals at your property", amount: meals.reduce((sum, m) => sum + m.amount, 0) });
        for (const m of meals) invoice.push({ label: m.label, amount: m.amount, indent: true });
        invoiceTotal += meals.reduce((sum, m) => sum + m.amount, 0);
      }
    }
  } else {
    const v = extra.visit as { days?: number; guests?: number; rate?: number; unit?: string; guideFee?: number; guideUnit?: string; free?: boolean } | undefined;
    if (v && !v.free && !extra.reservation) {
      const days = Number(v.days) || 1;
      const guests = Number(v.guests) || row.guests;
      const perPerson = v.unit === "person";
      const visitPart = (perPerson ? (Number(v.rate) || 0) * guests : Number(v.rate) || 0) * days;
      const guidePart = guideAmount(v.guideFee, v.guideUnit, guests, days);
      if (visitPart > 0) {
        invoice.push({
          label: "Visit fee",
          note: `${formatPKR(Number(v.rate) || 0)}${perPerson ? ` × ${guests} guest${guests === 1 ? "" : "s"}` : ""} × ${days} day${days === 1 ? "" : "s"}`,
          amount: visitPart,
        });
      }
      if (guidePart > 0) {
        invoice.push({
          label: "Guide fee",
          note: `${formatPKR(Number(v.guideFee) || 0)}${v.guideUnit === "group" ? " flat for the group" : ` × ${guests} guest${guests === 1 ? "" : "s"}`} × ${days} day${days === 1 ? "" : "s"}`,
          amount: guidePart,
        });
      }
      if (!visitPart && !guidePart) invoice.push({ label: row.listingName, amount: row.total });
    } else {
      invoice.push({
        label: row.listingName,
        note: extra.reservation ? `Table for ${row.guests}` : v?.free ? "Free visit" : undefined,
        amount: row.total,
      });
    }
  }

  const flow = String(pack?.flow ?? "");
  const hotels = pack
    ? [{ name: row.listingName, city: row.city, checkin: row.startDate, checkout: row.endDate }, ...(pack.stays ?? []).map((s) => ({ name: s.name, city: s.city, checkin: s.checkin, checkout: s.checkout }))]
    : [];

  return {
    number: dto.number,
    placedAt: dto.createdAt,
    nights,
    checkIn: meta.checkIn,
    checkOut: meta.checkOut,
    rooms,
    extraBeds: Number(extra.extraBeds) || 0,
    cribs: Number(extra.cribs) || 0,
    airportTransfer: Boolean(extra.airportTransfer),
    promo: String(extra.promo ?? ""),
    requests: String(extra.specialRequests ?? extra.requests ?? "").trim(),
    reservation: extra.reservation && extra.time ? { time: String(extra.time) } : undefined,
    taxiMode: row.kind === "TAXI" ? String(extra.taxiMode ?? "") : undefined,
    visit:
      row.kind === "ATTRACTION" && extra.visit && typeof extra.visit === "object"
        ? {
            days: Number((extra.visit as { days?: number }).days) || 1,
            guests: Number((extra.visit as { guests?: number }).guests) || row.guests,
            rate: Number((extra.visit as { rate?: number }).rate) || 0,
            unit: String((extra.visit as { unit?: string }).unit ?? ""),
            guideFee: Number((extra.visit as { guideFee?: number }).guideFee) || 0,
            guideUnit: String((extra.visit as { guideUnit?: string }).guideUnit ?? "person"),
            free: Boolean((extra.visit as { free?: boolean }).free),
          }
        : undefined,
    paid,
    refundOutlook: dto.refundOutlook,
    refund:
      extra.refund && typeof extra.refund === "object"
        ? {
            percent: Number((extra.refund as { percent?: number }).percent) || 0,
            amountPkr: Number((extra.refund as { amountPkr?: number }).amountPkr) || 0,
            status: String((extra.refund as { status?: string }).status ?? ""),
            at: String((extra.refund as { at?: string }).at ?? ""),
          }
        : null,
    wasPaid: extra.paymentStatus === "paid" || Boolean(extra.paidAt),
    invoice,
    invoiceTotal,
    package: pack
      ? {
          type: FLOW_LABEL[flow] ?? "Package",
          hotels,
          meals: {
            breakfast: Array.isArray(pack.meals?.breakfast) ? pack.meals!.breakfast.length : 0,
            lunch: Array.isArray(pack.meals?.lunch) ? pack.meals!.lunch.length : 0,
            dinner: Array.isArray(pack.meals?.dinner) ? pack.meals!.dinner.length : 0,
          },
          ziyarat: (pack.ziyaratIds ?? []).map((id) => (pack.ziyarat ?? []).find((z) => z.id === id)?.name ?? id),
          transfers: (pack.taxis ?? []).map((t) => {
            const info = (pack.taxiList ?? []).find((x) => x.id === t.id);
            const leg = t.leg === "out" ? "Airport drop-off" : t.leg === "in" ? "Airport pick-up" : "Trip";
            return {
              label: `${leg}: ${info ? `${info.origin} to ${info.destination}` : t.id}`,
              date: t.date,
              mode: t.mode === "private" ? "Private vehicle" : `${t.seats} seat${t.seats === 1 ? "" : "s"} shared`,
            };
          }),
          insurance: Boolean(pack.insurance),
          esim: Object.values(pack.esimSelections ?? {}).reduce((sum, n) => sum + (Number(n) || 0), 0),
        }
      : null,
  };
}
