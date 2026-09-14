import { convertFromPkr, isDisplayCurrency, type DisplayCurrency } from "@/lib/currency";

export function displayCurrencyFromRequest(req: Request, body?: { currency?: unknown }): DisplayCurrency {
  if (isDisplayCurrency(String(body?.currency ?? ""))) return String(body?.currency) as DisplayCurrency;
  const cookie = req.headers.get("cookie") || "";
  const hit = cookie.match(/(?:^|;\s*)serai-currency=([A-Z]{3})/i);
  if (hit && isDisplayCurrency(hit[1].toUpperCase())) return hit[1].toUpperCase() as DisplayCurrency;
  return "USD";
}

/** Stripe amounts are integer minor units (cents / paisa). */
export function toStripeCharge(amountPkr: number, currency: DisplayCurrency) {
  const major = convertFromPkr(Number(amountPkr) || 0, currency);
  const amount = Math.max(0, Math.round(major * 100));
  return { amount, currency: currency.toLowerCase() };
}
