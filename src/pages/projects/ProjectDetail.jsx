import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Check, Calendar, Banknote, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney, formatDate, formatDateTime } from '../../lib/format';
import { PROJECT_STATUS } from '../../lib/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

export default function ProjectDetail() {
  const { id } = useParams();
  const { canManageFinances: isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [contributed, setContributed] = useState(0);
  const [loading, setLoading] = useState(true);

  const [msOpen, setMsOpen] = useState(false);
  const [msForm, setMsForm] = useState({ title: '', description: '', due_date: '' });
  const [exOpen, setExOpen] = useState(false);
  const [exForm, setExForm] = useState({ description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), vendor: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', status: 'planning', progress_pct: 0, budget: 0 });
  const [editingExpense, setEditingExpense] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);

  
 
      async function load() {
    setLoading(true);
    const [{ data: p }, { data: m }, { data: e }, { data: c }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('project_milestones').select('*').eq('project_id', id).order('due_date', { nullsFirst: false }),
      supabase.from('project_expenses').select('*, profiles(full_name)').eq('project_id', id).order('expense_date', { ascending: false }),
      supabase.from('contributions').select('amount').eq('project_id', id).eq('verification_status', 'confirmed'),
    ]);
    setProject(p);
    setEditForm({
      name: p?.name || '',
      description: p?.description || '',
      status: p?.status || 'planning',
      progress_pct: p?.progress_pct || 0,
      budget: p?.budget || 0,
    });
    setMilestones(m || []);
    setExpenses(e || []);
    setContributed((c || []).reduce((s, r) => s + Number(r.amount || 0), 0));
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function addMilestone(e) {
    e.preventDefault();
    const { error } = await supabase.from('project_milestones').insert({
      project_id: id,
      title: msForm.title,
      description: msForm.description || null,
      due_date: msForm.due_date || null,
    });
    if (error) toast.error(error.message);
    else { toast.success('Milestone added'); setMsOpen(false); setMsForm({ title: '', description: '', due_date: '' }); load(); }
  }

  async function toggleMilestone(m) {
    const { error } = await supabase.from('project_milestones').update({
      completed: !m.completed,
      completed_at: !m.completed ? new Date().toISOString() : null,
    }).eq('id', m.id);
    if (error) toast.error(error.message); else load();
  }

  async function saveEdit(e) {
    e.preventDefault();
    const { error } = await supabase.from('projects').update({
      name: editForm.name,
      description: editForm.description,
      status: editForm.status,
      progress_pct: parseInt(editForm.progress_pct),
      budget: parseFloat(editForm.budget),
    }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Project updated'); setEditOpen(false); load(); }
  }

  async function deleteMilestone(m) {
    if (!confirm(`Delete milestone "${m.title}"?`)) return;
    const { error } = await supabase.from('project_milestones').delete().eq('id', m.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  }

  async function deleteExpense(ex) {
    if (!confirm(`Delete expense "${ex.description}" of ${formatMoney(ex.amount)}?`)) return;
    const { error } = await supabase.from('project_expenses').delete().eq('id', ex.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  }

  function openExpenseEdit(ex) {
    setEditingExpense(ex);
    setExForm({
      description: ex.description,
      amount: ex.amount,
      expense_date: ex.expense_date,
      vendor: ex.vendor || '',
    });
    setExOpen(true);
  }

  async function saveExpense(e) {
    e.preventDefault();
    setSavingExpense(true);
    let result;
    if (editingExpense) {
      result = await supabase.from('project_expenses').update({
        description: exForm.description,
        amount: parseFloat(exForm.amount),
        expense_date: exForm.expense_date,
        vendor: exForm.vendor || null,
      }).eq('id', editingExpense.id);
    } else {
      result = await supabase.from('project_expenses').insert({
        project_id: id,
        description: exForm.description,
        amount: parseFloat(exForm.amount),
        expense_date: exForm.expense_date,
        vendor: exForm.vendor || null,
        recorded_by: profile?.id,
      });
    }
    setSavingExpense(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editingExpense ? 'Expense updated' : 'Expense recorded');
      setExOpen(false);
      setEditingExpense(null);
      setExForm({ description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), vendor: '' });
      load();
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Project deleted'); navigate('/projects'); }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!project) return <EmptyState title="Project not found" />;

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const remaining = Number(project.budget || 0) - Number(contributed || 0);

  const financialProgress =
    Number(project.budget || 0) > 0
      ? Math.min(
          Math.round(
            (Number(contributed || 0) / Number(project.budget || 1)) * 100,
          ),
          100,
        )
      : 0;

  return (
    <>
      <Link
        to="/projects"
        className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft size={14} /> Back to projects
      </Link>

      <div className="card-padded mb-5 paper-grain">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {project.code && <p className="kicker mb-1">{project.code}</p>}
            <h1 className="font-display text-3xl font-semibold">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-ink-700 mt-2 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} statusMap={PROJECT_STATUS} />
            {isAdmin && (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  className="btn-secondary text-xs !py-2"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="btn-ghost text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-ink-700">Progress</span>
            <span className="font-semibold text-primary-900">
              {financialProgress}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-cream-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-700 to-primary-900 rounded-full transition-all"
              style={{ width: `${financialProgress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Budget</p>
            <p className="font-display text-xl font-semibold mt-0.5">
              {formatMoney(project.budget)}
            </p>
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Contributions</p>
            <p className="font-display text-xl font-semibold mt-0.5 text-primary-900">
              {formatMoney(contributed)}
            </p>
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Spent</p>
            <p className="font-display text-xl font-semibold mt-0.5">
              {formatMoney(totalExpenses)}
            </p>
          </div>
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">
              {remaining > 0 ? "Still Needed" : "Funding Surplus"}
            </p>

            <p
              className={`font-display text-lg font-semibold mt-0.5 ${
                remaining > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {formatMoney(Math.abs(remaining))}
            </p>

            <p className="text-[11px] text-ink-500 mt-1">
              {financialProgress}% funded
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 text-xs text-ink-500">
          {project.start_date && (
            <span>
              <Calendar size={11} className="inline mr-1" /> Started{" "}
              {formatDate(project.start_date)}
            </span>
          )}
          {project.target_end_date && (
            <span>
              <Calendar size={11} className="inline mr-1" /> Target{" "}
              {formatDate(project.target_end_date)}
            </span>
          )}
          {project.actual_end_date && (
            <span>
              <Calendar size={11} className="inline mr-1" /> Completed{" "}
              {formatDate(project.actual_end_date)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold">Milestones</h3>
            {isAdmin && (
              <button
                onClick={() => setMsOpen(true)}
                className="btn-secondary text-xs !py-1.5"
              >
                <Plus size={12} /> Add
              </button>
            )}
          </div>
          {milestones.length === 0 ? (
            <p className="text-sm text-ink-600">No milestones defined.</p>
          ) : (
            <ul className="space-y-2">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-cream-100"
                >
                  <button
                    onClick={() => isAdmin && toggleMilestone(m)}
                    disabled={!isAdmin}
                    className={`mt-0.5 w-5 h-5 rounded border-2 grid place-items-center transition shrink-0 ${
                      m.completed
                        ? "bg-primary-900 border-primary-900"
                        : "border-cream-300 hover:border-primary-500"
                    } ${!isAdmin && "cursor-default"}`}
                  >
                    {m.completed && (
                      <Check size={12} className="text-cream-50" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${m.completed ? "line-through text-ink-500" : "text-ink-900 font-medium"}`}
                    >
                      {m.title}
                    </p>
                    {m.description && (
                      <p className="text-xs text-ink-700 mt-0.5">
                        {m.description}
                      </p>
                    )}
                    {m.due_date && (
                      <p className="text-xs text-ink-500">
                        Due {formatDate(m.due_date)}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteMilestone(m)}
                      className="p-1 rounded text-rose-700 hover:bg-rose-50 shrink-0"
                      aria-label="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Banknote size={18} /> Expenses
            </h3>
            {isAdmin && (
              <button
                onClick={() => setExOpen(true)}
                className="btn-secondary text-xs !py-1.5"
              >
                <Plus size={12} /> Record
              </button>
            )}
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-ink-600">No expenses recorded yet.</p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {expenses.map((e) => (
                <li
                  key={e.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 truncate">
                      {e.description}
                    </p>
                    <p className="text-xs text-ink-600">
                      {formatDate(e.expense_date)}
                      {e.vendor && ` · ${e.vendor}`}
                      {e.profiles?.full_name && ` · by ${e.profiles.full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-semibold text-rose-700 whitespace-nowrap">
                      −{formatMoney(e.amount)}
                    </p>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => openExpenseEdit(e)}
                          className="p-1 rounded text-ink-600 hover:bg-cream-100"
                          aria-label="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => deleteExpense(e)}
                          className="p-1 rounded text-rose-700 hover:bg-rose-50"
                          aria-label="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        open={msOpen}
        onClose={() => setMsOpen(false)}
        title="Add milestone"
        footer={
          <>
            <button onClick={() => setMsOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button form="ms-form" type="submit" className="btn-primary">
              Add
            </button>
          </>
        }
      >
        <form id="ms-form" onSubmit={addMilestone} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input
              required
              className="input"
              value={msForm.title}
              onChange={(e) => setMsForm({ ...msForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              rows={2}
              className="input"
              value={msForm.description}
              onChange={(e) =>
                setMsForm({ ...msForm, description: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Due date</label>
            <input
              type="date"
              className="input"
              value={msForm.due_date}
              onChange={(e) =>
                setMsForm({ ...msForm, due_date: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={exOpen}
        onClose={() => {
          setExOpen(false);
          setEditingExpense(null);
        }}
        title={editingExpense ? "Edit expense" : "Record expense"}
        footer={
          <>
            <button
              onClick={() => {
                setExOpen(false);
                setEditingExpense(null);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              form="ex-form"
              type="submit"
              disabled={savingExpense}
              className="btn-primary"
            >
              {savingExpense ? "Saving…" : editingExpense ? "Update" : "Record"}
            </button>
          </>
        }
      >
        <form id="ex-form" onSubmit={saveExpense} className="space-y-3">
          <div>
            <label className="label">Description *</label>
            <input
              required
              className="input"
              value={exForm.description}
              onChange={(e) =>
                setExForm({ ...exForm, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (KSh) *</label>
              <input
                required
                type="number"
                step="0.01"
                className="input"
                value={exForm.amount}
                onChange={(e) =>
                  setExForm({ ...exForm, amount: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={exForm.expense_date}
                onChange={(e) =>
                  setExForm({ ...exForm, expense_date: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Vendor</label>
            <input
              className="input"
              value={exForm.vendor}
              onChange={(e) => setExForm({ ...exForm, vendor: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit project"
        footer={
          <>
            <button
              onClick={() => setEditOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button form="edit-form" type="submit" className="btn-primary">
              Save
            </button>
          </>
        }
      >
        <form id="edit-form" onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input
              required
              className="input"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              rows={3}
              className="input"
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value })
                }
              >
                {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="input"
                value={editForm.progress_pct}
                onChange={(e) =>
                  setEditForm({ ...editForm, progress_pct: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Budget (KSh)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={editForm.budget}
              onChange={(e) =>
                setEditForm({ ...editForm, budget: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
