import type { BookingDTO } from "@/lib/booking-dto";
import {
  packageGrandTotal,
  packageInvoiceBreakdown,
  packagePrimaryAmount,
  parseMealChoice,
  parseMealRates,
  type EsimSelections,
  type MealChoice,
  type MealRates,
  type PackageStaySlice,
  type PackageTaxi,
  type PrimaryStaySummary,
  type TaxiPick,
  type ZiyaratStop,
} from "@/lib/package-plan";

export type StoredPackage = {
  meals?: MealChoice;
  mealRates?: MealRates;
  ziyaratIds?: string[];
  taxis?: TaxiPick[];
  total?: number;
  ziyarat?: ZiyaratStop[];
  taxiList?: PackageTaxi[];
  stays?: PackageStaySlice[];
  insurance?: boolean;
  esimSelections?: EsimSelections;
};

function bookingPrimaryStay(booking: BookingDTO, pack: StoredPackage, stays: PackageStaySlice[]): PrimaryStaySummary {
  return {
    name: booking.listing.name,
    city: booking.listing.city,
    checkin: booking.startDate,
    checkout: booking.endDate,
    amount: packagePrimaryAmount(booking.total, { total: pack.total ?? 0, stays }),
  };
}

/** A hotel-grouped breakdown of the package — each hotel with its own meals nested, transfers/ziyarat kept separate — for a clearer invoice/receipt UI. */
export function bookingInvoiceBreakdown(booking: BookingDTO) {
  const pack = booking.extra.package as StoredPackage | undefined;
  if (!pack) return null;
  const stays = Array.isArray(pack.stays) ? pack.stays : [];
  return packageInvoiceBreakdown({
    meals: parseMealChoice(pack.meals),
    guests: booking.guests,
    ziyaratIds: pack.ziyaratIds ?? [],
    taxis: pack.taxis ?? [],
    ziyarat: Array.isArray(pack.ziyarat) ? pack.ziyarat : [],
    taxiList: Array.isArray(pack.taxiList) ? pack.taxiList : [],
    mealRates: parseMealRates(pack.mealRates),
    stayName: booking.listing.name,
    stays,
    primaryStay: bookingPrimaryStay(booking, pack, stays),
    insurance: Boolean(pack.insurance),
    esimSelections: pack.esimSelections,
  });
}

/** Every hotel name in the package (primary first), for invoice/receipt headers. */
export function bookingPackageHotelNames(booking: BookingDTO): string[] {
  const pack = booking.extra.package as StoredPackage | undefined;
  const extraHotels = pack?.stays ?? [];
  return [booking.listing.name, ...extraHotels.map((s) => s.name)];
}

/** The true full package total (every hotel + every add-on) — the stored booking.total excludes extra hotels, which are billed as their own booking rows. */
export function bookingPackageGrandTotal(booking: BookingDTO): number {
  const pack = booking.extra.package as StoredPackage | undefined;
  if (!pack) return booking.total;
  return packageGrandTotal(booking.total, { stays: pack.stays ?? [] });
}

export function bookingIsPaid(booking: { status: string; payment: string; extra: Record<string, unknown> }) {
  if (booking.status === "pending_payment" || booking.status === "cancelled" || booking.status === "declined") {
    return false;
  }
  if (booking.extra.paymentStatus === "paid" || Boolean(booking.extra.paidAt)) return true;
  return booking.status === "confirmed" && (booking.payment === "card" || booking.payment === "stripe");
}
