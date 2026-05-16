import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Wallet, Edit2, Trash2, Printer, CheckCircle2, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatMoney, formatDate } from '../../lib/format';
import { CONTRIBUTION_TYPES, PAYMENT_METHODS, MONTHS, VERIFICATION_STATUS } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';

export default function ContributionsList() {
  const { canManageFinances: isAdmin, canVerifyContributions, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [statusTab, setStatusTab] = useState(searchParams.get('pending') === '1' ? 'pending' : 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    setLoading(true);
    let query = supabase
      .from('contributions')
      .select('id, amount, contribution_type, payment_method, contribution_date, reference_no, period_month, period_year, notes, member_id, recorded_by, verification_status, verified_by, verified_at, rejection_reason, members(full_name, membership_no), projects(name)')
      .order('contribution_date', { ascending: false })
      .limit(500);
    if (type) query = query.eq('contribution_type', type);
    if (statusTab !== 'all') query = query.eq('verification_status', statusTab);
    if (dateFrom) query = query.gte('contribution_date', dateFrom);
    if (dateTo)   query = query.lte('contribution_date', dateTo);
    const { data } = await query;
    setRows(data || []);
    setSelectedIds(new Set()); // clear selection on reload
    setLoading(false);
  }

  useEffect(() => { load(); }, [type, statusTab, dateFrom, dateTo]);

  function toggleSelect(id) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const visible = filtered.filter((c) => c.verification_status === 'pending');
    if (selectedIds.size === visible.length && visible.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map((c) => c.id)));
    }
  }

  async function bulkVerify() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Verify ${selectedIds.size} contribution${selectedIds.size > 1 ? 's' : ''}?`)) return;
    const { error } = await supabase
      .from('contributions')
      .update({ verification_status: 'confirmed', rejection_reason: null })
      .in('id', Array.from(selectedIds));
    if (error) notifyError(error, { action: 'ContributionsList' });
    else {
      toast.success(`${selectedIds.size} verified`);
      setSelectedIds(new Set());
      load();
    }
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      amount: c.amount,
      contribution_type: c.contribution_type,
      payment_method: c.payment_method,
      contribution_date: c.contribution_date,
      reference_no: c.reference_no || '',
      period_month: c.period_month || '',
      period_year: c.period_year || '',
      notes: c.notes || '',
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('contributions').update({
      amount: parseFloat(form.amount),
      contribution_type: form.contribution_type,
      payment_method: form.payment_method,
      contribution_date: form.contribution_date,
      reference_no: form.reference_no || null,
      period_month: form.period_month ? Number(form.period_month) : null,
      period_year: form.period_year ? Number(form.period_year) : null,
      notes: form.notes || null,
    }).eq('id', editing.id);
    setSaving(false);
    if (error) notifyError(error, { action: 'ContributionsList' });
    else { toast.success('Updated'); setEditing(null); load(); }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete the ${formatMoney(c.amount)} contribution from ${c.members?.full_name || 'this member'}? This cannot be undone.`)) return;
    const { error } = await supabase.from('contributions').delete().eq('id', c.id);
    if (error) notifyError(error, { action: 'ContributionsList' }); else { toast.success('Deleted'); load(); }
  }

  async function handleVerify(c) {
    const { error } = await supabase.from('contributions').update({
      verification_status: 'confirmed',
      rejection_reason: null,
    }).eq('id', c.id);
    if (error) notifyError(error, { action: 'ContributionsList' });
    else { toast.success('Verified'); load(); }
  }

  async function handleReject() {
    if (!rejecting) return;
    if (!rejectReason.trim()) return toast.error('Please give a reason');
    const { error } = await supabase.from('contributions').update({
      verification_status: 'rejected',
      rejection_reason: rejectReason.trim(),
    }).eq('id', rejecting.id);
    if (error) notifyError(error, { action: 'ContributionsList' });
    else {
      toast.success('Rejected');
      setRejecting(null);
      setRejectReason('');
      load();
    }
  }

  const filtered = rows.filter((c) =>
    !q ||
    c.members?.full_name?.toLowerCase().includes(q.toLowerCase()) ||
    c.reference_no?.toLowerCase().includes(q.toLowerCase())
  );

  const total = filtered.reduce((s, c) => s + Number(c.amount || 0), 0);

  const columns = [];

  // Selection checkbox for verifiers on the pending tab
  if (canVerifyContributions && statusTab === 'pending') {
    columns.push({
      key: 'select', header: '',
      render: (c) => c.verification_status === 'pending' ? (
        <input
          type="checkbox"
          checked={selectedIds.has(c.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelect(c.id)}
          className="w-4 h-4 accent-primary-900"
        />
      ) : null,
    });
  }

  columns.push(
    { key: 'date', header: 'Date', render: (c) => formatDate(c.contribution_date) },
    {
      key: 'member', header: 'Member',
      render: (c) => (
        <div>
          <p className="font-medium text-ink-900">{c.members?.full_name || '—'}</p>
          <p className="text-xs text-ink-500 font-mono">{c.members?.membership_no}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (c) => CONTRIBUTION_TYPES.find((t) => t.value === c.contribution_type)?.label || c.contribution_type },
    { key: 'method', header: 'Method', render: (c) => PAYMENT_METHODS.find((m) => m.value === c.payment_method)?.label || c.payment_method },
    { key: 'reference_no', header: 'Reference', render: (c) => c.reference_no || '—' },
    {
      key: 'status', header: 'Status',
      render: (c) => {
        const v = VERIFICATION_STATUS[c.verification_status] || VERIFICATION_STATUS.confirmed;
        return (
          <span className={v.className} title={c.rejection_reason || v.label}>
            {v.icon} {v.label}
          </span>
        );
      },
    },
    {
      key: 'amount', header: 'Amount', className: 'text-right',
      render: (c) => (
        <span className={`font-semibold whitespace-nowrap ${c.verification_status === 'confirmed' ? 'text-primary-900' : 'text-ink-500'}`}>
          {formatMoney(c.amount)}
        </span>
      ),
    },
    {
      key: 'receipt', header: '', className: 'text-right',
      render: (c) => (
        c.verification_status === 'confirmed' ? (
          <Link
            to={`/receipt/${c.id}`}
            onClick={(e) => e.stopPropagation()}
            title="Print receipt"
            className="inline-flex p-1.5 rounded-lg text-ink-600 hover:bg-cream-100 hover:text-primary-900 transition"
          >
            <Printer size={14}/>
          </Link>
        ) : null
      ),
    },
  );
  columns.push({
    key: 'resubmit', header: '', className: 'text-right',
    render: (c) =>
      c.verification_status === 'rejected' && c.recorded_by === profile?.id ? (
        <Link
          to={`/my-giving?resubmit=${c.id}`}
          onClick={(e) => e.stopPropagation()}
          title="Edit & resubmit"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-primary-900 hover:bg-primary-50 border border-primary-200 transition whitespace-nowrap"
        >
          <Edit2 size={12}/> Resubmit
        </Link>
      ) : null,
  });

  if (canVerifyContributions) {
    columns.push({
      key: 'verify', header: '', className: 'text-right',
      render: (c) =>
        c.verification_status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleVerify(c); }}
              className="p-1.5 rounded-lg text-primary-900 hover:bg-primary-50 transition"
              title="Verify"
            >
              <CheckCircle2 size={16}/>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setRejecting(c); setRejectReason(''); }}
              className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 transition"
              title="Reject"
            >
              <XCircle size={16}/>
            </button>
          </div>
        ) : null,
    });
  }

  if (isAdmin) {
    columns.push({
      key: 'actions', header: '', className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-1.5 rounded-lg text-ink-700 hover:bg-cream-100" aria-label="Edit"><Edit2 size={14}/></button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(c); }} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete"><Trash2 size={14}/></button>
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader
        kicker="The Ledger"
        title="Contributions"
        description="Every gift, recorded with care."
        action={
          isAdmin ? (
            <Link to="/contributions/new" className="btn-primary">
              <Plus size={16} /> Record contribution
            </Link>
          ) : (
            <Link to="/my-giving" className="btn-primary">
              <Plus size={16} /> Record my contribution
            </Link>
          )
        }
      />

      {canVerifyContributions && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { value: 'all',       label: 'All',       icon: Wallet,        cls: 'text-ink-900' },
            { value: 'pending',   label: 'Pending',   icon: Clock,         cls: 'text-amber-700' },
            { value: 'confirmed', label: 'Confirmed', icon: ShieldCheck,   cls: 'text-primary-900' },
            { value: 'rejected',  label: 'Rejected',  icon: XCircle,       cls: 'text-rose-700' },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = statusTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => {
                  setStatusTab(t.value);
                  if (t.value === 'pending') setSearchParams({ pending: '1' }); else setSearchParams({});
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  isActive
                    ? 'bg-primary-900 text-cream-50 border-primary-900'
                    : 'bg-white text-ink-700 border-cream-200 hover:border-cream-300'
                }`}
              >
                <Icon size={14}/>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="card-padded mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-2 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by member or reference…"
              className="input pl-10"
            />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="">All types</option>
            {CONTRIBUTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
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
        <div className="mt-3 text-sm text-ink-700 flex items-center gap-2 flex-wrap">
          <Wallet size={14} className="text-primary-700" />
          Showing <strong>{filtered.length}</strong> entries · Total: <span className="font-semibold text-primary-900">{formatMoney(total)}</span>
          {statusTab !== 'confirmed' && statusTab !== 'all' && (
            <span className="text-ink-500">({statusTab} only — totals may not reflect official records)</span>
          )}
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-rose-700 hover:text-rose-900 underline ml-2">
              Clear date filter
            </button>
          )}
        </div>
      </div>

      {/* Bulk verify bar — visible when there's a selection */}
      {canVerifyContributions && statusTab === 'pending' && filtered.some((c) => c.verification_status === 'pending') && (
        <div className="card-padded mb-4 bg-primary-50/40 border-primary-200">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={selectAllVisible}
              className="btn-secondary !py-1.5 text-xs"
            >
              {selectedIds.size > 0 ? `Clear (${selectedIds.size})` : 'Select all pending'}
            </button>
            <button
              onClick={bulkVerify}
              disabled={selectedIds.size === 0}
              className="btn-primary !py-1.5 text-xs disabled:opacity-50"
            >
              <CheckCircle2 size={14}/> Verify {selectedIds.size > 0 ? `selected (${selectedIds.size})` : 'selected'}
            </button>
            <p className="text-xs text-ink-600 ml-auto">
              Tip: filter by date or type first, then "Select all pending" to bulk-verify a batch.
            </p>
          </div>
        </div>
      )}

      <DataTable
        loading={loading}
        rows={filtered}
        emptyTitle="No contributions yet"
        emptyDescription={isAdmin ? 'Record the first contribution to get started.' : 'Once contributions are recorded, they will appear here.'}
        columns={columns}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit contribution"
        size="md"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
            <button form="ce-form" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="ce-form" onSubmit={saveEdit} className="space-y-3">
            <div className="bg-cream-100 rounded-lg p-3 text-sm">
              <p className="font-medium">{editing.members?.full_name}</p>
              <p className="text-xs text-ink-600 font-mono">{editing.members?.membership_no}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (KSh) *</label>
                <input required type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}/>
              </div>
              <div>
                <label className="label">Date *</label>
                <input required type="date" className="input" value={form.contribution_date} onChange={(e) => setForm({ ...form, contribution_date: e.target.value })}/>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.contribution_type} onChange={(e) => setForm({ ...form, contribution_type: e.target.value })}>
                  {CONTRIBUTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Payment method</label>
                <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Period month</label>
                <select className="input" value={form.period_month || ''} onChange={(e) => setForm({ ...form, period_month: e.target.value })}>
                  <option value="">—</option>
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Period year</label>
                <input type="number" className="input" value={form.period_year || ''} onChange={(e) => setForm({ ...form, period_year: e.target.value })}/>
              </div>
            </div>
            <div>
              <label className="label">Reference / M-Pesa code</label>
              <input className="input" value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })}/>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => { setRejecting(null); setRejectReason(''); }}
        title={`Reject ${rejecting?.members?.full_name || 'contribution'}`}
        footer={
          <>
            <button onClick={() => { setRejecting(null); setRejectReason(''); }} className="btn-secondary">Cancel</button>
            <button onClick={handleReject} className="btn-danger">Reject contribution</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-900">
            Rejecting will notify the member with your reason. They can resubmit a corrected version.
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea
              rows={3}
              className="input"
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. M-Pesa code didn't match the amount; please re-submit with the correct code."
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
