import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { config, requireStripeConfig } from './config.js';
import { runAiCheckers } from './ai/checkers.js';
import {
  canRunCheck,
  findByInstallId,
  getAccount,
  markSubscription,
  publicUsage,
  recordCheck,
  updateSubscriptionByCustomer,
} from './store.js';

const app = express();
const stripe = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey, { apiVersion: '2026-05-27.dahlia' })
  : null;

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (request, response) => {
  if (!stripe || !config.stripeWebhookSecret) {
    return response.status(503).json({ error: 'Stripe webhooks are not configured.' });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      request.headers['stripe-signature'],
      config.stripeWebhookSecret,
    );
  } catch (error) {
    return response.status(400).send(`Webhook signature verification failed: ${error.message}`);
  }

  await handleStripeEvent(event);
  return response.json({ received: true });
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (request, response) => {
  response.json({ ok: true, freeCheckLimit: config.freeCheckLimit });
});

app.post('/api/check', async (request, response) => {
  const { installId, text, title, url } = request.body ?? {};

  if (!installId || typeof installId !== 'string') {
    return response.status(400).json({ error: 'installId is required.' });
  }

  if (!text || typeof text !== 'string' || text.trim().length < 500) {
    return response.status(400).json({ error: 'At least 500 characters of article text are required.' });
  }

  const account = getAccount(installId);

  if (!canRunCheck(account, config.freeCheckLimit)) {
    return response.status(402).json({
      error: 'Free check limit reached.',
      requiresSubscription: true,
      usage: publicUsage(account, config.freeCheckLimit),
    });
  }

  const result = await runAiCheckers({
    text: text.slice(0, 20_000),
    title,
    url,
  });
  const updatedAccount = recordCheck(installId);

  return response.json({
    ...result,
    usage: publicUsage(updatedAccount, config.freeCheckLimit),
  });
});

app.post('/api/checkout', async (request, response) => {
  try {
    requireStripeConfig();
  } catch (error) {
    return response.status(503).json({ error: error.message });
  }

  const { installId, email } = request.body ?? {};

  if (!installId || typeof installId !== 'string') {
    return response.status(400).json({ error: 'installId is required.' });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: config.stripePriceId, quantity: 1 }],
    client_reference_id: installId,
    customer_email: email || undefined,
    metadata: { installId },
    subscription_data: { metadata: { installId } },
    success_url: `${config.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appUrl}/billing/cancel`,
  });

  return response.json({ url: session.url });
});

app.post('/api/portal', async (request, response) => {
  try {
    requireStripeConfig();
  } catch (error) {
    return response.status(503).json({ error: error.message });
  }

  const { installId } = request.body ?? {};
  const account = installId ? findByInstallId(installId) : null;

  if (!account?.stripeCustomerId) {
    return response.status(404).json({ error: 'No Stripe customer found for this install.' });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: config.appUrl,
  });

  return response.json({ url: session.url });
});

app.get('/billing/success', (request, response) => {
  response.type('html').send(`
    <main style="font-family: system-ui; margin: 3rem auto; max-width: 42rem;">
      <h1>Subscription active</h1>
      <p>You can return to the Ghost Check extension and keep checking articles.</p>
    </main>
  `);
});

app.get('/billing/cancel', (request, response) => {
  response.type('html').send(`
    <main style="font-family: system-ui; margin: 3rem auto; max-width: 42rem;">
      <h1>Checkout canceled</h1>
      <p>No charge was made. You can restart checkout from the extension whenever you are ready.</p>
    </main>
  `);
});

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error.' });
});

async function handleStripeEvent(event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const installId = session.metadata?.installId ?? session.client_reference_id;

    if (installId && session.customer && session.subscription) {
      markSubscription(installId, session.customer, session.subscription, 'active');
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;

    if (subscription.customer) {
      updateSubscriptionByCustomer(subscription.customer, subscription.id, subscription.status);
    }
  }
}

app.listen(config.port, () => {
  console.log(`Ghost Check API listening on http://localhost:${config.port}`);
});
