import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Wallet,
  HandCoins,
  HeartHandshake,
  Hammer,
  Package,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Building2,
  UserCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatMoney, formatDate, timeAgo } from "../lib/format";
import { MONTHS, WELFARE_CATEGORIES } from "../lib/constants";
import StatCard from "../components/dashboard/StatCard";
import ChurchFinances from "../components/dashboard/ChurchFinances";
import MySection from "../components/dashboard/MySection";
import PageHeader from "../components/ui/PageHeader";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";

const CHART_COLORS = [
  "#0F4A3C",
  "#D4A24E",
  "#3f8a78",
  "#ad6b2a",
  "#5fa692",
  "#dec077",
  "#214740",
  "#c98a35",
];

export default function Dashboard() {
  const { profile, isAdminOrChair: isAdmin } = useAuth();
  const [tab, setTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [trend, setTrend] = useState([]);
  const [welfareBreakdown, setWelfareBreakdown] = useState([]);
  const [projectProgress, setProjectProgress] = useState([]);
  const [recentContrib, setRecentContrib] = useState([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (tab !== 'general') return; // lazy: load General data only when its tab is active
    let active = true;
    async function load() {
      setLoading(true);
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      // Run lookups in parallel; ignore errors silently and let cards show 0
      const [
        membersRes,
        monthCollectRes,
        pledgesRes,
        welfareRes,
        projectsRes,
        contribTrendRes,
        welfareCatRes,
        projectListRes,
        recentContribRes,
        meetingsRes,
        lowStockRes,
        announcementsRes,
      ] = await Promise.all([
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("contributions")
          .select("amount")
          .gte(
            "contribution_date",
            new Date(now.getFullYear(), now.getMonth(), 1)
              .toISOString()
              .slice(0, 10),
          ),
        supabase
          .from("pledges")
          .select("pledge_amount, paid_amount")
          .in("status", ["open", "partial"]),
        supabase
          .from("welfare_requests")
          .select("amount_disbursed")
          .eq("status", "disbursed"),
        supabase
          .from("projects")
          .select("id, status")
          .neq("status", "cancelled"),
        supabase
          .from("contributions")
          .select("amount, contribution_date")
          .gte("contribution_date", sixMonthsAgo.toISOString().slice(0, 10)),
        supabase
          .from("welfare_requests")
          .select("category, amount_disbursed")
          .gt("amount_disbursed", 0),
        supabase
          .from("project_progress")
          .select("id, name, budget, status, progress_pct")
          .order("id", { ascending: false })
          .limit(5),
        supabase
          .from("contributions")
          .select(
            "id, amount, contribution_type, contribution_date, members(full_name)",
          )
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("meetings")
          .select("id, title, meeting_date, status, location")
          .gte("meeting_date", new Date().toISOString())
          .order("meeting_date")
          .limit(3),
        supabase.from("v_low_stock_items").select("*").limit(5),
        supabase
          .from("announcements")
          .select("id, title, body, created_at, pinned")
          .eq("published", true)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (!active) return;

      const totalMembers = membersRes.count || 0;
      const monthCollections = (monthCollectRes.data || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0,
      );
      const pendingPledges = (pledgesRes.data || []).reduce(
        (sum, p) =>
          sum + (Number(p.pledge_amount || 0) - Number(p.paid_amount || 0)),
        0,
      );
      const welfareSpent = (welfareRes.data || []).reduce(
        (sum, w) => sum + Number(w.amount_disbursed || 0),
        0,
      );
      const activeProjects = (projectsRes.data || []).filter(
        (p) => p.status === "active",
      ).length;

      // Build 6-month trend
      const monthMap = new Map();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthMap.set(key, { name: MONTHS[d.getMonth()].slice(0, 3), total: 0 });
      }
      (contribTrendRes.data || []).forEach((c) => {
        const d = new Date(c.contribution_date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (monthMap.has(key)) {
          monthMap.get(key).total += Number(c.amount || 0);
        }
      });

      const catMap = new Map();
      (welfareCatRes.data || []).forEach((w) => {
        catMap.set(
          w.category,
          (catMap.get(w.category) || 0) + Number(w.amount_disbursed || 0),
        );
      });
      const wfBreakdown = Array.from(catMap.entries()).map(([k, v]) => ({
        name: WELFARE_CATEGORIES.find((c) => c.value === k)?.label || k,
        value: v,
      }));

      setStats({
        totalMembers,
        monthCollections,
        pendingPledges,
        welfareSpent,
        activeProjects,
      });
      setTrend(Array.from(monthMap.values()));
      setWelfareBreakdown(wfBreakdown);
      setProjectProgress(projectListRes.data || []);
      setRecentContrib(recentContribRes.data || []);
      setUpcomingMeetings(meetingsRes.data || []);
      setLowStock(lowStockRes.data || []);
      setAnnouncements(announcementsRes.data || []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [tab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner label="Gathering data…" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        kicker={`Hujambo, ${profile?.full_name?.split(" ")[1] || "rafiki"}`}
        title="Welcome to your dashboard"
        description="A snapshot of contributions, welfare, projects and the people you serve."
      />

      {/* Tab strip */}
      <div className="flex gap-2 mb-6 border-b border-cream-200">
        <button
          onClick={() => setTab('general')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            tab === 'general'
              ? 'text-primary-900 border-primary-900'
              : 'text-ink-600 border-transparent hover:text-ink-900'
          }`}
        >
          <Building2 size={16}/> Across The Team
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            tab === 'mine'
              ? 'text-primary-900 border-primary-900'
              : 'text-ink-600 border-transparent hover:text-ink-900'
          }`}
        >
          <UserCircle2 size={16}/> My Section
        </button>
      </div>

      {tab === 'mine' && <MySection />}

      {tab === 'general' && (
        <>
      {/* Public transparency widget — visible to all members. Shows aggregates only, never names. */}
      <div className="mb-8">
        <ChurchFinances />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Active Members"
          value={stats.totalMembers ?? 0}
        />
        <StatCard
          icon={Wallet}
          label="This Month"
          value={formatMoney(stats.monthCollections)}
          accent="accent"
        />
        <StatCard
          icon={HandCoins}
          label="Pending Pledges"
          value={formatMoney(stats.pendingPledges)}
          accent="amber"
        />
        <StatCard
          icon={HeartHandshake}
          label="Welfare Disbursed"
          value={formatMoney(stats.welfareSpent)}
          accent="rose"
        />
        <StatCard
          icon={Hammer}
          label="Active Projects"
          value={stats.activeProjects ?? 0}
          accent="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-8">
        <div className="card-padded xl:col-span-2">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="kicker">Trend</p>
              <h3 className="text-xl font-display font-semibold">
                Contribution flow · 6 months
              </h3>
            </div>
            <Link
              to="/contributions"
              className="text-sm font-medium text-primary-900 hover:text-primary-700 inline-flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F4A3C" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0F4A3C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="2 6"
                  stroke="#E4E8E5"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#5A6660" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#5A6660" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E4E8E5",
                    background: "#FAF7F2",
                  }}
                  formatter={(v) => formatMoney(v)}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#0F4A3C"
                  strokeWidth={2.5}
                  dot={{
                    r: 4,
                    fill: "#D4A24E",
                    strokeWidth: 2,
                    stroke: "#0F4A3C",
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-padded">
          <p className="kicker">Welfare Allocation</p>
          <h3 className="text-xl font-display font-semibold mb-4">
            Where support is going
          </h3>
          {welfareBreakdown.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-ink-500">
              No disbursements yet
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={welfareBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {welfareBreakdown.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-1.5 mt-3 text-xs">
            {welfareBreakdown.slice(0, 4).map((w, i) => (
              <div
                key={w.name}
                className="flex items-center justify-between text-ink-700"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  {w.name}
                </span>
                <span className="font-semibold">{formatMoney(w.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project progress + Recent contributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <div className="card-padded">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="kicker">Building Together</p>
              <h3 className="text-xl font-display font-semibold">
                Project progress
              </h3>
            </div>
            <Link
              to="/projects"
              className="text-sm font-medium text-primary-900 hover:text-primary-700 inline-flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          {projectProgress.length === 0 ? (
            <EmptyState
              icon={Hammer}
              title="No projects yet"
              description="Once admins set up church projects they'll appear here."
            />
          ) : (
            <div className="space-y-4">
              {projectProgress.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-medium text-ink-900 group-hover:text-primary-900 transition">
                      {p.name}
                    </p>
                    <span className="text-sm font-semibold text-primary-900">
                      {p.progress_pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-700 to-primary-900 rounded-full transition-all"
                      style={{ width: `${p.progress_pct}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card-padded">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="kicker">Latest</p>
              <h3 className="text-xl font-display font-semibold">
                Recent contributions
              </h3>
            </div>
            <Link
              to="/contributions"
              className="text-sm font-medium text-primary-900 hover:text-primary-700 inline-flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          {recentContrib.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No contributions yet"
              description={
                isAdmin
                  ? "Record your first one from the contributions page."
                  : "Contributions will appear here as they are recorded."
              }
            />
          ) : (
            <ul className="divide-y divide-cream-200">
              {recentContrib.map((c) => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 grid place-items-center text-primary-900 font-semibold text-sm">
                    {(c.members?.full_name || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-900 truncate">
                      {c.members?.full_name || "Member"}
                    </p>
                    <p className="text-xs text-ink-600">
                      {c.contribution_type} · {formatDate(c.contribution_date)}
                    </p>
                  </div>
                  <p className="font-semibold text-primary-900 whitespace-nowrap">
                    {formatMoney(c.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Upcoming meetings + Low stock + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card-padded">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={18} className="text-primary-900" />
            <h3 className="font-display font-semibold">Upcoming meetings</h3>
          </div>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-ink-600">No meetings scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingMeetings.map((m) => (
                <li key={m.id} className="border-l-2 border-accent-400 pl-3">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="text-sm font-semibold text-ink-900 hover:text-primary-900"
                  >
                    {m.title}
                  </Link>
                  <p className="text-xs text-ink-600">
                    {formatDate(m.meeting_date, "EEE, d MMM · HH:mm")}{" "}
                    {m.location && `· ${m.location}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-padded">
          <div className="flex items-center gap-2 mb-3">
            <Package size={18} className="text-primary-900" />
            <h3 className="font-display font-semibold">Low stock</h3>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-ink-600">
              All good — no items below reorder level.
            </p>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-ink-800">{i.name}</span>
                  <span className="badge-amber">
                    {i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-padded">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-primary-900" />
            <h3 className="font-display font-semibold">Announcements</h3>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-ink-600">No announcements yet.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id}>
                  <Link to="/announcements" className="block group">
                    <p className="font-semibold text-sm text-ink-900 group-hover:text-primary-900">
                      {a.pinned && "📌 "}
                      {a.title}
                    </p>
                    <p className="text-xs text-ink-600 line-clamp-2">
                      {a.body}
                    </p>
                    <p className="text-[11px] text-ink-500 mt-0.5">
                      {timeAgo(a.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
        </>
      )}
    </>
  );
}
