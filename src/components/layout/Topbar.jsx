import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { initials } from '../../lib/format';
import Avatar from '../ui/Avatar';
import { roleLabel } from '../../lib/constants';

export default function Topbar({ onOpenSidebar }) {
  const { profile, signOut, isAdminOrChair } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadUnread() {
      if (!profile?.id) return;
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      if (active) setUnread(count || 0);
    }
    loadUnread();
    const channel = supabase
      .channel('notif_topbar')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile?.id}` },
        loadUnread
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  return (
    <header className="sticky top-0 z-20 bg-cream-50/85 backdrop-blur-md border-b border-cream-200">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg text-ink-700 hover:bg-cream-200 transition"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex-1" />

        <Link
          to="/notifications"
          className="relative p-2 rounded-lg text-ink-700 hover:bg-cream-200 transition"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-[10px] font-bold text-white grid place-items-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-cream-100 hover:bg-cream-200 transition border border-cream-200"
          >
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name}
              size="md"
              className="!rounded-lg"
            />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-ink-900 leading-tight">{profile?.full_name}</p>
              <p className="text-[11px] text-ink-600 leading-tight">
                {roleLabel(profile?.role)}
              </p>
            </div>
            <ChevronDown size={14} className="text-ink-600" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lift border border-cream-200 py-2 z-40 animate-scale-in">
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-ink-800 hover:bg-cream-100"
                >
                  My Profile
                </Link>
                {isAdminOrChair && (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-ink-800 hover:bg-cream-100"
                  >
                    Admin Panel
                  </Link>
                )}
                <div className="border-t border-cream-200 my-1.5" />
                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/login');
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
