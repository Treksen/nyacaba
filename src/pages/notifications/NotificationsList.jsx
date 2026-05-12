import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { timeAgo } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { Link } from 'react-router-dom';

export default function NotificationsList() {
  const { profile } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [profile?.id]);

  async function markAllRead() {
    const { error } = await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() }).eq('user_id', profile.id).eq('read', false);
    if (error) toast.error(error.message); else { toast.success('All caught up'); load(); }
  }

  async function markRead(n) {
    if (n.read) return;
    await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() }).eq('id', n.id);
    load();
  }

  async function deleteOne(id) {
    await supabase.from('notifications').delete().eq('id', id);
    load();
  }

  const unreadCount = rows.filter((r) => !r.read).length;

  return (
    <>
      <PageHeader
        kicker="Stay In Touch"
        title="Notifications"
        description={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}.` : 'Everything is up to date.'}
        action={
          unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary">
              <CheckCheck size={16}/> Mark all read
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner/></div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={Bell} title="No notifications yet" description="You'll be notified about announcements, approvals, and welfare decisions here." />
        </div>
      ) : (
        <div className="card divide-y divide-cream-200">
          {rows.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n)}
              className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-cream-50/60 transition ${!n.read ? 'bg-primary-50/30' : ''}`}
            >
              <div className={`mt-0.5 w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                !n.read ? 'bg-primary-900 text-cream-50' : 'bg-cream-100 text-ink-600'
              }`}>
                <Bell size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${!n.read ? 'font-semibold text-ink-900' : 'font-medium text-ink-800'}`}>{n.title}</p>
                  <p className="text-xs text-ink-500 whitespace-nowrap">{timeAgo(n.created_at)}</p>
                </div>
                {n.body && <p className="text-sm text-ink-700 mt-0.5 line-clamp-2">{n.body}</p>}
                {n.link && (
                  <Link to={n.link} className="text-xs font-semibold text-primary-900 hover:text-primary-700 mt-1 inline-block">
                    View →
                  </Link>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                className="p-1 text-ink-400 hover:text-rose-700 transition shrink-0"
                aria-label="Delete"
              >
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
