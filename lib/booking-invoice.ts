import { nightsBetween } from "@/lib/format";
import type { BookingDTO } from "@/lib/booking-dto";
import {
  packageLineItems,
  parseMealChoice,
  parseMealRates,
  type MealChoice,
  type MealRates,
  type PackageStaySlice,
  type PackageTaxi,
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
};

export function bookingPackageLines(booking: BookingDTO) {
  const pack = booking.extra.package as StoredPackage | undefined;
  if (!pack) return [];
  const nights = Math.max(1, nightsBetween(booking.startDate, booking.endDate));
  const lines = packageLineItems({
    meals: parseMealChoice(pack.meals),
    guests: booking.guests,
    nights,
    ziyaratIds: pack.ziyaratIds ?? [],
    taxis: pack.taxis ?? [],
    ziyarat: Array.isArray(pack.ziyarat) ? pack.ziyarat : [],
    taxiList: Array.isArray(pack.taxiList) ? pack.taxiList : [],
    mealRates: parseMealRates(pack.mealRates),
    stayName: booking.listing.name,
    stays: Array.isArray(pack.stays) ? pack.stays : [],
  });
  if (lines.length) return lines;
  if (pack.total && pack.total > 0) return [{ id: "package", label: "Ziyarat package", amount: pack.total }];
  return [];
}
