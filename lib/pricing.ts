import { nightsBetween, todayIso } from "@/lib/format";
import { experienceById } from "@/lib/experiences";
import type { Occupancy, RatePlan, Stay, StayPricing } from "@/lib/types";
import { defaultRates, normalizeRooms, type BookableRoom } from "@/lib/rooms";

export type QuoteInput = Occupancy & {
  checkin: string;
  checkout: string;
  roomId?: string;
  ratePlanId?: string;
  extraBeds?: number;
  cribs?: number;
  extras?: string[];
  airportTransfer?: boolean;
  promo?: string;
  member?: boolean;
  mobile?: boolean;
};

export type PriceLine = { id: string; label: string; amount: number; note?: string };

export type NightRate = { date: string; amount: number; tags: string[] };

export type PriceQuote = {
  room: BookableRoom;
  rate: RatePlan;
  nights: number;
  rooms: number;
  nightly: NightRate[];
  start: number;
  roomSubtotal: number;
  lines: PriceLine[];
  discounts: PriceLine[];
  fees: PriceLine[];
  extras: PriceLine[];
  taxes: number;
  total: number;
  grand: number;
  dueNow: number;
  payLater: number;
  rulesApplied: string[];
};

const PK_HOLIDAYS: StayPricing["holidays"] = [
  { date: "2026-03-20", pct: 18, label: "Eid" },
  { date: "2026-03-21", pct: 18, label: "Eid" },
  { date: "2026-03-23", pct: 12, label: "Pakistan Day" },
  { date: "2026-05-27", pct: 18, label: "Eid" },
  { date: "2026-05-28", pct: 18, label: "Eid" },
  { date: "2026-08-14", pct: 15, label: "Independence Day" },
  { date: "2026-12-25", pct: 12, label: "Christmas" },
];

export function defaultPricing(partial?: Partial<StayPricing>): StayPricing {
  return {
    taxPct: num(partial?.taxPct, 16),
    serviceChargePct: num(partial?.serviceChargePct, 0),
    cityTaxPerNight: num(partial?.cityTaxPerNight, 0),
    cleaningFee: num(partial?.cleaningFee, 0),
    resortFeePerNight: num(partial?.resortFeePerNight, 0),
    extraPerson: num(partial?.extraPerson, 2500),
    extraBed: num(partial?.extraBed, 3500),
    crib: num(partial?.crib, 0),
    childFreeMaxAge: num(partial?.childFreeMaxAge, 5),
    childRateMaxAge: num(partial?.childRateMaxAge, 11),
    childRate: num(partial?.childRate, 1500),
    weekendPct: num(partial?.weekendPct, 8),
    occupancyPct: num(partial?.occupancyPct, 0),
    seasons: Array.isArray(partial?.seasons) ? partial.seasons : [],
    holidays: Array.isArray(partial?.holidays) && partial.holidays.length ? partial.holidays : PK_HOLIDAYS,
    longStayNights: num(partial?.longStayNights, 7),
    longStayPct: num(partial?.longStayPct, 10),
    earlyBirdDays: num(partial?.earlyBirdDays, 30),
    earlyBirdPct: num(partial?.earlyBirdPct, 8),
    lastMinuteDays: num(partial?.lastMinuteDays, 3),
    lastMinutePct: num(partial?.lastMinutePct, 10),
    memberPct: num(partial?.memberPct, 5),
    mobilePct: num(partial?.mobilePct, 4),
    promoCodes: Array.isArray(partial?.promoCodes)
      ? partial.promoCodes.map((p) => ({ code: String(p.code).toUpperCase(), pct: num(p.pct, 0) }))
      : [{ code: "SERAI10", pct: 10 }],
    airportTransfer: num(partial?.airportTransfer, 4500),
  };
}

