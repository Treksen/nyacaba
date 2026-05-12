-- =========================================================================
-- Nyacaba Welfare Management System - Row Level Security
-- =========================================================================
-- Run AFTER 001_initial_schema.sql.
-- =========================================================================

-- Helper: is the current user an approved admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
  );
$$;

-- Helper: is the current user an approved (active) profile?
create or replace function public.is_approved()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and approval_status = 'approved'
  );
$$;

-- Helper: get current user's linked member id
create or replace function public.my_member_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select m.id from members m where m.profile_id = auth.uid() limit 1;
$$;

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table welfare_groups enable row level security;
alter table members enable row level security;
alter table member_family enable row level security;
alter table contributions enable row level security;
alter table pledges enable row level security;
alter table welfare_requests enable row level security;
alter table welfare_approvals enable row level security;
alter table projects enable row level security;
alter table project_milestones enable row level security;
alter table project_expenses enable row level security;
alter table meetings enable row level security;
alter table meeting_attendance enable row level security;
alter table meeting_minutes enable row level security;
alter table action_items enable row level security;
alter table resolutions enable row level security;
alter table resolution_votes enable row level security;
alter table inventory_categories enable row level security;
alter table inventory_items enable row level security;
alter table inventory_transactions enable row level security;
alter table announcements enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ============================ PROFILES ============================
drop policy if exists "profiles_self_read" on profiles;
create policy "profiles_self_read" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_admin_read_all" on profiles;
create policy "profiles_admin_read_all" on profiles
  for select using (is_admin());

drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- prevent privilege escalation: role/approval cannot be self-modified
    and role = (select role from profiles where id = auth.uid())
    and approval_status = (select approval_status from profiles where id = auth.uid())
  );

drop policy if exists "profiles_admin_update" on profiles;
create policy "profiles_admin_update" on profiles
  for update using (is_admin());

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_admin_delete" on profiles;
create policy "profiles_admin_delete" on profiles
  for delete using (is_admin());

-- ============================ WELFARE GROUPS ============================
drop policy if exists "groups_read_all_approved" on welfare_groups;
create policy "groups_read_all_approved" on welfare_groups
  for select using (is_approved());

drop policy if exists "groups_admin_write" on welfare_groups;
create policy "groups_admin_write" on welfare_groups
  for all using (is_admin()) with check (is_admin());

-- ============================ MEMBERS ============================
drop policy if exists "members_self_read" on members;
create policy "members_self_read" on members
  for select using (profile_id = auth.uid() or is_admin());

drop policy if exists "members_admin_write" on members;
create policy "members_admin_write" on members
  for all using (is_admin()) with check (is_admin());

drop policy if exists "members_self_update_basic" on members;
create policy "members_self_update_basic" on members
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============================ MEMBER FAMILY ============================
drop policy if exists "family_self_read" on member_family;
create policy "family_self_read" on member_family
  for select using (
    is_admin()
    or member_id = my_member_id()
  );

drop policy if exists "family_self_write" on member_family;
create policy "family_self_write" on member_family
  for all using (
    is_admin() or member_id = my_member_id()
  ) with check (
    is_admin() or member_id = my_member_id()
  );

-- ============================ CONTRIBUTIONS ============================
drop policy if exists "contrib_self_read" on contributions;
create policy "contrib_self_read" on contributions
  for select using (
    is_admin() or member_id = my_member_id()
  );

drop policy if exists "contrib_admin_write" on contributions;
create policy "contrib_admin_write" on contributions
  for all using (is_admin()) with check (is_admin());

-- ============================ PLEDGES ============================
drop policy if exists "pledges_self_read" on pledges;
create policy "pledges_self_read" on pledges
  for select using (
    is_admin() or member_id = my_member_id()
  );

drop policy if exists "pledges_self_create" on pledges;
create policy "pledges_self_create" on pledges
  for insert with check (
    is_admin() or member_id = my_member_id()
  );

drop policy if exists "pledges_admin_update" on pledges;
create policy "pledges_admin_update" on pledges
  for update using (is_admin()) with check (is_admin());

drop policy if exists "pledges_admin_delete" on pledges;
create policy "pledges_admin_delete" on pledges
  for delete using (is_admin());

-- ============================ WELFARE REQUESTS ============================
drop policy if exists "welfare_self_read" on welfare_requests;
create policy "welfare_self_read" on welfare_requests
  for select using (
    is_admin() or member_id = my_member_id()
  );

drop policy if exists "welfare_self_create" on welfare_requests;
create policy "welfare_self_create" on welfare_requests
  for insert with check (
    is_admin() or member_id = my_member_id()
  );

drop policy if exists "welfare_self_update_pending" on welfare_requests;
create policy "welfare_self_update_pending" on welfare_requests
  for update using (
    is_admin() or (member_id = my_member_id() and status = 'pending')
  ) with check (
    is_admin() or (member_id = my_member_id() and status = 'pending')
  );

drop policy if exists "welfare_admin_delete" on welfare_requests;
create policy "welfare_admin_delete" on welfare_requests
  for delete using (is_admin());

-- ============================ WELFARE APPROVALS ============================
drop policy if exists "welfare_appr_admin_all" on welfare_approvals;
create policy "welfare_appr_admin_all" on welfare_approvals
  for all using (is_admin()) with check (is_admin());

drop policy if exists "welfare_appr_owner_read" on welfare_approvals;
create policy "welfare_appr_owner_read" on welfare_approvals
  for select using (
    is_admin() or exists (
      select 1 from welfare_requests w
      where w.id = welfare_approvals.request_id
        and w.member_id = my_member_id()
    )
  );

