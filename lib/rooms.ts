import type { BedKind, CancelPolicy, MealPlan, PayPolicy, RatePlan, Room } from "@/lib/types";
import type { MealKey } from "@/lib/search-index";

export type BookableRoom = Required<
  Pick<
    Room,
    | "id"
    | "name"
    | "sleeps"
    | "price"
    | "note"
    | "images"
    | "sizeSqm"
    | "beds"
    | "smoking"
    | "facilities"
    | "available"
    | "extraBedAllowed"
    | "cribAllowed"
    | "includedGuests"
    | "rates"
  >
>;

export const ROOM_FACILITY_OPTIONS = [
  "Wi-Fi",
  "Air conditioning",
  "Heating",
  "TV",
  "Private bathroom",
  "Shower",
  "Bathtub",
  "Hairdryer",
  "Safe",
  "Desk",
  "Balcony",
  "Mountain view",
  "City view",
  "Kitchenette",
  "Minibar",
  "Tea / coffee",
  "Wardrobe",
];

export const MEAL_PLAN_LABEL: Record<MealPlan, string> = {
  room_only: "Room only",
  breakfast: "Breakfast included",
  half_board: "Half board",
  full_board: "Full board",
};

export const PAY_LABEL: Record<PayPolicy, string> = {
  now: "Pay now",
  later: "Pay later",
  property: "Pay at property",
};

export const CANCEL_LABEL: Record<CancelPolicy, string> = {
  free: "Free cancellation",
  partial: "Partial refund",
  strict: "Non-refundable",
};

export const BED_LABEL: Record<BedKind, string> = {
  king: "King",
  queen: "Queen",
  twin: "Twin",
  single: "Single",
  sofa: "Sofa bed",
};

function asNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(v: unknown) {
  return String(v ?? "").trim();
}

export function newItemId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function bedCount(room: BookableRoom | Room) {
  return (room.beds ?? []).reduce((n, b) => n + b.count, 0);
}

export function bedCopy(room: BookableRoom | Room) {
  return (room.beds ?? [])
    .filter((b) => b.count > 0)
    .map((b) => `${b.count}× ${BED_LABEL[b.kind]}`)
    .join(" · ");
}

export function defaultRates(opts?: {
  meals?: MealKey[];
  cancellation?: CancelPolicy;
  payAtProperty?: boolean;
}): RatePlan[] {
  const meals = opts?.meals ?? [];
  const pay: PayPolicy = opts?.payAtProperty === false ? "now" : "property";
  const cancel: CancelPolicy = opts?.cancellation ?? "free";
  const rates: RatePlan[] = [
    { id: "ro-flex", name: "Room only · flexible", meal: "room_only", cancellation: cancel === "strict" ? "partial" : "free", payment: pay, nightlyAdjPct: 0 },
    { id: "ro-nr", name: "Room only · non-refundable", meal: "room_only", cancellation: "strict", payment: "now", nightlyAdjPct: -8 },
  ];
  if (meals.includes("breakfast") || meals.includes("half_board") || meals.includes("full_board") || meals.includes("all_inclusive")) {
    rates.push({ id: "bb-flex", name: "Breakfast included", meal: "breakfast", cancellation: "free", payment: pay, nightlyAdjPct: 12 });
  }
  if (meals.includes("half_board") || meals.includes("all_inclusive")) {
    rates.push({ id: "hb-flex", name: "Half board", meal: "half_board", cancellation: "free", payment: pay, nightlyAdjPct: 28 });
  }
  if (meals.includes("full_board") || meals.includes("all_inclusive")) {
    rates.push({ id: "fb-flex", name: "Full board", meal: "full_board", cancellation: "partial", payment: pay, nightlyAdjPct: 42 });
  }
  return rates;
}

export function emptyRoom(partial?: Partial<Room> & { id?: string; name?: string; price?: number }, ctx?: { meals?: MealKey[]; cancellation?: CancelPolicy; payAtProperty?: boolean }): BookableRoom {
  const sleeps = asNum(partial?.sleeps, 2);
  return normalizeRoom(
    {
      id: partial?.id || newItemId("room"),
      name: partial?.name || "Guest room",
      sleeps,
      price: asNum(partial?.price, 15000),
      note: partial?.note || "",
      images: partial?.images,
      sizeSqm: partial?.sizeSqm,
      beds: partial?.beds,
      smoking: partial?.smoking,
      facilities: partial?.facilities,
      available: partial?.available,
      extraBedAllowed: partial?.extraBedAllowed,
      cribAllowed: partial?.cribAllowed,
      includedGuests: partial?.includedGuests ?? sleeps,
      rates: partial?.rates,
    },
    ctx,
  );
}

