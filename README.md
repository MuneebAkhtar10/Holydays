# Serai

Pakistan-first stays, attractions, and taxi hire. Next.js App Router.

Booking requires a signed-in account (email or Google). Owners manage their own listings.

## Run

Node 20+.

```bash
nvm use 22
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Demo accounts (password `serai123`)

| Email | Role |
|---|---|
| guest@serai.pk | Traveller |
| stay.owner@serai.pk | Stay owner |
| attraction.owner@serai.pk | Attraction owner |
| taxi.owner@serai.pk | Taxi owner |
| dine.owner@serai.pk | Restaurant owner |

## Google login

Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`. Redirect URI:

`http://127.0.0.1:3000/api/auth/callback/google`

## Stripe (card payments)

Add test keys from the [Stripe dashboard](https://dashboard.stripe.com/apikeys):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Checkout uses Stripe Checkout (redirect). Successful payments confirm the booking; unpaid card bookings stay `pending_payment`.

Forward webhooks while developing:

```
stripe listen --forward-to http://127.0.0.1:3000/api/stripe/webhook
```

