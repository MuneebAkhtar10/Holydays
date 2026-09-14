import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { markBookingsPaid } from "@/lib/stripe-booking";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    if (!sessionId) return NextResponse.json({ error: "Missing Stripe session" }, { status: 400 });

    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Card payments are not configured." }, { status: 503 });

    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const bookingId = String(checkout.metadata?.bookingId || checkout.client_reference_id || "");
    if (!bookingId) return NextResponse.json({ error: "No booking on this payment" }, { status: 400 });
    if (checkout.payment_status !== "paid" && checkout.status !== "complete") {
      return NextResponse.json({ error: "Payment is not complete yet." }, { status: 402 });
    }

    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { userId: true } });
    if (!row || row.userId !== session.user.id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const booking = await markBookingsPaid(bookingId, sessionId, origin);
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    return NextResponse.json(booking);
  } catch (err) {
    console.error("POST /api/stripe/confirm", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not confirm payment" },
      { status: 400 },
    );
  }
}
