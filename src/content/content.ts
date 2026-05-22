import { autoDetectPrices } from '../shared/autoDetect';
import { BADGE_CLASS, INIT_KEY, STORAGE_KEYS } from '../shared/constants';
import { extractPriceText, purifyNumber } from '../shared/purifyNumber';
import { startPicker } from './picker';
import type { ContentMessage, ConversionConfig } from '../shared/types';

let currentConfig: ConversionConfig | null = null;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const resetPrevious = () => {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
  document.querySelectorAll('[data-converted="true"]').forEach((el) => {
    delete (el as HTMLElement).dataset.converted;
  });
};

const processPrices = () => {
  if (!currentConfig) return;
  const { selector, rate, operation, symbol } = currentConfig;
  if (!selector.trim() || !rate || rate <= 0) return;

  document.querySelectorAll(selector).forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.dataset.converted) return;

    const price = purifyNumber(extractPriceText(htmlEl));
    if (Number.isNaN(price) || price === 0) return;

    const convertedPrice = operation === 'divide' ? price / rate : price * rate;
    const formattedPrice = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(convertedPrice);

    const badge = document.createElement('div');
    badge.className = BADGE_CLASS;
    badge.style.cssText =
      'display:inline-flex; background:#fef08a; color:#854d0e; padding:2px 6px; border-radius:4px; font-size:0.85em; font-weight:bold; margin:4px 0; direction:ltr;';
    badge.innerText = `≈ ${formattedPrice}${symbol ? ` ${symbol}` : ''}`;

    htmlEl.insertAdjacentElement('afterend', badge);
    htmlEl.dataset.converted = 'true';
  });
};

const scheduleProcess = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => processPrices(), 300);
};

const stopConversion = () => {
  currentConfig = null;
  if (observer) observer.disconnect();
  observer = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  resetPrevious();
};

const startConversion = (config: ConversionConfig) => {
  currentConfig = config;
  resetPrevious();
  processPrices();

  if (observer) observer.disconnect();
  observer = new MutationObserver(() => scheduleProcess());
  observer.observe(document.body, { childList: true, subtree: true });
};

const onMessage = (
  request: ContentMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: Record<string, unknown>) => void,
): boolean => {
  if (request.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === 'START_PICKER') {
    void startPicker();
    sendResponse({ ok: true, started: true });
    return false;
  }

  if (request.type === 'AUTO_DETECT') {
    const result = autoDetectPrices();
    if (result.ok && result.selector) {
      void chrome.storage.local.set({
        [STORAGE_KEYS.pickedTarget]: {
          selector: result.selector,
          matchCount: result.matchCount ?? 0,
          preview: result.preview ?? '',
          pickedAt: Date.now(),
          source: 'auto',
          ...(result.reason ? { reason: result.reason } : {}),
        },
      });
    }
    sendResponse({ ...result });
    return false;
  }

  if (request.type === 'STOP_CONVERSION') {
    stopConversion();
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === 'START_CONVERSION') {
    startConversion(request.payload);
    const matched = currentConfig
      ? document.querySelectorAll(currentConfig.selector).length
      : 0;
    sendResponse({ ok: true, matched });
    return false;
  }

  return false;
};

const win = window as typeof window & { [INIT_KEY]?: boolean };
if (!win[INIT_KEY]) {
  win[INIT_KEY] = true;
  chrome.runtime.onMessage.addListener(onMessage);
}
