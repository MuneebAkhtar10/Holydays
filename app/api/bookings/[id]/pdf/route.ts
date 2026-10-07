import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBookingForEmail } from "@/lib/booking-emails";
import { buildBookingPdf, type PdfKind } from "@/lib/booking-pdf";
import { isDisplayCurrency } from "@/lib/currency";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** /api/bookings/:id/pdf?kind=invoice|receipt|voucher&currency=USD — the signed-in guest downloads their own document. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;

    const owner = await prisma.booking.findUnique({ where: { id }, select: { userId: true } });
    if (!owner || owner.userId !== session.user.id) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const url = new URL(req.url);
    const kindParam = url.searchParams.get("kind");
    const kind: PdfKind = kindParam === "receipt" || kindParam === "voucher" ? kindParam : "invoice";
    const cur = url.searchParams.get("currency");
    const currency = isDisplayCurrency(cur) ? cur : "PKR";

    const loaded = await loadBookingForEmail(id);
    if (!loaded) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const bytes = await buildBookingPdf(loaded.dto, kind, currency);
    const name = `HolyDays-${kind === "voucher" ? "confirmation" : kind}-${loaded.dto.number}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[pdf]", err);
    return NextResponse.json({ error: "Could not create the PDF." }, { status: 500 });
  }
}
