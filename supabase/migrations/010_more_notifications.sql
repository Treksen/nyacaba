-- =========================================================================
-- Nyacaba Welfare Management System - Broaden Notification Reach
-- =========================================================================
-- Extends migration 008 so that more events notify ALL approved members
-- rather than just leadership.
--
-- Newly notified for ALL members:
--   • New project launched
--
-- Now notifies ALL members (was: leadership only):
--   • New inventory item added
--
-- PERSONAL notification (only the contributor receives it):
--   • New contribution recorded — quiet "thank you, your gift was logged"
--
-- Still leadership-only (sensitive personal data):
--   • New pledge      — financial commitment is personal
--   • Welfare request — reveals personal hardship
--   • Disbursements   — private to the recipient
--
-- Run AFTER 008_notification_triggers.sql. Idempotent.
-- =========================================================================

-- =========================================================================
-- 1. INVENTORY ITEM TRIGGER — switch from staff to all members
-- =========================================================================
create or replace function public.trg_notify_new_inventory_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform notify_all_approved(
    '📦 New inventory: ' || new.name,
    'Stock added: ' || to_char(new.quantity, 'FM999,999,990.##')
      || ' ' || coalesce(new.unit, 'pcs')
      || coalesce(' (' || new.location || ')', ''),
    '/inventory/' || new.id,
    new.created_by
  );
  return new;
exception when others then return new;
end $$;
-- Trigger already exists from 008; replacing the function is enough.

-- =========================================================================
-- 2. CONTRIBUTION TRIGGER — PERSONAL to the contributor only
-- =========================================================================
-- Looks up the contributor's linked profile via members.profile_id and
-- sends a single confirmation to that person. Silent if the member has
-- no linked user account (some members aren't system users yet).
create or replace function public.trg_notify_new_contribution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_profile uuid;
  v_type_label     text;
begin
  -- Find the contributor's auth profile (if linked)
  select profile_id into v_member_profile
  from members
  where id = new.member_id;

  -- Skip silently if this member has no linked user account
  if v_member_profile is null then
    return new;
  end if;

  v_type_label := case new.contribution_type
    when 'monthly'  then 'monthly contribution'
    when 'tithe'    then 'tithe'
    when 'offering' then 'offering'
    when 'pledge'   then 'pledge payment'
    when 'project'  then 'project contribution'
    when 'special'  then 'special gift'
    else new.contribution_type::text
  end;

  perform notify_user(
    v_member_profile,
    '✓ Contribution recorded',
    'Thank you! Your ' || v_type_label || ' of KSh '
      || to_char(new.amount, 'FM999,999,990.##')
      || ' has been recorded'
      || coalesce(' (ref ' || new.reference_no || ')', '') || '.',
    '/my-giving'
  );

  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_new_contribution on contributions;
create trigger trg_notify_new_contribution
  after insert on contributions
  for each row execute function trg_notify_new_contribution();

-- =========================================================================
-- 3. PROJECT TRIGGER — new, notifies ALL members
-- =========================================================================
create or replace function public.trg_notify_new_project()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform notify_all_approved(
    '🛠️ New project: ' || new.name,
    coalesce(
      left(new.description, 160),
      'A new church project has been launched.'
    ) || coalesce(' · Budget: KSh ' || to_char(new.budget, 'FM999,999,990'), ''),
    '/projects/' || new.id,
    new.created_by
  );
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_new_project on projects;
create trigger trg_notify_new_project
  after insert on projects
  for each row execute function trg_notify_new_project();

-- =========================================================================
-- END
-- =========================================================================
