const extensionApi = globalThis.browser ?? globalThis.chrome;

const checkButton = document.querySelector('#check-page');
const subscribeButton = document.querySelector('#subscribe');
const apiBaseInput = document.querySelector('#api-base');
const statusText = document.querySelector('#status');

init();

async function init() {
  const { apiBase = 'http://localhost:4242' } = await extensionApi.storage.local.get('apiBase');
  apiBaseInput.value = apiBase;

  apiBaseInput.addEventListener('change', async () => {
    await extensionApi.storage.local.set({ apiBase: apiBaseInput.value.trim() || 'http://localhost:4242' });
    setStatus('API URL saved.');
  });

  checkButton.addEventListener('click', checkCurrentPage);
  subscribeButton.addEventListener('click', subscribe);
}

async function checkCurrentPage() {
  setStatus('Checking current page...');

  const active = await extensionApi.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' });
  if (!active.ok || !active.tabId) {
    setStatus('No active tab found.');
    return;
  }

  try {
    await extensionApi.scripting.insertCSS({
      target: { tabId: active.tabId },
      files: ['styles.css'],
    });
    await extensionApi.scripting.executeScript({
      target: { tabId: active.tabId },
      files: ['content.js'],
    });
    const result = await extensionApi.tabs.sendMessage(active.tabId, { type: 'CHECK_CURRENT_PAGE' });
    setStatus(result.ok ? 'Check complete. Review the page notice.' : result.error ?? 'Check failed.');
  } catch (error) {
    setStatus('Open an article page, then try again.');
  }
}

async function subscribe() {
  const installId = await getInstallId();
  const result = await extensionApi.runtime.sendMessage({ type: 'OPEN_CHECKOUT', installId });
  setStatus(result.ok ? 'Stripe checkout opened.' : result.error ?? 'Checkout failed.');
}

async function getInstallId() {
  const existing = await extensionApi.storage.local.get('installId');
  if (existing.installId) return existing.installId;

  const installId = crypto.randomUUID();
  await extensionApi.storage.local.set({ installId });
  return installId;
}

function setStatus(message) {
  statusText.textContent = message;
}
