import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmationEmail, loadBookingForEmail } from "@/lib/booking-emails";
import { recordEmailSent } from "@/lib/booking-notify";
import { notifyUser } from "@/lib/notify";
import { parseBookingExtras } from "@/lib/booking-view";
import { publicOrigin } from "@/lib/auth-tokens";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The traveller re-sends their own confirmation (invoice + receipt) to their account email. */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;

    const row = await prisma.booking.findUnique({ where: { id }, select: { userId: true, status: true, extras: true } });
    if (!row || row.userId !== session.user.id) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (row.status !== "confirmed") {
      return NextResponse.json({ error: "A confirmation email is only available for confirmed bookings." }, { status: 400 });
    }
    const extra = parseBookingExtras(row.extras);
    const last = new Date(String(extra.lastResendAt ?? 0)).getTime();
    if (Number.isFinite(last) && Date.now() - last < 60_000) {
      return NextResponse.json({ error: "Please wait a minute before asking for another copy." }, { status: 429 });
    }

    const loaded = await loadBookingForEmail(id);
    const to = loaded?.dto.guestEmail ?? "";
    if (!loaded || !to.includes("@")) return NextResponse.json({ error: "No email address on this account." }, { status: 400 });

    const mail = confirmationEmail(loaded.dto, publicOrigin());
    const sent = await notifyUser({ to, subject: mail.subject, text: mail.text, html: mail.html });
    if (!sent.delivered) {
      return NextResponse.json({ error: "We could not send the email right now. Please try again shortly." }, { status: 502 });
    }

    const fresh = await prisma.booking.findUnique({ where: { id }, select: { extras: true } });
    const latest = parseBookingExtras(fresh?.extras ?? row.extras);
    latest.lastResendAt = new Date().toISOString();
    await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(latest) } });
    await recordEmailSent(id, "confirmation_resent", to);
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    console.error("[resend]", err);
    return NextResponse.json({ error: "Could not send the email." }, { status: 500 });
  }
}
