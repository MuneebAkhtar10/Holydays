import { parseListingMeta } from "@/lib/listing-meta";
import { CANCEL_LABEL } from "@/lib/rooms";
import { todayIso } from "@/lib/format";
import type { CancelPolicy } from "@/lib/types";

/** What a guest can expect back if they cancel a booking they have already paid for by card. */
export type RefundOutlook = {
  /** Paid in advance by card, so there is money to return. */
  paid: boolean;
  policy: CancelPolicy;
  /** Suggested share of the amount paid, 0–100. The approver can change it. */
  percent: number;
  /** One line a person can read, e.g. "Partial refund rate: 50% back". */
  note: string;
};

const RANK: Record<CancelPolicy, number> = { free: 0, partial: 1, strict: 2 };

const isPolicy = (v: unknown): v is CancelPolicy => v === "free" || v === "partial" || v === "strict";

function daysUntil(iso: string) {
  const a = new Date(`${todayIso()}T12:00:00`).getTime();
  const b = new Date(`${iso}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** The cancellation term of the rate(s) the guest picked. Stored on the booking, with the hotel's current rates as a fallback for older bookings. */
export function bookingCancelPolicy(extra: Record<string, unknown>, listingMeta: string | null | undefined): CancelPolicy {
  if (isPolicy(extra.cancelPolicy)) return extra.cancelPolicy;
  const picks = Array.isArray(extra.picks) && extra.picks.length
    ? (extra.picks as { roomId: string; ratePlanId: string }[])
    : extra.roomId
      ? [{ roomId: String(extra.roomId), ratePlanId: String(extra.ratePlanId ?? "") }]
      : [];
  if (!picks.length) return "partial";
  const meta = parseListingMeta(listingMeta);
  let worst: CancelPolicy | null = null;
  for (const p of picks) {
    const room = meta.rooms.find((r) => r.id === p.roomId);
    const rate = room?.rates?.find((x) => x.id === p.ratePlanId) ?? room?.rates?.[0];
    const c = rate?.cancellation ?? meta.cancellation;
    if (isPolicy(c) && (!worst || RANK[c] > RANK[worst])) worst = c;
  }
  return worst ?? "partial";
}

export function refundOutlook(input: {
  extra: Record<string, unknown>;
  kind: string;
  startDate: string;
  listingMeta?: string | null;
}): RefundOutlook {
  const paid = input.extra.paymentStatus === "paid" || Boolean(input.extra.paidAt);
  const days = daysUntil(input.startDate);
  if (input.kind !== "STAY") {
    // Taxis, Ziyarat visits and tables: full refund with notice, half the day before, none on the day.
    const policy: CancelPolicy = days >= 2 ? "free" : days >= 1 ? "partial" : "strict";
    const percent = days >= 2 ? 100 : days >= 1 ? 50 : 0;
    const note =
      percent === 100
        ? "Cancelled at least 2 days ahead: full refund"
        : percent === 50
          ? "Cancelled the day before: 50% refund"
          : "Cancelled on the day: no refund";
    return { paid, policy, percent, note };
  }
  const policy = bookingCancelPolicy(input.extra, input.listingMeta);
  let percent = 0;
  let note = "";
  if (policy === "free") {
    percent = days >= 2 ? 100 : 50;
    note = days >= 2 ? `${CANCEL_LABEL.free}: full refund` : `${CANCEL_LABEL.free} applies up to 2 days before check-in: 50% refund`;
  } else if (policy === "partial") {
    percent = 50;
    note = `${CANCEL_LABEL.partial} rate: 50% back`;
  } else {
    note = `${CANCEL_LABEL.strict} rate: no refund`;
  }
  return { paid, policy, percent, note };
}

/** Text for the cancel dialog. Empty when the guest has not paid yet. */
export function refundHint(b: { refundOutlook: RefundOutlook }) {
  return b.refundOutlook.paid
    ? `You paid by card. ${b.refundOutlook.note}. Once the cancellation is approved, the refund goes back to your card.`
    : "";
}
