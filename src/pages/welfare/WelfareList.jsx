import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDate } from '../../lib/format';
import { WELFARE_STATUS, WELFARE_CATEGORIES, URGENCY } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';

export default function WelfareList() {
  const navigate = useNavigate();
  const { canManageWelfare } = useAuth();
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState('');
  const [memberId, setMemberId] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    // Load active members (only useful for leadership filter — RLS hides others from regular members)
    if (canManageWelfare) {
      supabase.from('members')
        .select('id, full_name')
        .eq('status', 'active')
        .order('full_name')
        .then(({ data }) => setMembers(data || []));
    }
  }, [canManageWelfare]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      let query = supabase
        .from('welfare_requests')
        .select('id, request_no, title, category, amount_requested, amount_approved, amount_disbursed, status, urgency, submitted_at, members(full_name)')
        .order('submitted_at', { ascending: false });
      if (status)   query = query.eq('status', status);
      if (category) query = query.eq('category', category);
      if (urgency)  query = query.eq('urgency', urgency);
      if (memberId) query = query.eq('member_id', memberId);
      const { data } = await query;
      if (active) {
        setRows(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [status, category, urgency, memberId]);

  const filtered = rows.filter((r) =>
    !q ||
    r.title?.toLowerCase().includes(q.toLowerCase()) ||
    r.request_no?.toLowerCase().includes(q.toLowerCase()) ||
    r.members?.full_name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        kicker="Bear One Another's Burdens"
        title="Welfare requests"
        description="Stand with members in their hour of need."
        action={
          <Link to="/welfare/new" className="btn-primary">
            <Plus size={16} /> New request
          </Link>
        }
      />

      <div className="card-padded mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, request no, member…"
              className="input pl-10"
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            <option value="">All categories</option>
            {WELFARE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="input">
            <option value="">All urgencies</option>
            {URGENCY.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">All statuses</option>
            {Object.entries(WELFARE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {canManageWelfare && members.length > 0 && (
          <div className="mb-3">
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="input">
              <option value="">All members</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
        )}
        <p className="text-xs text-ink-500">
          Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? 'request' : 'requests'}
          {(status || category || urgency || q || memberId) && ' (filtered)'}
        </p>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        onRowClick={(r) => navigate(`/welfare/${r.id}`)}
        emptyTitle="No requests yet"
        emptyDescription="Welfare requests will appear here as they're submitted."
        emptyAction={
          <Link to="/welfare/new" className="btn-primary">
            <Plus size={16} /> Submit first request
          </Link>
        }
        columns={[
          { key: 'no', header: 'Request', render: (r) => (
            <div>
              <p className="font-mono text-xs text-ink-600">{r.request_no}</p>
              <p className="font-medium text-ink-900">{r.title}</p>
            </div>
          )},
          { key: 'member', header: 'Member', render: (r) => r.members?.full_name || '—' },
          { key: 'category', header: 'Category', render: (r) => WELFARE_CATEGORIES.find((c) => c.value === r.category)?.label || r.category },
          {
            key: 'amount', header: 'Amount',
            render: (r) => (
              <div>
                <p className="font-semibold text-primary-900">{formatMoney(r.amount_requested)}</p>
                {r.amount_disbursed > 0 && <p className="text-xs text-ink-500">paid {formatMoney(r.amount_disbursed)}</p>}
              </div>
            ),
          },
          { key: 'urgency', header: 'Urgency', render: (r) => (
            <span className={
              r.urgency === 'critical' ? 'badge-rose' :
              r.urgency === 'high' ? 'badge-amber' :
              r.urgency === 'medium' ? 'badge-blue' : 'badge-slate'
            }>
              {r.urgency}
            </span>
          )},
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} statusMap={WELFARE_STATUS} /> },
          { key: 'date', header: 'Submitted', render: (r) => formatDate(r.submitted_at) },
        ]}
      />
    </>
  );
}
