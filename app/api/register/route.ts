import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { issueToken, publicOrigin } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";

const kinds = ["STAY", "ATTRACTION", "TAXI", "RESTAURANT"] as const;

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const asOwner = Boolean(body.asOwner);
  const ownerKind = String(body.ownerKind ?? "");

  if (!name || !email || password.length < 6) {
    return NextResponse.json({ error: "Name, email, and a password of 6+ characters are required." }, { status: 400 });
  }
  if (asOwner && !kinds.includes(ownerKind as (typeof kinds)[number])) {
    return NextResponse.json({ error: "Choose what you operate: stay, attraction, taxi, or restaurant." }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: asOwner ? "OWNER" : "TRAVELER",
      ownerKind: asOwner ? ownerKind : null,
    },
  });

  const token = await issueToken(user.id, "email", 1000 * 60 * 60 * 24);
  const link = `${publicOrigin()}/verify-email?token=${token}`;
  const sent = await notifyUser({
    to: email,
    subject: "Verify your Serai email",
    text: `Open this link to verify your email: ${link}`,
    code: token,
  });

  return NextResponse.json({ ok: true, preview: sent.delivered ? null : link });
}
