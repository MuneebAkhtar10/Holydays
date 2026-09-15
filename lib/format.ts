import { formatMoney } from "./currency";

/** Always PKR — emails, SMS, stored totals. Guest UI uses `useSerai().money`. */
export const formatPKR = (n: number) => formatMoney(n, "PKR");

export const formatDay = (iso: string) => {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

export const nightsBetween = (a: string, b: string) => {
  if (!a || !b) return 1;
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
};

export const datesInclusive = (start: string, end: string) => {
  const a = start || end;
  const b = end || start;
  if (!a) return [];
  const out: string[] = [];
  let cur = a;
  while (cur <= b) {
    out.push(cur);
    const next = new Date(`${cur}T12:00:00`);
    next.setDate(next.getDate() + 1);
    cur = next.toISOString().slice(0, 10);
  }
  return out;
};

export const stayNightDates = (checkin: string, checkout: string) => {
  const days = datesInclusive(checkin, checkout);
  if (days.length <= 1) return days;
  return days.slice(0, -1);
};

export const clampIsoDate = (date: string, start: string, end: string) => {
  if (!date) return start || date;
  if (start && date < start) return start;
  if (end && date > end) return end;
  return date;
};

export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Calendar date in the user's local timezone — use this for date-picker `min`. */
export const localTodayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Earliest valid check-out: not in the past, and after check-in when check-in is set. */
export const minCheckoutIso = (checkin = "", today = localTodayIso()) => {
  const afterCheckin = checkin ? addDaysIso(checkin, 1) : today;
  return afterCheckin > today ? afterCheckin : today;
};

export const clampCheckoutIso = (checkout: string, checkin = "", today = localTodayIso()) => {
  const min = minCheckoutIso(checkin, today);
  if (!checkout || checkout < min) return min;
  return checkout;
};

export const isPastBooking = (endDate: string, startDate = "") => {
  const end = endDate || startDate;
  return Boolean(end && end < todayIso());
};

export const datesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
  const a1 = aStart || aEnd;
  const a2 = aEnd || aStart;
  const b1 = bStart || bEnd;
  const b2 = bEnd || bStart;
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 <= b2 && b1 <= a2;
};

export const defaultDates = () => {
  const inD = new Date();
  inD.setDate(inD.getDate() + 18);
  const outD = new Date(inD);
  outD.setDate(outD.getDate() + 3);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { checkin: iso(inD), checkout: iso(outD) };
};
