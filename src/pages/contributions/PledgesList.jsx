import { useEffect, useState } from 'react';
import { Plus, HandCoins, Edit2, Trash2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatMoney, formatDate } from '../../lib/format';
import { PLEDGE_STATUS } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';

const BLANK = {
  member_id: '', pledge_amount: '', purpose: '', project_id: '',
  pledge_date: new Date().toISOString().slice(0, 10), due_date: '', notes: '',
  status: 'open',
};

export default function PledgesList() {
  const { canManageFinances: isAdmin, profile } = useAuth();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [myMember, setMyMember] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    let query = supabase
      .from('pledges')
      .select('id, member_id, pledge_amount, paid_amount, purpose, status, pledge_date, due_date, notes, project_id, members(full_name), projects(name)')
      .order('pledge_date', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data } = await query;
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from('members').select('id, full_name, profile_id').eq('status', 'active').order('full_name').then(({ data }) => setMembers(data || []));
    supabase.from('projects').select('id, name').neq('status', 'cancelled').order('name').then(({ data }) => setProjects(data || []));
  }, [statusFilter]);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('members').select('id').eq('profile_id', profile.id).maybeSingle().then(({ data }) => {
      if (data) setMyMember(data.id);
    });
  }, [profile?.id]);

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      member_id: p.member_id,
      pledge_amount: p.pledge_amount,
      purpose: p.purpose,
      project_id: p.project_id || '',
      pledge_date: p.pledge_date,
      due_date: p.due_date || '',
      notes: p.notes || '',
      status: p.status,
    });
    setOpen(true);
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    if (editing) {
      const { error } = await supabase.from('pledges').update({
        pledge_amount: parseFloat(form.pledge_amount),
        purpose: form.purpose,
        project_id: form.project_id || null,
        pledge_date: form.pledge_date,
        due_date: form.due_date || null,
        notes: form.notes || null,
        status: form.status,
      }).eq('id', editing.id);
      setSaving(false);
      if (error) notifyError(error, { action: 'PledgesList' });
      else { toast.success('Pledge updated'); setOpen(false); load(); }
      return;
    }

    const memberId = isAdmin ? form.member_id : myMember;
    if (!memberId) {
      setSaving(false);
      return toast.error(isAdmin ? 'Select a member' : 'Your account is not linked to a member yet — ask an admin');
    }
    const { error } = await supabase.from('pledges').insert({
      member_id: memberId,
      pledge_amount: parseFloat(form.pledge_amount),
      purpose: form.purpose,
      project_id: form.project_id || null,
      pledge_date: form.pledge_date,
      due_date: form.due_date || null,
      notes: form.notes || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) notifyError(error, { action: 'PledgesList' });
    else { toast.success('Pledge created'); setOpen(false); load(); }
  }

  async function handleDelete(p) {
    if (!confirm(`Delete this pledge of ${formatMoney(p.pledge_amount)} from ${p.members?.full_name || 'this member'}?`)) return;
    const { error } = await supabase.from('pledges').delete().eq('id', p.id);
    if (error) notifyError(error, { action: 'PledgesList' }); else { toast.success('Deleted'); load(); }
  }

  const columns = [
    { key: 'pledge_date', header: 'Date', render: (p) => formatDate(p.pledge_date) },
    { key: 'member', header: 'Member', render: (p) => p.members?.full_name || '—' },
    {
      key: 'purpose', header: 'Purpose', render: (p) => (
        <div>
          <p className="font-medium text-ink-900">{p.purpose}</p>
          {p.projects?.name && <p className="text-xs text-ink-500">{p.projects.name}</p>}
        </div>
      ),
    },
    {
      key: 'amount', header: 'Amount',
      render: (p) => (
        <div>
          <p className="font-semibold text-primary-900">{formatMoney(p.pledge_amount)}</p>
          <p className="text-xs text-ink-500">paid {formatMoney(p.paid_amount)}</p>
        </div>
      ),
    },
    {
      key: 'progress', header: 'Progress',
      render: (p) => {
        const pct = p.pledge_amount > 0 ? Math.min(100, (p.paid_amount / p.pledge_amount) * 100) : 0;
        return (
          <div className="w-32">
            <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
              <div className="h-full bg-primary-700 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-ink-600 mt-0.5">{pct.toFixed(0)}%</p>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} statusMap={PLEDGE_STATUS} /> },
    { key: 'due', header: 'Due', render: (p) => p.due_date ? formatDate(p.due_date) : '—' },
  ];

  if (isAdmin) {
    columns.push({
      key: 'actions', header: '', className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-ink-700 hover:bg-cream-100" aria-label="Edit"><Edit2 size={14}/></button>
          <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete"><Trash2 size={14}/></button>
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader
        kicker="Faithful Promises"
        title="Pledges"
        description="Commitments toward projects and the work of the church."
        action={
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> New pledge
          </button>
        }
      />

      <div className="card-padded mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by member, purpose, project…"
              className="input pl-10"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
            <option value="">All statuses</option>
            {Object.entries(PLEDGE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={rows.filter((p) =>
          !q ||
          p.members?.full_name?.toLowerCase().includes(q.toLowerCase()) ||
          p.purpose?.toLowerCase().includes(q.toLowerCase()) ||
          p.projects?.name?.toLowerCase().includes(q.toLowerCase())
        )}
        emptyTitle="No pledges yet"
        emptyDescription="Start by recording the first pledge."
        columns={columns}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit pledge' : 'New pledge'}
        size="md"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button form="pledge-form" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : (editing ? 'Update' : 'Save pledge')}
            </button>
          </>
        }
      >
        <form id="pledge-form" onSubmit={handleSubmit} className="space-y-3">
          {isAdmin && !editing && (
            <div>
              <label className="label">Member *</label>
              <select required className="input" value={form.member_id} onChange={(e) => update('member_id', e.target.value)}>
                <option value="">Select a member…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="bg-cream-100 rounded-lg p-3 text-sm">
              <p className="font-medium">{rows.find((r) => r.id === editing.id)?.members?.full_name || 'Member'}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (KSh) *</label>
              <input required type="number" step="0.01" min="0" className="input" value={form.pledge_amount} onChange={(e) => update('pledge_amount', e.target.value)} />
            </div>
            <div>
              <label className="label">Pledge date</label>
              <input type="date" className="input" value={form.pledge_date} onChange={(e) => update('pledge_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Purpose *</label>
            <input required className="input" value={form.purpose} onChange={(e) => update('purpose', e.target.value)} placeholder="e.g. Church expansion" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project (optional)</label>
              <select className="input" value={form.project_id} onChange={(e) => update('project_id', e.target.value)}>
                <option value="">— None —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" className="input" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} />
            </div>
          </div>
          {editing && isAdmin && (
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {Object.entries(PLEDGE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <p className="text-xs text-ink-500 mt-1">Status auto-updates as contributions are recorded against this pledge. Override only if needed.</p>
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
        </form>
      </Modal>
    </>
  );
}
