import { useEffect, useState, type ReactNode } from 'react';
import { getPageTab } from '../shared/chrome';
import { STORAGE_KEYS } from '../shared/constants';
import type {
  ContentScriptResponse,
  ConversionConfig,
  ConversionOperation,
  PickedTarget,
} from '../shared/types';

const DEFAULT_CONFIG: ConversionConfig = {
  selector: '',
  rate: 0,
  operation: 'divide',
  symbol: '',
};

const OPERATION_LABELS: Record<ConversionOperation, string> = {
  divide: 'تقسیم',
  multiply: 'ضرب',
};

const FORMULA_HINT: Record<ConversionOperation, string> = {
  divide: 'مقدار ÷ نرخ',
  multiply: 'مقدار × نرخ',
};

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
      aria-hidden
    />
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-pc-border bg-pc-surface p-3.5 shadow-card">
      <h3 className="pc-section-title">
        <span className="pc-step-badge">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Alert({ variant, children }: { variant: 'success' | 'error'; children: ReactNode }) {
  const styles =
    variant === 'success'
      ? 'border-emerald-200 bg-pc-success-bg text-emerald-800'
      : 'border-red-200 bg-pc-danger-bg text-red-800';

  return (
    <p
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${styles}`}
    >
      {children}
    </p>
  );
}

export function Popup() {
  const [config, setConfig] = useState<ConversionConfig>(DEFAULT_CONFIG);
  const [picked, setPicked] = useState<PickedTarget | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);

  const applyTarget = (target: PickedTarget, message: string) => {
    setPicked(target);
    setConfig((prev) => {
      const next = { ...prev, selector: target.selector };
      void chrome.storage.local.set({ [STORAGE_KEYS.config]: next });
      return next;
    });
    setStatus(message);
    setError(null);
  };

  const persistConfig = (next: ConversionConfig) => {
    setConfig(next);
    void chrome.storage.local.set({ [STORAGE_KEYS.config]: next });
  };

  useEffect(() => {
    void chrome.storage.local
      .get([STORAGE_KEYS.config, STORAGE_KEYS.pickedTarget])
      .then((stored) => {
        const savedConfig = stored[STORAGE_KEYS.config] as ConversionConfig | undefined;
        if (savedConfig) {
          setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
        }
        const savedTarget = stored[STORAGE_KEYS.pickedTarget] as PickedTarget | undefined;
        if (savedTarget) {
          const target = savedTarget;
          setPicked(target);
          setConfig((prev) => ({ ...prev, selector: target.selector }));
        }
      });

    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      const pickedChange = changes[STORAGE_KEYS.pickedTarget];
      const newTarget = pickedChange?.newValue as PickedTarget | undefined;
      if (area !== 'local' || !newTarget) return;
      const target = newTarget;
      const msg =
        target.source === 'auto'
          ? `${target.matchCount} قیمت با تشخیص خودکار پیدا شد.`
          : 'قیمت از صفحه انتخاب شد.';
      applyTarget(target, msg);
      setPicking(false);
      setAutoDetecting(false);
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const runAutoDetect = async () => {
    setAutoDetecting(true);
    setStatus(null);
    setError(null);

    try {
      const { tabId } = await getPageTab();
      const result = (await chrome.tabs.sendMessage(tabId, {
        type: 'AUTO_DETECT',
      })) as ContentScriptResponse | undefined;

      if (result?.ok && result.selector) {
        const target: PickedTarget = {
          selector: result.selector,
          matchCount: result.matchCount ?? 0,
          preview: result.preview ?? '',
          pickedAt: Date.now(),
          source: 'auto',
          ...(result.reason ? { reason: result.reason } : {}),
        };
        applyTarget(
          target,
          `${target.matchCount} قیمت شناسایی شد (${result.reason ?? 'خودکار'})`,
        );
        return;
      }

      setError('قیمتی پیدا نشد. از «انتخاب دستی» روی صفحه استفاده کنید.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تشخیص خودکار ناموفق بود.');
    } finally {
      setAutoDetecting(false);
    }
  };

  const handlePickOnPage = async () => {
    setStatus(null);
    setError(null);
    setPicking(true);

    try {
      const { tabId } = await getPageTab();
      await chrome.tabs.sendMessage(tabId, { type: 'START_PICKER' });
      window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در انتخاب از صفحه');
    } finally {
      setPicking(false);
    }
  };

  const handleApply = async () => {
    setStatus(null);
    setError(null);

    if (!config.selector.trim()) {
      setError('ابتدا قیمت را تشخیص دهید یا از صفحه انتخاب کنید.');
      return;
    }
    if (!config.rate || config.rate <= 0) {
      setError('نرخ تبدیل را وارد کنید (بزرگ‌تر از صفر).');
      return;
    }

    try {
      const { tabId } = await getPageTab();
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: 'START_CONVERSION',
        payload: config,
      })) as ContentScriptResponse | undefined;

      const matched = response?.matched ?? 0;
      if (matched === 0) {
        setError('عنصر پیدا نشد. دوباره انتخاب کنید یا صفحه را رفرش کنید.');
        return;
      }

      setStatus(`${matched} قیمت روی صفحه تبدیل شد.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'اعمال تبدیل ناموفق بود.');
    }
  };

  const handleStop = async () => {
    setStatus(null);
    setError(null);
    try {
      const { tabId } = await getPageTab();
      await chrome.tabs.sendMessage(tabId, { type: 'STOP_CONVERSION' });
      setStatus('تبدیل‌ها از صفحه حذف شد.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در توقف تبدیل');
    }
  };

  const hasTarget = Boolean(picked?.selector || config.selector.trim());
  const rateReady = config.rate > 0;
  const canApply = hasTarget && rateReady;

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="border-b border-pc-border pb-3">
        <h1 className="text-lg font-bold tracking-tight text-pc-text">تبدیل قیمت</h1>
        <p className="mt-0.5 text-xs leading-relaxed text-pc-muted">
          قیمت‌ها را روی همان صفحه ببینید — بدون جابه‌جایی
        </p>
      </header>

      {(status || error) && (
        <div className="space-y-2">
          {status && <Alert variant="success">{status}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      )}

      <Section step={1} title="انتخاب قیمت روی صفحه">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={autoDetecting || picking}
            onClick={() => void runAutoDetect()}
            className="pc-btn-primary"
          >
            {autoDetecting ? (
              <>
                <Spinner />
                در حال تشخیص…
              </>
            ) : (
              'تشخیص خودکار'
            )}
          </button>
          <button
            type="button"
            disabled={picking || autoDetecting}
            onClick={() => void handlePickOnPage()}
            className="pc-btn-secondary"
          >
            {picking ? 'آماده‌سازی…' : 'انتخاب دستی'}
          </button>
        </div>

        {picked ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  {picked.source === 'auto' ? 'تشخیص خودکار' : 'انتخاب دستی'}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  {picked.matchCount} عنصر قیمت
                  {picked.reason ? ` · ${picked.reason}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                فعال
              </span>
            </div>
            {picked.preview && (
              <p className="mt-2 truncate rounded-md bg-white/70 px-2 py-1.5 font-mono text-[11px] text-slate-600">
                {picked.preview}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-center text-xs text-pc-muted">
            هنوز قیمتی انتخاب نشده — یکی از دکمه‌های بالا را بزنید
          </p>
        )}
      </Section>

      <Section step={2} title="تنظیم نرخ تبدیل">
        <label className="mb-1.5 block text-sm font-medium text-pc-text" htmlFor="rate">
          نرخ
        </label>
        <input
          id="rate"
          type="number"
          min={0}
          step="any"
          required
          className="pc-input"
          placeholder="مثلاً ۱۷۷۰۰۰"
          value={config.rate > 0 ? config.rate : ''}
          onChange={(e) => {
            const value = e.target.value;
            persistConfig({
              ...config,
              rate: value === '' ? 0 : Number(value),
            });
          }}
        />

        <p className="mt-3 mb-1.5 text-sm font-medium text-pc-text">عملیات</p>
        <div
          className="grid grid-cols-2 gap-1 rounded-lg border border-pc-border bg-slate-100 p-1"
          role="group"
          aria-label="عملیات تبدیل"
        >
          {(Object.keys(OPERATION_LABELS) as ConversionOperation[]).map((op) => {
            const active = config.operation === op;
            return (
              <button
                key={op}
                type="button"
                aria-pressed={active}
                onClick={() => persistConfig({ ...config, operation: op })}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-pc-surface text-pc-primary shadow-sm ring-1 ring-pc-primary/20'
                    : 'text-pc-muted hover:text-pc-text'
                }`}
              >
                {OPERATION_LABELS[op]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-pc-muted">
          {FORMULA_HINT[config.operation]}
        </p>

        <label className="mb-1.5 mt-3 block text-sm font-medium text-pc-text" htmlFor="symbol">
          نماد خروجی{' '}
          <span className="font-normal text-pc-muted">(اختیاری)</span>
        </label>
        <input
          id="symbol"
          type="text"
          className="pc-input"
          placeholder="USD"
          dir="ltr"
          value={config.symbol}
          onChange={(e) => persistConfig({ ...config, symbol: e.target.value })}
        />
      </Section>

      <div className="space-y-2 pt-0.5">
        <button
          type="button"
          disabled={!canApply}
          onClick={() => void handleApply()}
          className="pc-btn-primary"
          title={
            !hasTarget
              ? 'ابتدا قیمت را انتخاب کنید'
              : !rateReady
                ? 'نرخ را وارد کنید'
                : undefined
          }
        >
          اعمال روی صفحه
        </button>
        <button type="button" onClick={() => void handleStop()} className="pc-btn-secondary">
          حذف تبدیل‌ها
        </button>
      </div>

      <div className="border-t border-pc-border pt-1">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="pc-btn-ghost"
          aria-expanded={showAdvanced}
        >
          <span className="text-[10px]" aria-hidden>
            {showAdvanced ? '▲' : '▼'}
          </span>
          تنظیمات پیشرفته (سلکتور CSS)
        </button>
        {showAdvanced && (
          <input
            type="text"
            dir="ltr"
            className="pc-input mt-1 font-mono text-xs"
            placeholder='[data-testid="price-final"]'
            value={config.selector}
            onChange={(e) => persistConfig({ ...config, selector: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
