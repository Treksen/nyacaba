import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, HandCoins, HeartHandshake, FileText, Plus, Printer,
  AlertCircle, ArrowUpRight, ChevronRight, BellRing, Users as UsersIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDate, initials } from '../../lib/format';
import { CONTRIBUTION_TYPES, PLEDGE_STATUS, WELFARE_STATUS, VERIFICATION_STATUS } from '../../lib/constants';
import StatCard from './StatCard';
import LoadingSpinner from '../ui/LoadingSpinner';
import Avatar from '../ui/Avatar';

/**
 * "My Section" tab content on the Dashboard.
 * Shows the current user's own contributions, pledges, welfare and quick
 * actions. Compact summary — full views live in /my-giving.
 */
export default function MySection() {
  const { profile } = useAuth();
  const [member, setMember] = useState(null);
  const [contribs, setContribs] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [welfare, setWelfare] = useState([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    async function load() {
      setLoading(true);

      // 1. Find the linked member record
      const { data: m } = await supabase
        .from('members')
        .select('id, full_name, membership_no, joined_on, welfare_groups(name)')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!active) return;

      if (!m) {
        setMember(null);
        setLoading(false);
        return;
      }

      // 2. Personal data in parallel
      const [{ data: c }, { data: p }, { data: w }, { count: nCount }] = await Promise.all([
        supabase.from('contributions')
          .select('id, amount, contribution_type, contribution_date, reference_no, verification_status, rejection_reason, recorded_by')
          .eq('member_id', m.id)
          .order('contribution_date', { ascending: false })
          .limit(5),
        supabase.from('pledges')
          .select('id, purpose, pledge_amount, paid_amount, status, due_date, projects(name)')
          .eq('member_id', m.id)
          .in('status', ['open', 'partial'])
          .order('pledge_date', { ascending: false })
          .limit(3),
        supabase.from('welfare_requests')
          .select('id, request_no, title, status, amount_requested, amount_disbursed, submitted_at')
          .eq('member_id', m.id)
          .order('submitted_at', { ascending: false })
          .limit(3),
        supabase.from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .is('read_at', null),
      ]);

      if (!active) return;
      setMember(m);
      setContribs(c || []);
      setPledges(p || []);
      setWelfare(w || []);
      setUnreadNotifs(nCount || 0);
      setLoading(false);
    }

    load();
    return () => { active = false; };
  }, [profile?.id]);

  if (loading) return (
    <div className="card-padded flex justify-center py-12">
      <LoadingSpinner label="Loading your records…" />
    </div>
  );

  if (!member) {
    return (
      <div className="card-padded text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cream-200 text-ink-600 mb-3">
          <AlertCircle size={22} strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-lg font-semibold mb-1">No member record linked</h3>
        <p className="text-sm text-ink-600 max-w-sm mx-auto">
          Your account isn't yet linked to a member record. Please ask an administrator to link you so your personal records show up here.
        </p>
      </div>
    );
  }

  const totalConfirmed = contribs
    .filter((c) => c.verification_status === 'confirmed')
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const pendingCount = contribs.filter((c) => c.verification_status === 'pending').length;
  const openPledgeTotal = pledges.reduce(
    (s, p) => s + (Number(p.pledge_amount || 0) - Number(p.paid_amount || 0)),
    0
  );
  const openWelfare = welfare.filter((w) => !['closed', 'rejected'].includes(w.status));

  return (
    <div className="space-y-5">
      {/* Identity strip */}
      <div className="card-padded paper-grain flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar
          src={profile?.avatar_url}
          name={member.full_name}
          size="2xl"
          className="!rounded-2xl !w-14 !h-14 !text-xl"
        />
        <div className="flex-1 min-w-0">
          <p className="kicker">{member.membership_no}</p>
          <h2 className="font-display text-xl font-semibold">{member.full_name}</h2>
          <p className="text-xs text-ink-600">
            {member.welfare_groups?.name && `${member.welfare_groups.name} · `}
            Member since {formatDate(member.joined_on)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/my-giving" className="btn-primary">
            <Plus size={14}/> Record contribution
          </Link>
          <Link to="/welfare/new" className="btn-secondary">
            <HeartHandshake size={14}/> Welfare request
          </Link>
          <Link to={`/statements/${member.id}`} className="btn-ghost">
            <FileText size={14}/> Statement
          </Link>
        </div>
      </div>

      {/* Personal stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Wallet}
          label="My Recent Giving"
          value={formatMoney(totalConfirmed)}
          accent="primary"
          hint={pendingCount > 0 ? `${pendingCount} pending verification` : 'Last 5 confirmed'}
        />
        <StatCard
          icon={HandCoins}
          label="Open Pledges"
          value={pledges.length}
          accent="amber"
          hint={openPledgeTotal > 0 ? `${formatMoney(openPledgeTotal)} outstanding` : 'All fulfilled'}
        />
        <StatCard
          icon={HeartHandshake}
          label="Welfare Requests"
          value={welfare.length}
          accent="rose"
          hint={openWelfare.length > 0 ? `${openWelfare.length} in progress` : 'None active'}
        />
        <StatCard
          icon={BellRing}
          label="Unread Alerts"
          value={unreadNotifs}
          accent="blue"
        />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent contributions */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold">Recent contributions</h3>
            <Link to="/my-giving" className="text-xs font-medium text-primary-900 hover:text-primary-700 inline-flex items-center gap-1">
              View all <ChevronRight size={12}/>
            </Link>
          </div>
          {contribs.length === 0 ? (
            <div className="text-sm text-ink-600">
              <p>No contributions yet.</p>
              <Link to="/my-giving" className="text-primary-900 hover:text-primary-700 font-medium inline-block mt-2">
                Record your first →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-cream-200">
              {contribs.map((c) => {
                const v = VERIFICATION_STATUS[c.verification_status] || VERIFICATION_STATUS.confirmed;
                return (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 capitalize flex items-center gap-2 flex-wrap">
                        {CONTRIBUTION_TYPES.find((t) => t.value === c.contribution_type)?.label || c.contribution_type}
                        {c.verification_status !== 'confirmed' && (
                          <span className={v.className}>{v.icon} {v.label}</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-600">
                        {formatDate(c.contribution_date)}
                        {c.reference_no && ` · ${c.reference_no}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className={`font-semibold whitespace-nowrap ${c.verification_status === 'confirmed' ? 'text-primary-900' : 'text-ink-600'}`}>
                        {formatMoney(c.amount)}
                      </p>
                      {c.verification_status === 'confirmed' && (
                        <Link to={`/receipt/${c.id}`} title="Print receipt"
                          className="p-1.5 rounded-lg text-ink-500 hover:bg-cream-100 hover:text-primary-900 transition">
                          <Printer size={12}/>
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Active pledges */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold">My active pledges</h3>
            <Link to="/pledges" className="text-xs font-medium text-primary-900 hover:text-primary-700 inline-flex items-center gap-1">
              All pledges <ChevronRight size={12}/>
            </Link>
          </div>
          {pledges.length === 0 ? (
            <p className="text-sm text-ink-600">No open pledges.</p>
          ) : (
            <ul className="space-y-3">
              {pledges.map((p) => {
                const pct = p.pledge_amount > 0 ? Math.min(100, (p.paid_amount / p.pledge_amount) * 100) : 0;
                return (
                  <li key={p.id} className="border-l-2 border-accent-400 pl-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-ink-900 text-sm">{p.purpose}</p>
                      <span className={PLEDGE_STATUS[p.status]?.className || 'badge-slate'}>
                        {PLEDGE_STATUS[p.status]?.label || p.status}
                      </span>
                    </div>
                    {p.projects?.name && <p className="text-xs text-ink-600 mb-1">{p.projects.name}</p>}
                    <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden mb-1">
                      <div className="h-full bg-primary-700 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-ink-700">
                      {formatMoney(p.paid_amount)} of {formatMoney(p.pledge_amount)} · {pct.toFixed(0)}%
                      {p.due_date && ` · due ${formatDate(p.due_date)}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Welfare history */}
        <div className="card-padded lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold">My welfare requests</h3>
            <Link to="/welfare/new" className="text-xs font-medium text-primary-900 hover:text-primary-700 inline-flex items-center gap-1">
              New request <ChevronRight size={12}/>
            </Link>
          </div>
          {welfare.length === 0 ? (
            <p className="text-sm text-ink-600">No welfare requests yet.</p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {welfare.map((w) => (
                <li key={w.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <Link to={`/welfare/${w.id}`} className="min-w-0 hover:text-primary-700">
                    <p className="font-medium text-ink-900">{w.title}</p>
                    <p className="text-xs text-ink-600 font-mono">{w.request_no} · {formatDate(w.submitted_at)}</p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-primary-900">{formatMoney(w.amount_requested)}</span>
                    <span className={WELFARE_STATUS[w.status]?.className || 'badge-slate'}>
                      {WELFARE_STATUS[w.status]?.label || w.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
