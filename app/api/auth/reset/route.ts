import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/auth-tokens";

export async function POST(req: Request) {
  const body = await req.json();
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  const user = await consumeToken("reset", token);
  if (!user) return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  return NextResponse.json({ ok: true });
}
