import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4242),
  appUrl: process.env.APP_URL ?? 'http://localhost:4242',
  extensionApiBase: process.env.EXTENSION_API_BASE ?? 'http://localhost:4242',
  freeCheckLimit: Number(process.env.FREE_CHECK_LIMIT ?? 10),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePriceId: process.env.STRIPE_PRICE_ID ?? '',
};

export function requireStripeConfig() {
  const missing = [];

  if (!config.stripeSecretKey) missing.push('STRIPE_SECRET_KEY');
  if (!config.stripePriceId) missing.push('STRIPE_PRICE_ID');

  if (missing.length > 0) {
    const detail = missing.join(', ');
    throw new Error(`Stripe is not configured. Missing ${detail}.`);
  }
}
