import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Trash2, Edit2, Download, ReceiptText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatMoney, formatDate, formatDateTime } from '../../lib/format';
import { EXPENSE_STATUS } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

export default function ExpenseDetail() {
  const { id } = useParams();
  const { profile, isAdmin, isChairperson, canManageFinances } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();

  const [exp, setExp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select(
        `
        *,
        expense_categories(name),
        inventory_items(name, sku),
        projects(name),
        recorder:safe_profiles!expenses_recorded_by_fkey(full_name),
        approver:safe_profiles!expenses_approved_by_fkey(full_name),
        rejecter:safe_profiles!expenses_rejected_by_fkey(full_name)
      `,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) notifyError(error, { action: 'load_expense_detail', expense_id: id });
    else setExp(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="card-padded flex justify-center py-10"><LoadingSpinner /></div>;
  if (!exp) {
    return (
      <>
        <Link to="/expenses" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-2">
          <ArrowLeft size={14}/> Back
        </Link>
        <div className="card-padded text-center py-10">
          <p className="text-ink-600">Expense not found or you don't have access.</p>
        </div>
      </>
    );
  }

  const isOwnExpense = exp.recorded_by === profile?.id;
  const canApprove   = (isAdmin || isChairperson) && exp.status === 'pending_approval' && !isOwnExpense;
  const canEdit      = exp.status === 'pending_approval' && (isOwnExpense || isAdmin);
  const canDelete    = isAdmin && exp.status === 'pending_approval';

  async function approve() {
    setActing(true);
    const { error } = await supabase.from('expenses')
      .update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq('id', id);
    setActing(false);
    if (error) notifyError(error, { action: 'approve_expense', expense_id: id });
    else { toast.success('Expense approved'); load(); }
  }

  async function reject() {
    if (!rejectReason.trim()) return toast.error('Please give a reason');
    setActing(true);
    const { error } = await supabase.from('expenses')
      .update({
        status: 'rejected',
        rejected_by: profile.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
      })
      .eq('id', id);
    setActing(false);
    if (error) {
      notifyError(error, { action: 'reject_expense', expense_id: id });
    } else {
      toast.success('Expense rejected');
      setRejectOpen(false);
      setRejectReason('');
      load();
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) notifyError(error, { action: 'delete_expense', expense_id: id });
    else { toast.success('Expense deleted'); navigate('/expenses'); }
  }

  return (
    <>
      <Link to="/expenses" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-2">
        <ArrowLeft size={14}/> Back to expenses
      </Link>

      <PageHeader
        kicker={exp.expense_no}
        title={exp.title}
        description={exp.expense_categories?.name && `Category: ${exp.expense_categories.name}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={exp.status} statusMap={EXPENSE_STATUS} />
          </div>
        }
      />

      {/* Action bar */}
      {(canApprove || canEdit || canDelete) && (
        <div className="card-padded mb-5">
          <div className="flex flex-wrap gap-2">
            {canApprove && (
              <>
                <button onClick={approve} disabled={acting} className="btn-primary">
                  <CheckCircle2 size={16}/> Approve
                </button>
                <button onClick={() => setRejectOpen(true)} disabled={acting} className="btn-danger">
                  <XCircle size={16}/> Reject
                </button>
              </>
            )}
            {canEdit && (
              <Link to={`/expenses/${id}/edit`} className="btn-secondary">
                <Edit2 size={14}/> Edit
              </Link>
            )}
            {canDelete && (
              <button onClick={handleDelete} className="btn-ghost text-rose-700 hover:bg-rose-50 ml-auto">
                <Trash2 size={14}/> Delete
              </button>
            )}
          </div>
          {isOwnExpense && exp.status === 'pending_approval' && (
            <p className="text-xs text-amber-700 mt-3">
              ⚖ You recorded this expense — another leader must approve it.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main info */}
        <div className="card-padded lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="kicker mb-0.5">Amount</p>
              <p className="font-display text-2xl font-semibold text-primary-900">{formatMoney(exp.amount)}</p>
            </div>
            <div>
              <p className="kicker mb-0.5">Date</p>
              <p className="text-ink-900">{formatDate(exp.expense_date)}</p>
            </div>
            <div>
              <p className="kicker mb-0.5">Payment</p>
              <p className="text-ink-900 capitalize">{exp.payment_method}</p>
            </div>
            {exp.reference_no && (
              <div>
                <p className="kicker mb-0.5">Reference</p>
                <p className="font-mono text-ink-800 text-xs">{exp.reference_no}</p>
              </div>
            )}
            {exp.vendor_name && (
              <div>
                <p className="kicker mb-0.5">Vendor</p>
                <p className="text-ink-900">{exp.vendor_name}</p>
              </div>
            )}
            <div>
              <p className="kicker mb-0.5">Recorded by</p>
              <p className="text-ink-900">{exp.recorder?.full_name || '—'}</p>
            </div>
          </div>

          {exp.description && (
            <div>
              <p className="kicker mb-1">Description</p>
              <p className="text-sm text-ink-800 whitespace-pre-line">{exp.description}</p>
            </div>
          )}
          {exp.notes && (
            <div>
              <p className="kicker mb-1">Notes</p>
              <p className="text-sm text-ink-700 whitespace-pre-line">{exp.notes}</p>
            </div>
          )}

          {/* Receipt */}
          {exp.receipt_url && (
            <div className="border-t border-cream-200 pt-4">
              <p className="kicker mb-2">Receipt</p>
              <a
                href={exp.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-200 text-primary-900 hover:bg-primary-50 transition"
              >
                <ReceiptText size={16}/> View / download receipt
              </a>
            </div>
          )}
        </div>

        {/* Sidebar: workflow + links */}
        <div className="space-y-4">
          <div className="card-padded">
            <p className="kicker mb-2">Workflow</p>
            <ul className="space-y-2 text-sm">
              <li>
                <p className="text-ink-600 text-xs">Recorded</p>
                <p className="text-ink-900">{exp.recorder?.full_name} · {formatDateTime(exp.created_at)}</p>
              </li>
              {exp.status === 'approved' && (
                <li>
                  <p className="text-emerald-700 text-xs">Approved</p>
                  <p className="text-ink-900">
                    {exp.approver?.full_name || <em>auto-approved (under threshold)</em>}
                    {exp.approved_at && <> · {formatDateTime(exp.approved_at)}</>}
                  </p>
                </li>
              )}
              {exp.status === 'rejected' && (
                <li>
                  <p className="text-rose-700 text-xs">Rejected</p>
                  <p className="text-ink-900">
                    {exp.rejecter?.full_name} · {formatDateTime(exp.rejected_at)}
                  </p>
                  {exp.rejection_reason && (
                    <p className="text-sm text-rose-700 mt-1">Reason: {exp.rejection_reason}</p>
                  )}
                </li>
              )}
            </ul>
          </div>

          {(exp.inventory_items || exp.projects) && (
            <div className="card-padded">
              <p className="kicker mb-2">Linked</p>
              {exp.inventory_items && (
                <p className="text-sm">
                  <span className="text-ink-600">Inventory: </span>
                  <Link to={`/inventory/${exp.linked_inventory_item_id}`} className="text-primary-900 hover:underline">
                    {exp.inventory_items.name}
                  </Link>
                  {exp.inventory_quantity && <span className="text-ink-500"> · +{exp.inventory_quantity}</span>}
                </p>
              )}
              {exp.projects && (
                <p className="text-sm mt-1">
                  <span className="text-ink-600">Project: </span>
                  <Link to={`/projects/${exp.linked_project_id}`} className="text-primary-900 hover:underline">
                    {exp.projects.name}
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this expense?"
        footer={
          <>
            <button onClick={() => setRejectOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={reject} disabled={acting} className="btn-danger">
              {acting ? 'Rejecting…' : 'Confirm reject'}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-700 mb-3">
          The treasurer will be notified. Please give a clear reason so they can fix and resubmit if needed.
        </p>
        <label className="label">Reason *</label>
        <textarea
          rows={3}
          className="input"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="e.g. Amount doesn't match the receipt"
        />
      </Modal>
    </>
  );
}
