import { prisma } from "@/lib/prisma";
import { datesOverlap } from "@/lib/format";
import { stayRooms } from "@/lib/pricing";
import type { Stay } from "@/lib/types";

/** How many rooms are still free at this hotel for the given dates, against every OTHER guest's confirmed booking
 *  (not just the current user's) — the actual server-side capacity check, independent of the live UI hint. */
export async function roomsLeftFor(
  listingId: string,
  stay: Stay,
  checkin: string,
  checkout: string,
  excludeBookingId?: string,
): Promise<number> {
  const bookings = await prisma.booking.findMany({
    where: {
      listingId,
      status: "confirmed",
      ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
    },
    select: { startDate: true, endDate: true },
  });
  const overlapping = bookings.filter((b) => datesOverlap(checkin, checkout, b.startDate, b.endDate)).length;
  const totalCapacity = stayRooms(stay).reduce((sum, r) => sum + r.available, 0);
  return Math.max(0, totalCapacity - overlapping);
}
