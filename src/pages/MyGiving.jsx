import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Wallet, HandCoins, Users as UsersIcon, FileText, HeartHandshake,
  Plus, Trash2, Edit2, Printer, AlertCircle, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatMoney, formatDate, initials } from '../lib/format';
import { CONTRIBUTION_TYPES, PLEDGE_STATUS, WELFARE_STATUS, PAYMENT_METHODS, VERIFICATION_STATUS } from '../lib/constants';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import StatCard from '../components/dashboard/StatCard';

const BLANK_FAMILY = { related_name: '', relation: '', date_of_birth: '', phone: '', notes: '' };

const BLANK_CONTRIB = {
  amount: '',
  contribution_type: 'monthly',
  payment_method: 'mpesa',
  contribution_date: new Date().toISOString().slice(0, 10),
  reference_no: '',
  notes: '',
  pledge_id: '',
  project_id: '',
};

export default function MyGiving() {
  const { profile } = useAuth();
  const toast = useToast();
  const [member, setMember] = useState(null);
  const [contribs, setContribs] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [welfare, setWelfare] = useState([]);
  const [family, setFamily] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [famOpen, setFamOpen] = useState(false);
  const [editingFam, setEditingFam] = useState(null);
  const [famForm, setFamForm] = useState(BLANK_FAMILY);
  const [famSaving, setFamSaving] = useState(false);

  const [contribOpen, setContribOpen] = useState(false);
  const [editingContrib, setEditingContrib] = useState(null);
  const [contribForm, setContribForm] = useState(BLANK_CONTRIB);
  const [contribSaving, setContribSaving] = useState(false);

  async function load() {
    if (!profile?.id) return;
    setLoading(true);
    // Find linked member
    const { data: m } = await supabase
      .from('members')
      .select('*, welfare_groups(name)')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (!m) {
      setMember(null);
      setLoading(false);
      return;
    }

    const [{ data: c }, { data: p }, { data: w }, { data: f }] = await Promise.all([
      supabase.from('contributions')
        .select('id, amount, contribution_type, payment_method, contribution_date, reference_no, notes, pledge_id, project_id, recorded_by, verification_status, rejection_reason, projects(name)')
        .eq('member_id', m.id)
        .order('contribution_date', { ascending: false }),
      supabase.from('pledges')
        .select('*, projects(name)')
        .eq('member_id', m.id)
        .order('pledge_date', { ascending: false }),
      supabase.from('welfare_requests')
        .select('id, request_no, title, category, amount_requested, amount_disbursed, status, submitted_at')
        .eq('member_id', m.id)
        .order('submitted_at', { ascending: false }),
      supabase.from('member_family')
        .select('*')
        .eq('member_id', m.id)
        .order('created_at'),
    ]);

    setMember(m);
    setContribs(c || []);
    setPledges(p || []);
    setWelfare(w || []);
    setFamily(f || []);
    setLoading(false);

    // Load active projects for the project-contribution selector
    supabase
      .from("projects")
      .select("id, name, status")
      .in("status", ["active", "planning", "planning"])
      .order("name")
      .then(({ data }) => setProjects(data || []));
  }

  useEffect(() => { load(); }, [profile?.id]);

  // Deep-link handler: /my-giving?resubmit=<contribution_id>
  // After contribs load, find the matching rejected entry and open the modal.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const resubmitId = searchParams.get('resubmit');
    if (!resubmitId || loading) return;
    const target = contribs.find((c) => c.id === resubmitId);
    if (target && target.verification_status === 'rejected' && target.recorded_by === profile?.id) {
      startResubmit(target);
      // Clean the URL so a refresh doesn't reopen the modal
      setSearchParams({});
    }
  }, [searchParams, contribs, loading, profile?.id]);

  function startCreateFam() {
    setEditingFam(null);
    setFamForm(BLANK_FAMILY);
    setFamOpen(true);
  }

  function startEditFam(f) {
    setEditingFam(f);
    setFamForm({
      related_name: f.related_name || '',
      relation: f.relation || '',
      date_of_birth: f.date_of_birth || '',
      phone: f.phone || '',
      notes: f.notes || '',
    });
    setFamOpen(true);
  }

  async function saveFam(e) {
    e.preventDefault();
    if (!member) return;
    setFamSaving(true);
    const payload = {
      ...famForm,
      date_of_birth: famForm.date_of_birth || null,
      phone: famForm.phone || null,
      notes: famForm.notes || null,
      member_id: member.id,
    };
    let result;
    if (editingFam) {
      result = await supabase.from('member_family').update(payload).eq('id', editingFam.id);
    } else {
      result = await supabase.from('member_family').insert(payload);
    }
    setFamSaving(false);
    if (result.error) toast.error(result.error.message);
    else { toast.success(editingFam ? 'Updated' : 'Added'); setFamOpen(false); load(); }
  }

  async function deleteFam(f) {
    if (!confirm(`Remove ${f.related_name}?`)) return;
    const { error } = await supabase.from('member_family').delete().eq('id', f.id);
    if (error) toast.error(error.message); else { toast.success('Removed'); load(); }
  }

  function startCreateContrib() {
    setEditingContrib(null);
    setContribForm(BLANK_CONTRIB);
    setContribOpen(true);
  }

  function startEditContrib(c) {
    // Only the contributor's own pending self-reports are editable
    if (c.verification_status !== 'pending' || c.recorded_by !== profile.id) return;
    setEditingContrib(c);
    setContribForm({
      amount: c.amount ?? '',
      contribution_type: c.contribution_type || 'monthly',
      payment_method: c.payment_method || 'mpesa',
      contribution_date: c.contribution_date || new Date().toISOString().slice(0, 10),
      reference_no: c.reference_no || '',
      notes: c.notes || '',
      pledge_id: c.pledge_id || '',
      project_id: c.project_id || '',
    });
    setContribOpen(true);
  }

  function startResubmit(c) {
    // Pre-fill the form from a rejected contribution but submit as NEW pending.
    // The rejected entry stays as historical record for the audit trail.
    if (c.verification_status !== 'rejected' || c.recorded_by !== profile.id) return;
    setEditingContrib(null); // important: not editing, creating fresh
    setContribForm({
      amount: c.amount ?? '',
      contribution_type: c.contribution_type || 'monthly',
      payment_method: c.payment_method || 'mpesa',
      contribution_date: new Date().toISOString().slice(0, 10), // use today's date for resubmit
      reference_no: c.reference_no || '',
      notes: c.notes || '',
      pledge_id: c.pledge_id || '',
      project_id: c.project_id || '',
    });
    setContribOpen(true);
  }

  async function saveContrib(e) {
    e.preventDefault();
    if (!member) return;
    const amount = parseFloat(contribForm.amount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    setContribSaving(true);

    const payload = {
      member_id: member.id,
      amount,
      contribution_type: contribForm.contribution_type,
      payment_method: contribForm.payment_method,
      contribution_date: contribForm.contribution_date,
      reference_no: contribForm.reference_no || null,
      notes: contribForm.notes || null,
      pledge_id: contribForm.pledge_id || null,
      project_id: contribForm.contribution_type === 'project' ? (contribForm.project_id || null) : null,
      recorded_by: profile.id,
    };

    if (contribForm.contribution_type === 'project' && !contribForm.project_id) {
      setContribSaving(false);
      return toast.error('Please pick a project for this contribution');
    }

    let result;
    if (editingContrib) {
      result = await supabase.from('contributions').update(payload).eq('id', editingContrib.id);
    } else {
      result = await supabase.from('contributions').insert(payload);
    }
    setContribSaving(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editingContrib ? 'Updated — still pending verification' : 'Submitted! Awaiting treasurer verification.');
      setContribOpen(false);
      load();
    }
  }

  async function deletePendingContrib(c) {
    if (c.verification_status !== 'pending' || c.recorded_by !== profile.id) return;
    if (!confirm('Delete this pending contribution? You can resubmit if needed.')) return;
    const { error } = await supabase.from('contributions').delete().eq('id', c.id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner label="Loading your records…"/></div>;

  if (!member) {
    return (
      <>
        <PageHeader kicker="Your Records" title="My giving" />
        <div className="card-padded text-center py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-200 text-ink-600 mb-4">
            <AlertCircle size={26} strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-display font-semibold mb-1">No member record linked yet</h3>
          <p className="text-sm text-ink-600 max-w-md mx-auto">
            Your account isn't yet linked to a member record. Please ask an administrator to link your account
            so your contributions, pledges and family records appear here.
          </p>
        </div>
      </>
    );
  }

  const totalConfirmed = contribs.filter((c) => c.verification_status === 'confirmed').reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalPending   = contribs.filter((c) => c.verification_status === 'pending').reduce((s, c) => s + Number(c.amount || 0), 0);
  const openPledges = pledges.filter((p) => ['open', 'partial'].includes(p.status));
  const totalOpenPledged = openPledges.reduce((s, p) => s + (Number(p.pledge_amount || 0) - Number(p.paid_amount || 0)), 0);

  return (
    <>
      <PageHeader
        kicker={`Karibu, ${profile.full_name?.split(' ')[0] || ''}`}
        title="My giving"
        description="Everything you've contributed, pledged, and your family records — all in one place."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={startCreateContrib} className="btn-primary">
              <Plus size={16} /> Record contribution
            </button>
            <Link to={`/statements/${member.id}`} className="btn-secondary">
              <FileText size={16} /> Full statement
            </Link>
          </div>
        }
      />

      <div className="card-padded mb-5 paper-grain">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar
            src={profile?.avatar_url}
            name={member.full_name}
            size="2xl"
            className="!rounded-2xl !w-16 !h-16 !text-2xl"
          />
          <div className="flex-1 min-w-0">
            <p className="kicker">{member.membership_no}</p>
            <h2 className="font-display text-2xl font-semibold">{member.full_name}</h2>
            <p className="text-sm text-ink-600">
              {member.welfare_groups?.name && `${member.welfare_groups.name} · `}
              Member since {formatDate(member.joined_on)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Wallet}
          label="Total Given"
          value={formatMoney(totalConfirmed)}
          accent="primary"
          hint={totalPending > 0 ? `${formatMoney(totalPending)} pending verification` : 'All confirmed'}
        />
        <StatCard icon={HandCoins}       label="Open Pledges"       value={openPledges.length} accent="amber" hint={openPledges.length > 0 ? `${formatMoney(totalOpenPledged)} outstanding` : 'All fulfilled'} />
        <StatCard icon={HeartHandshake}  label="Welfare Requests"   value={welfare.length} accent="rose" />
        <StatCard icon={UsersIcon}       label="Family Recorded"    value={family.length} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent contributions */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold">Recent contributions</h3>
            <Link to={`/statements/${member.id}`} className="text-xs font-medium text-primary-900 hover:text-primary-700">
              View all →
            </Link>
          </div>
          {contribs.length === 0 ? (
            <div className="text-sm text-ink-600">
              <p>No contributions recorded yet.</p>
              <button onClick={startCreateContrib} className="text-primary-900 hover:text-primary-700 inline-block mt-2 font-medium">
                Record your first contribution →
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-cream-200">
              {contribs.slice(0, 8).map((c) => {
                const v = VERIFICATION_STATUS[c.verification_status] || VERIFICATION_STATUS.confirmed;
                const isMyPending = c.verification_status === 'pending' && c.recorded_by === profile.id;
                const isMyRejected = c.verification_status === 'rejected' && c.recorded_by === profile.id;
                return (
                  <li key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 capitalize flex items-center gap-2 flex-wrap">
                        {CONTRIBUTION_TYPES.find((t) => t.value === c.contribution_type)?.label || c.contribution_type}
                        {c.verification_status !== 'confirmed' && (
                          <span className={v.className} title={v.label}>{v.icon} {v.label}</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-600">
                        {formatDate(c.contribution_date)} · {c.payment_method}
                        {c.reference_no && ` · ${c.reference_no}`}
                      </p>
                      {c.verification_status === 'rejected' && c.rejection_reason && (
                        <p className="text-xs text-rose-700 mt-0.5">Reason: {c.rejection_reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`font-semibold whitespace-nowrap ${c.verification_status === 'confirmed' ? 'text-primary-900' : 'text-ink-600'}`}>
                        {formatMoney(c.amount)}
                      </p>
                      {c.verification_status === 'confirmed' && (
                        <Link to={`/receipt/${c.id}`} title="Print receipt"
                          className="p-1.5 rounded-lg text-ink-500 hover:bg-cream-100 hover:text-primary-900 transition">
                          <Printer size={14}/>
                        </Link>
                      )}
                      {isMyPending && (
                        <>
                          <button onClick={() => startEditContrib(c)} title="Edit"
                            className="p-1.5 rounded-lg text-ink-500 hover:bg-cream-100 transition">
                            <Edit2 size={14}/>
                          </button>
                          <button onClick={() => deletePendingContrib(c)} title="Delete"
                            className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 transition">
                            <Trash2 size={14}/>
                          </button>
                        </>
                      )}
                      {isMyRejected && (
                        <button onClick={() => startResubmit(c)} title="Edit & resubmit"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-primary-900 hover:bg-primary-50 border border-primary-200 transition">
                          <Edit2 size={12}/> Edit &amp; resubmit
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pledges */}
        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-3">My pledges</h3>
          {pledges.length === 0 ? (
            <div className="text-sm text-ink-600">
              <p>No pledges yet.</p>
              <Link to="/pledges" className="text-primary-900 hover:text-primary-700 inline-block mt-2 font-medium">
                Make a pledge →
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {pledges.map((p) => {
                const pct = p.pledge_amount > 0 ? Math.min(100, (p.paid_amount / p.pledge_amount) * 100) : 0;
                return (
                  <li key={p.id} className="border-l-2 border-accent-400 pl-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-ink-900 text-sm">{p.purpose}</p>
                      <StatusBadge status={p.status} statusMap={PLEDGE_STATUS} />
                    </div>
                    {p.projects?.name && <p className="text-xs text-ink-600 mb-1">{p.projects.name}</p>}
                    <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden mb-1">
                      <div className="h-full bg-primary-700 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-ink-700">
                      {formatMoney(p.paid_amount)} of {formatMoney(p.pledge_amount)} ({pct.toFixed(0)}%)
                      {p.due_date && ` · due ${formatDate(p.due_date)}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Welfare history */}
        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-3">My welfare requests</h3>
          {welfare.length === 0 ? (
            <div className="text-sm text-ink-600">
              <p>No welfare requests yet.</p>
              <Link to="/welfare/new" className="text-primary-900 hover:text-primary-700 inline-block mt-2 font-medium">
                Submit a request →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-cream-200">
              {welfare.map((w) => (
                <li key={w.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <Link to={`/welfare/${w.id}`} className="min-w-0 hover:text-primary-700">
                    <p className="font-medium text-ink-900">{w.title}</p>
                    <p className="text-xs text-ink-600 font-mono">{w.request_no}</p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-primary-900">{formatMoney(w.amount_requested)}</span>
                    <StatusBadge status={w.status} statusMap={WELFARE_STATUS} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Family */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold">Family / Dependents</h3>
            <button onClick={startCreateFam} className="btn-secondary text-xs !py-1.5">
              <Plus size={12}/> Add
            </button>
          </div>
          {family.length === 0 ? (
            <p className="text-sm text-ink-600">No family records yet. Add spouse, children or dependents so the welfare team can support your household when needed.</p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {family.map((f) => (
                <li key={f.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{f.related_name}</p>
                    <p className="text-xs text-ink-600">
                      {f.relation}
                      {f.date_of_birth && ` · ${formatDate(f.date_of_birth)}`}
                      {f.phone && ` · ${f.phone}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEditFam(f)} className="p-1.5 rounded-lg text-ink-600 hover:bg-cream-100" aria-label="Edit">
                      <Edit2 size={12}/>
                    </button>
                    <button onClick={() => deleteFam(f)} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        open={famOpen}
        onClose={() => setFamOpen(false)}
        title={editingFam ? `Edit ${editingFam.related_name}` : 'Add family member'}
        footer={
          <>
            <button onClick={() => setFamOpen(false)} className="btn-secondary">Cancel</button>
            <button form="fam-form" type="submit" disabled={famSaving} className="btn-primary">
              {famSaving ? 'Saving…' : (editingFam ? 'Update' : 'Add')}
            </button>
          </>
        }
      >
        <form id="fam-form" onSubmit={saveFam} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input required className="input" value={famForm.related_name} onChange={(e) => setFamForm({ ...famForm, related_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Relation *</label>
              <input required className="input" value={famForm.relation} onChange={(e) => setFamForm({ ...famForm, relation: e.target.value })} placeholder="e.g. Spouse, Son, Daughter" />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <input type="date" className="input" value={famForm.date_of_birth} onChange={(e) => setFamForm({ ...famForm, date_of_birth: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={famForm.phone} onChange={(e) => setFamForm({ ...famForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input" value={famForm.notes} onChange={(e) => setFamForm({ ...famForm, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={contribOpen}
        onClose={() => setContribOpen(false)}
        title={editingContrib ? 'Edit pending contribution' : 'Record my contribution'}
        footer={
          <>
            <button onClick={() => setContribOpen(false)} className="btn-secondary">Cancel</button>
            <button form="contrib-form" type="submit" disabled={contribSaving} className="btn-primary">
              {contribSaving ? 'Saving…' : (editingContrib ? 'Update' : 'Submit for verification')}
            </button>
          </>
        }
      >
        <form id="contrib-form" onSubmit={saveContrib} className="space-y-3">
          <div className="bg-cream-100 border border-cream-200 rounded-lg p-3 text-xs text-ink-700 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-700"/>
            <p>
              Your contribution will be marked <strong>pending</strong> until the treasurer or admin verifies it against the bank/M-Pesa record. Please include the M-Pesa code or reference for fast verification.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (KSh) *</label>
              <input required type="number" step="0.01" min="0" className="input"
                value={contribForm.amount}
                onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Date *</label>
              <input required type="date" className="input"
                value={contribForm.contribution_date}
                onChange={(e) => setContribForm({ ...contribForm, contribution_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type *</label>
              <select required className="input"
                value={contribForm.contribution_type}
                onChange={(e) => setContribForm({ ...contribForm, contribution_type: e.target.value })}>
                {CONTRIBUTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Payment method *</label>
              <select required className="input"
                value={contribForm.payment_method}
                onChange={(e) => setContribForm({ ...contribForm, payment_method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          {contribForm.contribution_type === 'project' && (
            <div>
              <label className="label">Which project? *</label>
              {projects.length === 0 ? (
                <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  There are no active projects right now. Pick a different contribution type or ask leadership to open a project.
                </p>
              ) : (
                <select
                  required
                  className="input"
                  value={contribForm.project_id}
                  onChange={(e) => setContribForm({ ...contribForm, project_id: e.target.value })}
                >
                  <option value="">— Select project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div>
            <label className="label">M-Pesa code / reference</label>
            <input className="input" placeholder="e.g. SLE7XQ8Z2K"
              value={contribForm.reference_no}
              onChange={(e) => setContribForm({ ...contribForm, reference_no: e.target.value })} />
            <p className="text-xs text-ink-500 mt-1">Highly recommended — speeds up verification</p>
          </div>
          {openPledges.length > 0 && (
            <div>
              <label className="label">Apply to an open pledge?</label>
              <select className="input"
                value={contribForm.pledge_id}
                onChange={(e) => setContribForm({ ...contribForm, pledge_id: e.target.value })}>
                <option value="">— No, regular contribution —</option>
                {openPledges.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purpose} (KSh {Number(p.pledge_amount).toLocaleString()} pledged)
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input"
              value={contribForm.notes}
              onChange={(e) => setContribForm({ ...contribForm, notes: e.target.value })} />
          </div>
        </form>
      </Modal>
    </>
  );
}