-- ============================ PROJECTS ============================
drop policy if exists "projects_read_all" on projects;
create policy "projects_read_all" on projects
  for select using (is_approved());

drop policy if exists "projects_admin_write" on projects;
create policy "projects_admin_write" on projects
  for all using (is_admin()) with check (is_admin());

drop policy if exists "milestones_read_all" on project_milestones;
create policy "milestones_read_all" on project_milestones
  for select using (is_approved());

drop policy if exists "milestones_admin_write" on project_milestones;
create policy "milestones_admin_write" on project_milestones
  for all using (is_admin()) with check (is_admin());

drop policy if exists "expenses_read_all" on project_expenses;
create policy "expenses_read_all" on project_expenses
  for select using (is_approved());

drop policy if exists "expenses_admin_write" on project_expenses;
create policy "expenses_admin_write" on project_expenses
  for all using (is_admin()) with check (is_admin());

-- ============================ MEETINGS ============================
drop policy if exists "meetings_read_all" on meetings;
create policy "meetings_read_all" on meetings
  for select using (is_approved());

drop policy if exists "meetings_admin_write" on meetings;
create policy "meetings_admin_write" on meetings
  for all using (is_admin()) with check (is_admin());

drop policy if exists "attendance_read_all" on meeting_attendance;
create policy "attendance_read_all" on meeting_attendance
  for select using (is_approved());

drop policy if exists "attendance_admin_write" on meeting_attendance;
create policy "attendance_admin_write" on meeting_attendance
  for all using (is_admin()) with check (is_admin());

drop policy if exists "minutes_read_all" on meeting_minutes;
create policy "minutes_read_all" on meeting_minutes
  for select using (is_approved());

drop policy if exists "minutes_admin_write" on meeting_minutes;
create policy "minutes_admin_write" on meeting_minutes
  for all using (is_admin()) with check (is_admin());

drop policy if exists "actions_read_relevant" on action_items;
create policy "actions_read_relevant" on action_items
  for select using (
    is_admin() or assigned_to = auth.uid() or is_approved()
  );

drop policy if exists "actions_admin_write" on action_items;
create policy "actions_admin_write" on action_items
  for all using (is_admin()) with check (is_admin());

drop policy if exists "actions_self_complete" on action_items;
create policy "actions_self_complete" on action_items
  for update using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());

drop policy if exists "resolutions_read_all" on resolutions;
create policy "resolutions_read_all" on resolutions
  for select using (is_approved());

drop policy if exists "resolutions_admin_write" on resolutions;
create policy "resolutions_admin_write" on resolutions
  for all using (is_admin()) with check (is_admin());

drop policy if exists "votes_read_all" on resolution_votes;
create policy "votes_read_all" on resolution_votes
  for select using (is_approved());

drop policy if exists "votes_self_cast" on resolution_votes;
create policy "votes_self_cast" on resolution_votes
  for insert with check (voter_id = auth.uid() and is_approved());

drop policy if exists "votes_self_change" on resolution_votes;
create policy "votes_self_change" on resolution_votes
  for update using (voter_id = auth.uid()) with check (voter_id = auth.uid());

-- ============================ INVENTORY ============================
drop policy if exists "inv_cat_read_all" on inventory_categories;
create policy "inv_cat_read_all" on inventory_categories
  for select using (is_approved());

drop policy if exists "inv_cat_admin_write" on inventory_categories;
create policy "inv_cat_admin_write" on inventory_categories
  for all using (is_admin()) with check (is_admin());

drop policy if exists "inv_items_read_all" on inventory_items;
create policy "inv_items_read_all" on inventory_items
  for select using (is_approved());

drop policy if exists "inv_items_admin_write" on inventory_items;
create policy "inv_items_admin_write" on inventory_items
  for all using (is_admin()) with check (is_admin());

drop policy if exists "inv_txn_read_all" on inventory_transactions;
create policy "inv_txn_read_all" on inventory_transactions
  for select using (is_approved());

drop policy if exists "inv_txn_admin_write" on inventory_transactions;
create policy "inv_txn_admin_write" on inventory_transactions
  for all using (is_admin()) with check (is_admin());

-- ============================ ANNOUNCEMENTS / NOTIFICATIONS ============================
drop policy if exists "ann_read_all" on announcements;
create policy "ann_read_all" on announcements
  for select using (
    published and is_approved()
    and (audience = 'all'
         or (audience = 'admins' and is_admin())
         or (audience = 'members'))
  );

drop policy if exists "ann_admin_write" on announcements;
create policy "ann_admin_write" on announcements
  for all using (is_admin()) with check (is_admin());

drop policy if exists "notif_self_read" on notifications;
create policy "notif_self_read" on notifications
  for select using (user_id = auth.uid());

drop policy if exists "notif_self_update" on notifications;
create policy "notif_self_update" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notif_admin_insert" on notifications;
create policy "notif_admin_insert" on notifications
  for insert with check (is_admin());

drop policy if exists "notif_admin_delete" on notifications;
create policy "notif_admin_delete" on notifications
  for delete using (is_admin() or user_id = auth.uid());

-- ============================ AUDIT LOGS ============================
drop policy if exists "audit_admin_read" on audit_logs;
create policy "audit_admin_read" on audit_logs
  for select using (is_admin());

drop policy if exists "audit_authenticated_insert" on audit_logs;
create policy "audit_authenticated_insert" on audit_logs
  for insert with check (auth.uid() is not null);
