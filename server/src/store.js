const installs = new Map();
const customerToInstall = new Map();

function createAccount(installId) {
  return {
    installId,
    checksUsed: 0,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: 'free',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getAccount(installId) {
  if (!installs.has(installId)) {
    installs.set(installId, createAccount(installId));
  }

  return installs.get(installId);
}

export function canRunCheck(account, freeCheckLimit) {
  return isSubscribed(account) || account.checksUsed < freeCheckLimit;
}

export function recordCheck(installId) {
  const account = getAccount(installId);

  if (!isSubscribed(account)) {
    account.checksUsed += 1;
  }

  account.updatedAt = new Date().toISOString();
  return account;
}

export function attachStripeCustomer(installId, stripeCustomerId) {
  const account = getAccount(installId);
  account.stripeCustomerId = stripeCustomerId;
  account.updatedAt = new Date().toISOString();
  customerToInstall.set(stripeCustomerId, installId);
  return account;
}

export function markSubscription(installId, stripeCustomerId, stripeSubscriptionId, status) {
  const account = attachStripeCustomer(installId, stripeCustomerId);
  account.stripeSubscriptionId = stripeSubscriptionId;
  account.subscriptionStatus = status;
  account.updatedAt = new Date().toISOString();
  return account;
}

export function updateSubscriptionByCustomer(stripeCustomerId, stripeSubscriptionId, status) {
  const installId = customerToInstall.get(stripeCustomerId);
  if (!installId) return null;

  return markSubscription(installId, stripeCustomerId, stripeSubscriptionId, status);
}

export function findByInstallId(installId) {
  return installs.get(installId) ?? null;
}

export function isSubscribed(account) {
  return ['active', 'trialing'].includes(account.subscriptionStatus);
}

export function publicUsage(account, freeCheckLimit) {
  return {
    checksUsed: account.checksUsed,
    freeCheckLimit,
    checksRemaining: Math.max(freeCheckLimit - account.checksUsed, 0),
    subscriptionStatus: account.subscriptionStatus,
    subscribed: isSubscribed(account),
  };
}
