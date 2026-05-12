-- =========================================================================
-- NYACABA WELFARE — PRODUCTION CLEANUP
-- =========================================================================
-- ⚠️  DANGER — READ BEFORE RUNNING ⚠️
--
-- This script DELETES:
--   • All members, families, contributions, pledges
--   • All welfare requests + approvals
--   • All projects, milestones, expenses
--   • All meetings, attendance, minutes, action items, resolutions
--   • All inventory categories, items, transactions
--   • All announcements, notifications, audit logs
--   • All welfare groups, system settings
--   • All non-admin user accounts (auth.users + profiles)
--   • All non-admin profile photos in Storage
--
-- This script PRESERVES:
--   • The full database schema (tables, functions, triggers, RLS, cron jobs)
--   • Your admin account(s) — role='admin' AND approval_status='approved'
--   • Your admin's profile photo
--
-- THIS IS NOT REVERSIBLE. Take a Supabase backup snapshot first:
--   Supabase Dashboard → Database → Backups → "Take backup"
--
-- Run order:
--   1. Pre-flight check (raises exception if no admin found)
--   2. Preview counts of what will be wiped
--   3. Wipe
--   4. Post-wipe verification counts
-- =========================================================================

-- =========================================================================
-- STEP 1 — PRE-FLIGHT
-- =========================================================================
do $$
declare
  v_admin_count int;
begin
  select count(*) into v_admin_count
  from public.profiles
  where role = 'admin'
    and approval_status = 'approved';

  if v_admin_count = 0 then
    raise exception
      'ABORT: no approved admin found. Create one (role=''admin'', approval_status=''approved'') before running cleanup.';
  end if;

  raise notice 'Admin accounts to preserve: %', v_admin_count;
end $$;

-- Show the admin(s) being kept (for sanity)
select id, full_name, email, role, approval_status
from public.profiles
where role = 'admin'
order by created_at;

-- =========================================================================
-- STEP 2 — PREVIEW
-- =========================================================================
select 'profiles (non-admin)'  as item, count(*) as will_delete from public.profiles where role <> 'admin' or approval_status <> 'approved'
union all select 'auth.users (non-admin)',            count(*) from auth.users where id not in (select id from public.profiles where role = 'admin' and approval_status = 'approved')
union all select 'members',                           count(*) from public.members
union all select 'member_family',                     count(*) from public.member_family
union all select 'contributions',                     count(*) from public.contributions
union all select 'pledges',                           count(*) from public.pledges
union all select 'welfare_requests',                  count(*) from public.welfare_requests
union all select 'welfare_approvals',                 count(*) from public.welfare_approvals
union all select 'projects',                          count(*) from public.projects
union all select 'project_milestones',                count(*) from public.project_milestones
union all select 'project_expenses',                  count(*) from public.project_expenses
union all select 'meetings',                          count(*) from public.meetings
union all select 'meeting_attendance',                count(*) from public.meeting_attendance
union all select 'meeting_minutes',                   count(*) from public.meeting_minutes
union all select 'action_items',                      count(*) from public.action_items
union all select 'resolutions',                       count(*) from public.resolutions
union all select 'resolution_votes',                  count(*) from public.resolution_votes
union all select 'inventory_categories',              count(*) from public.inventory_categories
union all select 'inventory_items',                   count(*) from public.inventory_items
union all select 'inventory_transactions',            count(*) from public.inventory_transactions
union all select 'announcements',                     count(*) from public.announcements
union all select 'notifications',                     count(*) from public.notifications
union all select 'audit_logs',                        count(*) from public.audit_logs
union all select 'welfare_groups',                    count(*) from public.welfare_groups
union all select 'system_settings',                   count(*) from public.system_settings;

-- =========================================================================
-- STEP 3 — WIPE
-- =========================================================================
-- Single TRUNCATE with CASCADE clears everything in one shot.
-- RESTART IDENTITY resets any sequences so new records start at 1.
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

-- NOTE: Storage objects (avatars) must be cleaned manually via the Dashboard.
-- Supabase blocks direct DELETE on storage.objects to prevent orphaned files.
--
-- After this script finishes:
--   1. Go to Dashboard -> Storage -> avatars
--   2. Delete all UUID folders except your admin's
--   3. Find your admin's UUID with:
--        select id, email from public.profiles where role = 'admin';

-- Delete non-admin auth users (this cascades to profiles via FK)
delete from auth.users
where id not in (
  select id
  from public.profiles
  where role = 'admin'
    and approval_status = 'approved'
);

-- =========================================================================
-- STEP 4 — VERIFY (everything should be 0 except profiles=admin count)
-- =========================================================================
select 'profiles'           as table_name, count(*) as remaining from public.profiles
union all select 'auth.users',            count(*) from auth.users
union all select 'members',               count(*) from public.members
union all select 'contributions',         count(*) from public.contributions
union all select 'pledges',               count(*) from public.pledges
union all select 'welfare_requests',      count(*) from public.welfare_requests
union all select 'welfare_groups',        count(*) from public.welfare_groups
union all select 'projects',              count(*) from public.projects
union all select 'inventory_items',       count(*) from public.inventory_items
union all select 'announcements',         count(*) from public.announcements
union all select 'notifications',         count(*) from public.notifications
union all select 'audit_logs',            count(*) from public.audit_logs;

-- =========================================================================
-- OPTIONAL — RE-SEED MINIMAL CONFIG
-- =========================================================================
-- Members can't register a welfare group until at least one exists.
-- Uncomment to drop in a single "Main Congregation" group so the system
-- works out of the box. You can rename / add more later from the UI.
--
-- insert into public.welfare_groups (name, description, meeting_day, status)
-- values ('Main Congregation', 'Default group — rename or expand as needed', 'sunday', 'active');

-- =========================================================================
-- DONE
-- =========================================================================
