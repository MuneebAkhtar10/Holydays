import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { consumeToken, issueToken, publicOrigin } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";
import { fetchAccount, markEmailVerified } from "@/lib/account-store";
import { verifyEmailMail } from "@/lib/account-emails";
import { cooldownLeft, showDemoCodes } from "@/lib/verification";

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
    if (user.emailVerified) return NextResponse.json({ ok: true, already: true });
    const wait = await cooldownLeft(user.id, "email");
    if (wait > 0) {
      return NextResponse.json({ error: `Please wait ${wait} seconds before asking for another email.`, retryAfter: wait }, { status: 429 });
    }
    const next = await issueToken(user.id, "email", 1000 * 60 * 60 * 24);
    const origin = publicOrigin();
    const link = `${origin}/verify-email?token=${next}`;
    const mail = verifyEmailMail({ name: user.name, link, origin });
    const sent = await notifyUser({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html, code: next });
    if (!sent.delivered && !showDemoCodes()) {
      return NextResponse.json({ error: "We could not send the email right now. Please try again shortly." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, preview: sent.delivered ? null : link });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not verify email." }, { status: 500 });
  }
}
