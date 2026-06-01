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
      font-family: "Vazirmatn", "Segoe UI", Tahoma, system-ui, sans-serif;
    }
    #${PICKER_HINT_ID} {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: #312e81; color: #fff; padding: 12px 20px; border-radius: 12px;
      font-size: 14px; font-weight: 500; z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(49, 46, 129, 0.35);
      pointer-events: none; max-width: min(90vw, 420px); text-align: center;
      line-height: 1.5; border: 1px solid rgba(255,255,255,0.12);
    }
    #${PICKER_BOX_ID} {
      position: fixed; pointer-events: none; z-index: 2147483647;
      border: 2px solid #4f46e5; background: rgba(79, 70, 229, 0.14);
      border-radius: 8px; transition: left 0.05s, top 0.05s, width 0.05s, height 0.05s;
      box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
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
