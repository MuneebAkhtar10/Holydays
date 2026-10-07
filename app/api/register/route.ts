import { verifyEmailMail } from "@/lib/account-emails";
import { showDemoCodes } from "@/lib/verification";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { issueToken, publicOrigin } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";

const kinds = ["STAY", "ATTRACTION", "TAXI", "RESTAURANT"] as const;

function isUniqueEmailError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    const asOwner = Boolean(body.asOwner);
    const ownerKind = String(body.ownerKind ?? "");

    if (!name || !email.includes("@") || password.length < 6) {
      return NextResponse.json({ error: "Name, email, and a password of 6+ characters are required." }, { status: 400 });
    }
    if (asOwner && !kinds.includes(ownerKind as (typeof kinds)[number])) {
      return NextResponse.json({ error: "Choose what you operate: stay, attraction, taxi, or restaurant." }, { status: 400 });
    }

    const exists = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (exists) {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          role: asOwner ? "OWNER" : "TRAVELER",
          ownerKind: asOwner ? ownerKind : null,
        },
      });
    } catch (err) {
      if (isUniqueEmailError(err)) {
        return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
      }
      throw err;
    }

    let preview: string | null = null;
    try {
      const token = await issueToken(user.id, "email", 1000 * 60 * 60 * 24);
      const origin = publicOrigin();
      const link = `${origin}/verify-email?token=${token}`;
      const mail = verifyEmailMail({ name, link, origin });
      const sent = await notifyUser({ to: email, subject: mail.subject, text: mail.text, html: mail.html, code: token });
      preview = sent.delivered || !showDemoCodes() ? null : link;
    } catch (err) {
      console.error("[register] account created; verify email skipped", err);
    }

    return NextResponse.json({ ok: true, preview });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Could not create your account. Try again." }, { status: 500 });
  }
}
