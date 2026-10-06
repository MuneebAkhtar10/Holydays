import { NextResponse } from "next/server";
import { runBookingReminders } from "@/lib/booking-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Called daily by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const dryRun = new URL(req.url).searchParams.get("dry") === "1";
    return NextResponse.json(await runBookingReminders({ dryRun }));
  } catch (err) {
    console.error("[cron] booking-reminders", err);
    return NextResponse.json({ error: "Reminder run failed." }, { status: 500 });
  }
}
