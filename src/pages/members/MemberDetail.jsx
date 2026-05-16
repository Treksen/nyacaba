import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Phone, Mail, MapPin, Users as UsersIcon, FileText, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatMoney, formatDate, initials } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import WhatsAppButton from '../../components/ui/WhatsAppButton';

export default function MemberDetail() {
  const { id } = useParams();
  const { isAdminOrChair: isAdmin, isStaff, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [member, setMember] = useState(null);
  const [contribs, setContribs] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [welfare, setWelfare] = useState([]);
  const [family, setFamily] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: m } = await supabase
        .from('members')
        .select('*, welfare_groups(name), profile:profiles!members_profile_id_fkey(avatar_url)')
        .eq('id', id)
        .maybeSingle();
      const { data: c } = await supabase
        .from('contributions')
        .select('*')
        .eq('member_id', id)
        .eq('verification_status', 'confirmed')
        .order('contribution_date', { ascending: false })
        .limit(10);
      const { data: p } = await supabase
        .from('pledges')
        .select('*')
        .eq('member_id', id)
        .order('pledge_date', { ascending: false });
      const { data: w } = await supabase
        .from('welfare_requests')
        .select('*')
        .eq('member_id', id)
        .order('submitted_at', { ascending: false });
      const { data: f } = await supabase
        .from('member_family')
        .select('*')
        .eq('member_id', id)
        .order('created_at');
      if (!active) return;
      setMember(m);
      setContribs(c || []);
      setPledges(p || []);
      setWelfare(w || []);
      setFamily(f || []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [id]);

  async function handleDelete() {
    if (!confirm('Delete this member? This cannot be undone.')) return;
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) notifyError(error, { action: 'MemberDetail' });
    else {
      toast.success('Member deleted');
      navigate('/members');
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!member) return <EmptyState title="Member not found" description="This member may have been removed." />;

  const totalContributed = contribs.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <>
      <Link to="/members" className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to members
      </Link>

      <div className="card-padded mb-5 paper-grain">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Avatar
            src={member.profile?.avatar_url}
            name={member.full_name}
            size="3xl"
            className="!rounded-2xl !w-20 !h-20 !text-3xl"
          />
          <div className="flex-1 min-w-0">
            <p className="kicker mb-1">{member.membership_no}</p>
            <h1 className="font-display text-3xl font-semibold mb-2">{member.full_name}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-ink-700">
              {member.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={14}/> {member.phone}
                  <WhatsAppButton phone={member.phone} />
                </span>
              )}
              {member.email && <span className="inline-flex items-center gap-1.5"><Mail size={14}/> {member.email}</span>}
              {member.welfare_groups?.name && <span className="inline-flex items-center gap-1.5"><UsersIcon size={14}/> {member.welfare_groups.name}</span>}
              {(member.city || member.county) && <span className="inline-flex items-center gap-1.5"><MapPin size={14}/> {[member.city, member.county].filter(Boolean).join(', ')}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {(isStaff || member.profile_id === profile?.id) && (
              <Link to={`/statements/${member.id}`} className="btn-secondary">
                <FileText size={16} /> Statement
              </Link>
            )}
            {isAdmin && (
              <>
                <Link to={`/members/${member.id}/edit`} className="btn-primary">
                  <Edit2 size={16} /> Edit
                </Link>
                <button onClick={handleDelete} className="btn-ghost text-rose-700 hover:bg-rose-50">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="card-padded">
          <p className="kicker">Lifetime</p>
          <p className="font-display text-3xl font-semibold mt-1">{formatMoney(totalContributed)}</p>
          <p className="text-xs text-ink-600 mt-1">Total contributed</p>
        </div>
        <div className="card-padded">
          <p className="kicker">Open Pledges</p>
          <p className="font-display text-3xl font-semibold mt-1">{pledges.filter(p => ['open','partial'].includes(p.status)).length}</p>
          <p className="text-xs text-ink-600 mt-1">Active pledge commitments</p>
        </div>
        <div className="card-padded">
          <p className="kicker">Welfare</p>
          <p className="font-display text-3xl font-semibold mt-1">{welfare.length}</p>
          <p className="text-xs text-ink-600 mt-1">Requests submitted</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-3">Recent contributions</h3>
          {contribs.length === 0 ? (
            <p className="text-sm text-ink-600">No contributions recorded.</p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {contribs.map((c) => (
                <li key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-ink-900 capitalize">{c.contribution_type}</p>
                    <p className="text-xs text-ink-600">{formatDate(c.contribution_date)} · {c.payment_method}</p>
                  </div>
                  <p className="font-semibold text-primary-900">{formatMoney(c.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold mb-3">Family / Dependents</h3>
          {family.length === 0 ? (
            <p className="text-sm text-ink-600">No family records.</p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {family.map((f) => (
                <li key={f.id} className="py-2.5 text-sm">
                  <p className="font-medium text-ink-900">{f.related_name}</p>
                  <p className="text-xs text-ink-600">{f.relation} {f.date_of_birth ? `· ${formatDate(f.date_of_birth)}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {welfare.length > 0 && (
          <div className="card-padded lg:col-span-2">
            <h3 className="font-display text-lg font-semibold mb-3">Welfare history</h3>
            <ul className="divide-y divide-cream-200">
              {welfare.map((w) => (
                <li key={w.id} className="py-2.5 flex items-center justify-between text-sm">
                  <Link to={`/welfare/${w.id}`} className="hover:text-primary-700">
                    <p className="font-medium text-ink-900">{w.title}</p>
                    <p className="text-xs text-ink-600">{w.request_no} · {formatDate(w.submitted_at)}</p>
                  </Link>
                  <p className="font-semibold text-primary-900">{formatMoney(w.amount_requested)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
