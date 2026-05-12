import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney, formatDate, formatDateTime } from '../../lib/format';
import { CHURCH_NAME } from '../../lib/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Logo from '../../components/ui/Logo';

export default function MemberStatement() {
  const { memberId } = useParams();
  const { isStaff, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [member, setMember] = useState(null);
  const [contribs, setContribs] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: m } = await supabase
        .from('members')
        .select('*, welfare_groups(name)')
        .eq('id', memberId)
        .maybeSingle();

      // Access guard: a non-staff user can only view their OWN statement.
      if (m && !isStaff && m.profile_id !== profile?.id) {
        toast.error('You can only view your own statement.');
        navigate('/my-giving', { replace: true });
        return;
      }

      const { data: c } = await supabase
        .from('contributions')
        .select('*, projects(name)')
        .eq('member_id', memberId)
        .eq('verification_status', 'confirmed')
        .order('contribution_date', { ascending: false });
      const { data: p } = await supabase
        .from('pledges')
        .select('*')
        .eq('member_id', memberId);
      if (!active) return;
      setMember(m);
      setContribs(c || []);
      setPledges(p || []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [memberId, isStaff, profile?.id, navigate, toast]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!member) return <EmptyState title="Member not found" />;

  const total = contribs.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalPledged = pledges.reduce((s, p) => s + Number(p.pledge_amount || 0), 0);
  const totalPledgePaid = pledges.reduce((s, p) => s + Number(p.paid_amount || 0), 0);

  return (
    <>
      <div className="flex items-center justify-between mb-4 no-print">
        <Link to={`/members/${memberId}`} className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to member
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer size={16} /> Print statement
        </button>
      </div>

      <div className="card-padded print-card max-w-4xl mx-auto bg-white">
        <div className="flex items-start justify-between mb-6 pb-6 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div>
              <p className="kicker">{CHURCH_NAME}</p>
              <h1 className="font-display text-2xl font-semibold">Member Statement</h1>
              <p className="text-xs text-ink-600">Generated {formatDateTime(new Date())}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="kicker mb-1">Member</p>
            <p className="font-display text-xl font-semibold">{member.full_name}</p>
            <p className="text-sm text-ink-700 font-mono">{member.membership_no}</p>
            {member.phone && <p className="text-sm text-ink-700">{member.phone}</p>}
            {member.email && <p className="text-sm text-ink-700">{member.email}</p>}
            {member.welfare_groups?.name && <p className="text-sm text-ink-700">Group: {member.welfare_groups.name}</p>}
          </div>
          <div className="text-right">
            <div className="bg-cream-100 rounded-xl p-4 inline-block">
              <p className="kicker">Lifetime Total</p>
              <p className="font-display text-3xl font-semibold text-primary-900 mt-1">{formatMoney(total)}</p>
            </div>
          </div>
        </div>

        <h2 className="font-display text-lg font-semibold mb-3">Contributions</h2>
        {contribs.length === 0 ? (
          <p className="text-sm text-ink-600 mb-6">No contributions recorded.</p>
        ) : (
          (() => {
            // Group by year — each year section page-breaks for print
            const byYear = {};
            contribs.forEach((c) => {
              const y = new Date(c.contribution_date).getFullYear();
              (byYear[y] ||= []).push(c);
            });
            const years = Object.keys(byYear).sort((a, b) => b - a);
            return years.map((year, idx) => {
              const yearContribs = byYear[year];
              const yearTotal = yearContribs.reduce((s, c) => s + Number(c.amount || 0), 0);
              return (
                <div
                  key={year}
                  className="mb-6 statement-year-section"
                  style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                >
                  <h3 className="font-display text-base font-semibold text-primary-900 mb-2 pb-1 border-b-2 border-primary-100">
                    {year} · {yearContribs.length} {yearContribs.length === 1 ? 'gift' : 'gifts'} · {formatMoney(yearTotal)}
                  </h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-ink-200">
                        <th className="py-2 text-left text-xs uppercase tracking-wide text-ink-600">Date</th>
                        <th className="py-2 text-left text-xs uppercase tracking-wide text-ink-600">Type</th>
                        <th className="py-2 text-left text-xs uppercase tracking-wide text-ink-600">Method</th>
                        <th className="py-2 text-left text-xs uppercase tracking-wide text-ink-600">Reference</th>
                        <th className="py-2 text-right text-xs uppercase tracking-wide text-ink-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearContribs.map((c) => (
                        <tr key={c.id} className="border-b border-cream-200">
                          <td className="py-2">{formatDate(c.contribution_date)}</td>
                          <td className="py-2 capitalize">
                            {c.contribution_type}
                            {c.projects?.name && <span className="text-ink-500"> · {c.projects.name}</span>}
                          </td>
                          <td className="py-2">{c.payment_method}</td>
                          <td className="py-2 text-xs text-ink-600 font-mono">{c.reference_no || '—'}</td>
                          <td className="py-2 text-right font-semibold">{formatMoney(c.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-ink-300">
                        <td colSpan="4" className="py-2 font-medium text-right text-ink-700">{year} Subtotal</td>
                        <td className="py-2 font-semibold text-primary-900 text-right">{formatMoney(yearTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            });
          })()
        )}

        {contribs.length > 0 && (
          <div className="mb-6 border-t-2 border-ink-300 pt-2 flex justify-between font-display text-lg">
            <span className="font-semibold">Lifetime total</span>
            <span className="font-semibold text-primary-900">{formatMoney(total)}</span>
          </div>
        )}

        {pledges.length > 0 && (
          <>
            <h2 className="font-display text-lg font-semibold mb-3">Pledges</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-ink-200">
                  <th className="py-2 text-left text-xs uppercase tracking-wide text-ink-600">Date</th>
                  <th className="py-2 text-left text-xs uppercase tracking-wide text-ink-600">Purpose</th>
                  <th className="py-2 text-left text-xs uppercase tracking-wide text-ink-600">Status</th>
                  <th className="py-2 text-right text-xs uppercase tracking-wide text-ink-600">Pledged</th>
                  <th className="py-2 text-right text-xs uppercase tracking-wide text-ink-600">Paid</th>
                </tr>
              </thead>
              <tbody>
                {pledges.map((p) => (
                  <tr key={p.id} className="border-b border-cream-200">
                    <td className="py-2">{formatDate(p.pledge_date)}</td>
                    <td className="py-2">{p.purpose}</td>
                    <td className="py-2 capitalize">{p.status}</td>
                    <td className="py-2 text-right">{formatMoney(p.pledge_amount)}</td>
                    <td className="py-2 text-right">{formatMoney(p.paid_amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink-300">
                  <td colSpan="3" className="py-2 font-semibold text-right">Total</td>
                  <td className="py-2 font-semibold text-right">{formatMoney(totalPledged)}</td>
                  <td className="py-2 font-semibold text-right">{formatMoney(totalPledgePaid)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-cream-200 text-center text-xs text-ink-500">
          <p>Asante for your faithful giving · Elohim awabariki</p>
          <p className="mt-1">{CHURCH_NAME} Welfare Management System</p>
        </div>
      </div>
    </>
  );
}
