import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { setListingModeration } from "@/lib/admin-listings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const status = String(body.status ?? "");
    if (status !== "approved" && status !== "rejected" && status !== "pending") {
      return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
    }

    await setListingModeration(id, status, String(body.rejectReason ?? "Does not meet Serai standards."));
    return NextResponse.json({ id, status });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not update listing." }, { status: 500 });
  }
}
