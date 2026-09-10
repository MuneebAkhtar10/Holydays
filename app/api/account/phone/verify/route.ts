import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { consumeToken } from "@/lib/auth-tokens";
import { markPhoneVerified } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const code = String((await req.json()).code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });

    const user = await consumeToken("phone_otp", code);
    if (!user || user.id !== session.user.id) {
      return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 400 });
    }
    await markPhoneVerified(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not verify phone." }, { status: 500 });
  }
}
