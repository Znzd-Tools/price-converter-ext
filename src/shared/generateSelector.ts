const STABLE_ATTRS = [
  'data-testid',
  'data-test-id',
  'data-qa',
  'data-price',
  'data-test',
  'itemprop',
  'aria-label',
] as const;

const escapeAttr = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const isUnstableId = (id: string) =>
  /^[a-f0-9-]{10,}$/i.test(id) || /\d{6,}/.test(id) || /^react-|^ember/.test(id);

const isStableClass = (className: string) =>
  className.length < 48 &&
  !/^[a-z]{1,3}[A-Z]/.test(className) &&
  !/_{2,}|--[a-f0-9]{4,}|^[a-z0-9]{8,}$/i.test(className);

const selectorForElement = (el: Element): string | null => {
  for (const attr of STABLE_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) {
      const selector = `[${attr}="${escapeAttr(value)}"]`;
      const count = document.querySelectorAll(selector).length;
      if (count >= 1 && count <= 500) return selector;
    }
  }

  const { id } = el;
  if (id && !isUnstableId(id)) {
    const selector = `#${CSS.escape(id)}`;
    if (document.querySelectorAll(selector).length >= 1) return selector;
  }

  const stableClasses = [...el.classList].filter(isStableClass);
  if (stableClasses.length > 0) {
    const selector = `${el.tagName.toLowerCase()}.${stableClasses.slice(0, 2).join('.')}`;
    const count = document.querySelectorAll(selector).length;
    if (count >= 1 && count <= 500) return selector;
  }

  return null;
};

const buildStructuralSelector = (el: Element): string => {
  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node !== document.body && parts.length < 5) {
    let part = node.tagName.toLowerCase();
    const classes = [...node.classList].filter(isStableClass);
    if (classes.length) part += `.${classes.slice(0, 2).join('.')}`;
    parts.unshift(part);

    const candidate = parts.join(' > ');
    const count = document.querySelectorAll(candidate).length;
    if (count >= 1 && count <= 100) return candidate;

    node = node.parentElement;
  }

  return parts.join(' > ') || el.tagName.toLowerCase();
};

/** Build a selector that tends to match similar price nodes on the page. */
export const generateSelector = (el: Element): string => {
  let node: Element | null = el;

  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    const candidate = selectorForElement(node);
    if (candidate) return candidate;
  }

  return buildStructuralSelector(el);
};

export const countMatches = (selector: string): number => {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
};
