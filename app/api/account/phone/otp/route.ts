import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { issueToken, sixDigitOtp } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";
import { fetchAccount, normalizePhone, setUserPhone } from "@/lib/account-store";
import { RESEND_COOLDOWN_SECONDS, cooldownLeft, showDemoCodes } from "@/lib/verification";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const phone = normalizePhone(String(body.phone ?? ""));
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid mobile number, with country code (for example +92 300 1234567) or 03xx xxxxxxx." }, { status: 400 });
    }

    const user = await fetchAccount(session.user.id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const wait = await cooldownLeft(user.id, "phone_otp");
    if (wait > 0) {
      return NextResponse.json({ error: `Please wait ${wait} seconds before asking for another code.`, retryAfter: wait }, { status: 429 });
    }

    await setUserPhone(user.id, phone);
    const otp = sixDigitOtp();
    await issueToken(user.id, "phone_otp", 1000 * 60 * 10, otp);
    const sent = await notifyUser({
      to: phone,
      subject: "HolyDays phone code",
      text: `HolyDays: your verification code is ${otp}. It expires in 10 minutes. Never share it with anyone.`,
      code: otp,
    });

    if (!sent.delivered && !showDemoCodes()) {
      await prisma.authToken.deleteMany({ where: { userId: user.id, type: "phone_otp" } });
      return NextResponse.json({ error: "We could not send the text message right now. Please try again shortly." }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      phone,
      cooldown: RESEND_COOLDOWN_SECONDS,
      preview: sent.delivered ? null : otp,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not send code." }, { status: 500 });
  }
}
