import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { fetchAdminListings } from "@/lib/admin-listings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const status = new URL(req.url).searchParams.get("status") || "pending";
    const rows = await fetchAdminListings(status);
    return NextResponse.json(
      rows.map((l) => ({
        id: l.id,
        slug: l.slug,
        kind: l.kind,
        name: l.name,
        city: l.city,
        cover: l.cover,
        description: l.description,
        price: Number(l.price),
        priceUnit: l.priceUnit,
        status: l.status,
        rejectReason: l.rejectReason,
        owner: { name: l.ownerName, email: l.ownerEmail },
      })),
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load the approval queue." }, { status: 500 });
  }
}
