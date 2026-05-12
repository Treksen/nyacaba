import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONE = {
  success: 'bg-primary-900 text-cream-50 border-primary-800',
  error: 'bg-rose-700 text-white border-rose-800',
  info: 'bg-ink-800 text-cream-50 border-ink-700',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, type = 'info', timeout = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((curr) => [...curr, { id, message, type }]);
    if (timeout) setTimeout(() => dismiss(id), timeout);
  }, [dismiss]);

  const value = {
    toast: push,
    success: (m, t) => push(m, 'success', t),
    error: (m, t) => push(m, 'error', t),
    info: (m, t) => push(m, 'info', t),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lift border animate-slide-up ${TONE[t.type]}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
