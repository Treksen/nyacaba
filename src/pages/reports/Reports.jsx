import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, FileSpreadsheet, FileText, TrendingUp, TrendingDown, Users, Wallet, HeartHandshake, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/format';
import { CONTRIBUTION_TYPES, MONTHS, WELFARE_CATEGORIES } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const COLORS = ['#0F4A3C', '#D4A24E', '#3f8a78', '#ad6b2a', '#5fa692', '#dec077', '#214740', '#c98a35'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CHURCH = import.meta.env.VITE_CHURCH_NAME || 'Nyacaba';

export default function Reports() {
  const { isAdmin } = useAuth();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [year, setYear]             = useState(currentYear);
  const [loading, setLoading]       = useState(true);
  const [data, setData]             = useState(null);   // raw RPC result
  const [topContributors, setTopContributors] = useState([]);

  // Derived state from RPC data
  const summary        = data ? {
    totalContrib:     Number(data.total_contrib     || 0),
    contribCount:     Number(data.contrib_count     || 0),
    totalWelfare:     Number(data.total_welfare     || 0),
    totalGenExpenses: Number(data.total_gen_expenses|| 0),
    totalProjExpenses:Number(data.total_proj_expenses||0),
    totalOut:         Number(data.total_out         || 0),
    netPosition:      Number(data.total_contrib||0) - Number(data.total_out||0),
    activeMembers:    Number(data.active_members    || 0),
    newMembers:       Number(data.new_members       || 0),
  } : {};

  const welfareStats = data ? {
    total:     Number(data.welfare_total    || 0),
    approved:  Number(data.welfare_approved || 0),
    rejected:  Number(data.welfare_rejected || 0),
    pending:   Number(data.welfare_pending  || 0),
    requested: Number(data.welfare_requested|| 0),
    disbursed: Number(data.total_welfare    || 0),
  } : {};

  const meetingStats = data ? {
    total:         Number(data.total_meetings || 0),
    avgAttendance: Number(data.avg_attendance || 0),
  } : {};

  const pendingContribs = Number(data?.pending_contribs || 0);

  // Normalise monthly data
  const byMonth = data?.by_month
    ? data.by_month.map((m) => ({
        name:  MONTH_NAMES[Number(m.mo) - 1] || '',
        total: Number(m.total || 0),
        out:   Number(m.out   || 0),
      }))
    : [];

  // Normalise by_type
  const byType = (data?.by_type || []).map((t) => ({
    name:  CONTRIBUTION_TYPES.find((ct) => ct.value === t.type_key)?.label || t.type_key,
    value: Number(t.total || 0),
  })).sort((a, b) => b.value - a.value);

  // Welfare by category
  const welfareByCat = (data?.welfare_by_cat || []).map((w) => ({
    name:  WELFARE_CATEGORIES?.find((c) => c.value === w.category)?.label || w.category,
    value: Number(w.total || 0),
  }));

  // Expenses by category
  const expensesByCat = (data?.expenses_by_cat || []).map((e) => ({
    name:  e.category,
    value: Number(e.total || 0),
  }));

  // Projects
  const projectsSummary = (data?.projects || []).map((p) => ({
    name:   p.name,
    status: p.status,
    budget: Number(p.budget || 0),
    spent:  Number(p.spent  || 0),
  }));

  // Member growth
  const memberGrowth = (data?.member_growth || []).map((m) => ({
    name: MONTH_NAMES[Number(m.mo) - 1] || '',
    new:  Number(m.new || 0),
  }));

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);

      // All members use the SECURITY DEFINER RPC — returns church-wide aggregates
      const { data: rpc, error } = await supabase.rpc('reports_summary', { p_year: year });
      if (!active) return;
      if (!error) setData(rpc);

      // Top contributors — admin only (requires direct table access via RLS)
      if (isAdmin) {
        const start = `${year}-01-01`;
        const end   = `${year}-12-31`;
        const { data: contribs } = await supabase
          .from('contributions')
          .select('amount, members(full_name)')
          .eq('verification_status', 'confirmed')
          .gte('contribution_date', start)
          .lte('contribution_date', end);
        if (active && contribs) {
          const memberMap = {};
          contribs.forEach((c) => {
            const name = c.members?.full_name || 'Unknown';
            memberMap[name] = (memberMap[name] || 0) + Number(c.amount || 0);
          });
          setTopContributors(
            Object.entries(memberMap)
              .map(([name, total]) => ({ name, total }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 10)
          );
        }
      }

      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [year, isAdmin]);

  // ---- PDF: print current page with charts ----
  function handlePDF() {
    const existing = document.getElementById('nyacaba-print-style');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'nyacaba-print-style';
    style.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 12mm 10mm; }
        body * { visibility: hidden !important; }
        #nyacaba-report-root, #nyacaba-report-root * { visibility: visible !important; }
        #nyacaba-report-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
        #nyacaba-print-cover { visibility: visible !important; display: block !important; text-align: center; border-bottom: 3px solid #D4A24E; padding-bottom: 14px; margin-bottom: 18px; }
        #nyacaba-print-cover h1 { font-size: 20px; color: #0F4A3C; margin: 6px 0 3px; font-family: Georgia, serif; }
        #nyacaba-print-cover p  { color: #6b7280; font-size: 10px; margin: 2px 0; }
        .card-padded { border: 1px solid #e5e7eb !important; border-radius: 8px !important; padding: 10px !important; page-break-inside: avoid; box-shadow: none !important; background: #fff !important; margin-bottom: 12px; }
        .card-padded h3 { font-size: 11px !important; text-transform: uppercase; letter-spacing: .05em; color: #0F4A3C !important; text-align: center; border-bottom: 2px solid #D4A24E; padding-bottom: 3px; margin-bottom: 8px !important; }
        .kicker { font-size: 8px !important; color: #9ca3af !important; text-transform: uppercase; letter-spacing: .06em; }
        .font-display { font-family: Georgia, serif !important; }
        .recharts-wrapper, .recharts-surface { overflow: visible !important; }
        svg { overflow: visible !important; }
        .space-y-6 > * + * { margin-top: 12px; }
        .grid { display: grid !important; }
        .h-2 { height: 5px !important; }
      }
    `;
    document.head.appendChild(style);
    const root = document.getElementById('nyacaba-report-root');
    if (!root) return;
    const cover = document.createElement('div');
    cover.id = 'nyacaba-print-cover';
    cover.innerHTML = `
      <svg width="56" height="56" style="display:block;margin:0 auto 8px;" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="256" cy="256" r="250" fill="#064E3B"/>
        <circle cx="256" cy="256" r="210" stroke="#EAB54F" stroke-width="8" fill="none"/>
        <path d="M256 245C215 245 185 215 185 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
        <path d="M256 285C195 285 145 235 145 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
        <path d="M256 325C175 325 110 255 110 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
        <path d="M256 245C297 245 327 215 327 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
        <path d="M256 285C317 285 367 235 367 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
        <path d="M256 325C337 325 402 255 402 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
        <rect x="244" y="160" width="24" height="210" rx="12" fill="#EAB54F"/>
        <path d="M220 360H292C305 360 315 370 320 382H192C197 370 207 360 220 360Z" fill="#EAB54F"/>
        <circle cx="170" cy="390" r="12" fill="#EAB54F"/><circle cx="256" cy="410" r="12" fill="#EAB54F"/><circle cx="342" cy="390" r="12" fill="#EAB54F"/>
      </svg>
      <h1>${CHURCH}</h1>
      <p>Annual Financial &amp; Operations Report — ${year}</p>
      <p>Generated ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})} &nbsp;·&nbsp; Confidential</p>
    `;
    root.prepend(cover);
    window.print();
    setTimeout(() => {
      document.getElementById('nyacaba-print-cover')?.remove();
      document.getElementById('nyacaba-print-style')?.remove();
    }, 1200);
  }

  // ---- CSV ----
  function exportCSV() {
    const rows = [
      [`${CHURCH} Annual Report — ${year}`],['Generated',new Date().toLocaleString()],[''],
      ['SUMMARY'],
      ['Total Contributions',summary.totalContrib],['Welfare Disbursed',summary.totalWelfare],
      ['General Expenses',summary.totalGenExpenses],['Project Expenses',summary.totalProjExpenses],
      ['Total Out',summary.totalOut],['Net Position',summary.netPosition],[''],
      ['MONTHLY'],['Month','Contributions In','Welfare Out'],
      ...byMonth.map((m)=>[m.name,m.total,m.out]),[''],
      ['BY TYPE'],['Type','Amount'],...byType.map((t)=>[t.name,t.value]),[''],
      ['WELFARE'],['Category','Disbursed'],...welfareByCat.map((w)=>[w.name,w.value]),[''],
      ['GENERAL EXPENSES'],['Category','Amount'],...expensesByCat.map((e)=>[e.name,e.value]),[''],
      ...(isAdmin?[['TOP CONTRIBUTORS'],['Member','Total'],...topContributors.map((c)=>[c.name,c.total])]:[]),
    ];
    const csv = rows.map((r)=>r.map((v)=>`"${v??''}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'),{
      href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
      download:`report-${year}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  const net = summary.netPosition || 0;

  return (
    <>
      <PageHeader
        kicker="Annual Report" title="Reports"
        description="Full financial and operational overview for the selected year."
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <select className="input !w-auto" value={year} onChange={(e)=>setYear(parseInt(e.target.value))}>
              {years.map((y)=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={exportCSV} disabled={loading} className="btn-secondary"><FileSpreadsheet size={16}/> CSV</button>
            <button onClick={handlePDF} disabled={loading} className="btn-primary"><FileText size={16}/> PDF</button>
          </div>
        }
      />

      {loading ? (
        <div className="card-padded flex justify-center py-16"><LoadingSpinner label="Building report…"/></div>
      ) : (
        <div id="nyacaba-report-root" className="space-y-6">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Wallet} label="Total In" value={formatMoney(summary.totalContrib)} sub={`${summary.contribCount} entries · entire team`} color="emerald"/>
            <KpiCard icon={Wallet} label="Total Out" value={formatMoney(summary.totalOut)} sub="welfare + expenses + projects" color="rose"/>
            <KpiCard icon={Users} label="Active Members" value={summary.activeMembers} sub={`+${summary.newMembers} joined this year`} color="primary"/>
            <div className="card-padded flex flex-col justify-between">
              <p className="kicker mb-1 flex items-center gap-1">
                {net>=0?<TrendingUp size={12} className="text-emerald-700"/>:<TrendingDown size={12} className="text-rose-700"/>}
                Net Position
              </p>
              <p className={`font-display text-2xl font-semibold ${net>=0?'text-primary-900':'text-rose-700'}`}>
                {net<0?'−':''}{formatMoney(Math.abs(net))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard icon={HeartHandshake} label="Welfare Disbursed" value={formatMoney(summary.totalWelfare)} sub={`${welfareStats.total} requests`} color="amber"/>
            <KpiCard icon={BarChart3} label="General Expenses" value={formatMoney(summary.totalGenExpenses)} sub="approved expenses" color="amber"/>
            <KpiCard icon={Package} label="Project Expenses" value={formatMoney(summary.totalProjExpenses)} sub={`${projectsSummary.length} projects`} color="amber"/>
          </div>

          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4">Monthly — Contributions vs Welfare Out</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} margin={{top:5,right:10,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false} tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}K`:v}/>
                  <Tooltip formatter={(v)=>formatMoney(v)} contentStyle={{fontSize:12}}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="total" name="Contributions" fill="#0F4A3C" radius={[4,4,0,0]}/>
                  <Bar dataKey="out" name="Welfare Out" fill="#D4A24E" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Contributions by Type</h3>
              {byType.length===0?<EmptyMsg text="No confirmed contributions this year."/>:(
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
                          {byType.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v)=>formatMoney(v)}/><Legend wrapperStyle={{fontSize:11}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {byType.map((t)=>(
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
              {welfareByCat.length===0?<EmptyMsg text="No welfare disbursements this year."/>:(
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={welfareByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
                          {welfareByCat.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v)=>formatMoney(v)}/><Legend wrapperStyle={{fontSize:11}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {welfareByCat.map((w)=>(
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

          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4">Welfare Requests — {year}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <StatBox label="Total Requests" value={welfareStats.total}/>
              <StatBox label="Approved" value={welfareStats.approved} valueColor="text-emerald-700"/>
              <StatBox label="Rejected" value={welfareStats.rejected} valueColor="text-rose-700"/>
              <StatBox label="Pending" value={welfareStats.pending} valueColor="text-amber-700"/>
              <StatBox label="Amount Requested" value={formatMoney(welfareStats.requested)}/>
            </div>
            {welfareStats.requested>0&&(
              <div className="mt-3">
                <p className="text-xs text-ink-600 mb-1">
                  Disbursement rate: <strong>{Math.round((welfareStats.disbursed/welfareStats.requested)*100)}%</strong> of requested amount disbursed
                </p>
                <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                  <div className="h-full bg-primary-700 rounded-full" style={{width:`${Math.min(100,Math.round((welfareStats.disbursed/welfareStats.requested)*100))}%`}}/>
                </div>
              </div>
            )}
          </div>

          {expensesByCat.length>0&&(
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">General Expenses by Category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expensesByCat} layout="vertical" margin={{left:10,right:20}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false} tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}K`:v}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false} width={100}/>
                    <Tooltip formatter={(v)=>formatMoney(v)} contentStyle={{fontSize:12}}/>
                    <Bar dataKey="value" name="Amount" fill="#D4A24E" radius={[0,6,6,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {projectsSummary.length>0&&(
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Projects — Budget vs Spent</h3>
              <ul className="space-y-3">
                {projectsSummary.map((p)=>{
                  const pct=p.budget>0?Math.min(100,Math.round((p.spent/p.budget)*100)):0;
                  const over=p.budget>0&&p.spent>p.budget;
                  return(
                    <li key={p.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-ink-900">{p.name}
                          <span className={`ml-2 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full ${p.status==='active'?'bg-emerald-100 text-emerald-800':p.status==='completed'?'bg-blue-100 text-blue-800':'bg-cream-200 text-ink-600'}`}>{p.status}</span>
                        </span>
                        <span className={over?'text-rose-700 font-semibold':'text-ink-700'}>{formatMoney(p.spent)}{p.budget>0&&` / ${formatMoney(p.budget)}`}</span>
                      </div>
                      {p.budget>0&&(
                        <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                          <div className={`h-full rounded-full ${over?'bg-rose-500':'bg-primary-700'}`} style={{width:`${pct}%`}}/>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* TOP CONTRIBUTORS — admin only */}
          {isAdmin&&(
            <div className="card-padded">
              <h3 className="font-display text-lg font-semibold mb-4">Top 10 Contributors — {year}</h3>
              {topContributors.length===0?<EmptyMsg text="No confirmed contributions this year."/>:(
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topContributors} layout="vertical" margin={{left:10,right:20}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" horizontal={false}/>
                      <XAxis type="number" tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false} tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}K`:v}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false} width={120}/>
                      <Tooltip formatter={(v)=>formatMoney(v)} contentStyle={{fontSize:12}}/>
                      <Bar dataKey="total" name="Total Given" fill="#0F4A3C" radius={[0,6,6,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-1">New Members by Month — {year}</h3>
            <p className="text-xs text-ink-600 mb-4">{summary.newMembers} new member{summary.newMembers!==1?'s':''} joined this year</p>
            {summary.newMembers===0?<EmptyMsg text="No new members joined this year."/>:(
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={memberGrowth} margin={{top:5,right:10,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false}/>
                    <XAxis dataKey="name" tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false}/>
                    <YAxis allowDecimals={false} tick={{fontSize:11,fill:'#6E6555'}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{fontSize:12}}/>
                    <Bar dataKey="new" name="New Members" fill="#3f8a78" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

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
                <StatBox label="Pending Contributions" value={pendingContribs} valueColor={pendingContribs>0?'text-amber-700':undefined} sub="awaiting verification"/>
                <StatBox label="Pending Welfare" value={welfareStats.pending} valueColor={welfareStats.pending>0?'text-amber-700':undefined} sub="awaiting decision"/>
              </div>
            </div>
          </div>

        </div>
      )}
    </>
  );
}

function KpiCard({icon:Icon,label,value,sub,color='primary'}){
  const colors={primary:'text-primary-900',emerald:'text-emerald-700',rose:'text-rose-700',amber:'text-amber-700'};
  return(
    <div className="card-padded">
      <p className="kicker mb-1 flex items-center gap-1.5">{Icon&&<Icon size={12}/>} {label}</p>
      <p className={`font-display text-2xl font-semibold ${colors[color]||'text-ink-900'}`}>{value}</p>
      {sub&&<p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatBox({label,value,valueColor,sub}){
  return(
    <div className="bg-cream-100 rounded-xl p-3">
      <p className="kicker mb-0.5">{label}</p>
      <p className={`font-display text-xl font-semibold ${valueColor||'text-ink-900'}`}>{value??0}</p>
      {sub&&<p className="text-[11px] text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyMsg({text}){
  return <p className="text-sm text-ink-500 py-4 text-center">{text}</p>;
}
