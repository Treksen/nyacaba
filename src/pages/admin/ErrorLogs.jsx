import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatDateTime } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

export default function ErrorLogs() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [clearing, setClearing] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('error_logs')
      .select('*, profiles!error_logs_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) notifyError(error, { action: 'load_error_logs' });
    else setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggleRow(id) {
    setExpanded((e) => {
      const next = new Set(e);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function clearAll() {
    if (!confirm('Delete ALL error log entries? This cannot be undone.')) return;
    setClearing(true);
    const { error } = await supabase.from('error_logs').delete().not('id', 'is', null);
    setClearing(false);
    if (error) notifyError(error, { action: 'clear_error_logs' });
    else {
      toast.success('Error logs cleared');
      load();
    }
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Admin only"
        description="Only administrators can view the error log."
      />
    );
  }

  return (
    <>
      <PageHeader
        kicker="Diagnostics"
        title="Error logs"
        description="Every error captured by the frontend. Useful for spotting recurring issues."
        action={
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary text-xs !py-1.5">
              <RefreshCw size={12}/> Refresh
            </button>
            {rows.length > 0 && (
              <button onClick={clearAll} disabled={clearing} className="btn-ghost text-rose-700 hover:bg-rose-50 text-xs !py-1.5">
                <Trash2 size={12}/> {clearing ? 'Clearing…' : 'Clear all'}
              </button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="card-padded flex justify-center py-10">
          <LoadingSpinner label="Loading error logs…" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No errors logged"
          description="Either nothing has gone wrong, or the log was recently cleared. Good news either way."
        />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-cream-200">
            {rows.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <li key={r.id} className="p-4">
                  <button
                    onClick={() => toggleRow(r.id)}
                    className="w-full text-left flex items-start gap-3"
                  >
                    {isOpen ? <ChevronDown size={16} className="mt-1 shrink-0 text-ink-500" /> : <ChevronRight size={16} className="mt-1 shrink-0 text-ink-500" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-rose-700 break-words">
                        {r.code && <span className="bg-rose-100 px-1.5 py-0.5 rounded mr-2">{r.code}</span>}
                        {r.message}
                      </p>
                      <p className="text-xs text-ink-600 mt-1">
                        {formatDateTime(r.created_at)}
                        {r.profiles?.full_name && ` · ${r.profiles.full_name}`}
                        {r.user_role && ` · ${r.user_role}`}
                        {r.route && ` · ${r.route}`}
                      </p>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 ml-7 space-y-2 text-xs">
                      {r.details && (
                        <div>
                          <p className="kicker mb-0.5">Details</p>
                          <p className="font-mono text-ink-700 whitespace-pre-wrap">{r.details}</p>
                        </div>
                      )}
                      {r.hint && (
                        <div>
                          <p className="kicker mb-0.5">Hint</p>
                          <p className="font-mono text-ink-700">{r.hint}</p>
                        </div>
                      )}
                      {r.context && (
                        <div>
                          <p className="kicker mb-0.5">Context</p>
                          <pre className="font-mono text-ink-700 bg-cream-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(r.context, null, 2)}
                          </pre>
                        </div>
                      )}
                      {r.user_agent && (
                        <div>
                          <p className="kicker mb-0.5">User Agent</p>
                          <p className="font-mono text-ink-500 break-words">{r.user_agent}</p>
                        </div>
                      )}
                      {r.stack && (
                        <details>
                          <summary className="kicker cursor-pointer">Stack trace</summary>
                          <pre className="font-mono text-ink-500 bg-cream-100 p-2 rounded overflow-x-auto mt-1">
                            {r.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
