import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStripeCheckoutUrl } from "@/lib/stripe-booking";
import { displayCurrencyFromRequest } from "@/lib/stripe-money";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const bookingId = String(body.bookingId ?? "");
    if (!bookingId) return NextResponse.json({ error: "Missing booking" }, { status: 400 });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const url = await createStripeCheckoutUrl({
      bookingId,
      origin,
      currency: displayCurrencyFromRequest(req, body),
      customerEmail: session.user.email || undefined,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("POST /api/stripe/checkout", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start card payment" },
      { status: 400 },
    );
  }
}