export function normalizeRoom(
  raw: Partial<Room> & { id?: string; name?: string; price?: number; sleeps?: number; note?: string },
  ctx?: { meals?: MealKey[]; cancellation?: CancelPolicy; payAtProperty?: boolean },
): BookableRoom {
  const sleeps = Math.max(1, asNum(raw.sleeps, 2));
  const beds =
    Array.isArray(raw.beds) && raw.beds.length
      ? raw.beds.map((b) => ({
          kind: (["king", "queen", "twin", "single", "sofa"].includes(String(b.kind)) ? b.kind : "queen") as BedKind,
          count: Math.max(1, asNum(b.count, 1)),
        }))
      : [{ kind: "queen" as const, count: sleeps >= 3 ? 1 : 1 }, ...(sleeps >= 3 ? [{ kind: "single" as const, count: 1 }] : [])];
  const rates = Array.isArray(raw.rates) && raw.rates.length ? raw.rates.map(normalizeRate) : defaultRates(ctx);
  return {
    id: asStr(raw.id) || newItemId("room"),
    name: asStr(raw.name) || "Guest room",
    sleeps,
    price: Math.max(0, asNum(raw.price, 0)),
    note: asStr(raw.note),
    images: Array.isArray(raw.images) ? raw.images.map(String).filter(Boolean) : [],
    sizeSqm: Math.max(8, asNum(raw.sizeSqm, sleeps <= 2 ? 18 : 28)),
    beds,
    smoking: Boolean(raw.smoking),
    facilities: Array.isArray(raw.facilities) && raw.facilities.length ? raw.facilities.map(String) : ["Wi-Fi", "Private bathroom", "Air conditioning"],
    available: Math.max(1, asNum(raw.available, 3)),
    extraBedAllowed: raw.extraBedAllowed !== false,
    cribAllowed: raw.cribAllowed !== false,
    includedGuests: Math.max(1, asNum(raw.includedGuests, sleeps)),
    rates,
  };
}

export function normalizeRate(raw: Partial<RatePlan>): RatePlan {
  const meal = (["room_only", "breakfast", "half_board", "full_board"].includes(String(raw.meal)) ? raw.meal : "room_only") as MealPlan;
  const cancellation = (["free", "partial", "strict"].includes(String(raw.cancellation)) ? raw.cancellation : "free") as CancelPolicy;
  const payment = (["now", "later", "property"].includes(String(raw.payment)) ? raw.payment : "property") as PayPolicy;
  return {
    id: asStr(raw.id) || newItemId("rate"),
    name: asStr(raw.name) || MEAL_PLAN_LABEL[meal],
    meal,
    cancellation,
    payment,
    nightlyAdjPct: asNum(raw.nightlyAdjPct, 0),
  };
}

export function normalizeRooms(
  raw: unknown,
  fallbackPrice = 15000,
  ctx?: { meals?: MealKey[]; cancellation?: CancelPolicy; payAtProperty?: boolean },
): BookableRoom[] {
  if (!Array.isArray(raw) || !raw.length) {
    return [emptyRoom({ id: "room-1", price: fallbackPrice }, ctx)];
  }
  const list = raw.map((row, i) =>
    normalizeRoom({ ...(row as Room), id: (row as Room).id || `room-${i + 1}`, price: asNum((row as Room).price, fallbackPrice) }, ctx),
  );
  const seen = new Set<string>();
  return list.map((room) => {
    let id = room.id || newItemId("room");
    if (seen.has(id)) id = newItemId("room");
    seen.add(id);
    const rateSeen = new Set<string>();
    const rates = room.rates.map((rate) => {
      let rid = rate.id || newItemId("rate");
      if (rateSeen.has(rid)) rid = newItemId("rate");
      rateSeen.add(rid);
      return { ...rate, id: rid };
    });
    return { ...room, id, rates };
  });
}
