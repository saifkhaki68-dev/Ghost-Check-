# Ghost Check

A cross-browser extension that checks article pages for AI-written signals, shows an on-page notice, recommends more credible sources, and gates checks behind a Stripe subscription after 10 free uses.

## What is included

- Manifest V3 extension with popup, content script, background service worker, and shared styles.
- Node/Express backend with `/api/check`, `/api/checkout`, `/api/portal`, and Stripe webhook routes.
- Three pluggable mock AI checkers: stylometry, burstiness, and repetition detectors.
- Usage enforcement: 10 free checks per install ID, then subscription required.
- Stripe Checkout subscription flow for a `$12/year` recurring Price.
- Build script that creates `dist/chrome` and `dist/firefox` extension folders.

## Quick start

```sh
npm install
cp .env.example .env
npm run dev:server
```

In another terminal:

```sh
npm run build:extension
```

Load the unpacked extension from `dist/chrome` in Chrome or `dist/firefox` in Firefox.

## Stripe setup

1. Create a Stripe recurring Price for `$12/year`.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` in `.env`.
3. Forward webhooks to `POST /webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET`.
4. Listen for these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

The backend uses Stripe Checkout Sessions with `mode: "subscription"` and intentionally does not set `payment_method_types`, so Stripe can dynamically choose eligible payment methods from Dashboard settings.

## Production notes

The current usage store is in-memory so the app is easy to run locally. Before publishing, replace `server/src/store.js` with a database-backed store keyed by `installId` and Stripe customer ID.

Real detector APIs can be added by replacing or extending the provider definitions in `server/src/ai/checkers.js`. Keep API keys on the backend only; the extension should never call paid detector APIs directly.
