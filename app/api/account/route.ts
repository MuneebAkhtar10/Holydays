import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { issueToken, publicOrigin } from "@/lib/auth-tokens";
import { notifyUser } from "@/lib/notify";
import {
  deleteAccount,
  fetchAccount,
  fetchAccountByEmail,
  updateAccount,
} from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toJson(user: NonNullable<Awaited<ReturnType<typeof fetchAccount>>>) {
  let preferences: Record<string, unknown> = {};
  try {
    preferences = JSON.parse(user.preferences || "{}") as Record<string, unknown>;
  } catch {
    preferences = {};
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    phone: user.phone ?? "",
    phoneVerified: Boolean(user.phoneVerified),
    emailVerified: Boolean(user.emailVerified),
    nationality: user.nationality ?? "",
    residency: user.residency ?? "",
    hasPassword: Boolean(user.passwordHash),
    google: Boolean(user.googleId),
    preferences,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const user = await fetchAccount(session.user.id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toJson(user));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load account." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const current = await fetchAccount(session.user.id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const name = body.name !== undefined ? String(body.name).trim() : current.name;
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    let email = current.email;
    let emailVerified = current.emailVerified;
    let preview: string | null = null;
    if (body.email !== undefined) {
      const nextEmail = String(body.email).toLowerCase().trim();
      if (!nextEmail.includes("@")) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
      if (nextEmail !== current.email) {
        const taken = await fetchAccountByEmail(nextEmail);
        if (taken) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
        email = nextEmail;
        emailVerified = null;
        const token = await issueToken(current.id, "email", 1000 * 60 * 60 * 24);
        const link = `${publicOrigin()}/verify-email?token=${token}`;
        const sent = await notifyUser({
          to: email,
          subject: "Verify your new Serai email",
          text: `Confirm this address: ${link}`,
          code: token,
        });
        preview = sent.delivered ? null : link;
      }
    }

    let preferences = current.preferences || "{}";
    if (body.preferences && typeof body.preferences === "object") {
      preferences = JSON.stringify(body.preferences);
    }

    await updateAccount(current.id, {
      name,
      email,
      image: body.image !== undefined ? String(body.image || "") || null : current.image,
      nationality: body.nationality !== undefined ? String(body.nationality) : current.nationality ?? "",
      residency: body.residency !== undefined ? String(body.residency) : current.residency ?? "",
      preferences,
      emailVerified,
    });

    const updated = await fetchAccount(current.id);
    return NextResponse.json({
      ok: true,
      ...(updated ? toJson(updated) : {}),
      preview,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not save profile." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    await deleteAccount(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not delete account." }, { status: 500 });
  }
}
