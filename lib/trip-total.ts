/** One formula for taxi / Ziyarat / food bookings, used by the booking screen and the API so the card charge always matches what was shown. */
export function independentTripTotal(input: {
  kind: string;
  price: number;
  priceUnit?: string;
  guests: number;
  taxi?: { ratePerPerson: number; privateRate: number } | null;
  taxiMode?: string;
  /** Ziyarat plans can run for several days; the price is per day. */
  days?: number;
  /** Ziyarat guide fee per guest per day (PKR), on top of the visit price. */
  guideFee?: number;
  /** "group" charges the guide fee once per day for the whole party instead of per guest. */
  guideFeeUnit?: string;
}) {
  const guests = Math.max(1, Math.floor(Number(input.guests)) || 1);
  if (input.kind === "TAXI" && input.taxi) {
    if (input.taxiMode === "custom") return 0;
    if (input.taxiMode === "private") return input.taxi.privateRate;
    return input.taxi.ratePerPerson * guests;
  }
  const price = Number(input.price) || 0;
  const days = input.kind === "ATTRACTION" ? Math.max(1, Math.floor(Number(input.days)) || 1) : 1;
  const guide = input.kind === "ATTRACTION" ? guideAmount(input.guideFee, input.guideFeeUnit, guests, days) : 0;
  return (input.priceUnit === "person" ? price * guests : price) * days + guide;
}

/** The Ziyarat guide fee (PKR per guest per day) stored in a listing's meta, which may arrive as JSON text or an object. */
export function guideFeeOf(meta: unknown) {
  let bag: unknown = meta;
  if (typeof meta === "string") {
    try {
      bag = JSON.parse(meta || "{}");
    } catch {
      return 0;
    }
  }
  const n = Number((bag as { guideFee?: unknown } | null)?.guideFee);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Guide fee total: per guest per day, or once per day for the whole group. */
export function guideAmount(fee: unknown, unit: unknown, guests: number, days: number) {
  const f = Math.max(0, Number(fee) || 0);
  const d = Math.max(1, Math.floor(Number(days)) || 1);
  return unit === "group" ? f * d : f * Math.max(1, Math.floor(Number(guests)) || 1) * d;
}

export function guideUnitOf(meta: unknown): "person" | "group" {
  let bag: unknown = meta;
  if (typeof meta === "string") {
    try {
      bag = JSON.parse(meta || "{}");
    } catch {
      return "person";
    }
  }
  return (bag as { guideFeeUnit?: unknown } | null)?.guideFeeUnit === "group" ? "group" : "person";
}
