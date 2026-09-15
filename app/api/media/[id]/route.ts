import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await prisma.media.findUnique({ where: { id }, select: { mime: true, bytes: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Uint8Array.from(row.bytes), {
    headers: {
      "Content-Type": row.mime || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
