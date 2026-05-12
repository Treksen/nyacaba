import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { WELFARE_CATEGORIES, URGENCY } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';

export default function WelfareRequestForm() {
  const { profile, canManageWelfare: isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const prefill = location.state?.prefill || {};
  const [members, setMembers] = useState([]);
  const [myMember, setMyMember] = useState(null);
  const [myMemberName, setMyMemberName] = useState('');
  const [myMembershipNo, setMyMembershipNo] = useState('');
  const DRAFT_KEY = `welfare-request-draft-${profile?.id || 'anon'}`;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    // Prefill from router state (resubmit case) takes priority over draft
    if (prefill.title || prefill.description) {
      return {
        member_id: '',
        category: prefill.category || 'medical',
        title: prefill.title || '',
        description: prefill.description || '',
        amount_requested: prefill.amount_requested || '',
        urgency: prefill.urgency || 'medium',
      };
    }
    // Otherwise restore last unsaved draft, if any
    try {
      const raw = typeof window !== 'undefined' && window.localStorage.getItem(DRAFT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return {
      member_id: '',
      category: 'medical',
      title: '',
      description: '',
      amount_requested: '',
      urgency: 'medium',
    };
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // Detect that we restored an existing draft so we can tell the user
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw && !prefill.title) {
        const parsed = JSON.parse(raw);
        if (parsed.title || parsed.description) setDraftRestored(true);
      }
    } catch (_) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave draft on every change (debounced via setTimeout pattern)
  useEffect(() => {
    if (!profile?.id) return;
    const hasContent = form.title || form.description || form.amount_requested;
    try {
      if (hasContent) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch (_) { /* ignore quota errors */ }
  }, [form, DRAFT_KEY, profile?.id]);

  function clearDraft() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
  }

  useEffect(() => {
    if (isAdmin) {
      supabase.from('members').select('id, full_name').eq('status', 'active').order('full_name')
        .then(({ data }) => setMembers(data || []));
    }
    if (profile?.id) {
      supabase.from('members').select('id, full_name, membership_no').eq('profile_id', profile.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setMyMember(data.id);
            setMyMemberName(data.full_name);
            setMyMembershipNo(data.membership_no);
          }
        });
    }
  }, [isAdmin, profile?.id]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const memberId = isAdmin && form.member_id ? form.member_id : myMember;
    if (!memberId) {
      return toast.error(
        isAdmin
          ? 'Select a member to submit on behalf of'
          : 'Your account is not yet linked to a member record. Ask an admin to link you.'
      );
    }
    setSaving(true);
    const { error } = await supabase.from('welfare_requests').insert({
      member_id: memberId,
      category: form.category,
      title: form.title,
      description: form.description,
      amount_requested: parseFloat(form.amount_requested),
      urgency: form.urgency,
      submitted_by: profile?.id,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      clearDraft();
      toast.success('Welfare request submitted');
      navigate('/welfare');
    }
  }

  return (
    <>
      <Link to="/welfare" className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back
      </Link>
      <PageHeader
        kicker="Asking for Help"
        title="Submit a welfare request"
        description="Be honest, be direct. Your church is here to walk with you."
      />

      <form onSubmit={handleSubmit} className="card-padded space-y-4 max-w-3xl">
        {draftRestored && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-ink-800 flex items-start gap-2">
            <span className="text-amber-700">💾</span>
            <div className="flex-1">
              <p>
                <strong>Draft restored.</strong> We brought back what you were typing earlier so you don't lose your place.
              </p>
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  setForm({ member_id: '', category: 'medical', title: '', description: '', amount_requested: '', urgency: 'medium' });
                  setDraftRestored(false);
                }}
                className="mt-1 text-xs font-medium text-rose-700 hover:text-rose-900 underline"
              >
                Discard draft and start fresh
              </button>
            </div>
          </div>
        )}
        {isAdmin && (
          <div>
            <label className="label">Submitting on behalf of</label>
            <select className="input" value={form.member_id} onChange={(e) => update('member_id', e.target.value)}>
              <option value="">— Myself —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
        )}
        {!isAdmin && myMember && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm">
            <p className="text-ink-700">
              Submitting as:{' '}
              <span className="font-semibold text-primary-900">{myMemberName}</span>
              <span className="text-ink-500 font-mono"> · {myMembershipNo}</span>
            </p>
          </div>
        )}
        {!isAdmin && !myMember && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-ink-700">
            ⚠ Your account is not yet linked to a member record. Please ask an admin to link you before submitting.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Category *</label>
            <select required className="input" value={form.category} onChange={(e) => update('category', e.target.value)}>
              {WELFARE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Urgency *</label>
            <select className="input" value={form.urgency} onChange={(e) => update('urgency', e.target.value)}>
              {URGENCY.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Title *</label>
          <input required className="input" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Short summary, e.g. 'Hospital bill assistance'" />
        </div>

        <div>
          <label className="label">Description *</label>
          <textarea required rows={5} className="input" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Tell us what happened and what you need…" />
        </div>

        <div>
          <label className="label">Amount requested (KSh) *</label>
          <input required type="number" step="0.01" min="0" className="input" value={form.amount_requested} onChange={(e) => update('amount_requested', e.target.value)} />
        </div>

        <div className="bg-cream-100 border border-cream-200 rounded-xl p-4 text-sm text-ink-700">
          <p>Your request will be reviewed by the welfare committee. You can edit it while it's still pending.</p>
        </div>

        <div className="flex justify-end gap-2">
          <Link to="/welfare" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </>
  );
}
