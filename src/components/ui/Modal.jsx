import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer = null,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizes[size]} bg-cream-50 rounded-t-3xl sm:rounded-2xl shadow-lift border border-cream-200 max-h-[92vh] flex flex-col animate-scale-in`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 paper-grain rounded-t-3xl sm:rounded-t-2xl">
          <h3 className="text-lg font-display font-semibold text-ink-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-600 hover:bg-cream-200 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-3.5 border-t border-cream-200 bg-cream-100/40 rounded-b-2xl flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
