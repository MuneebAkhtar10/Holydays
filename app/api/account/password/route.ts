import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { fetchAccount, setPasswordHash } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const next = String(body.nextPassword ?? "");
    if (next.length < 6) return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });

    const user = await fetchAccount(session.user.id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.passwordHash) {
      const current = String(body.currentPassword ?? "");
      const ok = await bcrypt.compare(current, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "Current password is not right." }, { status: 400 });
    }

    await setPasswordHash(user.id, await bcrypt.hash(next, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not change password." }, { status: 500 });
  }
}
