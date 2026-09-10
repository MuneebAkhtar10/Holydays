import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { issueToken, sixDigitOtp } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";
import { fetchAccount, normalizePhone, setUserPhone } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const phone = normalizePhone(String(body.phone ?? ""));
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid mobile number (03xx xxxxxxx or +92…)." }, { status: 400 });
    }

    const user = await fetchAccount(session.user.id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await setUserPhone(user.id, phone);
    const otp = sixDigitOtp();
    await issueToken(user.id, "phone_otp", 1000 * 60 * 10, otp);
    const sent = await notifyUser({
      to: phone,
      subject: "Serai phone code",
      text: `Your Serai verification code is ${otp}. It expires in 10 minutes.`,
      code: otp,
    });
    return NextResponse.json({
      ok: true,
      phone,
      preview: sent.delivered ? null : otp,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not send code." }, { status: 500 });
  }
}
