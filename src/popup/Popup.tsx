import { useEffect, useState } from 'react';
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
  divide: 'تقسیم بر نرخ',
  multiply: 'ضرب در نرخ',
};

const FORMULA_HINT: Record<ConversionOperation, string> = {
  divide: 'خروجی = مقدار ÷ نرخ',
  multiply: 'خروجی = مقدار × نرخ',
};

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
          ? `تشخیص خودکار: ${target.matchCount} قیمت پیدا شد.`
          : 'عنصر از صفحه انتخاب شد.';
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
          `تشخیص خودکار: ${target.matchCount} قیمت (${result.reason ?? 'شناسایی شد'})`,
        );
        return;
      }

      setError('قیمت خودکار پیدا نشد. «انتخاب دستی» را بزنید.');
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

      setStatus(`${matched} قیمت تبدیل شد.`);
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

  return (
    <div className="p-4 w-80">
      <h2 className="text-base font-bold mb-3 border-b pb-2 text-slate-800">
        تبدیل قیمت
      </h2>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <button
            type="button"
            disabled={autoDetecting || picking}
            onClick={() => void runAutoDetect()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded font-medium text-sm"
          >
            {autoDetecting ? 'در حال تشخیص…' : 'تشخیص خودکار'}
          </button>
          <button
            type="button"
            disabled={picking || autoDetecting}
            onClick={() => void handlePickOnPage()}
            className="w-full py-2 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-60 text-slate-800 rounded font-medium text-sm"
          >
            {picking ? 'در حال آماده‌سازی…' : 'انتخاب دستی'}
          </button>
          {picked && (
            <div className="text-xs text-slate-700 bg-white border rounded p-2">
              <div className="font-medium text-green-800">
                {picked.source === 'auto' ? 'خودکار · ' : ''}
                {picked.matchCount} مورد
              </div>
              {picked.reason && <div className="text-slate-500">منبع: {picked.reason}</div>}
              {picked.preview && (
                <div className="truncate text-slate-500">نمونه: {picked.preview}</div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">نرخ تبدیل</label>
          <input
            type="number"
            min={0}
            step="any"
            required
            className="w-full border rounded p-2 text-sm"
            placeholder="مثلاً 177000"
            value={config.rate > 0 ? config.rate : ''}
            onChange={(e) => {
              const value = e.target.value;
              persistConfig({
                ...config,
                rate: value === '' ? 0 : Number(value),
              });
            }}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">عملیات</label>
          <select
            className="w-full border rounded p-2 text-sm"
            value={config.operation}
            onChange={(e) =>
              persistConfig({
                ...config,
                operation: e.target.value as ConversionOperation,
              })
            }
          >
            {(Object.keys(OPERATION_LABELS) as ConversionOperation[]).map((op) => (
              <option key={op} value={op}>
                {OPERATION_LABELS[op]}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">{FORMULA_HINT[config.operation]}</p>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">نماد خروجی (اختیاری)</label>
          <input
            type="text"
            className="w-full border rounded p-2 text-sm"
            placeholder="USD"
            value={config.symbol}
            onChange={(e) => persistConfig({ ...config, symbol: e.target.value })}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleApply()}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
        >
          اعمال روی صفحه
        </button>

        <button
          type="button"
          onClick={() => void handleStop()}
          className="w-full py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-sm"
        >
          حذف تبدیل‌ها
        </button>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full text-xs text-slate-500 hover:text-slate-700"
        >
          {showAdvanced ? '▲ پیشرفته' : '▼ پیشرفته (CSS)'}
        </button>
        {showAdvanced && (
          <input
            type="text"
            className="w-full border rounded p-2 text-sm font-mono"
            placeholder='[data-testid="price-final"]'
            value={config.selector}
            onChange={(e) => persistConfig({ ...config, selector: e.target.value })}
          />
        )}

        {status && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
            {status}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
