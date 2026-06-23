import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, CheckCheck, Trash2, ChevronUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNotifyError } from "../../lib/useNotifyError";
import { timeAgo } from "../../lib/format";
import PageHeader from "../../components/ui/PageHeader";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import { Link } from "react-router-dom";

// ── Per-notification row with clamping detection ──────────────────────────────
function NotificationRow({ n, onMarkRead, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const bodyRef = useRef(null);

  // After render, check if the text is actually overflowing
  const checkClamped = useCallback(() => {
    const el = bodyRef.current;
    if (el) setIsClamped(el.scrollHeight > el.clientHeight);
  }, []);

  useEffect(() => {
    checkClamped();
    window.addEventListener("resize", checkClamped);
    return () => window.removeEventListener("resize", checkClamped);
  }, [checkClamped]);

  return (
    <div
      onClick={() => onMarkRead(n)}
      className={`flex items-start gap-3 p-4 transition ${!n.read ? "bg-primary-50/30" : ""}`}
    >
      <div
        className={`mt-0.5 w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
          !n.read ? "bg-primary-900 text-cream-50" : "bg-cream-100 text-ink-600"
        }`}
      >
        <Bell size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm ${!n.read ? "font-semibold text-ink-900" : "font-medium text-ink-800"}`}
          >
            {n.title}
          </p>
          <p className="text-xs text-ink-500 whitespace-nowrap shrink-0">
            {timeAgo(n.created_at)}
          </p>
        </div>

        {n.body && (
          <p
            ref={bodyRef}
            className={`text-sm text-ink-700 mt-0.5 ${isExpanded ? "" : "line-clamp-2"}`}
          >
            {n.body}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-3">
          {isClamped && !isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(n);
                setIsExpanded(true);
              }}
              className="text-xs font-semibold text-primary-900 hover:text-primary-700"
            >
              More →
            </button>
          )}
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-ink-500 hover:text-ink-700"
            >
              <ChevronUp size={12} /> Show less
            </button>
          )}
          {isExpanded && n.link && (
            <Link
              to={n.link}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-semibold text-primary-900 hover:text-primary-700"
            >
              Go to page →
            </Link>
          )}
          {!isClamped && n.link && (
            <Link
              to={n.link}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-semibold text-primary-900 hover:text-primary-700"
            >
              View →
            </Link>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(n.id);
        }}
        className="p-1 text-ink-400 hover:text-rose-700 transition shrink-0"
        aria-label="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotificationsList() {
  const { profile } = useAuth();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile?.id]);

  async function markAllRead() {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .eq("read", false);
    if (error) notifyError(error, { action: "NotificationsList" });
    else {
      toast.success("All caught up");
      load();
    }
  }

  async function markRead(n) {
    if (n.read) return;
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", n.id);
    load();
  }

  async function deleteOne(id) {
    await supabase.from("notifications").delete().eq("id", id);
    load();
  }

  const unreadCount = rows.filter((r) => !r.read).length;

  return (
    <>
      <PageHeader
        kicker="Stay In Touch"
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.`
            : "Everything is up to date."
        }
        action={
          unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary">
              <CheckCheck size={16} /> Mark all read
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
            icon={Bell}
            title="No notifications yet"
            description="You'll be notified about announcements, approvals, and welfare decisions here."
          />
        </div>
      ) : (
        <div className="card divide-y divide-cream-200">
          {rows.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onMarkRead={markRead}
              onDelete={deleteOne}
            />
          ))}
        </div>
      )}
    </>
  );
}
