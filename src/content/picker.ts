import { EXT_PREFIX, PICKER_ROOT_ID, STORAGE_KEYS } from '../shared/constants';
import { countMatches, generateSelector } from '../shared/generateSelector';

const PICKER_STYLE_ID = `${EXT_PREFIX}-picker-style`;
const PICKER_HINT_ID = `${EXT_PREFIX}-picker-hint`;
const PICKER_BOX_ID = `${EXT_PREFIX}-picker-box`;

let pickerActive = false;
let cleanup: (() => void) | null = null;

const injectStyles = () => {
  if (document.getElementById(PICKER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PICKER_STYLE_ID;
  style.textContent = `
    #${PICKER_ROOT_ID} {
      position: fixed; inset: 0; z-index: 2147483646; cursor: crosshair;
      font-family: system-ui, sans-serif;
    }
    #${PICKER_HINT_ID} {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #fff; padding: 10px 16px; border-radius: 8px;
      font-size: 14px; z-index: 2147483647; box-shadow: 0 4px 20px rgba(0,0,0,.25);
      pointer-events: none; max-width: 90vw; text-align: center;
    }
    #${PICKER_BOX_ID} {
      position: fixed; pointer-events: none; z-index: 2147483647;
      border: 2px solid #2563eb; background: rgba(37, 99, 235, 0.12);
      border-radius: 4px; transition: all 0.05s ease-out;
    }
  `;
  document.documentElement.appendChild(style);
};

export const startPicker = (): Promise<{
  ok: boolean;
  selector?: string;
  matchCount?: number;
  preview?: string;
  cancelled?: boolean;
}> =>
  new Promise((resolve) => {
    if (pickerActive) {
      resolve({ ok: false, cancelled: true });
      return;
    }

    pickerActive = true;
    injectStyles();

    const root = document.createElement('div');
    root.id = PICKER_ROOT_ID;

    const hint = document.createElement('div');
    hint.id = PICKER_HINT_ID;
    hint.textContent = 'روی قیمت کلیک کنید — Esc برای لغو';

    const box = document.createElement('div');
    box.id = PICKER_BOX_ID;

    root.append(hint, box);
    document.documentElement.append(root);

    let hovered: Element | null = null;

    const getTarget = (x: number, y: number): Element | null => {
      root.style.pointerEvents = 'none';
      const el = document.elementFromPoint(x, y);
      root.style.pointerEvents = 'auto';
      if (!el || root.contains(el)) return null;
      return el;
    };

    const updateHighlight = (el: Element) => {
      const rect = el.getBoundingClientRect();
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;

      const selector = generateSelector(el);
      const matchCount = countMatches(selector);
      const preview = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      hint.textContent = `${matchCount} مورد پیدا شد — کلیک کنید | ${preview || selector}`;
    };

    const finish = (result: {
      ok: boolean;
      selector?: string;
      matchCount?: number;
      preview?: string;
      cancelled?: boolean;
    }) => {
      cleanup?.();
      pickerActive = false;
      resolve(result);
    };

    const onMove = (e: MouseEvent) => {
      const el = getTarget(e.clientX, e.clientY);
      if (!el) return;
      hovered = el;
      updateHighlight(el);
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!hovered) return;

      const selector = generateSelector(hovered);
      const matchCount = countMatches(selector);
      const preview = (hovered.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

      void chrome.storage.local.set({
        [STORAGE_KEYS.pickedTarget]: {
          selector,
          matchCount,
          preview,
          pickedAt: Date.now(),
          source: 'manual',
        },
      });

      finish({ ok: true, selector, matchCount, preview });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish({ ok: false, cancelled: true });
    };

    cleanup = () => {
      root.remove();
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      cleanup = null;
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  });

export const stopPicker = () => {
  cleanup?.();
  pickerActive = false;
};
