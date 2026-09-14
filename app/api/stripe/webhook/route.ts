import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { markBookingsPaid } from "@/lib/stripe-booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const checkout = event.data.object as { id: string; metadata?: { bookingId?: string }; client_reference_id?: string | null };
    const bookingId = String(checkout.metadata?.bookingId || checkout.client_reference_id || "");
    if (bookingId) {
      const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
      try {
        await markBookingsPaid(bookingId, checkout.id, origin);
      } catch (err) {
        console.error("stripe webhook confirm", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
