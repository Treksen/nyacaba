import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { CONTRIBUTION_TYPES } from '../../lib/constants';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Church Finances transparency widget.
 * Calls the church_finance_summary() Postgres function which returns
 * aggregates only — NO member names, NO per-member amounts.
 * Suitable to show to every member.
 */
export default function ChurchFinances() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="card-padded flex justify-center py-10">
      <LoadingSpinner label="Loading church totals…" />
    </div>
  );

  if (!data) return null;

  const monthly = data.monthly_breakdown || [];
  const types = data.type_breakdown || {};
  const thisMonth = Number(data.this_month_total || 0);
  const lastMonth = Number(data.last_month_total || 0);
  const monthChange = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
  const TrendIcon = monthChange === null ? null : monthChange >= 0 ? TrendingUp : TrendingDown;

  // Build a friendly type breakdown list
  const typeList = Object.entries(types)
    .map(([key, val]) => ({
      key,
      label: CONTRIBUTION_TYPES.find((t) => t.value === key)?.label || key,
      total: Number(val || 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="card-padded">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="kicker">Church Transparency</p>
          <h3 className="font-display text-xl font-semibold">Church finances</h3>
          <p className="text-xs text-ink-600 mt-0.5">
            Aggregate giving — no individual amounts shown.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">This Year</p>
          <p className="font-display text-xl font-semibold text-primary-900">{formatMoney(data.this_year_total)}</p>
        </div>
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">This Month</p>
          <p className="font-display text-xl font-semibold text-primary-900">{formatMoney(thisMonth)}</p>
          {TrendIcon && (
            <p className={`text-xs flex items-center gap-1 mt-0.5 ${monthChange >= 0 ? 'text-primary-700' : 'text-rose-700'}`}>
              <TrendIcon size={12}/> {monthChange >= 0 ? '+' : ''}{monthChange.toFixed(0)}% vs last month
            </p>
          )}
        </div>
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">Last Month</p>
          <p className="font-display text-xl font-semibold text-ink-800">{formatMoney(lastMonth)}</p>
        </div>
        <div className="bg-cream-100 rounded-xl p-3">
          <p className="kicker mb-0.5">Active Members</p>
          <p className="font-display text-xl font-semibold text-primary-900">{data.active_members}</p>
          <p className="text-xs text-ink-500">of {data.total_members}</p>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="mt-4">
          <p className="kicker mb-2">Last 12 Months</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(v) => formatMoney(v)} labelClassName="!text-ink-900" />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#0F4A3C"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0F4A3C', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(data.day_of_month_pattern?.length > 0) && (
        <div className="mt-5">
          <div className="flex items-end justify-between mb-2">
            <p className="kicker">Day of Month — When People Give</p>
            <p className="text-xs text-ink-500">Last 12 months</p>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.day_of_month_pattern} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false}/>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#6E6555' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                  tickFormatter={(d) => String(d)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
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
            Each dot is the total amount given on that day of the month, summed across the last 12 months. Helps the treasurer time monthly reminders.
          </p>
        </div>
      )}

      {typeList.length > 0 && (
        <div className="mt-4">
          <p className="kicker mb-2">This Year by Type</p>
          <ul className="space-y-1.5">
            {typeList.map((t) => {
              const pct = data.this_year_total > 0 ? (t.total / Number(data.this_year_total)) * 100 : 0;
              return (
                <li key={t.key} className="text-sm">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-ink-800">{t.label}</span>
                    <span className="font-semibold text-primary-900 tabular-nums">{formatMoney(t.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
                    <div className="h-full bg-primary-700 rounded-full" style={{ width: `${pct}%` }} />
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
