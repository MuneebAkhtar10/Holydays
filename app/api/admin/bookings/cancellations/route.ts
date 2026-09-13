import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toBookingDTO } from "@/lib/booking-dto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const rows = await prisma.booking.findMany({
      where: { status: "cancel_requested" },
      include: { listing: true, user: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows.map((row) => toBookingDTO(row)));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load cancellation requests." }, { status: 500 });
  }
}
