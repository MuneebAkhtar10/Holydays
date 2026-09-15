import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchOwnerBookings } from "@/lib/owner-bookings";
import { asMessages, chatReadOf, parseBookingExtras, unreadCount } from "@/lib/booking-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ unread: 0 });

  if (session.user.role === "OWNER") {
    const rows = await fetchOwnerBookings(session.user.id);
    const unread = rows.reduce((sum, b) => {
      if (String(b.status) === "cancelled") return sum;
      const extra = parseBookingExtras(String(b.extras ?? ""));
      const messages = asMessages(extra);
      return sum + unreadCount(messages, chatReadOf(extra).owner, "guest");
    }, 0);
    return NextResponse.json({ unread, inbox: "/owner?tab=messages" });
  }

  const rows = await prisma.booking.findMany({
    where: { userId: session.user.id, status: { not: "cancelled" } },
    select: { extras: true, id: true },
  });
  let unread = 0;
  let firstId = "";
  for (const row of rows) {
    const extra = parseBookingExtras(row.extras);
    const n = unreadCount(asMessages(extra), chatReadOf(extra).guest, "owner");
    if (n > 0 && !firstId) firstId = row.id;
    unread += n;
  }
  return NextResponse.json({ unread, inbox: firstId ? `/bookings/${firstId}` : "/trips" });
}
