import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

/* ─── context ──────────────────────────────────────────────────── */
const ToastContext = createContext(null);

/* ─── helpers ──────────────────────────────────────────────────── */
const MAX_TOASTS = 4;
const DURATION   = 3800;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const typeConfig = {
  success: {
    border: 'border-emerald-500/60',
    bg: 'bg-[#0d1f14]',
    Icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    bar: 'bg-emerald-500',
  },
  error: {
    border: 'border-red-500/60',
    bg: 'bg-[#1a0d0d]',
    Icon: AlertCircle,
    iconClass: 'text-red-400',
    bar: 'bg-red-500',
  },
  warning: {
    border: 'border-amber-500/60',
    bg: 'bg-[#1a1506]',
    Icon: AlertTriangle,
    iconClass: 'text-amber-400',
    bar: 'bg-amber-500',
  },
  info: {
    border: 'border-blue-500/60',
    bg: 'bg-[#0d1320]',
    Icon: Info,
    iconClass: 'text-blue-400',
    bar: 'bg-blue-500',
  },
};

/* ─── single toast item ─────────────────────────────────────────── */
function ToastItem({ toast, onDismiss }) {
  const cfg = typeConfig[toast.type] ?? typeConfig.info;
  const { Icon } = cfg;
  const [exiting, setExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 180);
  }, [toast.id, onDismiss]);

  // Auto-dismiss with exit animation
  useEffect(() => {
    const t = setTimeout(() => handleDismiss(), DURATION);
    return () => clearTimeout(t);
  }, [handleDismiss]);

  return (
    <div
      className={[
        'flex items-start gap-3 border rounded-xl px-4 py-3',
        'shadow-2xl text-sm text-white min-w-[280px] max-w-sm overflow-hidden relative',
        exiting ? 'anim-toast-out' : 'anim-toast-in',
        cfg.border,
        cfg.bg,
      ].join(' ')}
      role="alert"
    >
      {/* Accent bar on left */}
      <div className={['absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl', cfg.bar].join(' ')} />

      <Icon size={16} className={['mt-0.5 shrink-0', cfg.iconClass].join(' ')} />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={handleDismiss}
        className="text-[#6b7280] hover:text-white transition-colors shrink-0 btn-interactive rounded"
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
      // Deduplicate — skip if an identical message already exists
      if (prev.some((t) => t.message === message && t.type === type)) return prev;
      const next = [...prev, { id, type, message }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const toast = {
    success: (msg) => addToast('success', msg),
    error:   (msg) => addToast('error',   msg),
    warning: (msg) => addToast('warning', msg),
    info:    (msg) => addToast('info',    msg),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* toast stack — top-right */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
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
