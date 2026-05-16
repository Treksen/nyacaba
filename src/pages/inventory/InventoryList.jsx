import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Package, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatMoney, formatNumber } from '../../lib/format';
import { ITEM_CONDITION } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';

const BLANK = {
  name: '', sku: '', category_id: '', unit: 'pcs',
  quantity: 0, reorder_level: 0, unit_cost: 0,
  condition: 'good', location: '', description: '',
};

export default function InventoryList() {
  const { isAdminOrChair: isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);

  async function load() {
    setLoading(true);
    const [{ data: items }, { data: cats }] = await Promise.all([
      supabase.from('inventory_items').select('id, name, sku, quantity, reorder_level, unit, unit_cost, condition, location, description, category_id, inventory_categories(name)').order('name'),
      supabase.from('inventory_categories').select('id, name').order('name'),
    ]);
    setRows(items || []);
    setCategories(cats || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      name: item.name || '',
      sku: item.sku || '',
      category_id: item.category_id || '',
      unit: item.unit || 'pcs',
      quantity: item.quantity ?? 0,
      reorder_level: item.reorder_level ?? 0,
      unit_cost: item.unit_cost ?? 0,
      condition: item.condition || 'good',
      location: item.location || '',
      description: item.description || '',
    });
    setOpen(true);
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category_id: form.category_id || null,
      unit: form.unit,
      quantity: parseFloat(form.quantity || 0),
      reorder_level: parseFloat(form.reorder_level || 0),
      unit_cost: parseFloat(form.unit_cost || 0),
      condition: form.condition,
      location: form.location || null,
      description: form.description || null,
    };
    let result;
    if (editing) {
      result = await supabase.from('inventory_items').update(payload).eq('id', editing.id);
    } else {
      payload.created_by = profile?.id;
      result = await supabase.from('inventory_items').insert(payload);
    }
    setSaving(false);
    if (result.error) notifyError(result.error, { action: 'InventoryList' });
    else {
      toast.success(editing ? 'Item updated' : 'Item added');
      setOpen(false);
      load();
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? Transaction history will be lost.`)) return;
    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
    if (error) notifyError(error, { action: 'InventoryList' }); else { toast.success('Deleted'); load(); }
  }

  const filtered = rows.filter((r) => {
    const matchesQ = !q || r.name?.toLowerCase().includes(q.toLowerCase()) || r.sku?.toLowerCase().includes(q.toLowerCase());
    const matchesCat = !categoryFilter || r.category_id === categoryFilter;
    const matchesCond = !conditionFilter || r.condition === conditionFilter;
    const matchesLoc = !locationFilter || (r.location || '') === locationFilter;
    return matchesQ && matchesCat && matchesCond && matchesLoc;
  });

  // Unique non-empty locations across all items, for the location dropdown
  const locations = Array.from(new Set(rows.map((r) => r.location).filter(Boolean))).sort();

  const hasActiveFilters = q || categoryFilter || conditionFilter || locationFilter;

  const totalValue = filtered.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.unit_cost || 0), 0);
  const lowCount = filtered.filter((r) => Number(r.quantity) <= Number(r.reorder_level)).length;

  const columns = [
    { key: 'item', header: 'Item', render: (r) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-50 grid place-items-center text-primary-900">
          <Package size={16} />
        </div>
        <div>
          <p className="font-medium text-ink-900">{r.name}</p>
          {r.sku && <p className="text-xs text-ink-500 font-mono">{r.sku}</p>}
        </div>
      </div>
    )},
    { key: 'category', header: 'Category', render: (r) => r.inventory_categories?.name || '—' },
    { key: 'qty', header: 'Quantity', render: (r) => {
      const low = Number(r.quantity) <= Number(r.reorder_level);
      return (
        <span className={low ? 'badge-amber' : 'text-ink-800 font-medium'}>
          {formatNumber(r.quantity)} {r.unit}
        </span>
      );
    }},
    { key: 'cost', header: 'Unit cost', render: (r) => formatMoney(r.unit_cost) },
    { key: 'value', header: 'Value', render: (r) => formatMoney(Number(r.quantity) * Number(r.unit_cost)) },
    { key: 'condition', header: 'Condition', render: (r) => <span className="badge-slate">{r.condition}</span> },
    { key: 'location', header: 'Location', render: (r) => r.location || '—' },
  ];

  if (isAdmin) {
    columns.push({
      key: 'actions', header: '', className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 rounded-lg text-ink-700 hover:bg-cream-100" aria-label="Edit"><Edit2 size={14}/></button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete"><Trash2 size={14}/></button>
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader
        kicker="The Storehouse"
        title="Inventory"
        description="What we have, what we need, what we share."
        action={
          isAdmin && (
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Add item
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card-padded">
          <p className="kicker">Items</p>
          <p className="font-display text-2xl font-semibold mt-1">{filtered.length}</p>
        </div>
        <div className="card-padded">
          <p className="kicker">Total value</p>
          <p className="font-display text-2xl font-semibold mt-1">{formatMoney(totalValue)}</p>
        </div>
        <div className="card-padded">
          <p className="kicker flex items-center gap-1.5"><AlertTriangle size={11} /> Low stock</p>
          <p className="font-display text-2xl font-semibold mt-1 text-amber-700">{lowCount}</p>
        </div>
      </div>

      <div className="card-padded mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or SKU…"
              className="input pl-10"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className="input">
            <option value="">All conditions</option>
            {ITEM_CONDITION.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="input">
            <option value="">All locations</option>
            {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-3 text-xs text-ink-600">
            <span>
              Showing <strong>{filtered.length}</strong> of {rows.length} items
            </span>
            <button
              onClick={() => { setQ(''); setCategoryFilter(''); setConditionFilter(''); setLocationFilter(''); }}
              className="text-rose-700 hover:text-rose-900 underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        onRowClick={(r) => navigate(`/inventory/${r.id}`)}
        emptyTitle="No items yet"
        emptyDescription={isAdmin ? 'Add your first item to start tracking inventory.' : 'Items will appear here once added by an admin.'}
        columns={columns}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New inventory item'}
        size="lg"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button form="inv-form" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : (editing ? 'Update item' : 'Add item')}
            </button>
          </>
        }
      >
        <form id="inv-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="label">Name *</label>
            <input required className="input" value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div>
            <label className="label">SKU</label>
            <input className="input" value={form.sku} onChange={(e) => update('sku', e.target.value)} placeholder="auto-fill if blank" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category_id} onChange={(e) => update('category_id', e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unit} onChange={(e) => update('unit', e.target.value)} placeholder="pcs / kg / litre" />
          </div>
          <div>
            <label className="label">Condition</label>
            <select className="input" value={form.condition} onChange={(e) => update('condition', e.target.value)}>
              {ITEM_CONDITION.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" step="0.01" className="input" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
            {editing && <p className="text-xs text-ink-500 mt-1">Tip: for normal stock changes, use "Record transaction" on the item page so history is kept.</p>}
          </div>
          <div>
            <label className="label">Reorder level</label>
            <input type="number" step="0.01" className="input" value={form.reorder_level} onChange={(e) => update('reorder_level', e.target.value)} />
          </div>
          <div>
            <label className="label">Unit cost (KSh)</label>
            <input type="number" step="0.01" className="input" value={form.unit_cost} onChange={(e) => update('unit_cost', e.target.value)} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="e.g. Kitchen store" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea rows={2} className="input" value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>
        </form>
      </Modal>
    </>
  );
}
