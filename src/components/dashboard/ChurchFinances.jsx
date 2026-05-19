import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Wallet, Scale } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { CONTRIBUTION_TYPES } from '../../lib/constants';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Church-wide finance transparency widget.
 *
 * Calls church_finance_summary() — aggregates only, no member identities.
 * Shows separate Inflow / Outflow strips and the Net position.
 */
const PERIODS = [
  { key: 'day',   label: 'Day',   sub: 'Last 14 days' },
  { key: 'week',  label: 'Week',  sub: 'Last 12 weeks (Sun–Sat)' },
  { key: 'month', label: 'Month', sub: 'Last 12 months' },
  { key: 'year',  label: 'Year',  sub: 'Last 5 years' },
];

const OUTFLOW_SOURCE_META = {
  expenses: { label: 'General Expenses', color: '#D4A24E' },
  welfare:  { label: 'Welfare Disbursed', color: '#B45309' },
  projects: { label: 'Project Spending',  color: '#7C3AED' },
};

export default function ChurchFinances() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 640
  );

  // Track viewport for mobile-aware chart labels
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 640); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  // Normalize the selected period's data into { label, in, out, net } points
  const chartData = useMemo(() => {
    if (!data) return [];
    const arr =
      period === 'day'   ? data.daily_breakdown :
      period === 'week'  ? data.weekly_breakdown :
      period === 'month' ? data.monthly_breakdown :
      period === 'year'  ? data.yearly_breakdown : [];
    return (arr || []).map((d) => {
      const inVal  = Number(d.total || 0);
      const outVal = Number(d.out   || 0);
      return {
        label: d.label || d.month || '',
        in:  inVal,
        out: outVal,
        net: inVal - outVal,
      };
    });
  }, [period, data]);

  if (loading) return (
    <div className="card-padded flex justify-center py-10">
      <LoadingSpinner label="Loading church totals…" />
    </div>
  );
  if (!data) return null;

  const yearIn  = Number(data.this_year_total || 0);
  const yearOut = Number(data.this_year_out   || 0);
  const yearNet = yearIn - yearOut;

  const typeList = Object.entries(data.type_breakdown || {})
    .map(([key, val]) => ({
      key,
      label: CONTRIBUTION_TYPES.find((t) => t.value === key)?.label || key,
      total: Number(val || 0),
    }))
    .sort((a, b) => b.total - a.total);

  const outflowList = Object.entries(data.outflow_source_breakdown || {})
    .map(([key, val]) => ({
      key,
      label: OUTFLOW_SOURCE_META[key]?.label || key,
      color: OUTFLOW_SOURCE_META[key]?.color || '#8B7355',
      total: Number(val || 0),
    }))
    .sort((a, b) => b.total - a.total);

  const periodMeta = PERIODS.find((p) => p.key === period) || PERIODS[2];

  return (
    <div className="card-padded">
      <div>
        <p className="kicker">FINANCES</p>
        <h3 className="font-display text-xl font-semibold">Welfare finances</h3>
        <p className="text-xs text-ink-600 mt-0.5">
          Aggregate giving and spending.
        </p>
      </div>

      {/* ============ INFLOW STRIP ============ */}
      <div className="mt-5">
        <p className="kicker mb-2 flex items-center gap-1.5">
          <ArrowDown size={12} className="text-emerald-700"/>
          Money In
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Today"      value={data.today_total}      accent="emerald" />
          <StatTile label="This Week"  value={data.this_week_total}  accent="emerald" hint="since Sunday" />
          <StatTile label="This Month" value={data.this_month_total} accent="emerald" />
          <StatTile label="This Year"  value={yearIn}                accent="emerald" />
        </div>
      </div>

      {/* ============ OUTFLOW STRIP ============ */}
      <div className="mt-5">
        <p className="kicker mb-2 flex items-center gap-1.5">
          <ArrowUp size={12} className="text-rose-700"/>
          Money Out
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Today"      value={data.today_out}      accent="rose" />
          <StatTile label="This Week"  value={data.this_week_out}  accent="rose" hint="since Sunday" />
          <StatTile label="This Month" value={data.this_month_out} accent="rose" />
          <StatTile label="This Year"  value={yearOut}             accent="rose" />
        </div>
      </div>

      {/* ============ NET TOTAL ============ */}
      <div className="mt-5 bg-gradient-to-r from-primary-900 to-primary-800 text-cream-50 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cream-50/10 grid place-items-center">
            <Scale size={20}/>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-cream-200/70 font-semibold">
              Net This Year
            </p>
            <p className="text-[11px] text-cream-200/60">
              Contributions minus expenses, welfare and projects.
            </p>
          </div>
        </div>
        <p className={`font-display text-3xl font-semibold tabular-nums ${yearNet >= 0 ? 'text-cream-50' : 'text-rose-200'}`}>
          {yearNet >= 0 ? '' : '−'}{formatMoney(Math.abs(yearNet))}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-ink-600">
        <span><strong className="text-ink-900">{data.active_members}</strong> active member{data.active_members === 1 ? '' : 's'}</span>
        <span>·</span>
        <span>{data.total_members} on roll</span>
      </div>

      {/* ============ DUAL-LINE TREND ============ */}
      <div className="mt-5">
        <div className="flex items-end justify-between mb-2 flex-wrap gap-2">
          <div>
            <p className="kicker">Trend — In vs Out</p>
            <p className="text-xs text-ink-500">{periodMeta.sub}</p>
          </div>
          <div className="inline-flex bg-cream-100 rounded-xl p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  period === p.key
                    ? 'bg-white text-primary-900 shadow-sm'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-ink-500 bg-cream-50 rounded-lg">
            No activity in this period yet.
          </div>
        ) : (
          <div className={isMobile ? 'h-64' : 'h-56'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6E6555' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={isMobile ? 8 : 28}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? 'end' : 'middle'}
                  height={isMobile ? 50 : 30}
                  tickFormatter={(label) => {
                    if (!label) return '';
                    if (period === 'day') {
                      // "Dy DD Mon" → "Dy"   (e.g. "Wed 06 May" → "Wed")
                      const parts = String(label).split(/\s+/);
                      return parts[0] || label;
                    }
                    if (period === 'week') {
                      // "Wk DD Mon" → "DD Mon"
                      const parts = String(label).split(/\s+/);
                      return parts.slice(1).join(' ') || label;
                    }
                    if (period === 'month') {
                      // "May '26" → "May"
                      const parts = String(label).split(/\s+/);
                      return parts[0] || label;
                    }
                    return label;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6E6555' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                />
                <Tooltip
                  formatter={(v) => formatMoney(v)}
                  labelClassName="!text-ink-900"
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Line type="monotone" dataKey="in"  name="In"  stroke="#0F4A3C" strokeWidth={2.5} dot={{ r: 3, fill: '#0F4A3C', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="out" name="Out" stroke="#B45309" strokeWidth={2.5} dot={{ r: 3, fill: '#B45309', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ============ DAY-OF-MONTH PATTERN ============ */}
      {(data.day_of_month_pattern?.length > 0) && (
        <div className="mt-5">
          <div className="flex items-end justify-between mb-2">
            <p className="kicker">Day of Month — When People Give</p>
            <p className="text-xs text-ink-500">Last 12 months</p>
          </div>
          <div className={isMobile ? 'h-52' : 'h-44'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.day_of_month_pattern} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={isMobile ? 12 : 18} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 40 : 30} tickFormatter={(d) => String(d)} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6555' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(v) => formatMoney(v)} labelFormatter={(d) => `Day ${d} of month`} labelClassName="!text-ink-900" />
                <Line type="monotone" dataKey="total" stroke="#D4A24E" strokeWidth={2.5} dot={{ r: 3.5, fill: '#D4A24E', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ============ TWO BREAKDOWNS SIDE BY SIDE ============ */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {typeList.length > 0 && (
          <div>
            <p className="kicker mb-2">Contributions This Year by Type</p>
            <ul className="space-y-1.5">
              {typeList.map((t) => {
                const pct = yearIn > 0 ? (t.total / yearIn) * 100 : 0;
                return (
                  <li key={t.key} className="text-sm">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-ink-800">{t.label}</span>
                      <span className="font-semibold text-primary-900 tabular-nums">{formatMoney(t.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
                      <div className="h-full bg-emerald-700 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {outflowList.length > 0 && (
          <div>
            <p className="kicker mb-2">Spending This Year by Source</p>
            <ul className="space-y-1.5">
              {outflowList.map((o) => {
                const pct = yearOut > 0 ? (o.total / yearOut) * 100 : 0;
                return (
                  <li key={o.key} className="text-sm">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-ink-800">{o.label}</span>
                      <span className="font-semibold text-rose-700 tabular-nums">{formatMoney(o.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: o.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- StatTile sub-component ----------
function StatTile({ label, value, accent = 'emerald', hint }) {
  const valueColor = accent === 'rose' ? 'text-rose-700' : 'text-primary-900';
  return (
    <div className="bg-cream-100 rounded-xl p-3">
      <p className="kicker mb-0.5">{label}</p>
      <p className={`font-display text-xl font-semibold ${valueColor}`}>{formatMoney(value)}</p>
      {hint && <p className="text-[11px] text-ink-500 mt-0.5">{hint}</p>}
    </div>
  );
}
