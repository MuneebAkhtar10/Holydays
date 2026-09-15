import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function extFor(file: File) {
  const fromMime = ALLOWED.get(file.type);
  if (fromMime) return { mime: file.type, ext: fromMime };
  const ext = path.extname(file.name).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return { mime: "image/jpeg", ext: ".jpg" };
  if (ext === ".png") return { mime: "image/png", ext };
  if (ext === ".webp") return { mime: "image/webp", ext };
  if (ext === ".gif") return { mime: "image/gif", ext };
  return null;
}

async function saveToDisk(bytes: Buffer, ext: string) {
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${filename}`;
}

async function saveToDb(userId: string, mime: string, bytes: Buffer) {
  const row = await prisma.media.create({
    data: { userId, mime, bytes },
    select: { id: true },
  });
  return `/api/media/${row.id}`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const data = await req.formData();
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image file" }, { status: 400 });
    }
    if (file.size > 6 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 6MB" }, { status: 400 });
    }

    const kind = extFor(file);
    if (!kind) {
      return NextResponse.json({ error: "Use PNG, JPG, or WebP" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const live = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

    if (live) {
      try {
        const url = await saveToDb(session.user.id, kind.mime, bytes);
        return NextResponse.json({ url });
      } catch (err) {
        console.error("[uploads] database", err);
        try {
          const url = await saveToDisk(bytes, kind.ext);
          return NextResponse.json({ url });
        } catch (diskErr) {
          console.error("[uploads] disk", diskErr);
          return NextResponse.json(
            { error: "Could not store this image on the server. Try a smaller JPG." },
            { status: 500 },
          );
        }
      }
    }

    try {
      const url = await saveToDisk(bytes, kind.ext);
      return NextResponse.json({ url });
    } catch (err) {
      console.error("[uploads] disk", err);
      const url = await saveToDb(session.user.id, kind.mime, bytes);
      return NextResponse.json({ url });
    }
  } catch (err) {
    console.error("[uploads]", err);
    return NextResponse.json({ error: "Could not upload image" }, { status: 500 });
  }
}
