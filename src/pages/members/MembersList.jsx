import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import WhatsAppButton from '../../components/ui/WhatsAppButton';
import Avatar from '../../components/ui/Avatar';

export default function MembersList() {
  const { isAdminOrChair: isAdmin, isStaff, profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [myMemberId, setMyMemberId] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      let query = supabase
        .from('members')
        .select('id, membership_no, full_name, phone, email, status, group_id, profile_id, welfare_groups(name), profile:profiles!members_profile_id_fkey(avatar_url)')
        .order('full_name');
      const { data } = await query;
      if (active) {
        setRows(data || []);
        if (profile?.id) {
          const mine = (data || []).find((m) => m.profile_id === profile.id);
          setMyMemberId(mine?.id ?? null);
        }
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [profile?.id]);

  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    supabase.from('welfare_groups').select('id, name').order('name')
      .then(({ data }) => setGroups(data || []));
  }, []);

  const filtered = rows.filter(
    (m) =>
      (!q ||
        m.full_name?.toLowerCase().includes(q.toLowerCase()) ||
        m.membership_no?.toLowerCase().includes(q.toLowerCase()) ||
        m.phone?.toLowerCase().includes(q.toLowerCase()))
      && (!statusFilter || m.status === statusFilter)
      && (!groupFilter || m.group_id === groupFilter)
  );

  return (
    <>
      <PageHeader
        kicker="The People"
        title="Members"
        description="Every soul on the rolls of this house."
        action={
          isAdmin && (
            <Link to="/members/new" className="btn-primary">
              <Plus size={16} /> Add member
            </Link>
          )
        }
      />

      <div className="card-padded mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, membership no, or phone…"
              className="input pl-10"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="visitor">Visitor</option>
            <option value="deceased">Deceased</option>
            <option value="transferred">Transferred</option>
          </select>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="input">
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        onRowClick={(m) => navigate(`/members/${m.id}`)}
        emptyTitle="No members yet"
        emptyDescription={isAdmin ? 'Add the first member to get started.' : 'Members will appear here once added.'}
        emptyAction={isAdmin && (
          <Link to="/members/new" className="btn-primary">
            <Plus size={16} /> Add first member
          </Link>
        )}
        columns={[
          {
            key: 'name',
            header: 'Member',
            render: (m) => (
              <div className="flex items-center gap-3">
                <Avatar
                  src={m.profile?.avatar_url}
                  name={m.full_name}
                  size="md"
                  className="!rounded-lg"
                />
                <div>
                  <p className="font-medium text-ink-900">{m.full_name}</p>
                  <p className="text-xs text-ink-500 font-mono">{m.membership_no}</p>
                </div>
              </div>
            ),
          },
          { key: 'phone', header: 'Phone', render: (m) => m.phone ? (
            <div className="flex items-center gap-1.5">
              <span>{m.phone}</span>
              <WhatsAppButton phone={m.phone} />
            </div>
          ) : '—' },
          { key: 'email', header: 'Email', render: (m) => m.email || '—' },
          { key: 'group', header: 'Group', render: (m) => m.welfare_groups?.name || '—' },
          {
            key: 'status',
            header: 'Status',
            render: (m) => (
              <span className={
                m.status === 'active' ? 'badge-emerald' :
                m.status === 'inactive' ? 'badge-slate' : 'badge-rose'
              }>
                {m.status}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (m) => {
              const canViewStatement = isStaff || (myMemberId && m.id === myMemberId);
              if (!canViewStatement) return null;
              return (
                <Link
                  to={`/statements/${m.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-primary-900 hover:text-primary-700 inline-flex items-center gap-1 font-medium"
                >
                  <FileText size={12} /> Statement
                </Link>
              );
            },
          },
        ]}
      />
    </>
  );
}
