import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { CONTRIBUTION_TYPES, MONTHS, WELFARE_CATEGORIES } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const CHART_COLORS = ['#0F4A3C', '#D4A24E', '#3f8a78', '#ad6b2a', '#5fa692', '#dec077', '#214740', '#c98a35'];

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [byMonth, setByMonth] = useState([]);
  const [byType, setByType] = useState([]);
  const [welfareByCat, setWelfareByCat] = useState([]);
  const [topContributors, setTopContributors] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const [{ data: contribs }, { data: welfare }, { data: expenses }] = await Promise.all([
        supabase.from('contributions').select('amount, contribution_type, contribution_date, member_id, members(full_name)').eq('verification_status', 'confirmed').gte('contribution_date', startDate).lte('contribution_date', endDate),
        supabase.from('welfare_requests').select('category, amount_disbursed').gt('amount_disbursed', 0).gte('submitted_at', startDate).lte('submitted_at', endDate),
        supabase.from('project_expenses').select('amount').gte('expense_date', startDate).lte('expense_date', endDate),
      ]);

      if (!active) return;

      // by month
      const months = MONTHS.map((name, i) => ({ name: name.slice(0, 3), total: 0 }));
      (contribs || []).forEach((c) => {
        const m = new Date(c.contribution_date).getMonth();
        months[m].total += Number(c.amount || 0);
      });

      // by type
      const typeMap = {};
      (contribs || []).forEach((c) => {
        typeMap[c.contribution_type] = (typeMap[c.contribution_type] || 0) + Number(c.amount || 0);
      });
      const typeData = Object.entries(typeMap).map(([k, v]) => ({
        name: CONTRIBUTION_TYPES.find((t) => t.value === k)?.label || k,
        value: v,
      }));

      // welfare
      const welfareMap = {};
      (welfare || []).forEach((w) => {
        welfareMap[w.category] = (welfareMap[w.category] || 0) + Number(w.amount_disbursed || 0);
      });
      const welfareData = Object.entries(welfareMap).map(([k, v]) => ({
        name: WELFARE_CATEGORIES.find((c) => c.value === k)?.label || k,
        value: v,
      }));

      // top contributors
      const memberMap = {};
      (contribs || []).forEach((c) => {
        const name = c.members?.full_name || 'Unknown';
        memberMap[name] = (memberMap[name] || 0) + Number(c.amount || 0);
      });
      const top = Object.entries(memberMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10);

      const totalContrib = (contribs || []).reduce((s, c) => s + Number(c.amount || 0), 0);
      const totalWelfare = (welfare || []).reduce((s, w) => s + Number(w.amount_disbursed || 0), 0);
      const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

      setByMonth(months);
      setByType(typeData);
      setWelfareByCat(welfareData);
      setTopContributors(top);
      setSummary({
        totalContrib,
        totalWelfare,
        totalExpenses,
        netPosition: totalContrib - totalWelfare - totalExpenses,
        contribCount: (contribs || []).length,
      });
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [year]);

  function exportCSV() {
    const rows = [
      ['Nyacaba Welfare — Annual Report'],
      [`Year: ${year}`],
      [''],
      ['Summary'],
      ['Total contributions', summary.totalContrib],
      ['Total welfare disbursed', summary.totalWelfare],
      ['Total project expenses', summary.totalExpenses],
      ['Net position', summary.netPosition],
      [''],
      ['Monthly Collections'],
      ['Month', 'Amount'],
      ...byMonth.map((m) => [m.name, m.total]),
      [''],
      ['By Type'],
      ['Type', 'Amount'],
      ...byType.map((t) => [t.name, t.value]),
      [''],
      ['Top Contributors'],
      ['Member', 'Total'],
      ...topContributors.map((t) => [t.name, t.total]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nyacaba-report-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 5; y--) years.push(y);

  return (
    <>
      <PageHeader
        kicker="The Numbers"
        title="Reports"
        description={`Annual summary for the year ${year}.`}
        action={
          <div className="flex gap-2">
            <select className="input !w-auto" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={exportCSV} className="btn-primary">
              <Download size={16}/> Export CSV
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner label="Crunching numbers…"/></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="card-padded">
              <p className="kicker">Contributions</p>
              <p className="font-display text-2xl font-semibold mt-1 text-primary-900">{formatMoney(summary.totalContrib)}</p>
              <p className="text-xs text-ink-600 mt-0.5">{summary.contribCount} entries</p>
            </div>
            <div className="card-padded">
              <p className="kicker">Welfare Disbursed</p>
              <p className="font-display text-2xl font-semibold mt-1">{formatMoney(summary.totalWelfare)}</p>
            </div>
            <div className="card-padded">
              <p className="kicker">Project Expenses</p>
              <p className="font-display text-2xl font-semibold mt-1">{formatMoney(summary.totalExpenses)}</p>
            </div>
            <div className="card-padded">
              <p className="kicker">Net Position</p>
              <p className={`font-display text-2xl font-semibold mt-1 ${summary.netPosition < 0 ? 'text-rose-700' : 'text-primary-900'}`}>
                {formatMoney(summary.netPosition)}
              </p>
            </div>
          </div>

          <div className="card-padded mb-6">
            <h3 className="font-display text-lg font-semibold mb-4">Monthly contributions</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="2 6" stroke="#E4E8E5" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5A6660' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 12, fill: '#5A6660' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E4E8E5', background: '#FAF7F2' }} formatter={(v) => formatMoney(v)}/>
                  <Bar dataKey="total" fill="#0F4A3C" radius={[8, 8, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Contributions by type</h3>
              {byType.length === 0 ? <p className="text-sm text-ink-600">No data.</p> : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                        {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(v)}/>
                      <Legend/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Welfare by category</h3>
              {welfareByCat.length === 0 ? <p className="text-sm text-ink-600">No disbursements this year.</p> : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={welfareByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                        {welfareByCat.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(v)}/>
                      <Legend/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={18}/> Top contributors · {year}
            </h3>
            {topContributors.length === 0 ? <p className="text-sm text-ink-600">No contributions this year yet.</p> : (
              <ol className="divide-y divide-cream-200">
                {topContributors.map((c, i) => (
                  <li key={c.name} className="py-3 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-cream-200 text-ink-800 grid place-items-center font-display font-semibold text-sm">{i + 1}</span>
                    <span className="flex-1 font-medium text-ink-900">{c.name}</span>
                    <span className="font-semibold text-primary-900">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </>
  );
}
