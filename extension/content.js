(() => {
if (globalThis.__ghostCheckContentLoaded) {
  return;
}

globalThis.__ghostCheckContentLoaded = true;

const extensionApi = globalThis.browser ?? globalThis.chrome;
const PAGE_CHECK_KEY = 'ghost-check:checked';

let currentBanner = null;

bootstrap();

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CHECK_CURRENT_PAGE') {
    checkCurrentPage({ force: true })
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function bootstrap() {
  if (sessionStorage.getItem(PAGE_CHECK_KEY)) return;
  if (!looksLikeArticle()) return;

  await checkCurrentPage({ force: false });
}

async function checkCurrentPage({ force }) {
  if (!force && sessionStorage.getItem(PAGE_CHECK_KEY)) return { ok: true, skipped: true };

  const article = extractArticle();
  if (article.text.length < 500) return { ok: false, error: 'Not enough article text found.' };

  const installId = await getInstallId();
  const apiBase = await getApiBase();

  showBanner({ state: 'loading' });

  const response = await fetch(`${apiBase}/api/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      installId,
      title: article.title,
      url: location.href,
      text: article.text,
    }),
  });
  const payload = await response.json();

  sessionStorage.setItem(PAGE_CHECK_KEY, 'true');

  if (response.status === 402) {
    showBanner({ state: 'locked', result: payload, installId });
    return { ok: false, requiresSubscription: true };
  }

  if (!response.ok) {
    showBanner({ state: 'error', error: payload.error ?? 'Check failed.' });
    return { ok: false, error: payload.error };
  }

  showBanner({ state: 'result', result: payload, installId });
  return { ok: true, result: payload };
}

function extractArticle() {
  const article = document.querySelector('article');
  const root = article ?? document.body;
  const paragraphs = [...root.querySelectorAll('p')]
    .map((paragraph) => paragraph.innerText.trim())
    .filter((text) => text.length > 40);

  return {
    title: document.querySelector('h1')?.innerText.trim() || document.title,
    text: paragraphs.join('\n\n'),
  };
}

function looksLikeArticle() {
  if (document.querySelector('article')) return true;
  return [...document.querySelectorAll('p')].filter((paragraph) => paragraph.innerText.length > 80).length >= 4;
}

function showBanner({ state, result, error, installId }) {
  currentBanner?.remove();

  const banner = document.createElement('aside');
  banner.className = `aicc-banner aicc-${state}`;
  banner.setAttribute('role', 'status');

  if (state === 'loading') {
    banner.innerHTML = `
      <strong>Ghost Check</strong>
      <span>Checking this article with multiple detectors...</span>
    `;
  }

  if (state === 'locked') {
    banner.innerHTML = `
      <strong>Free checks used</strong>
      <span>You have used ${result.usage.checksUsed}/${result.usage.freeCheckLimit} free checks. Subscribe for $12/year to keep checking.</span>
      <button type="button" data-aicc-subscribe>Subscribe</button>
    `;
  }

  if (state === 'error') {
    banner.innerHTML = `
      <strong>Checker unavailable</strong>
      <span>${escapeHtml(error)}</span>
    `;
  }

  if (state === 'result') {
    const likelyAi = result.verdict === 'likely_ai';
    const sources = result.recommendedSources
      .map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a>`)
      .join('');

    banner.innerHTML = `
      <strong>${likelyAi ? 'This article may be AI-written' : 'Credibility check complete'}</strong>
      <span>${Math.round(result.aiProbability * 100)}% AI likelihood, ${result.confidence} confidence. ${result.usage.checksRemaining} free checks remaining.</span>
      <div class="aicc-sources">
        <span>More credible sources:</span>
        ${sources}
      </div>
      <details>
        <summary>Detector results</summary>
        ${result.checkers
          .map((checker) => `<p>${escapeHtml(checker.label)}: ${Math.round(checker.score * 100)}%</p>`)
          .join('')}
      </details>
    `;
  }

  banner.querySelector('[data-aicc-subscribe]')?.addEventListener('click', async () => {
    await extensionApi.runtime.sendMessage({ type: 'OPEN_CHECKOUT', installId });
  });

  document.documentElement.appendChild(banner);
  currentBanner = banner;
}

async function getInstallId() {
  const existing = await extensionApi.storage.local.get('installId');
  if (existing.installId) return existing.installId;

  const installId = crypto.randomUUID();
  await extensionApi.storage.local.set({ installId });
  return installId;
}

async function getApiBase() {
  const values = await extensionApi.storage.local.get({ apiBase: 'https://ghost-check.onrender.com' });
  return values.apiBase.replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
})();
