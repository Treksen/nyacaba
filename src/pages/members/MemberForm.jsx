import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const BLANK = {
  full_name: '',
  date_of_birth: '',
  gender: 'male',
  marital_status: '',
  occupation: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  county: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',
  group_id: '',
  status: 'active',
  joined_on: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function MemberForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { isAdminOrChair: isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(BLANK);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Only admins can manage members');
      navigate('/members');
    }
  }, [isAdmin, navigate, toast]);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: g } = await supabase.from('welfare_groups').select('id, name').order('name');
      if (active) setGroups(g || []);
      if (isEdit) {
        const { data: m } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
        if (active && m) {
          setForm({
            ...BLANK,
            ...m,
            date_of_birth: m.date_of_birth || '',
            joined_on: m.joined_on || '',
            group_id: m.group_id || '',
          });
        }
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id, isEdit]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      date_of_birth: form.date_of_birth || null,
      joined_on: form.joined_on || null,
      group_id: form.group_id || null,
    };
    let result;
    if (isEdit) {
      result = await supabase.from('members').update(payload).eq('id', id).select().maybeSingle();
    } else {
      result = await supabase.from('members').insert(payload).select().maybeSingle();
    }
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message);
    } else {
      toast.success(isEdit ? 'Member updated' : 'Member added');
      navigate(`/members/${result.data.id}`);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <>
      <Link to="/members" className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to members
      </Link>

      <PageHeader
        kicker={isEdit ? 'Edit Member' : 'New Member'}
        title={isEdit ? 'Update member details' : 'Add a new member'}
        description="Capture the basics now — you can fill in the rest later."
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-4">Personal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Full name *</label>
              <input required className="input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <input type="date" className="input" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Marital status</label>
              <input className="input" value={form.marital_status} onChange={(e) => update('marital_status', e.target.value)} placeholder="e.g. Married" />
            </div>
            <div>
              <label className="label">Occupation</label>
              <input className="input" value={form.occupation} onChange={(e) => update('occupation', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-4">Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+254 7XX XXX XXX" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} />
            </div>
            <div>
              <label className="label">City / Town</label>
              <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div>
              <label className="label">County</label>
              <input className="input" value={form.county} onChange={(e) => update('county', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-4">Church Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Welfare group</label>
              <select className="input" value={form.group_id} onChange={(e) => update('group_id', e.target.value)}>
                <option value="">— None —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Joined on</label>
              <input type="date" className="input" value={form.joined_on} onChange={(e) => update('joined_on', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-4">Emergency Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.emergency_contact_name} onChange={(e) => update('emergency_contact_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.emergency_contact_phone} onChange={(e) => update('emergency_contact_phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Relation</label>
              <input className="input" value={form.emergency_contact_relation} onChange={(e) => update('emergency_contact_relation', e.target.value)} placeholder="e.g. Spouse" />
            </div>
          </div>
        </div>

        <div className="card-padded">
          <label className="label">Notes</label>
          <textarea rows={3} className="input" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <Link to="/members" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? 'Saving…' : (isEdit ? 'Update member' : 'Save member')}
          </button>
        </div>
      </form>
    </>
  );
}
