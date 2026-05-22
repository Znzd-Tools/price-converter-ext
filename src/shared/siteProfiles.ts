export interface SiteSelector {
  selector: string;
  score: number;
  reason: string;
}

/** Hostname (without www) → selectors tried first on that site */
export const SITE_PROFILES: Record<string, SiteSelector[]> = {
  'digikala.com': [
    { selector: '[data-testid="price-final"]', score: 100, reason: 'Digikala price-final' },
    { selector: '[data-testid="price-no-discount"]', score: 96, reason: 'Digikala price-no-discount' },
    { selector: '[data-testid="price"]', score: 92, reason: 'Digikala price' },
    { selector: '.text-h4', score: 70, reason: 'Digikala legacy price class' },
  ],
  'amazon.com': [
    { selector: '.a-price .a-offscreen', score: 98, reason: 'Amazon price' },
    { selector: '.a-price-whole', score: 90, reason: 'Amazon price whole' },
    { selector: '[data-a-color="price"] .a-offscreen', score: 88, reason: 'Amazon price block' },
  ],
  'amazon.ae': [
    { selector: '.a-price .a-offscreen', score: 98, reason: 'Amazon AE price' },
  ],
  'amazon.co.uk': [
    { selector: '.a-price .a-offscreen', score: 98, reason: 'Amazon UK price' },
  ],
};

export const getSiteSelectors = (): SiteSelector[] => {
  const host = location.hostname.replace(/^www\./, '');
  for (const [domain, selectors] of Object.entries(SITE_PROFILES)) {
    if (host === domain || host.endsWith(`.${domain}`)) return selectors;
  }
  return [];
};
