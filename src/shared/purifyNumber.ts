export const purifyNumber = (str: string | null | undefined): number => {
  if (!str) return NaN;
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';

  let normalized = str;
  for (let i = 0; i < 10; i++) {
    normalized = normalized
      .replaceAll(persian.charAt(i), String(i))
      .replaceAll(arabic.charAt(i), String(i));
  }
  return parseFloat(normalized.replace(/[^\d.]/g, ''));
};

export const getElementText = (el: Element): string =>
  (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Prefer rendered text (handles nested / visually-hidden price nodes). */
export const extractPriceText = (el: Element): string => {
  const html = el as HTMLElement;
  const inner = (html.innerText ?? '').replace(/\s+/g, ' ').trim();
  if (inner.length > 0 && inner.length <= 120 && purifyNumber(inner) > 0) {
    return inner;
  }

  const leaves = [...html.querySelectorAll('*')].filter(
    (node) => node.children.length === 0 || node.childElementCount === 0,
  );
  for (const leaf of leaves) {
    const text = ((leaf as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text.length <= 80 && purifyNumber(text) > 0) return text;
  }

  const fallback = getElementText(el);
  return purifyNumber(fallback) > 0 ? fallback : inner || fallback;
};

export const hasPriceContent = (el: Element): boolean => {
  const value = purifyNumber(extractPriceText(el));
  return !Number.isNaN(value) && value > 0;
};
