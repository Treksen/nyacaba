import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { BarChart3, FileSpreadsheet, FileText, TrendingUp, TrendingDown, Users, Wallet, HeartHandshake, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatDate } from '../../lib/format';
import { CONTRIBUTION_TYPES, MONTHS, WELFARE_CATEGORIES } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const COLORS = ['#0F4A3C', '#D4A24E', '#3f8a78', '#ad6b2a', '#5fa692', '#dec077', '#214740', '#c98a35'];

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [year, setYear]           = useState(currentYear);
  const [loading, setLoading]     = useState(true);
  const [summary, setSummary]     = useState({});
  const [byMonth, setByMonth]     = useState([]);
  const [byType, setByType]       = useState([]);
  const [welfareByCat, setWelfareByCat] = useState([]);
  const [expensesByCat, setExpensesByCat] = useState([]);
  const [projectsSummary, setProjectsSummary] = useState([]);
  const [topContributors, setTopContributors] = useState([]);
  const [memberGrowth, setMemberGrowth] = useState([]);
  const [welfareStats, setWelfareStats] = useState({});
  const [meetingStats, setMeetingStats] = useState({});
  const [pendingContribs, setPendingContribs] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const start = `${year}-01-01`;
      const end   = `${year}-12-31`;

      const [
        { data: contribs },
        { data: contribsPending },
        { data: welfare },
        { data: projExpenses },
        { data: genExpenses },
        { data: projects },
        { data: members },
        { data: meetings },
        { data: attendance },
        { data: allMembers },
      ] = await Promise.all([
        supabase.from('contributions')
          .select('amount, contribution_type, contribution_date, member_id, members(full_name)')
          .eq('verification_status', 'confirmed')
          .gte('contribution_date', start).lte('contribution_date', end),
        supabase.from('contributions')
          .select('id', { count: 'exact', head: true })
          .eq('verification_status', 'pending'),
        supabase.from('welfare_requests')
          .select('category, amount_requested, amount_disbursed, status, submitted_at')
          .gte('submitted_at', start).lte('submitted_at', end),
        supabase.from('project_expenses')
          .select('amount, project_id, projects(name)').gte('expense_date', start).lte('expense_date', end),
        supabase.from('expenses')
          .select('amount, expense_categories(name)').eq('status', 'approved')
          .gte('expense_date', start).lte('expense_date', end),
        supabase.from('projects')
          .select('id, name, status, budget, start_date, end_date'),
        supabase.from('members')
          .select('id, status, joined_on, created_at')
          .gte('created_at', start).lte('created_at', end),
        supabase.from('meetings')
          .select('id, title, meeting_date, status')
          .gte('meeting_date', start).lte('meeting_date', end),
        supabase.from('meeting_attendance')
          .select('meeting_id, status'),
        supabase.from('members')
          .select('id, status'),
      ]);

      if (!active) return;

      // ---- CONTRIBUTIONS ----
      const months = MONTHS.map((name) => ({ name: name.slice(0, 3), total: 0, out: 0 }));
      (contribs || []).forEach((c) => {
        const m = new Date(c.contribution_date).getUTCMonth();
        months[m].total += Number(c.amount || 0);
      });

      const typeMap = {};
      (contribs || []).forEach((c) => {
        typeMap[c.contribution_type] = (typeMap[c.contribution_type] || 0) + Number(c.amount || 0);
      });
      const typeData = Object.entries(typeMap)
        .map(([k, v]) => ({ name: CONTRIBUTION_TYPES.find((t) => t.value === k)?.label || k, value: v }))
        .sort((a, b) => b.value - a.value);

      const memberMap = {};
      (contribs || []).forEach((c) => {
        const name = c.members?.full_name || 'Unknown';
        memberMap[name] = (memberMap[name] || 0) + Number(c.amount || 0);
      });
      const top = Object.entries(memberMap)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total).slice(0, 10);

      const totalContrib = (contribs || []).reduce((s, c) => s + Number(c.amount || 0), 0);

      // ---- WELFARE ----
      const welfareMap = {};
      (welfare || []).forEach((w) => {
        welfareMap[w.category] = (welfareMap[w.category] || 0) + Number(w.amount_disbursed || 0);
      });
      const welfareData = Object.entries(welfareMap)
        .map(([k, v]) => ({ name: WELFARE_CATEGORIES?.find((c) => c.value === k)?.label || k, value: v }))
        .sort((a, b) => b.value - a.value);

      const totalWelfare     = (welfare || []).reduce((s, w) => s + Number(w.amount_disbursed || 0), 0);
      const welfareRequested = (welfare || []).reduce((s, w) => s + Number(w.amount_requested || 0), 0);
      const welfareApproved  = (welfare || []).filter((w) => ['approved', 'disbursed', 'closed'].includes(w.status)).length;
      const welfareRejected  = (welfare || []).filter((w) => w.status === 'rejected').length;
      const welfarePending   = (welfare || []).filter((w) => w.status === 'pending').length;

      // Add welfare to monthly out
      (welfare || []).filter((w) => w.amount_disbursed > 0).forEach((w) => {
        const m = new Date(w.submitted_at).getUTCMonth();
        months[m].out += Number(w.amount_disbursed || 0);
      });

      // ---- GENERAL EXPENSES ----
      const genMap = {};
      (genExpenses || []).forEach((e) => {
        const name = e.expense_categories?.name || 'Uncategorized';
        genMap[name] = (genMap[name] || 0) + Number(e.amount || 0);
      });
      const genData = Object.entries(genMap)
        .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      const totalGenExpenses = (genExpenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

      // Add general expenses to monthly out
      (genExpenses || []).forEach(() => {}); // already totalled above

      // ---- PROJECT EXPENSES ----
      const projMap = {};
      (projExpenses || []).forEach((e) => {
        const name = e.projects?.name || 'Unknown Project';
        projMap[name] = (projMap[name] || 0) + Number(e.amount || 0);
      });
      const totalProjExpenses = (projExpenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

      // projects with budget vs spent
      const projSummary = (projects || []).map((p) => {
        const spent = (projExpenses || [])
          .filter((e) => e.project_id === p.id)
          .reduce((s, e) => s + Number(e.amount || 0), 0);
        return { name: p.name, budget: Number(p.budget || 0), spent, status: p.status };
      }).filter((p) => p.budget > 0 || p.spent > 0);

      const totalOut = totalWelfare + totalGenExpenses + totalProjExpenses;

      // ---- MEMBER GROWTH ----
      const growthMap = {};
      MONTHS.forEach((_, i) => { growthMap[i] = 0; });
      (members || []).forEach((m) => {
        const mo = new Date(m.created_at).getUTCMonth();
        growthMap[mo] = (growthMap[mo] || 0) + 1;
      });
      const growthData = MONTHS.map((name, i) => ({ name: name.slice(0, 3), new: growthMap[i] || 0 }));

      // ---- MEETINGS ----
      const totalMeetings = (meetings || []).length;
      const attendedMap   = {};
      (attendance || []).forEach((a) => {
        if (a.status === 'present') attendedMap[a.meeting_id] = (attendedMap[a.meeting_id] || 0) + 1;
      });
      const avgAttendance = totalMeetings > 0
        ? Math.round(Object.values(attendedMap).reduce((s, v) => s + v, 0) / totalMeetings)
        : 0;

      // ---- SET STATE ----
      setByMonth(months);
      setByType(typeData);
      setWelfareByCat(welfareData);
      setExpensesByCat(genData);
      setProjectsSummary(projSummary);
      setTopContributors(top);
      setMemberGrowth(growthData);
      setPendingContribs(contribsPending || 0);
      setWelfareStats({
        total: (welfare || []).length,
        approved: welfareApproved,
        rejected: welfareRejected,
        pending: welfarePending,
        requested: welfareRequested,
        disbursed: totalWelfare,
      });
      setMeetingStats({ total: totalMeetings, avgAttendance });
      setSummary({
        totalContrib,
        totalWelfare,
        totalGenExpenses,
        totalProjExpenses,
        totalOut,
        netPosition: totalContrib - totalOut,
        contribCount: (contribs || []).length,
        activeMembers: (allMembers || []).filter((m) => m.status === 'active').length,
        newMembers: (members || []).length,
      });
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [year]);

  // ---- EXPORT helpers (inline lightweight CSV) ----
  function exportCSV() {
    const rows = [
      [`${(typeof CHURCH_NAME !== 'undefined' ? CHURCH_NAME : 'Nyacaba')} Annual Report — ${year}`],
      ['Generated', new Date().toLocaleString()], [''],
      ['SUMMARY'],
      ['Total Contributions', summary.totalContrib],
      ['Welfare Disbursed', summary.totalWelfare],
      ['General Expenses', summary.totalGenExpenses],
      ['Project Expenses', summary.totalProjExpenses],
      ['Total Out', summary.totalOut],
      ['Net Position', summary.netPosition], [''],
      ['MONTHLY'], ['Month', 'Contributions'],
      ...byMonth.map((m) => [m.name, m.total]), [''],
      ['BY TYPE'], ['Type', 'Amount'],
      ...byType.map((t) => [t.name, t.value]), [''],
      ['WELFARE'], ['Category', 'Disbursed'],
      ...welfareByCat.map((w) => [w.name, w.value]), [''],
      ['GENERAL EXPENSES'], ['Category', 'Amount'],
      ...expensesByCat.map((e) => [e.name, e.value]), [''],
      ['TOP CONTRIBUTORS'], ['Member', 'Total'],
      ...topContributors.map((c) => [c.name, c.total]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `report-${year}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  const net = summary.netPosition || 0;

  return (
    <>
      <PageHeader
        kicker="Annual Report"
        title="Reports"
        description="Full financial and operational overview for the selected year."
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <select className="input !w-auto" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={exportCSV} disabled={loading} className="btn-secondary">
              <FileSpreadsheet size={16}/> CSV
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="card-padded flex justify-center py-16"><LoadingSpinner label="Building report…"/></div>
      ) : (
        <div className="space-y-6">

          {/* ====== KPI STRIP ====== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Wallet} label="Total In" value={formatMoney(summary.totalContrib)} sub={`${summary.contribCount} entries`} color="emerald"/>
            <KpiCard icon={Wallet} label="Total Out" value={formatMoney(summary.totalOut)} sub="welfare + expenses + projects" color="rose"/>
            <KpiCard icon={Users} label="Active Members" value={summary.activeMembers} sub={`+${summary.newMembers} joined this year`} color="primary"/>
            <div className={`card-padded flex flex-col justify-between`}>
              <p className="kicker mb-1 flex items-center gap-1">
                {net >= 0 ? <TrendingUp size={12} className="text-emerald-700"/> : <TrendingDown size={12} className="text-rose-700"/>}
                Net Position
              </p>
              <p className={`font-display text-2xl font-semibold ${net >= 0 ? 'text-primary-900' : 'text-rose-700'}`}>
                {net < 0 ? '−' : ''}{formatMoney(Math.abs(net))}
              </p>
            </div>
          </div>

          {/* ====== OUTFLOW BREAKDOWN ====== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard icon={HeartHandshake} label="Welfare Disbursed" value={formatMoney(summary.totalWelfare)} sub={`${welfareStats.total} requests`} color="amber"/>
            <KpiCard icon={BarChart3} label="General Expenses" value={formatMoney(summary.totalGenExpenses)} sub="approved expenses" color="amber"/>
            <KpiCard icon={Package} label="Project Expenses" value={formatMoney(summary.totalProjExpenses)} sub={`${projectsSummary.length} projects`} color="amber"/>
          </div>

          {/* ====== MONTHLY IN vs OUT ====== */}
          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4">Monthly — Contributions vs Welfare Out</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}/>
                  <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ fontSize: 12 }}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Bar dataKey="total" name="Contributions" fill="#0F4A3C" radius={[4,4,0,0]}/>
                  <Bar dataKey="out" name="Welfare Out" fill="#D4A24E" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ====== CONTRIBUTION TYPE + WELFARE CATEGORY ====== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Contributions by Type</h3>
              {byType.length === 0 ? <EmptyMsg text="No confirmed contributions this year."/> : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
                          {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v) => formatMoney(v)}/>
                        <Legend wrapperStyle={{ fontSize: 11 }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {byType.map((t) => (
                      <li key={t.name} className="flex justify-between text-sm">
                        <span className="text-ink-700">{t.name}</span>
                        <span className="font-semibold text-primary-900">{formatMoney(t.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Welfare by Category</h3>
              {welfareByCat.length === 0 ? <EmptyMsg text="No welfare disbursements this year."/> : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={welfareByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
                          {welfareByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v) => formatMoney(v)}/>
                        <Legend wrapperStyle={{ fontSize: 11 }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {welfareByCat.map((w) => (
                      <li key={w.name} className="flex justify-between text-sm">
                        <span className="text-ink-700">{w.name}</span>
                        <span className="font-semibold text-rose-700">{formatMoney(w.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* ====== WELFARE STATS ====== */}
          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4">Welfare Requests — {year}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <StatBox label="Total Requests" value={welfareStats.total}/>
              <StatBox label="Approved" value={welfareStats.approved} valueColor="text-emerald-700"/>
              <StatBox label="Rejected" value={welfareStats.rejected} valueColor="text-rose-700"/>
              <StatBox label="Pending" value={welfareStats.pending} valueColor="text-amber-700"/>
              <StatBox label="Amount Requested" value={formatMoney(welfareStats.requested)}/>
            </div>
            {welfareStats.requested > 0 && (
              <div className="mt-3">
                <p className="text-xs text-ink-600 mb-1">
                  Disbursement rate: <strong>{Math.round((welfareStats.disbursed / welfareStats.requested) * 100)}%</strong> of requested amount disbursed
                </p>
                <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                  <div
                    className="h-full bg-primary-700 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((welfareStats.disbursed / welfareStats.requested) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ====== GENERAL EXPENSES ====== */}
          {expensesByCat.length > 0 && (
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">General Expenses by Category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expensesByCat} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" horizontal={false}/>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}/>
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false} width={100}/>
                    <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ fontSize: 12 }}/>
                    <Bar dataKey="value" name="Amount" fill="#D4A24E" radius={[0,6,6,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ====== PROJECTS ====== */}
          {projectsSummary.length > 0 && (
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Projects — Budget vs Spent</h3>
              <ul className="space-y-3">
                {projectsSummary.map((p) => {
                  const pct = p.budget > 0 ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0;
                  const over = p.budget > 0 && p.spent > p.budget;
                  return (
                    <li key={p.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-ink-900">{p.name}
                          <span className={`ml-2 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full ${
                            p.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            p.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-cream-200 text-ink-600'
                          }`}>{p.status}</span>
                        </span>
                        <span className={over ? 'text-rose-700 font-semibold' : 'text-ink-700'}>
                          {formatMoney(p.spent)} {p.budget > 0 && `/ ${formatMoney(p.budget)}`}
                        </span>
                      </div>
                      {p.budget > 0 && (
                        <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                          <div className={`h-full rounded-full ${over ? 'bg-rose-500' : 'bg-primary-700'}`} style={{ width: `${pct}%` }}/>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ====== TOP CONTRIBUTORS ====== */}
          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4">Top 10 Contributors — {year}</h3>
            {topContributors.length === 0 ? <EmptyMsg text="No confirmed contributions this year."/> : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topContributors} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" horizontal={false}/>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}/>
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false} width={120}/>
                    <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ fontSize: 12 }}/>
                    <Bar dataKey="total" name="Total Given" fill="#0F4A3C" radius={[0,6,6,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ====== MEMBER GROWTH ====== */}
          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-1">New Members by Month — {year}</h3>
            <p className="text-xs text-ink-600 mb-4">{summary.newMembers} new member{summary.newMembers !== 1 ? 's' : ''} joined this year</p>
            {summary.newMembers === 0 ? <EmptyMsg text="No new members joined this year."/> : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={memberGrowth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false}/>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false}/>
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ fontSize: 12 }}/>
                    <Bar dataKey="new" name="New Members" fill="#3f8a78" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ====== MEETINGS + PENDING ALERTS ====== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Meetings — {year}</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Meetings Held" value={meetingStats.total}/>
                <StatBox label="Avg Attendance" value={meetingStats.avgAttendance} sub="per meeting"/>
              </div>
            </div>
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Pending Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Pending Contributions" value={pendingContribs} valueColor={pendingContribs > 0 ? 'text-amber-700' : undefined} sub="awaiting verification"/>
                <StatBox label="Pending Welfare" value={welfareStats.pending} valueColor={welfareStats.pending > 0 ? 'text-amber-700' : undefined} sub="awaiting decision"/>
              </div>
            </div>
          </div>

        </div>
      )}
    </>
  );
}

// ---- Small reusable components ----
function KpiCard({ icon: Icon, label, value, sub, color = 'primary' }) {
  const colors = {
    primary: 'text-primary-900',
    emerald: 'text-emerald-700',
    rose:    'text-rose-700',
    amber:   'text-amber-700',
  };
  return (
    <div className="card-padded">
      <p className="kicker mb-1 flex items-center gap-1.5">
        {Icon && <Icon size={12}/>} {label}
      </p>
      <p className={`font-display text-2xl font-semibold ${colors[color] || 'text-ink-900'}`}>{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatBox({ label, value, valueColor, sub }) {
  return (
    <div className="bg-cream-100 rounded-xl p-3">
      <p className="kicker mb-0.5">{label}</p>
      <p className={`font-display text-xl font-semibold ${valueColor || 'text-ink-900'}`}>{value ?? 0}</p>
      {sub && <p className="text-[11px] text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyMsg({ text }) {
  return <p className="text-sm text-ink-500 py-4 text-center">{text}</p>;
}
