import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wallet, HandCoins, HeartHandshake,
  Package, CalendarDays, Hammer, Megaphone, Bell,
  BarChart3, UserCog, ShieldCheck, Settings, History, Sparkles, X, AlertTriangle
} from 'lucide-react';
import Logo from '../ui/Logo';
import { CHURCH_NAME } from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/members',       label: 'Members',       icon: Users },
  { to: '/contributions', label: 'Contributions', icon: Wallet },
  { to: '/pledges',       label: 'Pledges',       icon: HandCoins },
  { to: '/welfare',       label: 'Welfare',       icon: HeartHandshake },
  { to: '/inventory',     label: 'Inventory',     icon: Package },
  { to: '/meetings',      label: 'Meetings',      icon: CalendarDays },
  { to: '/projects',      label: 'Projects',      icon: Hammer },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/reports',       label: 'Reports',       icon: BarChart3 },
];

export default function Sidebar({ open, onClose }) {
  const { isAdmin, isAdminOrChair, hasLinkedMember } = useAuth();
  return (
    <>
      {/* mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-primary-900 text-cream-50 flex flex-col
                    transform transition-transform duration-300 ease-out
                    ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Header */}
        <div className="px-6 py-6 border-b border-primary-800/60 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cream-50/10 p-1.5">
              <Logo size={32} />
            </div>
            <div>
              <h1 className="font-display text-2xl leading-tight text-cream-50">
                {CHURCH_NAME}
              </h1>
              <p className="text-[8px] tracking-[0.22em] font-semibold uppercase text-accent-300">
                Welfare Management System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-cream-100 hover:bg-primary-800"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="px-3 pb-2 text-[10px] tracking-[0.18em] uppercase text-cream-200/50 font-semibold">
            Main
          </p>
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                     ${
                       isActive
                         ? "bg-cream-50 text-primary-900 shadow-soft"
                         : "text-cream-100/85 hover:bg-primary-800/60 hover:text-cream-50"
                     }`
                  }
                >
                  <item.icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="my-5 mx-3 divider-ornament opacity-30" />

          <p className="px-3 pb-2 text-[10px] tracking-[0.18em] uppercase text-cream-200/50 font-semibold">
            Account
          </p>
          <ul className="space-y-0.5">
            {hasLinkedMember && (
              <li>
                <NavLink
                  to="/my-giving"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                   ${
                     isActive
                       ? "bg-cream-50 text-primary-900"
                       : "text-cream-100/85 hover:bg-primary-800/60"
                   }`
                  }
                >
                  <Sparkles size={18} strokeWidth={1.8} />
                  <span>My Giving</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink
                to="/profile"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                   ${
                     isActive
                       ? "bg-cream-50 text-primary-900"
                       : "text-cream-100/85 hover:bg-primary-800/60"
                   }`
                }
              >
                <UserCog size={18} strokeWidth={1.8} />
                <span>My Profile</span>
              </NavLink>
            </li>
            {isAdminOrChair && (
              <li>
                <NavLink
                  to="/admin"
                  end
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                     ${
                       isActive
                         ? "bg-cream-50 text-primary-900"
                         : "text-cream-100/85 hover:bg-primary-800/60"
                     }`
                  }
                >
                  <ShieldCheck size={18} strokeWidth={1.8} />
                  <span>Admin</span>
                </NavLink>
              </li>
            )}
            {isAdminOrChair && (
              <li>
                <NavLink
                  to="/admin/lookups"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                     ${
                       isActive
                         ? "bg-cream-50 text-primary-900"
                         : "text-cream-100/85 hover:bg-primary-800/60"
                     }`
                  }
                >
                  <Settings size={18} strokeWidth={1.8} />
                  <span>Lookups & Settings</span>
                </NavLink>
              </li>
            )}
            {isAdmin && (
              <li>
                <NavLink
                  to="/admin/audit"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                     ${
                       isActive
                         ? "bg-cream-50 text-primary-900"
                         : "text-cream-100/85 hover:bg-primary-800/60"
                     }`
                  }
                >
                  <History size={18} strokeWidth={1.8} />
                  <span>Audit Log</span>
                </NavLink>
              </li>
            )}
            {isAdmin && (
              <li>
                <NavLink
                  to="/admin/errors"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                     ${
                       isActive
                         ? "bg-cream-50 text-primary-900"
                         : "text-cream-100/85 hover:bg-primary-800/60"
                     }`
                  }
                >
                  <AlertTriangle size={18} strokeWidth={1.8} />
                  <span>Error Logs</span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div className="p-4 mx-3 mb-4 rounded-xl bg-primary-800/50 border border-primary-700/50">
          <p className="text-[10px] tracking-[0.18em] uppercase text-accent-300 font-semibold mb-1">
            Elohim Awabariki
          </p>
          <p className="text-xs text-cream-200/80 leading-relaxed">
            Serving with Transparency and Care.
          </p>
        </div>
      </aside>
    </>
  );
}
