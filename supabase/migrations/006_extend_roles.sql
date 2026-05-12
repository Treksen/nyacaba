-- =========================================================================
-- Nyacaba — Extended Roles, Pass 2
-- =========================================================================
-- Run this AFTER you've run the three `alter type user_role add value`
-- statements as a separate query. This file contains everything else:
-- helper functions, RLS policy rewrites, and the announcement trigger.
-- Safe to re-run; all operations are idempotent.
-- =========================================================================

-- ---- HELPER FUNCTIONS ---------------------------------------------------

create or replace function public.is_admin_or_chair()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and role in ('admin', 'chairperson')
  );
$$;

create or replace function public.can_manage_finances()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and role in ('admin', 'chairperson', 'treasurer')
  );
$$;

create or replace function public.can_manage_welfare()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and role in ('admin', 'chairperson', 'welfare_chair')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and role in ('admin', 'chairperson', 'treasurer', 'welfare_chair')
  );
$$;

-- ---- RLS POLICY REWRITES -----------------------------------------------

-- PROFILES
drop policy if exists "profiles_admin_read_all" on profiles;
create policy "profiles_admin_read_all" on profiles
  for select using (is_staff());

drop policy if exists "profiles_admin_update" on profiles;
create policy "profiles_admin_update" on profiles
  for update using (is_admin_or_chair());

-- WELFARE GROUPS
drop policy if exists "groups_admin_write" on welfare_groups;
create policy "groups_admin_write" on welfare_groups
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

-- MEMBERS
drop policy if exists "members_admin_write" on members;
create policy "members_admin_write" on members
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

-- CONTRIBUTIONS
drop policy if exists "contrib_admin_write" on contributions;
create policy "contrib_admin_write" on contributions
  for all using (can_manage_finances()) with check (can_manage_finances());

-- PLEDGES
drop policy if exists "pledges_admin_update" on pledges;
create policy "pledges_admin_update" on pledges
  for update using (can_manage_finances()) with check (can_manage_finances());

drop policy if exists "pledges_admin_delete" on pledges;
create policy "pledges_admin_delete" on pledges
  for delete using (can_manage_finances());

-- WELFARE REQUESTS
drop policy if exists "welfare_self_update_pending" on welfare_requests;
create policy "welfare_self_update_pending" on welfare_requests
  for update using (
    can_manage_welfare()
    or (member_id = my_member_id() and status = 'pending')
  ) with check (
    can_manage_welfare()
    or (member_id = my_member_id() and status = 'pending')
  );

drop policy if exists "welfare_admin_delete" on welfare_requests;
create policy "welfare_admin_delete" on welfare_requests
  for delete using (is_admin_or_chair());

-- WELFARE APPROVALS
drop policy if exists "welfare_appr_admin_all" on welfare_approvals;
create policy "welfare_appr_admin_all" on welfare_approvals
  for all using (can_manage_welfare()) with check (can_manage_welfare());

-- PROJECTS, MILESTONES, EXPENSES
drop policy if exists "projects_admin_write" on projects;
create policy "projects_admin_write" on projects
  for all using (can_manage_finances()) with check (can_manage_finances());

drop policy if exists "milestones_admin_write" on project_milestones;
create policy "milestones_admin_write" on project_milestones
  for all using (can_manage_finances()) with check (can_manage_finances());

drop policy if exists "expenses_admin_write" on project_expenses;
create policy "expenses_admin_write" on project_expenses
  for all using (can_manage_finances()) with check (can_manage_finances());

-- MEETINGS, MINUTES, ACTIONS, RESOLUTIONS
drop policy if exists "meetings_admin_write" on meetings;
create policy "meetings_admin_write" on meetings
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

drop policy if exists "attendance_admin_write" on meeting_attendance;
create policy "attendance_admin_write" on meeting_attendance
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

drop policy if exists "minutes_admin_write" on meeting_minutes;
create policy "minutes_admin_write" on meeting_minutes
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

drop policy if exists "actions_admin_write" on action_items;
create policy "actions_admin_write" on action_items
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

drop policy if exists "resolutions_admin_write" on resolutions;
create policy "resolutions_admin_write" on resolutions
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

-- INVENTORY
drop policy if exists "inv_cat_admin_write" on inventory_categories;
create policy "inv_cat_admin_write" on inventory_categories
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

drop policy if exists "inv_items_admin_write" on inventory_items;
create policy "inv_items_admin_write" on inventory_items
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

drop policy if exists "inv_txn_admin_write" on inventory_transactions;
create policy "inv_txn_admin_write" on inventory_transactions
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

-- ANNOUNCEMENTS
drop policy if exists "ann_read_all" on announcements;
create policy "ann_read_all" on announcements
  for select using (
    published and is_approved()
    and (audience = 'all'
         or (audience = 'admins' and is_staff())
         or (audience = 'members'))
  );

drop policy if exists "ann_admin_write" on announcements;
create policy "ann_admin_write" on announcements
  for all using (is_admin_or_chair()) with check (is_admin_or_chair());

-- NOTIFICATIONS
drop policy if exists "notif_admin_insert" on notifications;
create policy "notif_admin_insert" on notifications
  for insert with check (is_staff());

-- ---- ANNOUNCEMENT TRIGGER (updated semantics for 'admins' audience) -----

create or replace function public.notify_on_announcement()
returns trigger language plpgsql as $$
begin
  if new.published then
    insert into notifications (user_id, title, body, link, channel)
    select p.id,
           '📢 ' || new.title,
           coalesce(left(new.body, 200), ''),
           '/announcements',
           'in_app'
    from profiles p
    where p.approval_status = 'approved'
      and (
        new.audience = 'all'
        or (new.audience = 'admins' and p.role <> 'member')
        or (new.audience = 'members' and p.role = 'member')
      );
  end if;
  return new;
end $$;

-- =========================================================================
-- END
-- =========================================================================