import { prisma } from "@/lib/prisma";
import { toBookingDTO } from "@/lib/booking-dto";
import { notifyBookingCreated } from "@/lib/booking-notify";
import { parseBookingExtras } from "@/lib/booking-view";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { toStripeCharge } from "@/lib/stripe-money";
import type { DisplayCurrency } from "@/lib/currency";

export function isCardPayment(method: string) {
  return method === "card" || method === "stripe";
}

export async function packageBookingIds(bookingId: string) {
  const extras = await prisma.booking.findMany({
    where: { extras: { contains: `"packageId":"${bookingId}"` } },
    select: { id: true },
  });
  return [bookingId, ...extras.map((row) => row.id).filter((id) => id !== bookingId)];
}

export async function packageChargePkr(bookingId: string) {
  const ids = await packageBookingIds(bookingId);
  const rows = await prisma.booking.findMany({
    where: { id: { in: ids } },
    select: { total: true },
  });
  return rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
}

export async function createStripeCheckoutUrl(input: {
  bookingId: string;
  origin: string;
  currency: DisplayCurrency;
  customerEmail?: string;
}) {
  if (!stripeConfigured()) {
    throw new Error("Card payments are not configured. Add STRIPE_SECRET_KEY to the environment.");
  }
  const stripe = getStripe();
  if (!stripe) throw new Error("Card payments are not configured.");

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { listing: true, user: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "pending_payment") {
    throw new Error("This booking is not waiting for card payment.");
  }

  const pkr = await packageChargePkr(booking.id);
  const charge = toStripeCharge(pkr, input.currency);
  if (charge.amount < 50) {
    throw new Error("This total is too small to charge by card. Choose pay at property, or pick a longer stay.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${input.origin}/booked/${booking.id}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/booked/${booking.id}?pay=cancel`,
    customer_email: input.customerEmail || booking.user?.email || undefined,
    client_reference_id: booking.id,
    metadata: { bookingId: booking.id },
    managed_payments: { enabled: false },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: charge.currency,
          unit_amount: charge.amount,
          product_data: {
            name: booking.listing.name,
            description: `HolyDays ${booking.startDate} – ${booking.endDate}`,
            tax_code: "txcd_20060000",
          },
        },
      },
    ],
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");

  const extra = parseBookingExtras(booking.extras);
  extra.stripeSessionId = session.id;
  extra.stripeCurrency = charge.currency;
  await prisma.booking.update({
    where: { id: booking.id },
    data: { extras: JSON.stringify(extra), payment: "card" },
  });

  return session.url;
}

export async function markBookingsPaid(bookingId: string, sessionId: string, origin: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { include: { owner: true } }, user: true },
  });
  if (!booking) return null;
  if (booking.status === "confirmed") {
    return toBookingDTO(booking);
  }
  if (booking.status !== "pending_payment") {
    throw new Error("This booking cannot be marked paid.");
  }

  const ids = await packageBookingIds(booking.id);
  await prisma.booking.updateMany({
    where: { id: { in: ids }, status: "pending_payment" },
    data: { status: "confirmed", payment: "card" },
  });

  const extra = parseBookingExtras(booking.extras);
  extra.stripeSessionId = sessionId;
  extra.paidAt = new Date().toISOString();
  extra.paymentStatus = "paid";
  const saved = await prisma.booking.update({
    where: { id: booking.id },
    data: { extras: JSON.stringify(extra), status: "confirmed", payment: "card" },
    include: { listing: { include: { owner: true } }, user: true },
  });

  await notifyBookingCreated({
    email: saved.user?.email || "",
    phone: saved.phone,
    name: saved.user?.name || "Guest",
    listing: saved.listing.name,
    id: saved.id,
    startDate: saved.startDate,
    endDate: saved.endDate,
    total: saved.total,
    origin,
    ownerEmail: saved.listing.owner?.email,
  });

  return toBookingDTO(saved);
}
