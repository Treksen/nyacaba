import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Wallet, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatMoney, formatDate } from '../../lib/format';
import { EXPENSE_STATUS } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';

export default function ExpensesList() {
  const { canManageFinances, isStaff } = useAuth();
  const navigate = useNavigate();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    supabase.from('expense_categories').select('id, name').eq('status', 'active').order('sort_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      let query = supabase
        .from("expenses")
        .select(
          "id, expense_no, title, amount, expense_date, payment_method, status, category_id, expense_categories(name), recorder:profiles!expenses_recorded_by_fkey(full_name)",
        )
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter)   query = query.eq('status', statusFilter);
      if (categoryFilter) query = query.eq('category_id', categoryFilter);
      if (dateFrom)       query = query.gte('expense_date', dateFrom);
      if (dateTo)         query = query.lte('expense_date', dateTo);
      const { data, error } = await query;
      if (active) {
        if (error) notifyError(error, { action: 'load_expenses' });
        else setRows(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [statusFilter, categoryFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => rows.filter((r) =>
    !q ||
    r.title?.toLowerCase().includes(q.toLowerCase()) ||
    r.expense_no?.toLowerCase().includes(q.toLowerCase())
  ), [rows, q]);

  const total = useMemo(
    () => filtered.filter((r) => r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0),
    [filtered]
  );

  // if (!isStaff) {
  //   return (
  //     <EmptyState
  //       icon={AlertCircle}
  //       title="Leadership only"
  //       description="Only leadership can view the expense ledger."
  //     />
  //   );
  // }

  return (
    <>
      <PageHeader
        kicker="The Outflow"
        title="Expenses"
        description="General spending — lunch, utilities, supplies, transport, stipends, maintenance."
        action={
          canManageFinances && (
            <Link to="/expenses/new" className="btn-primary">
              <Plus size={16} /> Record expense
            </Link>
          )
        }
      />

      <div className="card-padded mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title or expense no."
              className="input pl-10"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
            <option value="">All statuses</option>
            {Object.entries(EXPENSE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-600 mb-1 block">From</label>
            <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-ink-600 mb-1 block">To</label>
            <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-700 flex items-center gap-2 flex-wrap">
          <Wallet size={14} className="text-primary-700" />
          Showing <strong>{filtered.length}</strong> · Approved total: <span className="font-semibold text-primary-900">{formatMoney(total)}</span>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-rose-700 hover:text-rose-900 underline ml-2">
              Clear dates
            </button>
          )}
        </p>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        onRowClick={(r) => navigate(`/expenses/${r.id}`)}
        emptyTitle="No expenses yet"
        emptyDescription="When the treasurer records an outflow, it appears here."
        emptyAction={
          canManageFinances && (
            <Link to="/expenses/new" className="btn-primary">
              <Plus size={16} /> Record the first expense
            </Link>
          )
        }
        columns={[
          { key: 'no', header: 'No', render: (r) => <span className="font-mono text-xs text-ink-600">{r.expense_no}</span> },
          { key: 'date', header: 'Date', render: (r) => formatDate(r.expense_date) },
          { key: 'title', header: 'Title', render: (r) => (
            <div>
              <p className="font-medium text-ink-900">{r.title}</p>
              {r.expense_categories?.name && <p className="text-xs text-ink-500">{r.expense_categories.name}</p>}
            </div>
          )},
          { key: 'recorder', header: 'Recorded by', render: (r) => r.recorder?.full_name || '—', className: 'hidden md:table-cell' },
          { key: 'method', header: 'Method', render: (r) => <span className="capitalize text-xs">{r.payment_method}</span>, className: 'hidden md:table-cell' },
          { key: 'amount', header: 'Amount', className: 'text-right', render: (r) => (
            <span className={`font-semibold whitespace-nowrap ${r.status === 'approved' ? 'text-primary-900' : 'text-ink-500'}`}>
              {formatMoney(r.amount)}
            </span>
          )},
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} statusMap={EXPENSE_STATUS} /> },
        ]}
      />
    </>
  );
}
