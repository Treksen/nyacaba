import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CONTRIBUTION_TYPES, PAYMENT_METHODS, MONTHS } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';

export default function ContributionForm() {
  const { canManageFinances: isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Route guard: this form is for staff (admin/chair/treasurer). Members
  // self-record via the "Record contribution" button on /my-giving.
  useEffect(() => {
    if (!isAdmin) {
      toast.error('Members record contributions from My Giving — taking you there.');
      navigate('/my-giving', { replace: true });
    }
  }, [isAdmin, navigate, toast]);
  const today = new Date();
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    member_id: '',
    amount: '',
    contribution_type: 'monthly',
    payment_method: 'cash',
    reference_no: '',
    contribution_date: today.toISOString().slice(0, 10),
    period_month: today.getMonth() + 1,
    period_year: today.getFullYear(),
    project_id: '',
    pledge_id: '',
    notes: '',
  });

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Only admins can record contributions');
      navigate('/contributions');
    }
  }, [isAdmin, navigate, toast]);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase.from('members').select('id, full_name, membership_no').eq('status', 'active').order('full_name'),
        supabase.from('projects').select('id, name').neq('status', 'cancelled').order('name'),
      ]);
      if (active) {
        setMembers(m || []);
        setProjects(p || []);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // Load pledges for selected member when type is 'pledge'
  useEffect(() => {
    let active = true;
    if (form.member_id && form.contribution_type === 'pledge') {
      supabase
        .from('pledges')
        .select('id, purpose, pledge_amount, paid_amount, status')
        .eq('member_id', form.member_id)
        .in('status', ['open', 'partial'])
        .then(({ data }) => active && setPledges(data || []));
    } else {
      setPledges([]);
    }
    return () => { active = false; };
  }, [form.member_id, form.contribution_type]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      member_id: form.member_id,
      amount: parseFloat(form.amount),
      contribution_type: form.contribution_type,
      payment_method: form.payment_method,
      reference_no: form.reference_no || null,
      contribution_date: form.contribution_date,
      period_month: form.period_month ? Number(form.period_month) : null,
      period_year: form.period_year ? Number(form.period_year) : null,
      project_id: form.project_id || null,
      pledge_id: form.pledge_id || null,
      notes: form.notes || null,
      recorded_by: profile?.id,
    };
    const { error } = await supabase.from('contributions').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Contribution recorded');
      navigate('/contributions');
    }
  }

  return (
    <>
      <Link
        to="/contributions"
        className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft size={14} /> Back
      </Link>
      <PageHeader
        kicker="New Entry"
        title="Record a contribution"
        description="Capture a gift to the Lord's work — every shilling, every story."
      />

      <form onSubmit={handleSubmit} className="card-padded space-y-4 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Member *</label>
            <select
              required
              className="input"
              value={form.member_id}
              onChange={(e) => update("member_id", e.target.value)}
            >
              <option value="">Select a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.membership_no})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Amount (KSh) *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Date *</label>
            <input
              required
              type="date"
              className="input"
              value={form.contribution_date}
              onChange={(e) => update("contribution_date", e.target.value)}
            />
          </div>

          <div>
            <label className="label">Type *</label>
            <select
              className="input"
              value={form.contribution_type}
              onChange={(e) => update("contribution_type", e.target.value)}
            >
              {CONTRIBUTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Payment method *</label>
            <select
              className="input"
              value={form.payment_method}
              onChange={(e) => update("payment_method", e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Period month</label>
            <select
              className="input"
              value={form.period_month || ""}
              onChange={(e) => update("period_month", e.target.value)}
            >
              <option value="">—</option>
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Period year</label>
            <input
              type="number"
              className="input"
              value={form.period_year || ""}
              onChange={(e) => update("period_year", e.target.value)}
            />
          </div>

          <div>
            <label className="label">Reference / M-Pesa code</label>
            <input
              className="input"
              value={form.reference_no}
              onChange={(e) => update("reference_no", e.target.value)}
              placeholder="e.g. SHX1A23BCD"
            />
          </div>

          {(form.contribution_type === "project" ||
            form.contribution_type === "pledge") && (
            <div>
              <label className="label">Project</label>
              <select
                className="input"
                value={form.project_id}
                onChange={(e) => update("project_id", e.target.value)}
              >
                <option value="">— Select —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.contribution_type === "pledge" && pledges.length > 0 && (
            <div className="md:col-span-2">
              <label className="label">Apply to pledge</label>
              <select
                className="input"
                value={form.pledge_id}
                onChange={(e) => update("pledge_id", e.target.value)}
              >
                <option value="">— Select —</option>
                {pledges.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purpose} (paid {p.paid_amount}/{p.pledge_amount})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea
              rows={2}
              className="input"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/contributions" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? "Saving…" : "Record contribution"}
          </button>
        </div>
      </form>
    </>
  );
}
