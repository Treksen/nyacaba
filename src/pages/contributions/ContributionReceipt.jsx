import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatDate, formatDateTime, numberToWords } from '../../lib/format';
import { CHURCH_NAME, CONTRIBUTION_TYPES, PAYMENT_METHODS } from '../../lib/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Logo from '../../components/ui/Logo';

export default function ContributionReceipt() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from('contributions')
        .select('*, members(full_name, membership_no), projects(name), recorder:profiles!contributions_recorded_by_fkey(full_name), verifier:profiles!contributions_verified_by_fkey(full_name)')
        .eq('id', id)
        .maybeSingle();
      if (active) {
        setC(data);
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!c) return <EmptyState title="Receipt not found" description="This contribution may have been deleted." />;

  if (c.verification_status !== 'confirmed') {
    return (
      <>
        <Link to={-1} className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="card-padded text-center max-w-xl mx-auto">
          <h2 className="font-display text-2xl font-semibold mb-2">
            {c.verification_status === 'pending' ? 'Awaiting verification' : 'Not verified'}
          </h2>
          <p className="text-sm text-ink-700 mb-3">
            {c.verification_status === 'pending'
              ? 'A receipt can be printed once the treasurer or admin verifies this contribution.'
              : 'This contribution was not verified. Please re-submit a corrected entry.'}
          </p>
          {c.rejection_reason && (
            <p className="text-sm text-rose-700 italic">Reason: {c.rejection_reason}</p>
          )}
        </div>
      </>
    );
  }

  const receiptNo = `RCP-${c.id.slice(0, 8).toUpperCase()}`;
  const typeLabel = CONTRIBUTION_TYPES.find((t) => t.value === c.contribution_type)?.label || c.contribution_type;
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === c.payment_method)?.label || c.payment_method;
  const amountWords = numberToWords(c.amount);

  return (
    <>
      <div className="flex items-center justify-between mb-4 no-print">
        <Link to={-1} className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back
        </Link>
        <button
          onClick={() => window.print()}
          className="btn-primary"
          title="Use your browser's print dialog and choose 'Save as PDF' as the destination"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="card-padded print-card max-w-3xl mx-auto bg-white">
        <div className="flex items-start justify-between mb-6 pb-6 border-b-2 border-double border-cream-300">
          <div className="flex items-center gap-3">
            <Logo size={56} />
            <div>
              <p className="kicker">{CHURCH_NAME} Church</p>
              <h1 className="font-display text-3xl font-semibold">Official Receipt</h1>
              <p className="text-xs text-ink-600 mt-1">For your records</p>
            </div>
          </div>
          <div className="text-right">
            <p className="kicker">Receipt No.</p>
            <p className="font-mono text-lg font-semibold">{receiptNo}</p>
            <p className="text-xs text-ink-600 mt-2">{formatDate(c.contribution_date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-6">
          <div>
            <p className="kicker mb-0.5">Received From</p>
            <p className="font-display text-lg font-semibold">{c.members?.full_name || '—'}</p>
            <p className="text-xs text-ink-600 font-mono">{c.members?.membership_no}</p>
          </div>
          <div>
            <p className="kicker mb-0.5">Purpose</p>
            <p className="font-semibold">{typeLabel}</p>
            {c.projects?.name && <p className="text-xs text-ink-700">{c.projects.name}</p>}
            {c.period_month && c.period_year && (
              <p className="text-xs text-ink-600">For period {c.period_month}/{c.period_year}</p>
            )}
          </div>
          <div>
            <p className="kicker mb-0.5">Payment method</p>
            <p>{methodLabel}</p>
          </div>
          <div>
            <p className="kicker mb-0.5">Reference / M-Pesa code</p>
            <p className="font-mono">{c.reference_no || '—'}</p>
          </div>
        </div>

        <div className="bg-cream-100 border border-cream-200 rounded-2xl p-6 mb-6">
          <p className="kicker mb-1">Amount Received</p>
          <p className="font-display text-5xl font-semibold text-primary-900">{formatMoney(c.amount)}</p>
          <p className="text-sm text-ink-700 mt-2 italic">
            ({amountWords} Kenyan Shillings only)
          </p>
        </div>

        {c.notes && (
          <div className="mb-6">
            <p className="kicker mb-1">Notes</p>
            <p className="text-sm text-ink-700">{c.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 mt-12 mb-6 pt-6">
          <div>
            <div className="border-b-2 border-ink-300 h-8 mb-1"/>
            <p className="text-xs text-ink-600">Received by</p>
            {c.verifier?.full_name ? (
              <p className="text-sm font-medium text-ink-900 mt-0.5">{c.verifier.full_name}</p>
            ) : c.recorder?.full_name && (
              <p className="text-sm font-medium text-ink-900 mt-0.5">{c.recorder.full_name}</p>
            )}
          </div>
          <div>
            <div className="border-b-2 border-ink-300 h-8 mb-1"/>
            <p className="text-xs text-ink-600">Signature & stamp</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-cream-200 text-center text-xs text-ink-500">
          <p>Asante kwa moyo wako wa upendo · Thank you for your generous contribution</p>
          <p className="mt-1 italic">"Each of you should give what you have decided in your heart to give." 2 Cor 9:7</p>
          <p className="mt-2 text-[10px]">Issued {formatDateTime(c.created_at)} · {CHURCH_NAME} Welfare Management System</p>
        </div>
      </div>
    </>
  );
}
