import { formatPKR, formatDay, clampIsoDate, nightsBetween, stayNightDates } from "@/lib/format";
import { airportForCity, cityNamedIn, pilgrimAirports, pilgrimCountryForPlace, type PilgrimCountry } from "@/lib/pilgrim";

export type { PilgrimCountry };
export { pilgrimCountryForPlace };

export type MealKind = "breakfast" | "lunch" | "dinner";

export type MealChoice = {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
};

export type MealRates = {
  breakfast: number;
  lunch: number;
  dinner: number;
};

export type EsimTier = "" | "1gb" | "5gb" | "10gb";
export type EsimPlanId = Exclude<EsimTier, "">;
/** How many eSIMs of each plan to buy, e.g. { "1gb": 2, "5gb": 1 } for a mixed family. */
export type EsimSelections = Partial<Record<EsimPlanId, number>>;

export const INSURANCE_RATE_PER_GUEST = 2200;

export const ESIM_PLANS: { id: EsimPlanId; label: string; blurb: string; pricePerGuest: number }[] = [
  { id: "1gb", label: "1 GB", blurb: "Light use — messaging and maps", pricePerGuest: 1200 },
  { id: "5gb", label: "5 GB", blurb: "Everyday use — social, calls, navigation", pricePerGuest: 2800 },
  { id: "10gb", label: "10 GB", blurb: "Heavy use — streaming and hotspot", pricePerGuest: 4500 },
];

export function esimPlanRate(tier: EsimTier | string | undefined) {
  return ESIM_PLANS.find((p) => p.id === tier)?.pricePerGuest ?? 0;
}

export function esimSelectionsTotal(selections: EsimSelections | undefined) {
  if (!selections) return 0;
  return ESIM_PLANS.reduce((sum, p) => sum + Math.max(0, Number(selections[p.id]) || 0) * p.pricePerGuest, 0);
}

export function esimSelectionsCount(selections: EsimSelections | undefined) {
  if (!selections) return 0;
  return ESIM_PLANS.reduce((sum, p) => sum + Math.max(0, Number(selections[p.id]) || 0), 0);
}

export const MEAL_RATE: MealRates = {
  breakfast: 2500,
  lunch: 3800,
  dinner: 4200,
};

export function parseMealRates(raw: unknown): MealRates {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = (key: MealKind) => {
    if (!(key in o) || o[key] === "" || o[key] == null) return MEAL_RATE[key];
    const v = Number(o[key]);
    return Number.isFinite(v) && v >= 0 ? v : MEAL_RATE[key];
  };
  return { breakfast: n("breakfast"), lunch: n("lunch"), dinner: n("dinner") };
}

export function mealDays(value: unknown, nights: number): number {
  const max = Math.max(0, nights);
  if (typeof value === "boolean") return value ? max : 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function parseMealDates(value: unknown, stayDates: string[]): string[] {
  if (Array.isArray(value)) {
    const picked = value.map(String);
    if (!stayDates.length) return picked.filter(Boolean);
    return stayDates.filter((d) => picked.includes(d));
  }
  const n = mealDays(value, stayDates.length || 0);
  return stayDates.slice(0, n);
}

export function parseMealChoice(raw: unknown, stayDates: string[] = []): MealChoice {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    breakfast: parseMealDates(o.breakfast, stayDates),
    lunch: parseMealDates(o.lunch, stayDates),
    dinner: parseMealDates(o.dinner, stayDates),
  };
}

/** Replace only the days that fall within `scope` (one hotel's date range), keeping every other hotel's picks untouched. */
export function mergeMealChoiceScope(prev: MealChoice, next: MealChoice, scope: string[]): MealChoice {
  const scopeSet = new Set(scope);
  const mergeKind = (key: MealKind) => [...prev[key].filter((d) => !scopeSet.has(d)), ...next[key]];
  return { breakfast: mergeKind("breakfast"), lunch: mergeKind("lunch"), dinner: mergeKind("dinner") };
}

