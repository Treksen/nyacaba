import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Upload, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { EXPENSE_PAYMENT_METHODS } from '../../lib/constants';
import { uploadExpenseReceipt } from '../../lib/expenseReceipt';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

const BLANK = {
  title: '',
  description: '',
  category_id: '',
  amount: '',
  expense_date: new Date().toISOString().slice(0, 10),
  payment_method: 'cash',
  reference_no: '',
  vendor_name: '',
  linked_inventory_item_id: '',
  inventory_quantity: '',
  linked_project_id: '',
  notes: '',
};

export default function ExpenseForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const { profile, canManageFinances } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();

  const [form, setForm] = useState(BLANK);
  const [categories, setCategories] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [threshold, setThreshold] = useState(10000);

  // Load lookups + threshold + (if editing) the row
  useEffect(() => {
    Promise.all([
      supabase.from('expense_categories').select('id, name').eq('status', 'active').order('sort_order'),
      supabase.from('inventory_items').select('id, name, sku').order('name'),
      supabase.from('projects').select('id, name').neq('status', 'cancelled').order('name'),
      supabase.from('system_settings').select('value').eq('key', 'expense_approval_threshold').maybeSingle(),
    ]).then(([cats, items, projs, settings]) => {
      setCategories(cats.data || []);
      setInventoryItems(items.data || []);
      setProjects(projs.data || []);
      if (settings.data?.value) {
        const t = Number(settings.data.value);
        if (!Number.isNaN(t)) setThreshold(t);
      }
    });

    if (isEdit) {
      supabase.from('expenses').select('*').eq('id', id).maybeSingle()
        .then(({ data, error }) => {
          if (error) notifyError(error, { action: 'load_expense', expense_id: id });
          else if (data) {
            setForm({
              title: data.title || '',
              description: data.description || '',
              category_id: data.category_id || '',
              amount: data.amount ?? '',
              expense_date: data.expense_date || new Date().toISOString().slice(0, 10),
              payment_method: data.payment_method || 'cash',
              reference_no: data.reference_no || '',
              vendor_name: data.vendor_name || '',
              linked_inventory_item_id: data.linked_inventory_item_id || '',
              inventory_quantity: data.inventory_quantity ?? '',
              linked_project_id: data.linked_project_id || '',
              notes: data.notes || '',
            });
            setExistingReceiptUrl(data.receipt_url || null);
          }
          setLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!canManageFinances) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Treasurer or admin only"
        description="Only the treasurer or admin can record expenses."
      />
    );
  }

  if (loading) return <div className="card-padded flex justify-center py-10"><LoadingSpinner /></div>;

  async function handleSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    if (!form.title.trim()) return toast.error('Give the expense a short title');
    if (!form.category_id) return toast.error('Pick a category');

    // Validate optional inventory link
    if (form.linked_inventory_item_id) {
      const qty = parseFloat(form.inventory_quantity);
      if (!qty || qty <= 0) {
        return toast.error('Enter how many units this expense added to inventory');
      }
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      category_id: form.category_id,
      amount,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      reference_no: form.reference_no?.trim() || null,
      vendor_name: form.vendor_name?.trim() || null,
      linked_inventory_item_id: form.linked_inventory_item_id || null,
      inventory_quantity: form.linked_inventory_item_id ? parseFloat(form.inventory_quantity) : null,
      linked_project_id: form.linked_project_id || null,
      notes: form.notes?.trim() || null,
      recorded_by: profile.id,
    };

    let savedId = id;
    if (isEdit) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', id);
      if (error) {
        setSaving(false);
        return notifyError(error, { action: 'update_expense', expense_id: id });
      }
    } else {
      const { data, error } = await supabase.from('expenses').insert(payload).select('id').maybeSingle();
      if (error) {
        setSaving(false);
        return notifyError(error, { action: 'create_expense' });
      }
      savedId = data?.id;
    }

    // Upload receipt if attached
    if (receiptFile && savedId) {
      try {
        const url = await uploadExpenseReceipt(receiptFile, savedId);
        const { error } = await supabase.from('expenses').update({ receipt_url: url }).eq('id', savedId);
        if (error) notifyError(error, { action: 'attach_receipt', expense_id: savedId });
      } catch (err) {
        notifyError(err, { action: 'upload_receipt', expense_id: savedId });
      }
    }

    setSaving(false);
    toast.success(isEdit ? 'Expense updated' : (amount >= threshold ? 'Submitted — awaiting chair approval' : 'Recorded and auto-approved'));
    navigate(`/expenses/${savedId}`);
  }

  const amountNum = parseFloat(form.amount);
  const willNeedApproval = amountNum >= threshold;

  return (
    <>
      <Link to="/expenses" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-2">
        <ArrowLeft size={14}/> Back to expenses
      </Link>
      <PageHeader
        kicker={isEdit ? 'Edit Expense' : 'New Expense'}
        title={isEdit ? 'Edit expense' : 'Record an expense'}
        description={isEdit ? 'Update the details of this expense.' : 'Capture what was spent — and on what.'}
      />

      <form onSubmit={handleSubmit} className="card-padded space-y-4 max-w-3xl">
        <div>
          <label className="label">Title *</label>
          <input
            required
            className="input"
            placeholder="e.g. Sunday lunch supplies — 18 May"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Category *</label>
            <select required className="input"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">— Select —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date *</label>
            <input required type="date" className="input"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Amount (KSh) *</label>
            <input required type="number" step="0.01" min="0" className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            {amountNum > 0 && willNeedApproval && !isEdit && (
              <p className="text-xs text-amber-700 mt-1">
                ℹ Amounts at or above {threshold.toLocaleString()} need chairperson approval before they're final.
              </p>
            )}
          </div>
          <div>
            <label className="label">Payment method *</label>
            <select required className="input"
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            >
              {EXPENSE_PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Reference / receipt no.</label>
            <input className="input"
              placeholder="M-Pesa code, receipt no."
              value={form.reference_no}
              onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Vendor / paid to</label>
            <input className="input"
              placeholder="e.g. Naivas Supermarket"
              value={form.vendor_name}
              onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
            />
          </div>
        </div>

        {/* Optional inventory link */}
        <details className="border border-cream-200 rounded-xl p-3" open={!!form.linked_inventory_item_id}>
          <summary className="cursor-pointer text-sm font-medium text-ink-800">
            Restocked inventory? <span className="font-normal text-ink-500">(optional)</span>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="label">Inventory item</label>
              <select className="input"
                value={form.linked_inventory_item_id}
                onChange={(e) => setForm({ ...form, linked_inventory_item_id: e.target.value })}
              >
                <option value="">— None —</option>
                {inventoryItems.map((i) => <option key={i.id} value={i.id}>{i.name} {i.sku ? `· ${i.sku}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Quantity added</label>
              <input type="number" step="0.01" min="0" className="input"
                placeholder="e.g. 5 (kg of sugar)"
                value={form.inventory_quantity}
                onChange={(e) => setForm({ ...form, inventory_quantity: e.target.value })}
                disabled={!form.linked_inventory_item_id}
              />
              <p className="text-[11px] text-ink-500 mt-1">
                On approval, stock will increase by this amount automatically.
              </p>
            </div>
          </div>
        </details>

        {/* Optional project link */}
        <details className="border border-cream-200 rounded-xl p-3" open={!!form.linked_project_id}>
          <summary className="cursor-pointer text-sm font-medium text-ink-800">
            Belongs to a project? <span className="font-normal text-ink-500">(optional)</span>
          </summary>
          <div className="mt-3">
            <label className="label">Project</label>
            <select className="input"
              value={form.linked_project_id}
              onChange={(e) => setForm({ ...form, linked_project_id: e.target.value })}
            >
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </details>

        <div>
          <label className="label">Receipt (optional)</label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            {existingReceiptUrl && !receiptFile && (
              <a href={existingReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-900 hover:underline">
                View current receipt
              </a>
            )}
          </div>
          <p className="text-[11px] text-ink-500 mt-1">JPG, PNG, HEIC, or PDF — max 5 MB.</p>
        </div>

        <div>
          <label className="label">Description / notes</label>
          <textarea
            rows={3}
            className="input"
            placeholder="Anything else worth recording…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-cream-200">
          <Link to="/expenses" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16}/> {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Record expense')}
          </button>
        </div>
      </form>
    </>
  );
}
