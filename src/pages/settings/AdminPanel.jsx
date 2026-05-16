import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, ShieldCheck, ShieldOff, UserCheck, Users, Power, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import { formatDate, formatDateTime, initials } from '../../lib/format';
import { ROLES, roleLabel, roleBadgeClass } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import Avatar from '../../components/ui/Avatar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';

export default function AdminPanel() {
  const { isAdmin, isAdminOrChair, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUser, setLinkUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [roleEditUser, setRoleEditUser] = useState(null);
  const [roleEditValue, setRoleEditValue] = useState('member');

  useEffect(() => {
    if (!isAdminOrChair) {
      toast.error('Admin access required');
      navigate('/');
    }
  }, [isAdminOrChair, navigate, toast]);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: u }, { data: m }] = await Promise.all([
      supabase.from('profiles').select('*').eq('approval_status', 'pending').order('created_at'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('members').select('id, full_name, profile_id').order('full_name'),
    ]);
    setPending(p || []);
    setAllUsers(u || []);
    setMembers(m || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(userId) {
    // Fetch user profile first
    const { data: userProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError) {
      return notifyError(fetchError, { action: 'fetch_user_profile_for_approval', user_id: userId });
    }
    if (!userProfile) {
      return toast.error("User profile not found");
    }

    // 1. Approve profile
    const { error: approveError } = await supabase
      .from("profiles")
      .update({
        approval_status: "approved",
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (approveError) {
      return notifyError(approveError, { action: 'AdminPanel' });
    }

    // 2. Check if member already exists
    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    // 3. Create member automatically if missing
    if (!existingMember) {
      const { error: memberError } = await supabase.from("members").insert({
        full_name: userProfile.full_name,
        email: userProfile.email,
        phone: userProfile.phone,
        profile_id: userId,
        joined_on: new Date().toISOString().slice(0, 10), // date column, not timestamp
        status: "active",
      });

      if (memberError) {
        return notifyError(memberError, { action: 'AdminPanel' });
      }
    }

    toast.success("User approved successfully");
    load();
  }

  async function reject(userId) {
    if (!confirm('Reject this user? They will not be able to access the system.')) return;
    const { error } = await supabase.from('profiles').update({
      approval_status: 'rejected',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }).eq('id', userId);
    if (error) notifyError(error, { action: 'AdminPanel' });
    else { toast.success('User rejected'); load(); }
  }

  async function toggleAdmin(user) {
    const newRole = user.role === 'admin' ? 'member' : 'admin';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
    if (error) notifyError(error, { action: 'AdminPanel' });
    else { toast.success(`Role changed to ${newRole}`); load(); }
  }

  function openRoleEdit(user) {
    setRoleEditUser(user);
    setRoleEditValue(user.role);
  }

  async function saveRole() {
    if (!roleEditUser) return;
    const { error } = await supabase.from('profiles').update({ role: roleEditValue }).eq('id', roleEditUser.id);
    if (error) notifyError(error, { action: 'AdminPanel' });
    else {
      toast.success(`Role set to ${roleEditValue}`);
      setRoleEditUser(null);
      load();
    }
  }

  async function deactivate(user) {
    if (!confirm(`Deactivate ${user.full_name}? They won't be able to access the system, but their record stays for the audit trail.`)) return;
    const { error } = await supabase.from('profiles').update({ approval_status: 'inactive' }).eq('id', user.id);
    if (error) notifyError(error, { action: 'AdminPanel' }); else { toast.success('User deactivated'); load(); }
  }

  async function reactivate(user) {
    const { error } = await supabase.from('profiles').update({
      approval_status: 'approved',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) notifyError(error, { action: 'AdminPanel' }); else { toast.success('User reactivated'); load(); }
  }

  async function deleteUser(user) {
    if (!confirm(`Permanently delete ${user.full_name}'s profile? Their auth account in Supabase will remain (delete it from Supabase → Authentication → Users to fully remove). This cannot be undone.`)) return;
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    if (error) notifyError(error, { action: 'AdminPanel' }); else { toast.success('Profile deleted'); load(); }
  }

  async function linkToMember(memberId) {
    if (!linkUser) return;
    const { error } = await supabase.from('members').update({ profile_id: linkUser.id }).eq('id', memberId);
    if (error) notifyError(error, { action: 'AdminPanel' });
    else {
      toast.success('Linked to member');
      setLinkOpen(false);
      setLinkUser(null);
      load();
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner/></div>;

  return (
    <>
      <PageHeader
        kicker="Stewardship"
        title="Admin panel"
        description="Approve new members, manage roles, and link accounts to member records."
      />

      <div className="flex gap-2 mb-5 border-b border-cream-200">
        <button onClick={() => setTab('pending')} className={`px-4 py-2 -mb-px border-b-2 transition text-sm font-medium ${tab === 'pending' ? 'border-primary-900 text-primary-900' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>
          Pending approval
          {pending.length > 0 && <span className="ml-2 badge-amber">{pending.length}</span>}
        </button>
        <button onClick={() => setTab('users')} className={`px-4 py-2 -mb-px border-b-2 transition text-sm font-medium ${tab === 'users' ? 'border-primary-900 text-primary-900' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>
          All users
          <span className="ml-2 badge-slate">{allUsers.length}</span>
        </button>
      </div>

      {tab === 'pending' ? (
        pending.length === 0 ? (
          <div className="card">
            <EmptyState icon={UserCheck} title="No pending approvals" description="When new members register, they'll appear here for review." />
          </div>
        ) : (
          <div className="card divide-y divide-cream-200">
            {pending.map((u) => (
              <div key={u.id} className="p-4 flex flex-wrap items-center gap-3">
                <Avatar
                  src={u.avatar_url}
                  name={u.full_name}
                  size="lg"
                  className="!rounded-xl"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900">{u.full_name}</p>
                  <p className="text-xs text-ink-600">{u.email}{u.phone && ` · ${u.phone}`}</p>
                  <p className="text-xs text-ink-500 mt-0.5">Registered {formatDateTime(u.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(u.id)} className="btn-primary !py-2"><CheckCircle2 size={14}/> Approve</button>
                  <button onClick={() => reject(u.id)} className="btn-danger !py-2"><XCircle size={14}/> Reject</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="card divide-y divide-cream-200">
          {allUsers.map((u) => {
            const linkedMember = members.find((m) => m.profile_id === u.id);
            return (
              <div key={u.id} className="p-4 flex flex-wrap items-center gap-3">
                <Avatar
                  src={u.avatar_url}
                  name={u.full_name}
                  size="md"
                  className="!rounded-xl"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900">{u.full_name}</p>
                  <p className="text-xs text-ink-600 truncate">{u.email}</p>
                  {linkedMember && <p className="text-xs text-primary-700 mt-0.5">Linked to: {linkedMember.full_name}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={
                    u.approval_status === 'approved' ? 'badge-emerald' :
                    u.approval_status === 'pending' ? 'badge-amber' :
                    u.approval_status === 'rejected' ? 'badge-rose' : 'badge-slate'
                  }>{u.approval_status}</span>
                  <span className={roleBadgeClass(u.role)}>{roleLabel(u.role)}</span>
                  {u.id !== profile.id && (
                    <>
                      {isAdmin && (
                        <button onClick={() => openRoleEdit(u)} className="btn-secondary !py-1.5 text-xs">
                          <ShieldCheck size={12}/> Change role
                        </button>
                      )}
                      {!linkedMember && (
                        <button onClick={() => { setLinkUser(u); setLinkOpen(true); }} className="btn-secondary !py-1.5 text-xs">
                          <Users size={12}/> Link to member
                        </button>
                      )}
                      {u.approval_status === 'approved' && (
                        <button onClick={() => deactivate(u)} className="btn-secondary !py-1.5 text-xs">
                          <Power size={12}/> Deactivate
                        </button>
                      )}
                      {u.approval_status === 'inactive' && (
                        <button onClick={() => reactivate(u)} className="btn-primary !py-1.5 text-xs">
                          <Power size={12}/> Reactivate
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteUser(u)} className="btn-ghost !py-1.5 text-xs text-rose-700 hover:bg-rose-50">
                          <Trash2 size={12}/>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={linkOpen}
        onClose={() => { setLinkOpen(false); setLinkUser(null); }}
        title={`Link ${linkUser?.full_name || 'user'} to a member record`}
      >
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {members.filter((m) => !m.profile_id).map((m) => (
            <button
              key={m.id}
              onClick={() => linkToMember(m.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-cream-100 text-left border border-cream-200"
            >
              <Users size={16} className="text-primary-700"/>
              <span className="font-medium text-ink-900">{m.full_name}</span>
            </button>
          ))}
          {members.filter((m) => !m.profile_id).length === 0 && (
            <p className="text-sm text-ink-600 text-center py-6">All members are already linked. Create a new member record first.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!roleEditUser}
        onClose={() => setRoleEditUser(null)}
        title={`Change role for ${roleEditUser?.full_name || ''}`}
        footer={
          <>
            <button onClick={() => setRoleEditUser(null)} className="btn-secondary">Cancel</button>
            <button onClick={saveRole} className="btn-primary">Save role</button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-ink-700 mb-3">
            Pick what this person can do in the system. Roles can be changed at any time.
          </p>
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                roleEditValue === r.value
                  ? 'border-primary-700 bg-primary-50'
                  : 'border-cream-200 hover:border-cream-300'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={roleEditValue === r.value}
                onChange={(e) => setRoleEditValue(e.target.value)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={r.className}>{r.label}</span>
                </div>
                <p className="text-xs text-ink-600">
                  {r.value === 'admin' && 'Full system access. Can manage roles, system settings, and everything below.'}
                  {r.value === 'chairperson' && 'Oversees the church. Approves members, schedules meetings, manages welfare and finances. Cannot change system settings or assign admin.'}
                  {r.value === 'treasurer' && 'Records and edits contributions, pledges, projects and project expenses.'}
                  {r.value === 'welfare_chair' && 'Reviews, approves, rejects and disburses welfare requests.'}
                  {r.value === 'member' && 'Ordinary church member. Views own contributions and can submit welfare requests.'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </Modal>
    </>
  );
}
