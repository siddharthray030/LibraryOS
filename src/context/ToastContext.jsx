import { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

/* ─── context ──────────────────────────────────────────────────── */
const ToastContext = createContext(null);

/* ─── helpers ──────────────────────────────────────────────────── */
const MAX_TOASTS = 4;
const DURATION   = 3500;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const typeConfig = {
  success: {
    border: 'border-emerald-500',
    Icon: CheckCircle2,
    iconClass: 'text-emerald-400',
  },
  error: {
    border: 'border-red-500',
    Icon: AlertCircle,
    iconClass: 'text-red-400',
  },
  info: {
    border: 'border-blue-500',
    Icon: Info,
    iconClass: 'text-blue-400',
  },
};

/* ─── single toast item ─────────────────────────────────────────── */
function ToastItem({ toast, onDismiss }) {
  const cfg = typeConfig[toast.type] ?? typeConfig.info;
  const { Icon } = cfg;

  return (
    <div
      className={[
        'flex items-start gap-3 bg-[#1a2035] border rounded-lg px-4 py-3',
        'shadow-xl text-sm text-white min-w-[280px] max-w-sm',
        'animate-[slideInRight_0.25s_ease-out]',
        cfg.border,
      ].join(' ')}
      role="alert"
    >
      <Icon size={16} className={['mt-0.5 shrink-0', cfg.iconClass].join(' ')} />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[#6b7280] hover:text-white transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ─── provider ──────────────────────────────────────────────────── */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message) => {
    const id = makeId();
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    setTimeout(() => dismiss(id), DURATION);
  }, [dismiss]);

  const toast = {
    success: (msg) => addToast('success', msg),
    error:   (msg) => addToast('error',   msg),
    info:    (msg) => addToast('info',    msg),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* toast stack */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ─── hook ──────────────────────────────────────────────────────── */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
