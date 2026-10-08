import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { CancelDecisionError, decideCancellation } from "@/lib/refunds";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const dto = await decideCancellation({
      id,
      approve: Boolean(body.approve),
      by: "admin",
      refundPercent: body.refundPercent,
    });
    return NextResponse.json(dto);
  } catch (err) {
    if (err instanceof CancelDecisionError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Could not update this cancellation request." }, { status: 500 });
  }
}
