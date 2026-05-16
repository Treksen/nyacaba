import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Hammer, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatMoney, formatDate } from '../../lib/format';
import { PROJECT_STATUS } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

export default function ProjectsList() {
  const { canManageFinances: isAdmin, profile } = useAuth();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', description: '', budget: 0,
    start_date: '', target_end_date: '', status: 'planning',
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("v_project_financials")
      .select("*")
      .order("updated_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('projects').insert({
      ...form,
      budget: parseFloat(form.budget || 0),
      code: form.code || null,
      start_date: form.start_date || null,
      target_end_date: form.target_end_date || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) notifyError(error, { action: 'ProjectsList' });
    else {
      toast.success('Project created');
      setOpen(false);
      setForm({ name: '', code: '', description: '', budget: 0, start_date: '', target_end_date: '', status: 'planning' });
      load();
    }
  }

  return (
    <>
      <PageHeader
        kicker="Building Together"
        title="Projects"
        description="Every brick laid by faithful hands."
        action={
          isAdmin && (
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus size={16} /> New project
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Hammer}
            title="No projects yet"
            description={
              isAdmin
                ? "Start by creating your first project."
                : "Projects will appear here once created."
            }
            action={
              isAdmin && (
                <button onClick={() => setOpen(true)} className="btn-primary">
                  <Plus size={16} /> New project
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="card-padded group hover:shadow-lift transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-900 grid place-items-center">
                  <Hammer size={18} />
                </div>
                <StatusBadge status={p.status} statusMap={PROJECT_STATUS} />
              </div>

              <h3 className="font-display text-xl font-semibold text-ink-900 group-hover:text-primary-900 transition mb-1">
                {p.name}
              </h3>
              {p.code && (
                <p className="text-xs font-mono text-ink-500 mb-2">{p.code}</p>
              )}
              {p.description && (
                <p className="text-sm text-ink-600 line-clamp-2 mb-3">
                  {p.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-ink-700 mb-2">
                <span>Progress</span>
                <span className="font-semibold text-primary-900">
                  {Math.min(
                    Math.round(
                      ((p.total_contributions || 0) / Number(p.budget || 1)) *
                        100,
                    ),
                    100,
                  )}
                  %
                </span>
              </div>
              <div className="h-2 rounded-full bg-cream-200 overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-primary-700 to-primary-900 rounded-full"
                  style={{
                    width: `${Math.min(
                      Math.round(
                        ((p.total_contributions || 0) / Number(p.budget || 1)) *
                          100,
                      ),
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-end justify-between pt-3 border-t border-cream-200">
                <div>
                  <p className="kicker">Budget</p>
                  <p className="font-semibold text-ink-900">
                    {formatMoney(p.budget)}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-primary-900 group-hover:translate-x-1 transition-transform"
                />
              </div>
              {p.target_end_date && (
                <p className="text-xs text-ink-500 mt-2">
                  Target: {formatDate(p.target_end_date)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New project"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              form="proj-form"
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Saving…" : "Create project"}
            </button>
          </>
        }
      >
        <form id="proj-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Project name *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Code</label>
              <input
                className="input"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="e.g. PRJ-EXPAND"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              rows={3}
              className="input"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Budget (KSh)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.budget}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budget: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                className="input"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2">
              <label className="label">Target end date</label>
              <input
                type="date"
                className="input"
                value={form.target_end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target_end_date: e.target.value }))
                }
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
