export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function isBlockedUrl(url?: string) {
  return (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('file://')
  );
}

export async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return;
  } catch {
    // Content script missing or crashed — inject the single bundled file
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    throw new Error(
      'اسکریپت صفحه اجرا نشد. صفحه را رفرش کنید، افزونه را Reload کنید، و دوباره امتحان کنید.',
    );
  }
}

export async function getPageTab() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error('تب فعال پیدا نشد.');
  }
  if (isBlockedUrl(tab.url)) {
    throw new Error('روی این صفحه امکان اجرا نیست. یک وب‌سایت عادی باز کنید.');
  }
  await ensureContentScript(tab.id);
  return { tab, tabId: tab.id };
}