export type ZiyaratStop = {
  id: string;
  country: PilgrimCountry;
  city: string;
  name: string;
  nastaliq: string;
  hours: string;
  price: number;
  cover: string;
  blurb: string;
};

export type TripStop = {
  time: string;
  place: string;
  note: string;
};

export type PackageTaxi = {
  id: string;
  country: PilgrimCountry;
  cities: string[];
  origin: string;
  destination: string;
  driver: string;
  driverPhoto: string;
  vehicle: string;
  vehiclePhoto: string;
  model: string;
  seats: number;
  vacant: number;
  rate: number;
  ratePerPerson: number;
  privateRate: number;
  hours: string;
  itinerary: TripStop[];
  cover: string;
  name: string;
  blurb: string;
  service: "ziyarat" | "airport";
};


function metaBag(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const obj = JSON.parse(raw || "{}");
      if (obj && typeof obj === "object") return obj as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

export type PackageListing = {
  slug: string;
  name: string;
  nastaliq?: string;
  city: string;
  region: string;
  cover: string;
  description?: string;
  price: number;
  meta?: unknown;
};

export function listingToZiyarat(row: PackageListing): ZiyaratStop {
  const meta = metaBag(row.meta);
  const country = pilgrimCountryForPlace(row.city, String(meta.country || row.region)) ?? "IQ";
  return {
    id: row.slug,
    country,
    city: row.city,
    name: row.name,
    nastaliq: row.nastaliq || "",
    hours: String(meta.hours || "Half day"),
    price: row.price,
    cover: row.cover,
    blurb: row.description || "",
  };
}

function parseStops(raw: unknown, fallbackCities: string[]): TripStop[] {
  if (Array.isArray(raw)) {
    const stops = raw
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as { time?: unknown; place?: unknown; note?: unknown };
        const place = String(r.place ?? "").trim();
        if (!place) return null;
        return { time: String(r.time ?? "").trim(), place, note: String(r.note ?? "").trim() };
      })
      .filter((s): s is TripStop => Boolean(s));
    if (stops.length) return stops;
  }
  return fallbackCities.map((place, i) => ({
    time: "",
    place,
    note: i === 0 ? "Hotel pickup" : i === fallbackCities.length - 1 ? "Return / drop" : "Ziyarat stop",
  }));
}

