export const DISPLAY_CURRENCIES = ["PKR", "USD", "GBP"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Listing amounts are stored in PKR. Header FX is for guest display only. */
export const PKR_PER: Record<DisplayCurrency, number> = {
  PKR: 1,
  USD: 278,
  GBP: 355,
};

const LOCALE: Record<DisplayCurrency, string> = {
  PKR: "en-PK",
  USD: "en-US",
  GBP: "en-GB",
};

export function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
  return value === "PKR" || value === "USD" || value === "GBP";
}

export function convertFromPkr(amountPkr: number, currency: DisplayCurrency) {
  const rate = PKR_PER[currency] || 1;
  return (Number(amountPkr) || 0) / rate;
}

export function convertToPkr(amount: number, currency: DisplayCurrency) {
  const rate = PKR_PER[currency] || 1;
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * rate);
}

export function inputFromPkr(amountPkr: number, currency: DisplayCurrency) {
  const value = convertFromPkr(Number(amountPkr) || 0, currency);
  if (!Number.isFinite(value)) return "0";
  if (currency === "PKR") return String(Math.round(value));
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function formatMoney(amountPkr: number, currency: DisplayCurrency = "PKR") {
  const value = convertFromPkr(Number(amountPkr) || 0, currency);
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PKR" ? 0 : 2,
    minimumFractionDigits: currency === "PKR" ? 0 : 2,
  }).format(value);
}
