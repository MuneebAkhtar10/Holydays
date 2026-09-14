import Stripe from "stripe";

let client: Stripe | null | undefined;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (client === undefined) {
    client = new Stripe(key);
  }
  return client;
}
