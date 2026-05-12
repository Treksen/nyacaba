import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Package, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney, formatNumber, formatDateTime } from '../../lib/format';
import { TXN_TYPES, ITEM_CONDITION } from '../../lib/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';

export default function InventoryItemPage() {
  const { id } = useParams();
  const { isAdminOrChair: isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [item, setItem] = useState(null);
  const [txns, setTxns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    txn_type: 'intake', quantity: '', unit_cost: '', reference: '', notes: '',
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: it }, { data: t }, { data: cats }] = await Promise.all([
      supabase.from('inventory_items').select('*, inventory_categories(name)').eq('id', id).maybeSingle(),
      supabase.from('inventory_transactions').select('*, profiles(full_name)').eq('item_id', id).order('performed_at', { ascending: false }),
      supabase.from('inventory_categories').select('id, name').order('name'),
    ]);
    setItem(it);
    setTxns(t || []);
    setCategories(cats || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function recordTxn(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      item_id: id,
      txn_type: form.txn_type,
      quantity: parseFloat(form.quantity),
      unit_cost: parseFloat(form.unit_cost || 0),
      reference: form.reference || null,
      notes: form.notes || null,
      performed_by: profile?.id,
    };
    const { error } = await supabase.from('inventory_transactions').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Transaction recorded');
      setOpen(false);
      setForm({ txn_type: 'intake', quantity: '', unit_cost: '', reference: '', notes: '' });
      load();
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this item? Transaction history will be lost.')) return;
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Item deleted');
      navigate('/inventory');
    }
  }

  function openEdit() {
    setEditForm({
      name: item.name || '',
      sku: item.sku || '',
      category_id: item.category_id || '',
      unit: item.unit || 'pcs',
      reorder_level: item.reorder_level ?? 0,
      unit_cost: item.unit_cost ?? 0,
      condition: item.condition || 'good',
      location: item.location || '',
      description: item.description || '',
    });
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSavingEdit(true);
    const { error } = await supabase.from('inventory_items').update({
      name: editForm.name,
      sku: editForm.sku || null,
      category_id: editForm.category_id || null,
      unit: editForm.unit,
      reorder_level: parseFloat(editForm.reorder_level || 0),
      unit_cost: parseFloat(editForm.unit_cost || 0),
      condition: editForm.condition,
      location: editForm.location || null,
      description: editForm.description || null,
    }).eq('id', id);
    setSavingEdit(false);
    if (error) toast.error(error.message);
    else { toast.success('Item updated'); setEditOpen(false); load(); }
  }

  async function deleteTxn(txn) {
    if (!confirm('Delete this transaction? Item quantity will NOT auto-reverse — adjust manually if needed.')) return;
    const { error } = await supabase.from('inventory_transactions').delete().eq('id', txn.id);
    if (error) toast.error(error.message); else { toast.success('Transaction deleted'); load(); }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!item) return <EmptyState title="Item not found" />;

  const low = Number(item.quantity) <= Number(item.reorder_level);

  return (
    <>
      <Link to="/inventory" className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to inventory
      </Link>

      <div className="card-padded mb-5 paper-grain">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-900 grid place-items-center">
              <Package size={24} />
            </div>
            <div>
              {item.sku && <p className="kicker mb-1">{item.sku}</p>}
              <h1 className="font-display text-3xl font-semibold">{item.name}</h1>
              <p className="text-sm text-ink-600 mt-1">
                {item.inventory_categories?.name || 'Uncategorized'}
                {item.location && ` · ${item.location}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <button onClick={() => setOpen(true)} className="btn-primary">
                  <Plus size={16} /> Record transaction
                </button>
                <button onClick={openEdit} className="btn-secondary">
                  <Edit2 size={16} /> Edit
                </button>
                <button onClick={handleDelete} className="btn-ghost text-rose-700 hover:bg-rose-50">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">In Stock</p>
            <p className={`font-display text-2xl font-semibold mt-0.5 ${low ? 'text-amber-700' : 'text-primary-900'}`}>
              {formatNumber(item.quantity)} <span className="text-sm font-normal">{item.unit}</span>
            </p>
            {low && <p className="text-xs text-amber-700 mt-0.5">Below reorder level</p>}
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Reorder At</p>
            <p className="font-display text-2xl font-semibold mt-0.5">{formatNumber(item.reorder_level)}</p>
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Unit Cost</p>
            <p className="font-display text-2xl font-semibold mt-0.5">{formatMoney(item.unit_cost)}</p>
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Total Value</p>
            <p className="font-display text-2xl font-semibold mt-0.5">{formatMoney(Number(item.quantity) * Number(item.unit_cost))}</p>
          </div>
        </div>

        {item.description && (
          <p className="text-sm text-ink-700 mt-5 pt-5 border-t border-cream-200">{item.description}</p>
        )}
      </div>

      <div className="card-padded">
        <h3 className="font-display text-lg font-semibold mb-3">Transaction history</h3>
        {txns.length === 0 ? (
          <p className="text-sm text-ink-600">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-cream-200">
            {txns.map((t) => {
              const positive = ['intake', 'donation', 'purchase'].includes(t.txn_type);
              return (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 capitalize">
                      {TXN_TYPES.find((x) => x.value === t.txn_type)?.label || t.txn_type}
                    </p>
                    <p className="text-xs text-ink-600">
                      {formatDateTime(t.performed_at)}
                      {t.profiles?.full_name && ` · ${t.profiles.full_name}`}
                      {t.reference && ` · ${t.reference}`}
                    </p>
                    {t.notes && <p className="text-xs text-ink-700 mt-1 italic">{t.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={`font-semibold whitespace-nowrap ${positive ? 'text-primary-900' : 'text-rose-700'}`}>
                      {positive ? '+' : '−'}{formatNumber(t.quantity)} {item.unit}
                    </p>
                    {isAdmin && (
                      <button onClick={() => deleteTxn(t)} className="p-1 rounded text-rose-700 hover:bg-rose-50" aria-label="Delete">
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record inventory transaction"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button form="txn-form" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Record'}
            </button>
          </>
        }
      >
        <form id="txn-form" onSubmit={recordTxn} className="space-y-3">
          <div>
            <label className="label">Type *</label>
            <select className="input" value={form.txn_type} onChange={(e) => update('txn_type', e.target.value)}>
              {TXN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-xs text-ink-500 mt-1">Adjustments can be negative — enter quantity as a negative number to subtract.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity *</label>
              <input required type="number" step="0.01" className="input" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
            </div>
            <div>
              <label className="label">Unit cost (KSh)</label>
              <input type="number" step="0.01" className="input" value={form.unit_cost} onChange={(e) => update('unit_cost', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" value={form.reference} onChange={(e) => update('reference', e.target.value)} placeholder="Receipt no, vendor, etc." />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
        </form>
      </Modal>
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${item.name}`}
        size="lg"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button form="inv-edit-form" type="submit" disabled={savingEdit} className="btn-primary">
              {savingEdit ? 'Saving…' : 'Update item'}
            </button>
          </>
        }
      >
        <form id="inv-edit-form" onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="label">Name *</label>
            <input required className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">SKU</label>
            <input className="input" value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={editForm.category_id} onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} />
          </div>
          <div>
            <label className="label">Condition</label>
            <select className="input" value={editForm.condition} onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}>
              {ITEM_CONDITION.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reorder level</label>
            <input type="number" step="0.01" className="input" value={editForm.reorder_level} onChange={(e) => setEditForm({ ...editForm, reorder_level: e.target.value })} />
          </div>
          <div>
            <label className="label">Unit cost (KSh)</label>
            <input type="number" step="0.01" className="input" value={editForm.unit_cost} onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Location</label>
            <input className="input" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea rows={2} className="input" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <div className="md:col-span-2 bg-cream-100 rounded-lg p-3 text-xs text-ink-700">
            💡 To change quantity, use the <strong>Record transaction</strong> button instead — that way movement history is kept and the math stays consistent.
          </div>
        </form>
      </Modal>
    </>
  );
}
