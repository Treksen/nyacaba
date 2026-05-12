import { useEffect, useState } from 'react';
import { Plus, Megaphone, Pin, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, timeAgo } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';

const BLANK = { title: '', body: '', audience: 'all', pinned: false };

export default function AnnouncementsList() {
  const { isAdminOrChair: isAdmin, profile } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles(full_name)')
      .eq('published', true)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      title: a.title || '',
      body: a.body || '',
      audience: a.audience || 'all',
      pinned: !!a.pinned,
    });
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    let result;
    if (editing) {
      result = await supabase.from('announcements').update({
        title: form.title, body: form.body, audience: form.audience, pinned: form.pinned,
      }).eq('id', editing.id);
    } else {
      result = await supabase.from('announcements').insert({ ...form, created_by: profile?.id });
    }
    setSaving(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editing ? 'Announcement updated' : 'Announcement published');
      setOpen(false);
      load();
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  }

  return (
    <>
      <PageHeader
        kicker="Speak Plainly"
        title="Announcements"
        description="The voice of the church to its people."
        action={
          isAdmin && (
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16}/> New announcement
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner/></div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={Megaphone} title="No announcements yet" description={isAdmin ? 'Publish the first announcement to your community.' : 'Announcements will appear here when published.'} />
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((a) => (
            <article key={a.id} className={`card-padded ${a.pinned ? 'border-accent-300 bg-accent-50/30' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {a.pinned && <Pin size={14} className="text-accent-600"/>}
                    <p className="kicker">{a.audience === 'admins' ? 'For leadership' : a.audience === 'members' ? 'For members' : 'All members'}</p>
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-ink-900 mb-2">{a.title}</h2>
                  <p className="text-ink-700 whitespace-pre-line">{a.body}</p>
                  <p className="text-xs text-ink-500 mt-3">
                    {a.profiles?.full_name && `${a.profiles.full_name} · `}
                    {formatDateTime(a.created_at)} · {timeAgo(a.created_at)}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEdit(a)} className="p-2 rounded-lg text-ink-600 hover:bg-cream-100" aria-label="Edit"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(a.id)} className="p-2 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete"><Trash2 size={16}/></button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit announcement' : 'New announcement'}
        size="lg"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button form="ann-form" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : (editing ? 'Update' : 'Publish')}
            </button>
          </>
        }
      >
        <form id="ann-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/>
          </div>
          <div>
            <label className="label">Body *</label>
            <textarea required rows={6} className="input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What do you want everyone to know?"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Audience</label>
              <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="all">Everyone</option>
                <option value="members">Members only</option>
                <option value="admins">Leadership only (admin, chair, treasurer, welfare chair)</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="w-4 h-4 rounded text-primary-900"/>
                Pin to top
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