function num(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function parsePricing(raw: unknown): StayPricing {
  if (!raw || typeof raw !== "object") return defaultPricing();
  return defaultPricing(raw as Partial<StayPricing>);
}

export function eachNight(checkin: string, checkout: string): string[] {
  const nights = nightsBetween(checkin, checkout);
  const out: string[] = [];
  const d = new Date(`${checkin}T12:00:00`);
  for (let i = 0; i < nights; i += 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function weekend(iso: string) {
  const day = new Date(`${iso}T12:00:00`).getDay();
  return day === 5 || day === 6;
}

function inSeason(iso: string, windows: StayPricing["seasons"]) {
  return windows.find((w) => iso >= w.start && iso <= w.end);
}

function pct(amount: number, p: number) {
  return Math.round(amount * (p / 100));
}

export function stayRooms(stay: Stay): BookableRoom[] {
  return normalizeRooms(stay.rooms, stay.price);
}

export function stayPricingOf(stay: Stay): StayPricing {
  return defaultPricing(stay.pricing);
}

export function pickSearchRate(room: BookableRoom): RatePlan {
  const rates = room.rates.length ? room.rates : defaultRates();
  return [...rates].sort((a, b) => a.nightlyAdjPct - b.nightlyAdjPct)[0] ?? rates[0];
}

function rateById(room: BookableRoom, id?: string) {
  if (id) {
    const hit = room.rates.find((r) => r.id === id);
    if (hit) return hit;
  }
  return pickSearchRate(room);
}

function roomById(rooms: BookableRoom[], id?: string) {
  return rooms.find((r) => r.id === id) ?? rooms[0];
}

/**
 * Search, property, and checkout all call this with the same occupancy and dates.
 * Optional extras, promo, extra beds, crib, member, and mobile change the quote
 * only when those flags are set — that is the defined-rule exception.
 */
export function quoteStay(stay: Stay, input: QuoteInput): PriceQuote {
  const rooms = stayRooms(stay);
  const pricing = stayPricingOf(stay);
  const room = roomById(rooms, input.roomId);
  const rate = rateById(room, input.ratePlanId);
  const roomQty = Math.max(1, Math.min(input.rooms || 1, room.available));
  const nights = eachNight(input.checkin, input.checkout);
  const nightCount = Math.max(1, nights.length);
  const rulesApplied: string[] = ["base_room_price"];
  const nightly: NightRate[] = nights.map((date) => {
    let amount = room.price;
    const tags: string[] = ["base"];
    const season = inSeason(date, pricing.seasons);
    if (season?.pct) {
      amount += pct(room.price, season.pct);
      tags.push(season.label || "season");
      rulesApplied.push("seasonal_pricing");
    }
    if (pricing.weekendPct && weekend(date)) {
      amount += pct(room.price, pricing.weekendPct);
      tags.push("weekend");
      rulesApplied.push("weekend_pricing");
    }
    const holiday = pricing.holidays.find((h) => h.date === date);
    if (holiday?.pct) {
      amount += pct(room.price, holiday.pct);
      tags.push(holiday.label);
      rulesApplied.push("holiday_pricing");
    }
    if (rate.nightlyAdjPct) {
      amount += pct(amount, rate.nightlyAdjPct);
      tags.push(rate.meal);
    }
    return { date, amount: Math.max(0, Math.round(amount)), tags };
  });

  const roomSubtotal = nightly.reduce((s, n) => s + n.amount, 0) * roomQty;
  const start = Math.round(roomSubtotal / nightCount / roomQty);
  const lines: PriceLine[] = [
    { id: "room", label: `${room.name} · ${rate.name} · ${nightCount} night${nightCount === 1 ? "" : "s"} · ${roomQty} room${roomQty === 1 ? "" : "s"}`, amount: roomSubtotal },
  ];

  const adults = Math.max(1, input.adults || 1);
  const childAges = (input.childAges || []).slice(0, input.children || 0);
  while (childAges.length < (input.children || 0)) childAges.push(8);
  const included = room.includedGuests * roomQty;
  const adultLikeKids = childAges.filter((age) => age > pricing.childRateMaxAge).length;
  const payingChildren = childAges.filter((age) => age > pricing.childFreeMaxAge && age <= pricing.childRateMaxAge).length;
  const extraAdults = Math.max(0, adults + adultLikeKids - included);
  if (extraAdults && pricing.extraPerson) {
    const amt = extraAdults * pricing.extraPerson * nightCount;
    lines.push({ id: "extra-person", label: `Extra person × ${extraAdults}`, amount: amt });
    rulesApplied.push("extra_person_pricing", "occupancy_based_pricing", "number_of_guests_pricing");
  }
  if (payingChildren && pricing.childRate) {
    const childFees = payingChildren * pricing.childRate * nightCount;
    lines.push({ id: "child", label: `Child rate × ${payingChildren}`, amount: childFees });
    rulesApplied.push("child_pricing");
  }
  if (pricing.occupancyPct && adults + childAges.length >= room.sleeps * roomQty) {
    const amt = pct(roomSubtotal, pricing.occupancyPct);
    lines.push({ id: "full-occ", label: "Full occupancy", amount: amt });
    rulesApplied.push("occupancy_based_pricing");
  }

  const extraBeds = Math.max(0, input.extraBeds || 0);
  const cribs = Math.max(0, input.cribs || 0);
  if (extraBeds && room.extraBedAllowed) {
    const amt = extraBeds * pricing.extraBed * nightCount;
    lines.push({ id: "extra-bed", label: `Extra bed × ${extraBeds}`, amount: amt });
    rulesApplied.push("extra_bed_pricing");
  }
  if (cribs && room.cribAllowed && pricing.crib) {
    const amt = cribs * pricing.crib * nightCount;
    lines.push({ id: "crib", label: `Baby cot × ${cribs}`, amount: amt });
  }

  const lodgings = lines.reduce((s, l) => s + l.amount, 0);
  const discounts: PriceLine[] = [];
  const daysOut = Math.max(0, Math.round((new Date(`${input.checkin}T12:00:00`).getTime() - new Date(`${todayIso()}T12:00:00`).getTime()) / 86400000));
  if (nightCount >= pricing.longStayNights && pricing.longStayPct) {
    discounts.push({ id: "long-stay", label: `Long stay (${nightCount} nights)`, amount: -pct(lodgings, pricing.longStayPct) });
    rulesApplied.push("long_stay_discounts");
  }
  if (daysOut >= pricing.earlyBirdDays && pricing.earlyBirdPct) {
    discounts.push({ id: "early", label: "Early bird", amount: -pct(lodgings, pricing.earlyBirdPct) });
    rulesApplied.push("early_bird_discounts");
  } else if (daysOut <= pricing.lastMinuteDays && pricing.lastMinutePct) {
    discounts.push({ id: "last", label: "Last minute", amount: -pct(lodgings, pricing.lastMinutePct) });
    rulesApplied.push("last_minute_discounts");
  }
  if (input.member && pricing.memberPct) {
    discounts.push({ id: "member", label: "Member", amount: -pct(lodgings, pricing.memberPct) });
    rulesApplied.push("member_discounts");
  }
  if (input.mobile && pricing.mobilePct) {
    discounts.push({ id: "mobile", label: "Mobile-only", amount: -pct(lodgings, pricing.mobilePct) });
    rulesApplied.push("mobile_only_discounts");
  }
  const afterAuto = lodgings + discounts.reduce((s, d) => s + d.amount, 0);
  const code = String(input.promo || "").trim().toUpperCase();
  if (code) {
    const promo = pricing.promoCodes.find((p) => p.code === code);
    if (promo?.pct) {
      discounts.push({ id: "promo", label: `Promo ${promo.code}`, amount: -pct(afterAuto, promo.pct) });
      rulesApplied.push("promo_codes");
    }
  }

  const afterDisc = lodgings + discounts.reduce((s, d) => s + d.amount, 0);
  const extras: PriceLine[] = [];
  if (input.airportTransfer && pricing.airportTransfer) {
    extras.push({ id: "airport", label: "Airport transfer", amount: pricing.airportTransfer });
  }
  for (const eid of input.extras || []) {
    const exp = experienceById(eid);
    if (exp) extras.push({ id: eid, label: exp.title, amount: exp.price });
  }

  const fees: PriceLine[] = [];
  if (pricing.cleaningFee) fees.push({ id: "cleaning", label: "Cleaning fee", amount: pricing.cleaningFee });
  if (pricing.resortFeePerNight) fees.push({ id: "resort", label: "Resort fee", amount: pricing.resortFeePerNight * nightCount * roomQty });
  if (pricing.serviceChargePct) fees.push({ id: "service", label: "Service charge", amount: pct(afterDisc, pricing.serviceChargePct) });
  if (pricing.cityTaxPerNight) fees.push({ id: "city", label: "City / tourism tax", amount: pricing.cityTaxPerNight * nightCount * roomQty });
  const feeSum = fees.reduce((s, f) => s + f.amount, 0);
  const extraSum = extras.reduce((s, e) => s + e.amount, 0);
  const taxable = afterDisc + feeSum - (fees.find((f) => f.id === "city")?.amount ?? 0);
  const taxes = pricing.taxPct ? pct(Math.max(0, taxable), pricing.taxPct) : 0;
  if (taxes) rulesApplied.push("taxes", "service_charges");
  const total = afterDisc;
  const grand = afterDisc + feeSum + extraSum + taxes;
  const payLater = rate.payment !== "now";
  return {
    room,
    rate,
    nights: nightCount,
    rooms: roomQty,
    nightly,
    start,
    roomSubtotal,
    lines,
    discounts,
    fees,
    extras,
    taxes,
    total,
    grand,
    dueNow: payLater ? extraSum : grand,
    payLater: payLater ? grand - extraSum : 0,
    rulesApplied: [...new Set(rulesApplied)],
  };
}

export function searchQuote(stay: Stay, checkin: string, checkout: string, occupancy: Occupancy): PriceQuote {
  const rooms = stayRooms(stay);
  const roomQty = Math.max(1, occupancy.rooms || 1);
  const adults = Math.max(1, occupancy.adults || 1);
  const quotes = rooms
    .filter((r) => r.sleeps * Math.min(roomQty, r.available) >= adults)
    .map((r) =>
      quoteStay(stay, {
        ...occupancy,
        rooms: Math.min(roomQty, r.available),
        checkin,
        checkout,
        roomId: r.id,
        ratePlanId: pickSearchRate(r).id,
      }),
    );
  const pool = quotes.length ? quotes : rooms.map((r) => quoteStay(stay, { ...occupancy, checkin, checkout, roomId: r.id, ratePlanId: pickSearchRate(r).id }));
  return pool.sort((a, b) => a.grand - b.grand)[0];
}

export function quoteFingerprint(q: PriceQuote) {
  return [q.room.id, q.rate.id, q.nights, q.rooms, q.start, q.total, q.taxes, q.grand].join(":");
}
