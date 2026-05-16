import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { CONTRIBUTION_TYPES } from '../../lib/constants';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Church-wide finance transparency widget.
 *
 * Calls church_finance_summary() — aggregates only, no member identities.
 * Suitable to show to every approved member.
 */
const PERIODS = [
  { key: 'day',   label: 'Day',   sub: 'Last 14 days' },
  { key: 'week',  label: 'Week',  sub: 'Last 12 weeks (Sun–Sat)' },
  { key: 'month', label: 'Month', sub: 'Last 12 months' },
  { key: 'year',  label: 'Year',  sub: 'Last 5 years' },
];

const PERIOD_COLOR = {
  day:   '#D4A24E',
  week:  '#0F4A3C',
  month: '#0F4A3C',
  year:  '#7C3AED',
};

export default function ChurchFinances() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: result, error } = await supabase.rpc('church_finance_summary');
      if (active) {
        if (!error) setData(result);
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // Normalize the selected period's data into { label, total } pairs
  const chartData = useMemo(() => {
    if (!data) return [];
    switch (period) {
      case 'day':   return (data.daily_breakdown   || []).map((d) => ({ label: d.label, total: Number(d.total || 0) }));
      case 'week':  return (data.weekly_breakdown  || []).map((d) => ({ label: d.label, total: Number(d.total || 0) }));
      case 'month': return (data.monthly_breakdown || []).map((d) => ({ label: d.month, total: Number(d.total || 0) }));
      case 'year':  return (data.yearly_breakdown  || []).map((d) => ({ label: d.label, total: Number(d.total || 0) }));
      default:      return [];
    }
  }, [period, data]);

  if (loading) return (
    <div className="card-padded flex justify-center py-10">
      <LoadingSpinner label="Loading church totals…" />
    </div>
  );

  if (!data) return null;

  // KPI deltas
  const thisMonth = Number(data.this_month_total || 0);
  const lastMonth = Number(data.last_month_total || 0);
  const monthChange = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
  const TrendIcon = monthChange === null ? null : monthChange >= 0 ? TrendingUp : TrendingDown;

  // Type breakdown list
  const types = data.type_breakdown || {};
  const typeList = Object.entries(types)
    .map(([key, val]) => ({
      key,
      label: CONTRIBUTION_TYPES.find((t) => t.value === key)?.label || key,
      total: Number(val || 0),
    }))
    .sort((a, b) => b.total - a.total);

  const periodMeta = PERIODS.find((p) => p.key === period) || PERIODS[2];
  const periodColor = PERIOD_COLOR[period];

  return (
    <div className="card-padded">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="kicker">Welfare finances</p>
          {/* <h3 className="font-display text-xl font-semibold"></h3> */}
          <p className="text-xs text-ink-600 mt-0.5">
            Aggregate giving totals and trends across the Team. 
          </p>
        </div>
      </div>

      {/* KPI stat strip — today / week / month / year */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">Today</p>
          <p className="font-display text-xl font-semibold text-primary-900">
            {formatMoney(data.today_total)}
          </p>
        </div>
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">This Week</p>
          <p className="font-display text-xl font-semibold text-primary-900">
            {formatMoney(data.this_week_total)}
          </p>
          <p className="text-[11px] text-ink-500 mt-0.5">since Sunday</p>
        </div>
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">This Month</p>
          <p className="font-display text-xl font-semibold text-primary-900">
            {formatMoney(thisMonth)}
          </p>
          {TrendIcon && (
            <p
              className={`text-xs flex items-center gap-1 mt-0.5 ${monthChange >= 0 ? "text-primary-700" : "text-rose-700"}`}
            >
              <TrendIcon size={12} /> {monthChange >= 0 ? "+" : ""}
              {monthChange.toFixed(0)}% vs last
            </p>
          )}
        </div>
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">This Year</p>
          <p className="font-display text-xl font-semibold text-primary-900">
            {formatMoney(data.this_year_total)}
          </p>
        </div>
      </div>

      {/* Member count strip */}
      <div className="mt-3 flex items-center gap-3 text-xs text-ink-600">
        <span>
          <strong className="text-ink-900">{data.active_members}</strong> active
          member{data.active_members === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span>{data.total_members} on roll</span>
      </div>

      {/* Period toggle + trend chart */}
      <div className="mt-5">
        <div className="flex items-end justify-between mb-2 flex-wrap gap-2">
          <div>
            <p className="kicker">Trend</p>
            <p className="text-xs text-ink-500">{periodMeta.sub}</p>
          </div>
          <div className="inline-flex bg-cream-100 rounded-xl p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  period === p.key
                    ? "bg-white text-primary-900 shadow-sm"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-ink-500 bg-cream-50 rounded-lg">
            No confirmed contributions in this period yet.
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E8DFD0"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#6E6555" }}
                  axisLine={false}
                  tickLine={false}
                  interval={period === "day" ? 1 : 0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6E6555" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v
                  }
                />
                <Tooltip
                  formatter={(v) => formatMoney(v)}
                  labelClassName="!text-ink-900"
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={periodColor}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: periodColor, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Day-of-month deposit pattern (kept) */}
      {/* {(data.day_of_month_pattern?.length > 0) && (
        <div className="mt-5">
          <div className="flex items-end justify-between mb-2">
            <p className="kicker">Day of Month — When People Give</p>
            <p className="text-xs text-ink-500">Last 12 months</p>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.day_of_month_pattern} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#6E6555' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                  tickFormatter={(d) => String(d)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6E6555' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                />
                <Tooltip
                  formatter={(v) => formatMoney(v)}
                  labelFormatter={(d) => `Day ${d} of month`}
                  labelClassName="!text-ink-900"
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#D4A24E"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#D4A24E', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-ink-500 mt-1">
            Each dot is the total amount given on that day of the month, summed across the last 12 months.
            Helps the treasurer time monthly reminders.
          </p>
        </div>
      )} */}

      {/* Type breakdown — this year */}
      {typeList.length > 0 && (
        <div className="mt-5">
          <p className="kicker mb-2">This Year by Type</p>
          <ul className="space-y-1.5">
            {typeList.map((t) => {
              const pct =
                data.this_year_total > 0
                  ? (t.total / Number(data.this_year_total)) * 100
                  : 0;
              return (
                <li key={t.key} className="text-sm">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-ink-800">{t.label}</span>
                    <span className="font-semibold text-primary-900 tabular-nums">
                      {formatMoney(t.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
                    <div
                      className="h-full bg-primary-700 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
