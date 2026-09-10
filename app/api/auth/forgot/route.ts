import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueToken, publicOrigin } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";

export async function POST(req: Request) {
  const email = String((await req.json()).email ?? "").toLowerCase().trim();
  if (!email.includes("@")) return NextResponse.json({ error: "Enter the email on your account." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  // Always look successful so emails cannot be enumerated.
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const token = await issueToken(user.id, "reset", 1000 * 60 * 60);
  const link = `${publicOrigin()}/reset-password?token=${token}`;
  const sent = await notifyUser({
    to: email,
    subject: "Reset your Serai password",
    text: `Reset your password: ${link}`,
    code: token,
  });
  return NextResponse.json({ ok: true, preview: sent.delivered ? null : link });
}
