import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, History, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatDateTime, timeAgo, initials } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

const ENTITY_LABELS = {
  profiles:                'User profile',
  members:                 'Member',
  member_family:           'Family record',
  contributions:           'Contribution',
  pledges:                 'Pledge',
  welfare_requests:        'Welfare request',
  welfare_approvals:       'Welfare decision',
  projects:                'Project',
  project_milestones:      'Milestone',
  project_expenses:        'Project expense',
  inventory_items:         'Inventory item',
  inventory_transactions:  'Inventory transaction',
  inventory_categories:    'Inventory category',
  welfare_groups:          'Welfare group',
  meetings:                'Meeting',
  meeting_minutes:         'Meeting minutes',
  action_items:            'Action item',
  resolutions:             'Resolution',
  announcements:           'Announcement',
  system_settings:         'System setting',
};

const ACTION_STYLES = {
  insert: { icon: Plus,   label: 'Created', cls: 'bg-primary-50 text-primary-900' },
  update: { icon: Pencil, label: 'Updated', cls: 'bg-blue-50 text-blue-700' },
  delete: { icon: Trash2, label: 'Deleted', cls: 'bg-rose-50 text-rose-700' },
};

export default function AuditLog() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Admin access required');
      navigate('/');
    }
  }, [isAdmin, navigate, toast]);

  async function load() {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, details, created_at, actor_id, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (entityFilter) query = query.eq('entity_type', entityFilter);
    if (actionFilter) query = query.eq('action', actionFilter);
    const { data, error } = await query;
    if (error) notifyError(error, { action: 'AuditLog' });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [entityFilter, actionFilter]);

  const filtered = rows.filter((r) =>
    !q ||
    r.profiles?.full_name?.toLowerCase().includes(q.toLowerCase()) ||
    r.entity_type?.toLowerCase().includes(q.toLowerCase()) ||
    r.entity_id?.toLowerCase().includes(q.toLowerCase())
  );

  function summarizeRow(r) {
    const d = r.details || {};
    if (r.action === 'update' && d.changed?.length) {
      // For each changed key, show key:oldval→newval (truncate values)
      return d.changed.slice(0, 3).map((k) => {
        const ov = JSON.stringify(d.old?.[k] ?? null).slice(0, 30);
        const nv = JSON.stringify(d.new?.[k] ?? null).slice(0, 30);
        return `${k}: ${ov} → ${nv}`;
      }).join(' · ') + (d.changed.length > 3 ? `  (+${d.changed.length - 3} more)` : '');
    }
    if (r.action === 'insert' || r.action === 'delete') {
      const row = d.row || {};
      // Try to pick a human-readable identifier
      const ident = row.name || row.title || row.full_name || row.request_no || row.purpose || row.email || row.id;
      return ident ? String(ident).slice(0, 80) : `${r.entity_type} ${r.entity_id?.slice(0, 8) || ''}`;
    }
    return r.entity_id?.slice(0, 8) || '';
  }

  return (
    <>
      <PageHeader
        kicker="Trust & Transparency"
        title="Audit log"
        description="Every change to money, members, welfare, and configuration — recorded with the person who made it."
      />

      <div className="card-padded mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actor, entity, ID…"
              className="input pl-10"
            />
          </div>
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="input">
            <option value="">All entity types</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input">
            <option value="">All actions</option>
            <option value="insert">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
          </select>
        </div>
        <p className="text-xs text-ink-500 mt-3">
          Showing the most recent 500 events. Use the filters to narrow down.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner label="Loading the log…" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={History} title="No events yet" description="Once changes happen in the system, they'll show up here." />
        </div>
      ) : (
        <div className="card divide-y divide-cream-200">
          {filtered.map((r) => {
            const style = ACTION_STYLES[r.action] || ACTION_STYLES.update;
            const Icon = style.icon;
            const isOpen = !!expanded[r.id];
            return (
              <div key={r.id}>
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}
                  className="w-full flex items-start gap-3 p-4 hover:bg-cream-50/60 transition text-left"
                >
                  <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${style.cls}`}>
                    <Icon size={14}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink-900">
                        {r.profiles?.full_name || (r.actor_id ? 'Unknown user' : 'System')}
                      </span>
                      <span className="text-ink-500">·</span>
                      <span className="text-ink-700">
                        {style.label.toLowerCase()} {ENTITY_LABELS[r.entity_type] || r.entity_type}
                      </span>
                    </div>
                    <p className="text-xs text-ink-600 mt-0.5 line-clamp-1 font-mono">
                      {summarizeRow(r)}
                    </p>
                    <p className="text-[11px] text-ink-500 mt-0.5">
                      {formatDateTime(r.created_at)} · {timeAgo(r.created_at)}
                    </p>
                  </div>
                  {isOpen ? <ChevronDown size={16} className="text-ink-500 mt-2"/> : <ChevronRight size={16} className="text-ink-500 mt-2"/>}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 -mt-1">
                    <div className="bg-cream-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-words text-ink-800">{JSON.stringify(r.details, null, 2)}</pre>
                    </div>
                    <p className="text-[11px] text-ink-500 mt-1.5">
                      Record ID: <span className="font-mono">{r.entity_id}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
