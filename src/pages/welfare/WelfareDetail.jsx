import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, XCircle, MessageSquare, Banknote, Trash2,
  Users2, ShieldCheck, Phone, Pencil, RotateCcw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney, formatDate, formatDateTime } from '../../lib/format';
import { WELFARE_STATUS, WELFARE_CATEGORIES, roleLabel } from '../../lib/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import WhatsAppButton from '../../components/ui/WhatsAppButton';

const APPROVALS_NEEDED = 2;

export default function WelfareDetail() {
  const { id } = useParams();
  const { canManageWelfare, isAdmin, isAdminOrChair, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [req, setReq] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decisionOpen, setDecisionOpen] = useState(null); // 'approve' | 'reject' | 'request_info'
  const [decision, setDecision] = useState({ approved_amount: '', comments: '' });
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [disburseAmount, setDisburseAmount] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const { data: r } = await supabase
      .from('welfare_requests')
      .select('*, members(full_name, membership_no, phone, profile_id)')
      .eq('id', id)
      .maybeSingle();
    const { data: a } = await supabase
      .from('welfare_approvals')
      .select('*, profiles(full_name, role)')
      .eq('request_id', id)
      .order('decided_at', { ascending: false });
    setReq(r);
    setApprovals(a || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // Realtime: subscribe to changes on this welfare_request and its approvals.
  // When another leader approves/rejects in parallel, the page updates live.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`welfare-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'welfare_approvals', filter: `request_id=eq.${id}`,
      }, () => load())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'welfare_requests', filter: `id=eq.${id}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Compute the LATEST decision per approver (the source of truth)
  // — we keep all rows for the audit log, but only the latest counts.
  const latestByApprover = (() => {
    const map = new Map();
    for (const a of approvals) {
      if (!map.has(a.approver_id)) map.set(a.approver_id, a); // approvals are sorted desc by decided_at
    }
    return Array.from(map.values());
  })();
  const approverDecisions = latestByApprover.filter((a) => a.decision === 'approve');
  const rejectionDecisions = latestByApprover.filter((a) => a.decision === 'reject');
  const myDecision = latestByApprover.find((a) => a.approver_id === profile?.id);

  function openDecision(kind) {
    setDecisionOpen(kind);
    setDecision({
      approved_amount: req?.amount_requested ?? '',
      comments: '',
    });
  }

  async function submitDecision() {
    if (!decisionOpen || !req) return;
    setSubmittingDecision(true);

    // upsert by (request_id, approver_id) — second migration adds this unique constraint
    const payload = {
      request_id: req.id,
      approver_id: profile.id,
      decision: decisionOpen,
      approved_amount: decisionOpen === 'approve'
        ? parseFloat(decision.approved_amount || req.amount_requested)
        : null,
      comments: decision.comments || null,
      decided_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('welfare_approvals')
      .upsert(payload, { onConflict: 'request_id,approver_id' });

    setSubmittingDecision(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Decision recorded');
      setDecisionOpen(null);
      setDecision({ approved_amount: '', comments: '' });
      load();
    }
  }

  async function recordDisbursement() {
    if (!req) return;
    const amount = parseFloat(disburseAmount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    const newDisbursed = Number(req.amount_disbursed || 0) + amount;
    const { error } = await supabase.from('welfare_requests').update({
      amount_disbursed: newDisbursed,
      status: 'disbursed',
    }).eq('id', req.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Disbursement recorded');
      setDisburseOpen(false);
      setDisburseAmount('');
      load();
    }
  }

  async function handleClose() {
    if (!confirm('Close this request? It cannot be reopened.')) return;
    const { error } = await supabase.from('welfare_requests').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Request closed'); load(); }
  }

  function openEdit() {
    setEditForm({
      title: req.title || '',
      description: req.description || '',
      category: req.category || '',
      urgency: req.urgency || 'medium',
      amount_requested: req.amount_requested ?? '',
    });
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSavingEdit(true);
    const { error } = await supabase.from('welfare_requests').update({
      title: editForm.title,
      description: editForm.description,
      category: editForm.category,
      urgency: editForm.urgency,
      amount_requested: parseFloat(editForm.amount_requested),
    }).eq('id', req.id);
    setSavingEdit(false);
    if (error) toast.error(error.message);
    else { toast.success('Request updated'); setEditOpen(false); load(); }
  }

  async function handleDelete() {
    if (!confirm('Delete this welfare request? Decision history and disbursement records will be lost. This cannot be undone.')) return;
    const { error } = await supabase.from('welfare_requests').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Request deleted'); navigate('/welfare'); }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!req) return <EmptyState title="Request not found" />;

  const isDecidedTerminal = ['approved', 'rejected', 'disbursed', 'closed'].includes(req.status);
  const isPendingState = ['pending', 'under_review'].includes(req.status);
  // You "own" the request if you are the beneficiary OR you submitted it on behalf.
  // Either way you cannot approve/reject it — two OTHER leaders must.
  const isBeneficiary = req.members?.profile_id && profile?.id && req.members.profile_id === profile.id;
  const isSubmitter   = req.submitted_by && profile?.id && req.submitted_by === profile.id;
  const isOwnRequest  = isBeneficiary || isSubmitter;
  const canDecide   = canManageWelfare && !isOwnRequest && !['disbursed', 'closed'].includes(req.status);
  const canDisburse = canManageWelfare && req.status === 'approved';
  const canEditDetails  = isPendingState && (isSubmitter || canManageWelfare);
  const canDeleteThis   = (isAdminOrChair) || (isSubmitter && isPendingState);
  // Resubmit: rejected requests, if you were the requester (beneficiary or submitter)
  const canResubmit     = req.status === 'rejected' && (isSubmitter || isBeneficiary);

  const progress = Math.min(approverDecisions.length, APPROVALS_NEEDED);

  return (
    <>
      <Link to="/welfare" className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to welfare
      </Link>

      <div className="card-padded mb-5 paper-grain">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="kicker mb-1">{req.request_no}</p>
            <h1 className="font-display text-3xl font-semibold">{req.title}</h1>
            <p className="text-sm text-ink-600 mt-1">
              {WELFARE_CATEGORIES.find((c) => c.value === req.category)?.label}
              {' · for '}
              <Link to={`/members/${req.member_id}`} className="text-primary-900 hover:text-primary-700 font-medium">
                {req.members?.full_name}
              </Link>
            </p>
            {req.members?.phone && (
              <p className="text-xs text-ink-600 mt-1 inline-flex items-center gap-1.5">
                <Phone size={11}/> {req.members.phone}
                <WhatsAppButton phone={req.members.phone} />
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={req.status} statusMap={WELFARE_STATUS} />
            <span className={
              req.urgency === 'critical' ? 'badge-rose' :
              req.urgency === 'high' ? 'badge-amber' :
              req.urgency === 'medium' ? 'badge-blue' : 'badge-slate'
            }>
              {req.urgency}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Requested</p>
            <p className="font-display text-xl font-semibold mt-0.5">{formatMoney(req.amount_requested)}</p>
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Approved</p>
            <p className="font-display text-xl font-semibold mt-0.5">
              {req.amount_approved ? formatMoney(req.amount_approved) : '—'}
            </p>
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Disbursed</p>
            <p className="font-display text-xl font-semibold mt-0.5">{formatMoney(req.amount_disbursed)}</p>
          </div>
        </div>

        <p className="text-sm text-ink-700 whitespace-pre-line">{req.description}</p>
        <p className="text-xs text-ink-500 mt-4">Submitted {formatDateTime(req.submitted_at)}</p>
      </div>

      {/* Member-facing status note (when the leadership-only approval card is hidden) */}
      {!canManageWelfare && isPendingState && (
        <div className="card-padded mb-5 bg-blue-50/40 border-blue-200">
          <p className="text-sm text-ink-800">
            <span className="font-semibold">Under review.</span>{' '}
            You'll receive a notification when a decision is made. Two officials must approve before disbursement.
          </p>
        </div>
      )}

      {/* Approval progress card — leadership-only. Members see a simpler status hint above. */}
      {canManageWelfare && ['pending', 'under_review'].includes(req.status) && (
        <div className="card-padded mb-5 border-accent-300 bg-accent-50/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="kicker">Dual Approval</p>
              <h3 className="font-display text-xl font-semibold mt-1">
                {progress} of {APPROVALS_NEEDED} approvals received
              </h3>
              <p className="text-sm text-ink-700 mt-1">
                At least {APPROVALS_NEEDED} distinct officials must approve before this request can be disbursed.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {[...Array(APPROVALS_NEEDED)].map((_, i) => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full grid place-items-center border-2 transition ${
                    i < progress
                      ? 'bg-primary-900 border-primary-900 text-cream-50'
                      : 'bg-white border-cream-300 text-cream-300'
                  }`}
                >
                  <CheckCircle2 size={18} />
                </div>
              ))}
            </div>
          </div>

          {approverDecisions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-accent-200">
              <p className="kicker mb-2">Approved by</p>
              <div className="flex flex-wrap gap-2">
                {approverDecisions.map((a) => (
                  <div key={a.id} className="inline-flex items-center gap-1.5 bg-white border border-primary-200 rounded-full px-3 py-1 text-xs">
                    <ShieldCheck size={12} className="text-primary-700"/>
                    <span className="font-medium text-ink-900">{a.profiles?.full_name}</span>
                    <span className="text-ink-500">·</span>
                    <span className="text-ink-600">{roleLabel(a.profiles?.role)}</span>
                    {a.approved_amount && (
                      <>
                        <span className="text-ink-500">·</span>
                        <span className="font-semibold text-primary-900">{formatMoney(a.approved_amount)}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {myDecision && (
            <div className="mt-3 pt-3 border-t border-accent-200 text-sm">
              <p className="text-ink-700">
                Your current decision:{' '}
                <span className={
                  myDecision.decision === 'approve' ? 'font-semibold text-primary-900' :
                  myDecision.decision === 'reject' ? 'font-semibold text-rose-700' :
                  'font-semibold text-blue-700'
                }>
                  {myDecision.decision === 'approve' ? 'Approved' :
                   myDecision.decision === 'reject' ? 'Rejected' : 'Asked for more info'}
                </span>
                {' on '}{formatDate(myDecision.decided_at)}.
                {' '}
                <span className="text-ink-500">You can change it below.</span>
              </p>
            </div>
          )}

          {isOwnRequest && (
            <div className="mt-3 pt-3 border-t border-accent-200 text-sm text-ink-800 bg-amber-50/60 border border-amber-200 rounded-lg p-3">
              ⚖️ {isSubmitter && !isBeneficiary
                ? 'You submitted this request on behalf of someone — you cannot also approve or reject it.'
                : 'This request is for you — you cannot approve or reject it yourself.'}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      {(canDecide || canDisburse || canEditDetails || canDeleteThis || canResubmit || (isAdminOrChair && req.status !== 'closed')) && (
        <div className="card-padded mb-5">
          <div className="flex flex-wrap gap-2">
            {canDecide && (
              <>
                <button onClick={() => openDecision('approve')} className="btn-primary">
                  <CheckCircle2 size={16} /> {myDecision?.decision === 'approve' ? 'Update approval' : 'Approve'}
                </button>
                <button onClick={() => openDecision('reject')} className="btn-danger">
                  <XCircle size={16} /> Reject
                </button>
                <button onClick={() => openDecision('request_info')} className="btn-secondary">
                  <MessageSquare size={16} /> Request more info
                </button>
              </>
            )}
            {canDisburse && (
              <button onClick={() => setDisburseOpen(true)} className="btn-accent">
                <Banknote size={16} /> Record disbursement
              </button>
            )}
            {canEditDetails && (
              <button onClick={openEdit} className="btn-secondary">
                <Pencil size={14}/> Edit details
              </button>
            )}
            {canResubmit && (
              <button
                onClick={() => navigate('/welfare/new', { state: {
                  prefill: {
                    title: req.title,
                    description: req.description,
                    category: req.category,
                    urgency: req.urgency,
                    amount_requested: req.amount_requested,
                  }
                } })}
                className="btn-primary"
              >
                <RotateCcw size={14}/> Edit & resubmit
              </button>
            )}
            {isAdminOrChair && req.status !== 'closed' && req.status !== 'disbursed' && (
              <button onClick={handleClose} className="btn-ghost">
                Close request
              </button>
            )}
            {canDeleteThis && (
              <button onClick={handleDelete} className="btn-ghost text-rose-700 hover:bg-rose-50 ml-auto">
                <Trash2 size={14}/> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Decision history */}
      <div className="card-padded">
        <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
          <Users2 size={18}/> Decision history
        </h3>
        {approvals.length === 0 ? (
          <p className="text-sm text-ink-600">No decisions recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li key={a.id} className="border-l-2 pl-3 border-primary-300">
                <p className="text-sm">
                  <span className="font-semibold capitalize">{a.decision.replace('_', ' ')}</span>
                  {a.approved_amount && ` · ${formatMoney(a.approved_amount)}`}
                  {' by '}
                  <span className="font-semibold">{a.profiles?.full_name}</span>
                  {a.profiles?.role && <span className="text-ink-500"> ({roleLabel(a.profiles.role)})</span>}
                </p>
                {a.comments && <p className="text-sm text-ink-700 mt-0.5">{a.comments}</p>}
                <p className="text-xs text-ink-500 mt-0.5">{formatDateTime(a.decided_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Decision modal */}
      <Modal
        open={!!decisionOpen}
        onClose={() => setDecisionOpen(null)}
        title={
          decisionOpen === 'approve' ? (myDecision?.decision === 'approve' ? 'Update your approval' : 'Approve request') :
          decisionOpen === 'reject'  ? 'Reject request' :
          'Request more information'
        }
        footer={
          <>
            <button onClick={() => setDecisionOpen(null)} className="btn-secondary">Cancel</button>
            <button
              onClick={submitDecision}
              disabled={submittingDecision}
              className={decisionOpen === 'reject' ? 'btn-danger' : 'btn-primary'}
            >
              {submittingDecision ? 'Saving…' : 'Confirm'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {decisionOpen === 'approve' && (
            <>
              <div className="bg-cream-100 rounded-lg p-3 text-sm text-ink-700">
                <strong>{approverDecisions.length}</strong> of <strong>{APPROVALS_NEEDED}</strong> approvals received so far.
                {approverDecisions.length + 1 >= APPROVALS_NEEDED && !myDecision && (
                  <span className="block mt-1 text-primary-900 font-medium">
                    Your approval will complete the dual-approval requirement.
                  </span>
                )}
              </div>
              <div>
                <label className="label">Approved amount (KSh) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={decision.approved_amount}
                  onChange={(e) => setDecision((d) => ({ ...d, approved_amount: e.target.value }))}
                />
                <p className="text-xs text-ink-500 mt-1">
                  Defaults to the requested amount ({formatMoney(req.amount_requested)}). Adjust if approving a different amount.
                </p>
              </div>
            </>
          )}
          {decisionOpen === 'reject' && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-900">
              ⚠ A single rejection from any official stops this request — even if others have approved.
            </div>
          )}
          <div>
            <label className="label">Comments {decisionOpen === 'request_info' && '*'}</label>
            <textarea
              rows={3}
              className="input"
              value={decision.comments}
              onChange={(e) => setDecision((d) => ({ ...d, comments: e.target.value }))}
              placeholder={
                decisionOpen === 'request_info'
                  ? 'What additional information do you need?'
                  : 'Add any notes for the record…'
              }
              required={decisionOpen === 'request_info'}
            />
          </div>
        </div>
      </Modal>

      {/* Disbursement modal */}
      <Modal
        open={disburseOpen}
        onClose={() => setDisburseOpen(false)}
        title="Record disbursement"
        footer={
          <>
            <button onClick={() => setDisburseOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={recordDisbursement} className="btn-primary">Record</button>
          </>
        }
      >
        <div>
          <label className="label">Amount disbursed (KSh)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={disburseAmount}
            onChange={(e) => setDisburseAmount(e.target.value)}
            placeholder={req.amount_approved ?? ''}
          />
          <p className="text-xs text-ink-500 mt-1">
            Approved: {formatMoney(req.amount_approved)} · Already disbursed: {formatMoney(req.amount_disbursed)}
          </p>
        </div>
      </Modal>

      {/* Edit details modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit request details"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button form="welfare-edit-form" type="submit" disabled={savingEdit} className="btn-primary">
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        <form id="welfare-edit-form" onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input
              required
              className="input"
              value={editForm.title || ''}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select required className="input"
                value={editForm.category || ''}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              >
                {WELFARE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Urgency *</label>
              <select required className="input"
                value={editForm.urgency || 'medium'}
                onChange={(e) => setEditForm({ ...editForm, urgency: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Amount requested (KSh) *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={editForm.amount_requested ?? ''}
              onChange={(e) => setEditForm({ ...editForm, amount_requested: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea
              required
              rows={4}
              className="input"
              value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
          <p className="text-xs text-ink-500">
            Editing the details will not reset the decision history. If approvals have already been given, the approvers should review the change.
          </p>
        </form>
      </Modal>
    </>
  );
}
