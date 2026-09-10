import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { consumeToken, issueToken, publicOrigin } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";
import { fetchAccount, markEmailVerified } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "");
    if (token) {
      const user = await consumeToken("email", token);
      if (!user) return NextResponse.json({ error: "This verification link is invalid or expired." }, { status: 400 });
      await markEmailVerified(user.id);
      return NextResponse.json({ ok: true, email: user.email });
    }

    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const user = await fetchAccount(session.user.id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const next = await issueToken(user.id, "email", 1000 * 60 * 60 * 24);
    const link = `${publicOrigin()}/verify-email?token=${next}`;
    const sent = await notifyUser({
      to: user.email,
      subject: "Verify your Serai email",
      text: `Open this link: ${link}`,
      code: next,
    });
    return NextResponse.json({ ok: true, preview: sent.delivered ? null : link });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not verify email." }, { status: 500 });
  }
}
