import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users, Package, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';

const ALL_TABS = [
  { key: 'welfare_groups',       label: 'Welfare Groups',       table: 'welfare_groups',       icon: Users,    adminOnly: false },
  { key: 'inventory_categories', label: 'Inventory Categories', table: 'inventory_categories', icon: Package,  adminOnly: false },
  { key: 'system_settings',      label: 'System Settings',      table: 'system_settings',      icon: Settings, adminOnly: true  },
];

export default function LookupsPanel() {
  const { isAdmin, isAdminOrChair } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  // System Settings is hidden from chair; only admin sees the third tab.
  const TABS = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);
  const [tab, setTab] = useState('welfare_groups');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', key: '', value: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdminOrChair) {
      toast.error('Admin access required');
      navigate('/');
    }
  }, [isAdminOrChair, navigate, toast]);

  async function load() {
    setLoading(true);
    const table = TABS.find((t) => t.key === tab).table;
    const orderField = tab === 'system_settings' ? 'key' : 'name';
    const { data, error } = await supabase.from(table).select('*').order(orderField);
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [tab]);

  function startCreate() {
    setEditing(null);
    setForm({ name: '', description: '', key: '', value: '' });
    setOpen(true);
  }

  function startEdit(row) {
    setEditing(row);
    setForm({
      name: row.name || '',
      description: row.description || '',
      key: row.key || '',
      value: row.value || '',
    });
    setOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const table = TABS.find((t) => t.key === tab).table;
    let payload;
    let pkField;
    if (tab === 'system_settings') {
      payload = { key: form.key, value: form.value, description: form.description || null };
      pkField = 'key';
    } else {
      payload = { name: form.name, description: form.description || null };
      pkField = 'id';
    }
    let result;
    if (editing) {
      result = await supabase.from(table).update(payload).eq(pkField, editing[pkField]);
    } else {
      result = await supabase.from(table).insert(payload);
    }
    setSaving(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editing ? 'Updated' : 'Created');
      setOpen(false);
      load();
    }
  }

  async function handleDelete(row) {
    const labelField = tab === 'system_settings' ? row.key : row.name;
    if (!confirm(`Delete "${labelField}"? This cannot be undone.`)) return;
    const table = TABS.find((t) => t.key === tab).table;
    const pkField = tab === 'system_settings' ? 'key' : 'id';
    const { error } = await supabase.from(table).delete().eq(pkField, row[pkField]);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  }

  const currentTab = TABS.find((t) => t.key === tab);
  const Icon = currentTab.icon;

  return (
    <>
      <PageHeader
        kicker="System Configuration"
        title="Lookups & Settings"
        description="Manage the small reference tables that power the rest of the system."
        action={
          <button onClick={startCreate} className="btn-primary">
            <Plus size={16} /> New {currentTab.label.replace(/s$/, '').toLowerCase()}
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-5 border-b border-cream-200">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 -mb-px border-b-2 transition text-sm font-medium inline-flex items-center gap-2 ${
                tab === t.key
                  ? 'border-primary-900 text-primary-900'
                  : 'border-transparent text-ink-600 hover:text-ink-900'
              }`}
            >
              <TabIcon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner /></div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Icon}
            title={`No ${currentTab.label.toLowerCase()} yet`}
            description="Add your first one to get going."
            action={<button onClick={startCreate} className="btn-primary"><Plus size={16}/> Add</button>}
          />
        </div>
      ) : (
        <div className="card divide-y divide-cream-200">
          {rows.map((r) => (
            <div key={r.id || r.key} className="p-4 flex flex-wrap items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-900 grid place-items-center shrink-0">
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-900">
                  {tab === 'system_settings' ? (
                    <>
                      <span className="font-mono text-xs text-ink-500">{r.key}</span>
                      <span className="ml-2 font-medium">→ {r.value || <em className="text-ink-400">empty</em>}</span>
                    </>
                  ) : r.name}
                </p>
                {r.description && <p className="text-sm text-ink-600 mt-0.5">{r.description}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(r)} className="p-2 rounded-lg text-ink-700 hover:bg-cream-100" aria-label="Edit">
                  <Edit2 size={14}/>
                </button>
                <button onClick={() => handleDelete(r)} className="p-2 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete">
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${currentTab.label.replace(/s$/, '')}` : `New ${currentTab.label.replace(/s$/, '')}`}
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button form="lookup-form" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : (editing ? 'Update' : 'Create')}
            </button>
          </>
        }
      >
        <form id="lookup-form" onSubmit={handleSave} className="space-y-3">
          {tab === 'system_settings' ? (
            <>
              <div>
                <label className="label">Key *</label>
                <input
                  required
                  className="input font-mono text-sm"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  disabled={!!editing}
                  placeholder="e.g. minimum_monthly_contribution"
                />
                {editing && <p className="text-xs text-ink-500 mt-1">Keys can't be renamed — delete and recreate if needed.</p>}
              </div>
              <div>
                <label className="label">Value</label>
                <input className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="e.g. 200" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Name *</label>
                <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={3} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
