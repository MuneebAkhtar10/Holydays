import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { markPhoneVerified } from "@/lib/account-store";
import { consumePhoneCode, recordWrongCode, tooManyWrongCodes } from "@/lib/verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const code = String((await req.json()).code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });

    const userId = session.user.id;
    if (await tooManyWrongCodes(userId)) {
      return NextResponse.json({ error: "Too many wrong codes. Wait a few minutes, then request a new code." }, { status: 429 });
    }
    if (!(await consumePhoneCode(userId, code))) {
      await recordWrongCode(userId);
      return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 400 });
    }
    await markPhoneVerified(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not verify phone." }, { status: 500 });
  }
}
