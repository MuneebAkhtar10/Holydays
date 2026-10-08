import { prisma } from "@/lib/prisma";
import { toBookingDTO } from "@/lib/booking-dto";
import { notifyCancellationDecision } from "@/lib/booking-notify";
import { parseBookingExtras } from "@/lib/booking-view";
import { getStripe } from "@/lib/stripe";
import { packageChargePkr } from "@/lib/stripe-booking";

export type RefundRecord = {
  percent: number;
  /** In PKR, the app's stored currency. */
  amountPkr: number;
  /** In the currency the card was charged, minor units (cents). */
  amountMinor: number;
  currency: string;
  status: "none" | "pending" | "succeeded" | "failed";
  stripeRefundId?: string;
  by: "owner" | "admin";
  at: string;
};

type Row = NonNullable<Awaited<ReturnType<typeof loadRow>>>;

const loadRow = (id: string) => prisma.booking.findUnique({ where: { id }, include: { listing: true, user: true } });

/**
 * Returns the guest's card payment for this booking, in proportion. Only the booking that carries the Stripe session
 * (the main one in a package) holds the money; sibling hotels in the same package refund nothing on their own.
 */
async function refundCardPayment(row: Row, percent: number, by: "owner" | "admin"): Promise<RefundRecord | null> {
  const extra = parseBookingExtras(row.extras);
  const sessionId = String(extra.stripeSessionId ?? "");
  const paid = extra.paymentStatus === "paid" || Boolean(extra.paidAt);
  if (!paid || !sessionId) return null;

  const existing = extra.refund as RefundRecord | undefined;
  if (existing && (existing.status === "succeeded" || existing.status === "pending")) return existing;

  const base = { percent, by, at: new Date().toISOString() };
  const totalPkr = await packageChargePkr(row.id);
  const amountPkr = Math.round((totalPkr * percent) / 100);
  if (percent <= 0) return { ...base, amountPkr: 0, amountMinor: 0, currency: String(extra.stripeCurrency ?? ""), status: "none" };

  const stripe = getStripe();
  if (!stripe) throw new Error("Card payments are not configured, so the refund could not be sent. Add STRIPE_SECRET_KEY.");

  const checkout = await stripe.checkout.sessions.retrieve(sessionId);
  const intent = typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent?.id;
  if (!intent) throw new Error("Could not find the card payment for this booking in Stripe.");
  const amountMinor = Math.floor(((checkout.amount_total ?? 0) * percent) / 100);
  if (amountMinor < 1) return { ...base, amountPkr: 0, amountMinor: 0, currency: checkout.currency ?? "", status: "none" };

  const refund = await stripe.refunds.create(
    {
      payment_intent: intent,
      amount: amountMinor,
      reason: "requested_by_customer",
      metadata: { bookingId: row.id, percent: String(percent) },
    },
    { idempotencyKey: `holydays-refund-${row.id}-${percent}` },
  );
  return {
    ...base,
    amountPkr,
    amountMinor,
    currency: checkout.currency ?? "",
    status: refund.status === "failed" || refund.status === "canceled" ? "failed" : refund.status === "succeeded" ? "succeeded" : "pending",
    stripeRefundId: refund.id,
  };
}

export class CancelDecisionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Approve or deny a guest's cancellation request. Approving a card-paid booking sends the refund before it is marked cancelled. */
export async function decideCancellation(input: {
  id: string;
  approve: boolean;
  by: "owner" | "admin";
  /** 0–100. Defaults to what the booking's cancellation policy says. */
  refundPercent?: unknown;
  /** Owners may only decide their own listings. */
  ownerId?: string;
}) {
  const booking = await loadRow(input.id);
  if (!booking || (input.ownerId && booking.listing.ownerId !== input.ownerId)) throw new CancelDecisionError("Booking not found", 404);
  if (booking.status !== "cancel_requested") throw new CancelDecisionError("This booking has no pending cancellation request.");

  const extra = parseBookingExtras(booking.extras);
  extra.cancelDecision = input.approve ? "approved" : "denied";
  extra.cancelDecidedAt = new Date().toISOString();
  extra.cancelDecidedBy = input.by;

  if (input.approve) {
    const outlook = toBookingDTO(booking).refundOutlook;
    const asked = Number(input.refundPercent);
    const percent = Number.isFinite(asked) && input.refundPercent !== undefined && input.refundPercent !== "" ? Math.min(100, Math.max(0, Math.round(asked))) : outlook.percent;
    try {
      const refund = await refundCardPayment(booking, percent, input.by);
      if (refund) extra.refund = refund;
    } catch (err) {
      console.error("[refund] failed", err);
      throw new CancelDecisionError(
        `The refund could not be sent, so the booking was not cancelled. ${err instanceof Error ? err.message : ""}`.trim(),
        502,
      );
    }
  }

  const updated = await prisma.booking.update({
    where: { id: input.id },
    data: { status: input.approve ? "cancelled" : "confirmed", extras: JSON.stringify(extra) },
    include: { listing: true, user: true },
  });
  await notifyCancellationDecision(updated.id, input.approve);
  return toBookingDTO(updated);
}
