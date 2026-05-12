-- =========================================================================
-- NYACABA — RECOVERY CLEANUP (resume after partial run)
-- =========================================================================
-- Run this if `clean-database.sql` errored at the storage step.
-- It finishes the cleanup WITHOUT touching storage.objects (which is
-- protected by Supabase). Avatars get cleaned manually from the Dashboard.
-- =========================================================================

-- Confirm admin still exists
do $$
declare v_count int;
begin
  select count(*) into v_count
  from public.profiles
  where role = 'admin' and approval_status = 'approved';

  if v_count = 0 then
    raise exception 'ABORT: no approved admin found. Stop and investigate before continuing.';
  end if;
  raise notice 'Admins to preserve: %', v_count;
end $$;

-- Re-run TRUNCATE in case the original failed (idempotent — wiping empty tables is a no-op)
truncate
  public.audit_logs,
  public.notifications,
  public.announcements,
  public.resolution_votes,
  public.resolutions,
  public.action_items,
  public.meeting_minutes,
  public.meeting_attendance,
  public.meetings,
  public.project_expenses,
  public.project_milestones,
  public.projects,
  public.inventory_transactions,
  public.inventory_items,
  public.inventory_categories,
  public.welfare_approvals,
  public.welfare_requests,
  public.contributions,
  public.pledges,
  public.member_family,
  public.members,
  public.welfare_groups,
  public.system_settings
restart identity cascade;

-- Delete non-admin auth users (this cascades to profiles via FK)
delete from auth.users
where id not in (
  select id from public.profiles
  where role = 'admin' and approval_status = 'approved'
);

-- Verify
select 'profiles'      as table_name, count(*) as remaining from public.profiles
union all select 'auth.users',        count(*) from auth.users
union all select 'members',           count(*) from public.members
union all select 'contributions',     count(*) from public.contributions
union all select 'welfare_groups',    count(*) from public.welfare_groups
union all select 'notifications',     count(*) from public.notifications
union all select 'audit_logs',        count(*) from public.audit_logs;

-- Expected: profiles=1 (or more if multiple admins), auth.users=same, others=0
