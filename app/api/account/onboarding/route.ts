import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const kinds = ["STAY", "ATTRACTION", "TAXI", "RESTAURANT"] as const;

function parsePrefs(raw: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ needsRole: false });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  return NextResponse.json({ needsRole: parsePrefs(user?.preferences).needsRole === true });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const prefs = parsePrefs(user.preferences);
  if (prefs.needsRole !== true) return NextResponse.json({ error: "Account type is already set." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const asOwner = Boolean(body.asOwner);
  const ownerKind = String(body.ownerKind ?? "");
  if (asOwner && !kinds.includes(ownerKind as (typeof kinds)[number])) {
    return NextResponse.json({ error: "Choose what you operate: stay, attraction, taxi, or restaurant." }, { status: 400 });
  }

  delete prefs.needsRole;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: asOwner ? "OWNER" : "TRAVELER",
      ownerKind: asOwner ? ownerKind : null,
      preferences: JSON.stringify(prefs),
    },
  });
  return NextResponse.json({ ok: true, role: asOwner ? "OWNER" : "TRAVELER" });
}
