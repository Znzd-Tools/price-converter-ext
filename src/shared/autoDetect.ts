import { BADGE_CLASS, PICKER_ROOT_ID } from './constants';
import { generateSelector } from './generateSelector';
import { extractPriceText, getElementText, hasPriceContent } from './purifyNumber';
import { getSiteSelectors, type SiteSelector } from './siteProfiles';

const PRICE_NAME = /price|cost|amount|fee|total|final|value|paid|تومان|ریال/i;
const PRICE_TEXT =
  /[\d,.۰-۹٠-٩]+\s*(تومان|ریال|٬|،|USD|EUR|€|\$|£|AED)|^\s*[\d,.۰-۹٠-٩]{2,}\s*$/i;
const MIN_SCORE = 40;

export interface AutoDetectResult {
  ok: boolean;
  selector?: string;
  matchCount?: number;
  preview?: string;
  reason?: string;
}

interface ScoredCandidate {
  selector: string;
  score: number;
  matchCount: number;
  preview: string;
  reason: string;
}

const BUILTIN_SELECTORS: SiteSelector[] = [
  { selector: '[data-testid="price-final"]', score: 95, reason: 'data-testid=price-final' },
  { selector: '[data-testid="product-price"]', score: 93, reason: 'data-testid=product-price' },
  { selector: '[data-testid="price"]', score: 90, reason: 'data-testid=price' },
  { selector: '[data-testid*="price"]', score: 82, reason: 'data-testid contains price' },
  { selector: '[data-price]', score: 88, reason: 'data-price attribute' },
  { selector: '[itemprop="price"]', score: 88, reason: 'schema.org price' },
  { selector: '[itemprop="lowPrice"]', score: 84, reason: 'schema.org lowPrice' },
  { selector: '.a-price .a-offscreen', score: 90, reason: 'Amazon-style price' },
  { selector: '[class*="price"]', score: 65, reason: 'class contains price' },
  { selector: '[class*="Price"]', score: 65, reason: 'class contains Price' },
];

const isVisible = (el: Element): boolean => {
  const html = el as HTMLElement;
  if (html.closest(`#${PICKER_ROOT_ID}, .${BADGE_CLASS}`)) return false;
  const style = getComputedStyle(html);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = html.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const countPricedMatches = (selector: string): { count: number; preview: string } => {
  try {
    const priced = [...document.querySelectorAll(selector)].filter(
      (el) => isVisible(el) && hasPriceContent(el),
    );
    const preview = priced[0] ? extractPriceText(priced[0]).slice(0, 60) : '';
    return { count: priced.length, preview };
  } catch {
    return { count: 0, preview: '' };
  }
};

const scoreSelector = (
  selector: string,
  baseScore: number,
  reason: string,
  opts?: { relaxMatch?: boolean },
): ScoredCandidate | null => {
  let elements: Element[];
  try {
    elements = [...document.querySelectorAll(selector)];
  } catch {
    return null;
  }

  const visible = elements.filter(isVisible);
  if (visible.length === 0 || visible.length > 120) return null;

  const { count, preview } = countPricedMatches(selector);

  if (count === 0) {
    if (!opts?.relaxMatch) return null;
    if (visible.length === 0) return null;
    return {
      selector,
      score: baseScore - 15,
      matchCount: visible.length,
      preview: extractPriceText(visible[0]!).slice(0, 60) || getElementText(visible[0]!).slice(0, 60),
      reason,
    };
  }

  if (count > 80) return null;

  let score = baseScore + Math.min(count * 3, 20);
  if (PRICE_TEXT.test(preview)) score += 10;
  if (count === 1) score -= 5;
  if (count > 30) score -= 10;

  return { selector, score, matchCount: count, preview, reason };
};

const scanAttributedElements = (): ScoredCandidate[] => {
  const bySelector = new Map<string, ScoredCandidate>();

  document
    .querySelectorAll(
      '[data-testid], [data-test-id], [data-qa], [data-price], [itemprop], [aria-label]',
    )
    .forEach((el) => {
      let attrScore = 0;
      let reason = '';

      for (const attr of el.attributes) {
        if (!PRICE_NAME.test(attr.name) && !PRICE_NAME.test(attr.value)) continue;
        attrScore = attr.name.startsWith('data-') ? 75 : 78;
        reason = `${attr.name}=${attr.value.slice(0, 40)}`;
        break;
      }

      if (!attrScore || !isVisible(el) || !hasPriceContent(el)) return;

      const selector = generateSelector(el);
      const { count, preview } = countPricedMatches(selector);
      if (count === 0 || count > 80) return;

      const score = attrScore + Math.min(count * 3, 18);
      const existing = bySelector.get(selector);
      if (!existing || score > existing.score) {
        bySelector.set(selector, { selector, score, matchCount: count, preview, reason });
      }
    });

  return [...bySelector.values()];
};

export const autoDetectPrices = (): AutoDetectResult => {
  const candidates: ScoredCandidate[] = [];
  const siteSelectors = getSiteSelectors();

  for (const site of siteSelectors) {
    const c = scoreSelector(site.selector, site.score, site.reason, { relaxMatch: true });
    if (c) candidates.push(c);
  }

  for (const builtin of BUILTIN_SELECTORS) {
    if (siteSelectors.some((s) => s.selector === builtin.selector)) continue;
    const c = scoreSelector(builtin.selector, builtin.score, builtin.reason);
    if (c) candidates.push(c);
  }

  candidates.push(...scanAttributedElements());

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < MIN_SCORE) {
    return { ok: false };
  }

  return {
    ok: true,
    selector: best.selector,
    matchCount: best.matchCount,
    preview: best.preview,
    reason: best.reason,
  };
};