export function listingToTaxi(row: PackageListing): PackageTaxi {
  const meta = metaBag(row.meta);
  const country = pilgrimCountryForPlace(row.city, String(meta.country || row.region)) ?? "IQ";
  const route = Array.isArray(meta.routeCities)
    ? meta.routeCities.map(String).filter(Boolean)
    : String(meta.route ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const cities = route.length ? route : [row.city];
  const origin = String(meta.origin || cities[0] || row.city);
  const destination = String(meta.destination || cities[cities.length - 1] || row.city);
  const seats = Number(meta.seats) || 7;
  const perPerson = row.price;
  const privateRate = Number(meta.privateRate) || perPerson * seats;
  const hay = `${row.name} ${row.description || ""} ${origin} ${destination}`.toLowerCase();
  const service: "ziyarat" | "airport" =
    meta.service === "airport" || hay.includes("airport") ? "airport" : "ziyarat";
  const air = service === "airport"
    ? pilgrimAirports[country].find(
        (a) =>
          origin === a.label ||
          destination === a.label ||
          origin.toLowerCase().includes(a.city.toLowerCase()) ||
          destination.toLowerCase().includes(a.city.toLowerCase()),
      ) ?? airportForCity(country, row.city)
    : null;
  const citiesResolved =
    service === "airport" && air
      ? Array.from(new Set([air.city, row.city, origin, ...cities].filter(Boolean)))
      : cities;
  return {
    id: row.slug,
    country,
    cities: citiesResolved,
    origin: air ? air.label : origin,
    destination: air ? "Guest hotel" : destination,
    driver: String(meta.driver || row.name),
    driverPhoto: String(meta.driverPhoto || ""),
    vehicle: String(meta.vehicle || row.name),
    vehiclePhoto: String(meta.vehiclePhoto || ""),
    model: String(meta.model || ""),
    seats,
    vacant: Number(meta.vacant) || seats,
    rate: perPerson,
    ratePerPerson: perPerson,
    privateRate,
    hours: String(meta.hours || "Full day"),
    itinerary: parseStops(meta.itinerary, cities),
    cover: row.cover,
    name: row.name,
    blurb: row.description || "",
    service,
  };
}

export function ziyaratFor(list: ZiyaratStop[], country: PilgrimCountry | null, city: string) {
  if (!country) return list.filter((z) => z.city.toLowerCase() === city.toLowerCase());
  const local = list.filter((z) => z.country === country);
  const here = local.filter((z) => z.city.toLowerCase() === city.toLowerCase());
  return here.length ? [...here, ...local.filter((z) => z.city.toLowerCase() !== city.toLowerCase())] : local;
}

export function taxisFor(list: PackageTaxi[], country: PilgrimCountry | null, city: string) {
  const local = country ? list.filter((t) => t.country === country) : list;
  const needle = city.trim().toLowerCase();
  return [...local].sort((a, b) => {
    const score = (t: PackageTaxi) => {
      if (t.service === "airport") {
        if (t.cities.some((c) => c.toLowerCase() === needle)) return 0;
        if (t.destination.toLowerCase().includes(needle) || t.origin.toLowerCase().includes(needle)) return 1;
        return 2;
      }
      if (t.origin.toLowerCase() === needle) return 0;
      if (t.cities.some((c) => c.toLowerCase() === needle)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });
}

export function mealTotal(meals: MealChoice, guests: number, nights: number, rates: MealRates = MEAL_RATE) {
  const heads = Math.max(1, guests);
  const count = (days: string[] | number) => (Array.isArray(days) ? days.length : mealDays(days, nights));
  return (
    rates.breakfast * count(meals.breakfast) * heads +
    rates.lunch * count(meals.lunch) * heads +
    rates.dinner * count(meals.dinner) * heads
  );
}

export function mealLines(meals: MealChoice, guests: number, nights: number, rates: MealRates = MEAL_RATE, hotelName?: string) {
  const heads = Math.max(1, guests);
  const days = (value: string[] | number) => (Array.isArray(value) ? [...value].sort() : []);
  const lines: { id: string; label: string; amount: number }[] = [];
  const row = (id: string, label: string, picked: string[], rate: number) => {
    if (picked.length <= 0 || rate <= 0) return;
    const dayList = picked.map((d) => formatDay(d)).join(", ");
    lines.push({
      id: hotelName ? `${id}-${hotelName}` : id,
      label: `${label}${hotelName ? ` · ${hotelName}` : ""} · ${dayList} · ${heads} guest${heads === 1 ? "" : "s"}`,
      amount: rate * picked.length * heads,
    });
  };
  row("bfast", "Breakfast", days(meals.breakfast), rates.breakfast);
  row("lunch", "Lunch", days(meals.lunch), rates.lunch);
  row("dinner", "Dinner", days(meals.dinner), rates.dinner);
  return lines;
}

export type PrimaryStaySummary = { name: string; city: string; checkin: string; checkout: string; amount: number };

function transferAndZiyaratLines(input: {
  guests: number;
  ziyaratIds: string[];
  taxis: TaxiPick[];
  ziyarat: ZiyaratStop[];
  taxiList: PackageTaxi[];
  stayName?: string;
  insurance?: boolean;
  esimSelections?: EsimSelections;
}) {
  const lines: { id: string; label: string; amount: number }[] = [];
  lines.push(
    ...input.ziyaratIds
      .map((id) => input.ziyarat.find((z) => z.id === id))
      .filter((z): z is ZiyaratStop => Boolean(z))
      .map((z) => ({ id: z.id, label: `Ziyarat · ${z.name}`, amount: z.price * Math.max(1, input.guests) })),
  );
  for (const p of input.taxis) {
    const t = input.taxiList.find((x) => x.id === p.id);
    if (!t) continue;
    const when = p.date ? ` · ${formatDay(p.date)}` : "";
    const hotel =
      p.hotelName ||
      input.stayName ||
      "";
    const route =
      t.service === "airport" && hotel
        ? airportPickupTitle(t, hotel, p.leg === "out" ? "out" : "in")
        : tripTitle(t);
    const prefix = t.service === "airport" ? (p.leg === "out" ? "Airport drop off · " : "Airport pick up · ") : "Day trip · ";
    lines.push({
      id: p.slotId || `${t.id}-${p.date}`,
      label: `${prefix}${route}${when} · ${t.driver} · ${t.vehicle}`,
      amount: taxiPickCost(t, p, input.guests),
    });
  }
  if (input.insurance) {
    const heads = Math.max(1, input.guests);
    lines.push({
      id: "insurance",
      label: `Travel insurance · ${heads} guest${heads === 1 ? "" : "s"}`,
      amount: INSURANCE_RATE_PER_GUEST * heads,
    });
  }
  for (const plan of ESIM_PLANS) {
    const qty = Math.max(0, Number(input.esimSelections?.[plan.id]) || 0);
    if (qty <= 0) continue;
    lines.push({
      id: `esim-${plan.id}`,
      label: `eSIM ${plan.label} · ${qty} guest${qty === 1 ? "" : "s"}`,
      amount: plan.pricePerGuest * qty,
    });
  }
  return lines;
}

export type InvoiceLine = { id: string; label: string; amount: number };
export type InvoiceHotelGroup = {
  id: string;
  name: string;
  city: string;
  checkin: string;
  checkout: string;
  roomAmount: number;
  mealLines: InvoiceLine[];
  subtotal: number;
};

/** A structured, hotel-grouped view of a package's charges — each hotel with its own meals nested under it, and
 *  everything else (transfers, ziyarat) kept as a separate flat list — for a clearer invoice/receipt layout. */
export function packageInvoiceBreakdown(input: {
  meals: MealChoice;
  guests: number;
  ziyaratIds: string[];
  taxis: TaxiPick[];
  ziyarat: ZiyaratStop[];
  taxiList: PackageTaxi[];
  mealRates?: MealRates;
  stayName?: string;
  stays?: PackageStaySlice[];
  primaryStay?: PrimaryStaySummary;
  insurance?: boolean;
  esimSelections?: EsimSelections;
}): { hotels: InvoiceHotelGroup[]; extras: InvoiceLine[]; hotelsSubtotal: number; extrasSubtotal: number; total: number } {
  const rates = parseMealRates(input.mealRates ?? MEAL_RATE);
  const hotelLegs = [
    ...(input.primaryStay ? [{ ...input.primaryStay, listingId: "primary" }] : []),
    ...(input.stays ?? []),
  ].sort((a, b) => a.checkin.localeCompare(b.checkin));

  const hotels: InvoiceHotelGroup[] = hotelLegs.map((leg) => {
    const legMeals = parseMealChoice(input.meals, stayNightDates(leg.checkin, leg.checkout));
    const meals = mealLines(legMeals, input.guests, nightsBetween(leg.checkin, leg.checkout), rates);
    return {
      id: leg.listingId,
      name: leg.name,
      city: leg.city,
      checkin: leg.checkin,
      checkout: leg.checkout,
      roomAmount: leg.amount,
      mealLines: meals,
      subtotal: leg.amount + meals.reduce((s, m) => s + m.amount, 0),
    };
  });

  const extras = transferAndZiyaratLines(input);
  const hotelsSubtotal = hotels.reduce((s, h) => s + h.subtotal, 0);
  const extrasSubtotal = extras.reduce((s, l) => s + l.amount, 0);
  return { hotels, extras, hotelsSubtotal, extrasSubtotal, total: hotelsSubtotal + extrasSubtotal };
}

/** The primary (first-booked) hotel's own room cost, derived back out of the stored booking total. */
export function packagePrimaryAmount(bookingTotal: number, pack: Pick<StayPackage, "total" | "stays">) {
  const extraStaySum = (pack.stays ?? []).reduce((s, row) => s + (Number(row.amount) || 0), 0);
  return bookingTotal - pack.total + extraStaySum;
}

/** The true full cost of everything in the package — every hotel plus every add-on — since the stored booking total excludes extra hotels (they're billed as their own Booking rows). */
export function packageGrandTotal(bookingTotal: number, pack: Pick<StayPackage, "stays">) {
  const extraStaySum = (pack.stays ?? []).reduce((s, row) => s + (Number(row.amount) || 0), 0);
  return bookingTotal + extraStaySum;
}

export type TaxiMode = "shared" | "private";
export type TaxiPick = {
  slotId: string;
  id: string;
  seats: number;
  mode: TaxiMode;
  date: string;
  leg?: "in" | "out";
  hotelName?: string;
};

export type PackageStaySlice = {
  listingId: string;
  name: string;
  city: string;
  cover?: string;
  checkin: string;
  checkout: string;
  roomId?: string;
  ratePlanId?: string;
  roomName?: string;
  amount: number;
  cancellation?: "free" | "partial" | "strict";
  rooms: number;
};

export function airportLabelOf(t: PackageTaxi) {
  if (t.origin.toLowerCase().includes("airport")) return t.origin;
  if (t.destination.toLowerCase().includes("airport")) return t.destination;
  return t.origin;
}

export function airportPickupTitle(t: PackageTaxi, hotel: string, leg: "in" | "out" = "in") {
  const air = airportLabelOf(t);
  return leg === "out" ? `${hotel} → ${air}` : `${air} → ${hotel}`;
}

export function taxiPickCost(t: PackageTaxi, _pick: TaxiPick, _guests: number) {
  return t.privateRate;
}

export function packageAddonsTotal(input: {
  meals: MealChoice;
  guests: number;
  nights: number;
  ziyaratIds: string[];
  taxis: TaxiPick[];
  ziyarat: ZiyaratStop[];
  taxiList: PackageTaxi[];
  mealRates?: MealRates;
  stays?: PackageStaySlice[];
  insurance?: boolean;
  esimSelections?: EsimSelections;
}) {
  const ziyarat = input.ziyaratIds
    .map((id) => input.ziyarat.find((z) => z.id === id))
    .filter(Boolean)
    .reduce((s, z) => s + (z!.price * Math.max(1, input.guests)), 0);
  const taxis = input.taxis.reduce((s, pick) => {
    const t = input.taxiList.find((x) => x.id === pick.id);
    return s + (t ? taxiPickCost(t, pick, input.guests) : 0);
  }, 0);
  const extraHotels = (input.stays ?? []).reduce((s, stay) => s + (Number(stay.amount) || 0), 0);
  const insurance = input.insurance ? INSURANCE_RATE_PER_GUEST * Math.max(1, input.guests) : 0;
  const esim = esimSelectionsTotal(input.esimSelections);
  return mealTotal(input.meals, input.guests, input.nights, input.mealRates ?? MEAL_RATE) + ziyarat + taxis + extraHotels + insurance + esim;
}

export function taxiLabel(t: PackageTaxi) {
  return `${t.origin} → ${t.destination} · ${formatPKR(t.ratePerPerson)} / person · private ${formatPKR(t.privateRate)}`;
}

export function tripTitle(t: PackageTaxi) {
  if (t.service === "airport") return `${airportLabelOf(t)} · hotel transfers`;
  return t.origin && t.destination && t.origin !== t.destination ? `${t.origin} → ${t.destination}` : t.name;
}

export function tripDestinationCity(t: PackageTaxi): string | null {
  const dest = cityNamedIn(t.destination, t.country);
  if (dest) return dest;
  const last = t.cities.length ? t.cities[t.cities.length - 1] : "";
  return cityNamedIn(last, t.country) || (t.destination.trim() && t.destination.toLowerCase() !== "guest hotel" ? t.destination.trim() : null);
}

export type StayPackage = {
  flow?: "ziyarat" | "package";
  meals: MealChoice;
  mealRates: MealRates;
  ziyaratIds: string[];
  taxis: TaxiPick[];
  stays: PackageStaySlice[];
  insurance: boolean;
  esimSelections: EsimSelections;
  total: number;
};

function parseStaySlices(raw: unknown): PackageStaySlice[] {
  if (!Array.isArray(raw)) return [];
  const out: PackageStaySlice[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const listingId = String(r.listingId || "").trim();
    const checkin = String(r.checkin || "").trim();
    const checkout = String(r.checkout || "").trim();
    if (!listingId || !checkin || !checkout) continue;
    out.push({
      listingId,
      name: String(r.name || listingId),
      city: String(r.city || ""),
      cover: r.cover ? String(r.cover) : undefined,
      checkin,
      checkout,
      roomId: r.roomId ? String(r.roomId) : undefined,
      ratePlanId: r.ratePlanId ? String(r.ratePlanId) : undefined,
      roomName: r.roomName ? String(r.roomName) : undefined,
      amount: Number(r.amount) || 0,
      cancellation: r.cancellation === "free" || r.cancellation === "partial" || r.cancellation === "strict" ? r.cancellation : undefined,
      rooms: Math.max(1, Number(r.rooms) || 1),
    });
  }
  return out;
}

export function sanitizePackage(
  raw: unknown,
  guests: number,
  nights: number,
  ziyarat: ZiyaratStop[],
  taxiList: PackageTaxi[],
  mealRates: MealRates = MEAL_RATE,
  stayStart = "",
  stayEnd = "",
): StayPackage {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const stays = parseStaySlices(body.stays);
  const windowEnd = stays.reduce((end, s) => (s.checkout > end ? s.checkout : end), stayEnd || stayStart);
  const stayDates = stayNightDates(stayStart, stayEnd);
  const meals = parseMealChoice(body.meals, stayDates.length ? stayDates : Array.from({ length: nights }, (_, i) => String(i)));
  const rates = parseMealRates(mealRates);
  const ziyaratIds = Array.isArray(body.ziyaratIds)
    ? body.ziyaratIds.map(String).filter((id) => ziyarat.some((z) => z.id === id))
    : [];
  const taxis: TaxiPick[] = [];
  const rows = Array.isArray(body.taxis) ? body.taxis : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const t = taxiList.find((x) => x.id === String(r.id));
    if (!t) continue;
    const mode: TaxiMode = "private";
    const seats = t.seats;
    const date = clampIsoDate(String(r.date || stayStart || ""), stayStart, windowEnd);
    taxis.push({
      slotId: String(r.slotId || `trip-${t.id}-${date}-${taxis.length}`),
      id: t.id,
      seats,
      mode,
      date,
      leg: r.leg === "out" ? "out" : r.leg === "in" ? "in" : undefined,
      hotelName: r.hotelName ? String(r.hotelName) : undefined,
    });
  }
  const flow = body.flow === "package" ? "package" : "ziyarat";
  const insurance = Boolean(body.insurance);
  const rawEsim = body.esimSelections && typeof body.esimSelections === "object" ? (body.esimSelections as Record<string, unknown>) : {};
  const esimSelections: EsimSelections = {};
  let esimUsed = 0;
  for (const p of ESIM_PLANS) {
    const qty = Math.max(0, Math.floor(Number(rawEsim[p.id]) || 0));
    if (qty <= 0) continue;
    const capped = Math.min(qty, Math.max(0, Math.max(1, guests) - esimUsed));
    if (capped <= 0) continue;
    esimSelections[p.id] = capped;
    esimUsed += capped;
  }
  return {
    flow,
    meals,
    mealRates: rates,
    ziyaratIds,
    taxis,
    stays,
    insurance,
    esimSelections,
    total: packageAddonsTotal({ meals, guests, nights, ziyaratIds, taxis, ziyarat, taxiList, mealRates: rates, stays, insurance, esimSelections }),
  };
}
