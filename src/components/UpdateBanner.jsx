import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

/**
 * Shows a banner when a new app version is ready to install.
 * Polls for updates every 60 seconds so users on long sessions are notified.
 * "Update now" applies immediately; "X" dismisses until next deploy.
 */
export default function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) setInterval(() => r.update(), 60_000);
    },
  });

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-primary-900 text-cream-50 text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <RefreshCw size={15} className="shrink-0 opacity-80" />
        <span>A new version of the app is ready.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1 rounded-lg bg-accent-500 text-white text-xs font-semibold hover:bg-accent-600 transition"
        >
          Update now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-primary-700 transition opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
