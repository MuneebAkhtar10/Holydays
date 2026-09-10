import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const kinds = ["STAY", "ATTRACTION", "TAXI", "RESTAURANT"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (session.user.role === "ADMIN") {
    return NextResponse.json({ error: "Admin accounts cannot become partners." }, { status: 403 });
  }
  const { ownerKind } = await req.json();
  if (!kinds.includes(ownerKind)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "OWNER", ownerKind },
  });
  return NextResponse.json({ ok: true });
}
