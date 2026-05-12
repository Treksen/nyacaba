import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../lib/format';
import { MEETING_STATUS } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

export default function MeetingsList() {
  const { isAdminOrChair: isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', meeting_date: '', location: '', agenda: '' });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, location, status')
      .order('meeting_date', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    // datetime-local returns a tz-naive string like "2025-10-02T22:00".
    // new Date(str) interprets it in the browser's local timezone,
    // .toISOString() then encodes the correct UTC instant for storage.
    // Without this, Postgres assumes UTC and the time is wrong by your TZ offset.
    const isoMeetingDate = form.meeting_date
      ? new Date(form.meeting_date).toISOString()
      : null;
    const { error } = await supabase.from('meetings').insert({
      title: form.title,
      meeting_date: isoMeetingDate,
      location: form.location || null,
      agenda: form.agenda || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Meeting scheduled');
      setOpen(false);
      setForm({ title: '', meeting_date: '', location: '', agenda: '' });
      load();
    }
  }

  async function handleDelete(m) {
    if (!confirm(`Delete "${m.title}"? Attendance, minutes, action items, and resolutions will all be removed.`)) return;
    const { error } = await supabase.from('meetings').delete().eq('id', m.id);
    if (error) toast.error(error.message); else { toast.success('Meeting deleted'); load(); }
  }

  return (
    <>
      <PageHeader
        kicker="Gathering Together"
        title="Meetings"
        description="Where the church plans, prays, and decides."
        action={
          isAdmin && (
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus size={16} /> Schedule meeting
            </button>
          )
        }
      />

      <DataTable
        loading={loading}
        rows={rows}
        onRowClick={(r) => navigate(`/meetings/${r.id}`)}
        emptyTitle="No meetings yet"
        emptyDescription={isAdmin ? 'Schedule your first meeting.' : 'Meetings will appear here when scheduled.'}
        columns={[
          { key: 'title', header: 'Meeting', render: (r) => (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-100 text-accent-700 grid place-items-center">
                <CalendarDays size={16} />
              </div>
              <p className="font-medium text-ink-900">{r.title}</p>
            </div>
          )},
          { key: 'when', header: 'When', render: (r) => formatDateTime(r.meeting_date) },
          { key: 'location', header: 'Location', render: (r) => r.location || '—' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} statusMap={MEETING_STATUS} /> },
          ...(isAdmin ? [{
            key: 'actions', header: '', className: 'text-right',
            render: (r) => (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete">
                <Trash2 size={14}/>
              </button>
            ),
          }] : []),
        ]}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule a meeting"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button form="meet-form" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Schedule'}
            </button>
          </>
        }
      >
        <form id="meet-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input required className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Date & time *</label>
              <input required type="datetime-local" className="input" value={form.meeting_date} onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Main Sanctuary" />
            </div>
          </div>
          <div>
            <label className="label">Agenda</label>
            <textarea rows={4} className="input" value={form.agenda} onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))} placeholder="What will be discussed?" />
          </div>
        </form>
      </Modal>
    </>
  );
}
