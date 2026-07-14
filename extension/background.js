const extensionApi = globalThis.browser ?? globalThis.chrome;

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_CHECKOUT') {
    openCheckout(message.installId)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'GET_ACTIVE_TAB') {
    getActiveTab()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function openCheckout(installId) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ installId }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to start checkout.');
  }

  await extensionApi.tabs.create({ url: payload.url });
  return { ok: true };
}

async function getActiveTab() {
  const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
  return { ok: true, tabId: tab?.id ?? null };
}

async function getApiBase() {
  const values = await extensionApi.storage.local.get({ apiBase: 'http://localhost:4242' });
  return values.apiBase.replace(/\/$/, '');
}
