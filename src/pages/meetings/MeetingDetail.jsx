import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, FileText, ListTodo, Vote, Plus, Trash2, Check, Edit2, Upload, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatDate, formatDateTime } from '../../lib/format';
import { MEETING_STATUS, RESOLUTION_STATUS } from '../../lib/constants';
import { uploadMeetingMinutesPdf, removeMeetingMinutesPdf } from '../../lib/meetingMinutes';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

export default function MeetingDetail() {
  const { id } = useParams();
  const { isAdminOrChair: isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [meeting, setMeeting] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [minutes, setMinutes] = useState(null);
  const [actions, setActions] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionForm, setActionForm] = useState({ title: '', assigned_to: '', due_date: '' });
  const [minOpen, setMinOpen] = useState(false);
  const [minutesContent, setMinutesContent] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef(null);
  const [resOpen, setResOpen] = useState(false);
  const [resForm, setResForm] = useState({ title: '', description: '' });
  const [voteForResolution, setVoteForResolution] = useState({}); // local cast tracking

  async function load() {
    setLoading(true);
    const [{ data: m }, { data: a }, { data: mins }, { data: act }, { data: res }, { data: mem }] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).maybeSingle(),
      supabase.from('meeting_attendance').select('*, members(full_name), profiles(full_name)').eq('meeting_id', id),
      supabase.from('meeting_minutes').select('*').eq('meeting_id', id).maybeSingle(),
      supabase.from('action_items').select('*, profiles(full_name)').eq('meeting_id', id).order('due_date'),
      supabase.from('resolutions').select('*, resolution_votes(choice, voter_id)').eq('meeting_id', id),
      supabase.from('members').select('id, full_name, profile_id').eq('status', 'active').order('full_name'),
    ]);
    setMeeting(m);
    setAttendance(a || []);
    setMinutes(mins);
    setMinutesContent(mins?.content || '');
    setActions(act || []);
    setResolutions(res || []);
    setMembers(mem || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function setStatus(status) {
    const { error } = await supabase.from('meetings').update({ status }).eq('id', id);
    if (error) notifyError(error, { action: 'MeetingDetail' }); else { toast.success('Status updated'); load(); }
  }

  async function toggleAttendance(memberId, status = 'present') {
    const existing = attendance.find((a) => a.member_id === memberId);
    if (existing) {
      const { error } = await supabase.from('meeting_attendance').update({ status }).eq('id', existing.id);
      if (error) return notifyError(error, { action: 'MeetingDetail' });
    } else {
      const { error } = await supabase.from('meeting_attendance').insert({
        meeting_id: id, member_id: memberId, status,
      });
      if (error) return notifyError(error, { action: 'MeetingDetail' });
    }
    load();
  }

  async function saveMinutes() {
    const payload = { meeting_id: id, content: minutesContent, uploaded_by: profile?.id };
    let error;
    if (minutes) {
      ({ error } = await supabase.from('meeting_minutes').update({ content: minutesContent }).eq('id', minutes.id));
    } else {
      ({ error } = await supabase.from('meeting_minutes').insert(payload));
    }
    if (error) notifyError(error, { action: 'MeetingDetail' });
    else { toast.success('Minutes saved'); setMinOpen(false); load(); }
  }

  async function handlePdfSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const url = await uploadMeetingMinutesPdf(file, id);

      // Upsert into meeting_minutes — create row if needed
      if (minutes) {
        const { error } = await supabase
          .from('meeting_minutes')
          .update({ document_url: url, uploaded_by: profile?.id })
          .eq('id', minutes.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meeting_minutes').insert({
          meeting_id: id,
          content: '(See attached PDF)',
          document_url: url,
          uploaded_by: profile?.id,
        });
        if (error) throw error;
      }
      toast.success('Minutes PDF uploaded');
      await load();
    } catch (err) {
      notifyError(err, { action: 'MeetingDetail' });
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  async function handleRemovePdf() {
    if (!minutes?.document_url) return;
    if (!confirm('Remove the minutes PDF?')) return;
    setUploadingPdf(true);
    try {
      await removeMeetingMinutesPdf(id);
      const { error } = await supabase
        .from('meeting_minutes')
        .update({ document_url: null })
        .eq('id', minutes.id);
      if (error) throw error;
      toast.success('PDF removed');
      await load();
    } catch (err) {
      notifyError(err, { action: 'MeetingDetail' });
    } finally {
      setUploadingPdf(false);
    }
  }

  async function addAction(e) {
    e.preventDefault();
    const { error } = await supabase.from('action_items').insert({
      meeting_id: id,
      title: actionForm.title,
      assigned_to: actionForm.assigned_to || null,
      due_date: actionForm.due_date || null,
    });
    if (error) notifyError(error, { action: 'MeetingDetail' });
    else {
      toast.success('Action added');
      setActionOpen(false);
      setActionForm({ title: '', assigned_to: '', due_date: '' });
      load();
    }
  }

  async function toggleAction(action) {
    const { error } = await supabase.from('action_items').update({
      completed: !action.completed,
      completed_at: !action.completed ? new Date().toISOString() : null,
    }).eq('id', action.id);
    if (error) notifyError(error, { action: 'MeetingDetail' }); else load();
  }

  async function addResolution(e) {
    e.preventDefault();
    const { error } = await supabase.from('resolutions').insert({
      meeting_id: id,
      title: resForm.title,
      description: resForm.description,
      status: 'voting',
      voting_opens_at: new Date().toISOString(),
      created_by: profile?.id,
    });
    if (error) notifyError(error, { action: 'MeetingDetail' });
    else {
      toast.success('Resolution opened for voting');
      setResOpen(false);
      setResForm({ title: '', description: '' });
      load();
    }
  }

  async function castVote(resolutionId, choice) {
    setVoteForResolution((v) => ({ ...v, [resolutionId]: choice }));
    const { error } = await supabase.from('resolution_votes').upsert({
      resolution_id: resolutionId,
      voter_id: profile.id,
      choice,
    }, { onConflict: 'resolution_id,voter_id' });
    if (error) notifyError(error, { action: 'MeetingDetail' }); else { toast.success('Vote recorded'); load(); }
  }

  async function deleteAction(action) {
    if (!confirm(`Delete the action item "${action.title}"?`)) return;
    const { error } = await supabase.from('action_items').delete().eq('id', action.id);
    if (error) notifyError(error, { action: 'MeetingDetail' }); else { toast.success('Deleted'); load(); }
  }

  async function deleteResolution(res) {
    if (!confirm(`Delete the resolution "${res.title}"? Votes will be lost.`)) return;
    const { error } = await supabase.from('resolutions').delete().eq('id', res.id);
    if (error) notifyError(error, { action: 'MeetingDetail' }); else { toast.success('Deleted'); load(); }
  }

  async function deleteMinutes() {
    if (!minutes) return;
    if (!confirm('Delete the minutes for this meeting?')) return;
    const { error } = await supabase.from('meeting_minutes').delete().eq('id', minutes.id);
    if (error) notifyError(error, { action: 'MeetingDetail' }); else { toast.success('Minutes deleted'); load(); }
  }

  async function deleteMeeting() {
    if (!confirm(`Delete "${meeting?.title}"? Attendance, minutes, action items and resolutions for this meeting will all be removed.`)) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) notifyError(error, { action: 'MeetingDetail' });
    else { toast.success('Meeting deleted'); navigate('/meetings'); }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!meeting) return <EmptyState title="Meeting not found" />;

  return (
    <>
      <Link to="/meetings" className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to meetings
      </Link>

      <div className="card-padded mb-5 paper-grain">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker mb-1">Meeting</p>
            <h1 className="font-display text-3xl font-semibold">{meeting.title}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-ink-700">
              <span className="inline-flex items-center gap-1.5"><Calendar size={14}/> {formatDateTime(meeting.meeting_date)}</span>
              {meeting.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14}/> {meeting.location}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={meeting.status} statusMap={MEETING_STATUS} />
            {isAdmin && (
              <select className="input !w-auto !py-1.5 text-xs" value={meeting.status} onChange={(e) => setStatus(e.target.value)}>
                {Object.keys(MEETING_STATUS).map((k) => <option key={k} value={k}>Mark {MEETING_STATUS[k].label}</option>)}
              </select>
            )}
            {isAdmin && (
              <button onClick={deleteMeeting} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete meeting">
                <Trash2 size={14}/>
              </button>
            )}
          </div>
        </div>
        {meeting.agenda && (
          <div className="mt-4 pt-4 border-t border-cream-200">
            <p className="kicker mb-1.5">Agenda</p>
            <p className="text-sm text-ink-700 whitespace-pre-line">{meeting.agenda}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance */}
        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-3">Attendance ({attendance.filter((a) => a.status === 'present').length}/{members.length})</h3>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {members.map((m) => {
              const rec = attendance.find((a) => a.member_id === m.id);
              return (
                <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-cream-100">
                  <span className="text-sm">{m.full_name}</span>
                  {isAdmin ? (
                    <select
                      value={rec?.status || ''}
                      onChange={(e) => toggleAttendance(m.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-cream-300 bg-white"
                    >
                      <option value="">Mark…</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="apology">Apology</option>
                      <option value="late">Late</option>
                    </select>
                  ) : (
                    <span className={
                      rec?.status === 'present' ? 'badge-emerald' :
                      rec?.status === 'apology' ? 'badge-amber' :
                      rec?.status === 'late' ? 'badge-blue' :
                      rec?.status === 'absent' ? 'badge-rose' : 'badge-slate'
                    }>
                      {rec?.status || 'unknown'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Minutes */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <FileText size={18}/> Minutes
            </h3>
            {isAdmin && (
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setMinOpen(true)} className="btn-secondary text-xs !py-1.5">
                  {minutes ? 'Edit text' : 'Add text'}
                </button>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={uploadingPdf}
                  className="btn-secondary text-xs !py-1.5"
                  title="Upload a PDF version of the minutes"
                >
                  <Upload size={12}/> {uploadingPdf ? 'Uploading…' : (minutes?.document_url ? 'Replace PDF' : 'Upload PDF')}
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={handlePdfSelect}
                />
                {minutes && (
                  <button onClick={deleteMinutes} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Delete minutes">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            )}
          </div>
          {minutes?.document_url && (
            <div className="mb-3 flex items-center justify-between gap-3 bg-primary-50 border border-primary-200 rounded-lg p-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={18} className="text-primary-900 shrink-0"/>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">Minutes PDF available</p>
                  <p className="text-xs text-ink-600">Uploaded {formatDate(minutes.updated_at || minutes.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={minutes.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-primary-900 hover:bg-primary-100 border border-primary-300 transition"
                >
                  <Download size={12}/> Download
                </a>
                {isAdmin && (
                  <button
                    onClick={handleRemovePdf}
                    disabled={uploadingPdf}
                    className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 transition"
                    aria-label="Remove PDF"
                    title="Remove PDF"
                  >
                    <Trash2 size={12}/>
                  </button>
                )}
              </div>
            </div>
          )}
          {minutes ? (
            <div className="text-sm text-ink-700 whitespace-pre-line max-h-80 overflow-y-auto">{minutes.content}</div>
          ) : (
            <p className="text-sm text-ink-600">Minutes not yet recorded.</p>
          )}
        </div>

        {/* Action items */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <ListTodo size={18}/> Action items
            </h3>
            {isAdmin && (
              <button onClick={() => setActionOpen(true)} className="btn-secondary text-xs !py-1.5">
                <Plus size={12}/> Add
              </button>
            )}
          </div>
          {actions.length === 0 ? (
            <p className="text-sm text-ink-600">No action items.</p>
          ) : (
            <ul className="space-y-2">
              {actions.map((a) => (
                <li key={a.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-cream-100">
                  <button
                    onClick={() => toggleAction(a)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 grid place-items-center transition ${
                      a.completed ? 'bg-primary-900 border-primary-900' : 'border-cream-300 hover:border-primary-500'
                    }`}
                  >
                    {a.completed && <Check size={12} className="text-cream-50" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${a.completed ? 'line-through text-ink-500' : 'text-ink-900'}`}>{a.title}</p>
                    <p className="text-xs text-ink-600">
                      {a.profiles?.full_name && `${a.profiles.full_name}`}
                      {a.due_date && ` · due ${formatDate(a.due_date)}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteAction(a)} className="p-1 rounded text-rose-700 hover:bg-rose-50 shrink-0" aria-label="Delete">
                      <Trash2 size={12}/>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resolutions */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Vote size={18}/> Resolutions
            </h3>
            {isAdmin && (
              <button onClick={() => setResOpen(true)} className="btn-secondary text-xs !py-1.5">
                <Plus size={12}/> New
              </button>
            )}
          </div>
          {resolutions.length === 0 ? (
            <p className="text-sm text-ink-600">No resolutions raised.</p>
          ) : (
            <ul className="space-y-3">
              {resolutions.map((r) => {
                const yesCount = (r.resolution_votes || []).filter((v) => v.choice === 'yes').length;
                const noCount = (r.resolution_votes || []).filter((v) => v.choice === 'no').length;
                const abstainCount = (r.resolution_votes || []).filter((v) => v.choice === 'abstain').length;
                const myVote = (r.resolution_votes || []).find((v) => v.voter_id === profile?.id)?.choice;
                return (
                  <li key={r.id} className="border border-cream-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-ink-900">{r.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={r.status} statusMap={RESOLUTION_STATUS} />
                        {isAdmin && (
                          <button onClick={() => deleteResolution(r)} className="p-1 rounded text-rose-700 hover:bg-rose-50" aria-label="Delete">
                            <Trash2 size={12}/>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-ink-700 mb-2">{r.description}</p>
                    <div className="flex items-center gap-2 text-xs text-ink-700 mb-2">
                      <span className="text-primary-900 font-medium">Yes {yesCount}</span>
                      <span className="text-rose-700 font-medium">No {noCount}</span>
                      <span className="text-ink-500 font-medium">Abstain {abstainCount}</span>
                    </div>
                    {r.status === 'voting' && (
                      <div className="flex gap-2">
                        {['yes', 'no', 'abstain'].map((c) => (
                          <button
                            key={c}
                            onClick={() => castVote(r.id, c)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition capitalize ${
                              myVote === c
                                ? 'bg-primary-900 text-cream-50 border-primary-900'
                                : 'bg-white text-ink-800 border-cream-300 hover:border-primary-300'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal open={actionOpen} onClose={() => setActionOpen(false)} title="Add action item"
        footer={
          <>
            <button onClick={() => setActionOpen(false)} className="btn-secondary">Cancel</button>
            <button form="act-form" type="submit" className="btn-primary">Add</button>
          </>
        }
      >
        <form id="act-form" onSubmit={addAction} className="space-y-3">
          <div>
            <label className="label">Action *</label>
            <input required className="input" value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assignee</label>
              <select className="input" value={actionForm.assigned_to} onChange={(e) => setActionForm({ ...actionForm, assigned_to: e.target.value })}>
                <option value="">—</option>
                {members.filter((m) => m.profile_id).map((m) => <option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" className="input" value={actionForm.due_date} onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={minOpen} onClose={() => setMinOpen(false)} title={minutes ? 'Edit minutes' : 'Add minutes'}
        size="lg"
        footer={
          <>
            <button onClick={() => setMinOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveMinutes} className="btn-primary">Save</button>
          </>
        }
      >
        <textarea rows={14} className="input" value={minutesContent} onChange={(e) => setMinutesContent(e.target.value)} placeholder="Record what was discussed, decided, and assigned…" />
      </Modal>

      <Modal open={resOpen} onClose={() => setResOpen(false)} title="New resolution"
        footer={
          <>
            <button onClick={() => setResOpen(false)} className="btn-secondary">Cancel</button>
            <button form="res-form" type="submit" className="btn-primary">Open for voting</button>
          </>
        }
      >
        <form id="res-form" onSubmit={addResolution} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input required className="input" value={resForm.title} onChange={(e) => setResForm({ ...resForm, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea required rows={4} className="input" value={resForm.description} onChange={(e) => setResForm({ ...resForm, description: e.target.value })} />
          </div>
        </form>
      </Modal>
    </>
  );
}
