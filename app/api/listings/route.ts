import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withReviewStats } from "@/lib/moderation";
import { fetchListingsForOwner, fetchPublicListings, fetchReviewStatsMap } from "@/lib/listing-query";
import { encodeStayMeta, parseListingMeta } from "@/lib/listing-meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toCard(listing: {
  id: string;
  slug: string;
  kind: string;
  name: string;
  nastaliq: string;
  city: string;
  region: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  published: boolean;
  status: string;
  rejectReason: string;
  reviews?: { rating: number }[];
  meta?: string;
}) {
  const stats = withReviewStats(listing);
  const meta = parseListingMeta(listing.meta);
  return {
    id: listing.id,
    slug: listing.slug,
    kind: listing.kind,
    name: listing.name,
    nastaliq: listing.nastaliq,
    city: listing.city,
    region: listing.region,
    cover: listing.cover,
    description: listing.description,
    price: listing.price,
    priceUnit: listing.priceUnit,
    published: listing.published,
    status: listing.status ?? "pending",
    rejectReason: listing.rejectReason ?? "",
    reviewCount: stats.reviewCount,
    reviewAvg: stats.reviewAvg,
    meta,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");
    const mine = searchParams.get("mine");
    const session = await getServerSession(authOptions);

    const stats = await fetchReviewStatsMap();
    const asCards = (listings: Awaited<ReturnType<typeof fetchPublicListings>>) =>
      listings.map((l) => {
        const s = stats[l.id];
        return {
          ...toCard({ ...l, published: Boolean(l.published), price: Number(l.price), reviews: [], meta: l.meta }),
          reviewCount: s?.count ?? 0,
          reviewAvg: s?.avg ?? 0,
        };
      });

    if (mine === "1") {
      if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
      return NextResponse.json(asCards(await fetchListingsForOwner(session.user.id)));
    }

    return NextResponse.json(asCards(await fetchPublicListings(kind)));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load listings." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Owner account required" }, { status: 403 });
    }
    const body = await req.json();
    const kind = String(body.kind || session.user.ownerKind || "STAY");
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const base =
      String(body.slug ?? name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || kind.toLowerCase();
    let slug = base;
    let n = 1;
    while (await prisma.listing.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const meta = encodeStayMeta(body, { city: String(body.city ?? ""), cover: String(body.cover ?? ""), price: Number(body.price) || 0 });

    const listing = await prisma.listing.create({
      data: {
        slug,
        kind,
        ownerId: session.user.id,
        name,
        nastaliq: String(body.nastaliq ?? ""),
        city: String(body.city ?? ""),
        region: String(body.region ?? ""),
        cover: String(body.cover || "/images/hero-hunza-dusk.png"),
        description: String(body.description ?? ""),
        price: Number(body.price) || 0,
        priceUnit: String(body.priceUnit || "night"),
        published: false,
        meta,
      },
    });
    try {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { status: "pending", rejectReason: "" },
      });
    } catch {
      await prisma.$executeRaw`
        UPDATE Listing SET status = 'pending', rejectReason = '', published = false, meta = ${meta}, updatedAt = CURRENT_TIMESTAMP WHERE id = ${listing.id}
      `;
    }
    return NextResponse.json({
      id: listing.id,
      slug: listing.slug,
      kind: listing.kind,
      name: listing.name,
      status: listing.status,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Unknown argument") || message.includes("Unknown field")) {
      return NextResponse.json(
        { error: "The database client is out of date. Restart the Next.js server, then try Save again." },
        { status: 500 },
      );
    }
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A listing with this name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save listing." }, { status: 500 });
  }
}
