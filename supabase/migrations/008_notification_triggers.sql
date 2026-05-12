-- =========================================================================
-- Nyacaba Welfare Management System - Event-driven Notifications
-- =========================================================================
-- Fans out in-app notifications when meaningful things happen:
--   • New pledge       → leadership (admin / chair / treasurer / welfare_chair)
--   • New welfare req. → leadership (welfare-eligible)
--   • New meeting      → all approved members
--   • New active member→ all approved members
--   • New inventory    → leadership
--
-- Welfare DECISIONS (approve/reject) live in migration 009 because they
-- couple with the dual-approval logic.
--
-- Run AFTER 007_audit_triggers.sql. Idempotent.
-- =========================================================================

-- =========================================================================
-- 1. NOTIFICATION HELPER FUNCTIONS
-- =========================================================================

create or replace function public.notify_staff(
  p_title text, p_body text, p_link text, p_exclude uuid default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into notifications (user_id, title, body, link, channel)
  select p.id, p_title, p_body, p_link, 'in_app'
  from profiles p
  where p.approval_status = 'approved'
    and p.role in ('admin', 'chairperson', 'treasurer', 'welfare_chair')
    and (p_exclude is null or p.id != p_exclude);
$$;

create or replace function public.notify_all_approved(
  p_title text, p_body text, p_link text, p_exclude uuid default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into notifications (user_id, title, body, link, channel)
  select p.id, p_title, p_body, p_link, 'in_app'
  from profiles p
  where p.approval_status = 'approved'
    and (p_exclude is null or p.id != p_exclude);
$$;

create or replace function public.notify_user(
  p_user_id uuid, p_title text, p_body text, p_link text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into notifications (user_id, title, body, link, channel)
  values (p_user_id, p_title, p_body, p_link, 'in_app');
$$;

-- =========================================================================
-- 2. PER-EVENT TRIGGERS
-- =========================================================================

-- New pledge → leadership
create or replace function public.trg_notify_new_pledge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_name text;
begin
  select full_name into v_member_name from members where id = new.member_id;
  perform notify_staff(
    '🤝 New pledge: ' || coalesce(v_member_name, 'A member'),
    'KSh ' || to_char(new.pledge_amount, 'FM999,999,990') || ' for: ' || new.purpose,
    '/pledges',
    new.created_by
  );
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_new_pledge on pledges;
create trigger trg_notify_new_pledge
  after insert on pledges
  for each row execute function trg_notify_new_pledge();

-- New welfare request → leadership
create or replace function public.trg_notify_new_welfare_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_name text;
begin
  select full_name into v_member_name from members where id = new.member_id;
  perform notify_staff(
    '🆘 New welfare request: ' || new.title,
    coalesce(v_member_name, 'A member') || ' requested KSh '
      || to_char(new.amount_requested, 'FM999,999,990')
      || ' (' || new.category || ', ' || new.urgency || ')',
    '/welfare/' || new.id,
    new.submitted_by
  );
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_new_welfare_request on welfare_requests;
create trigger trg_notify_new_welfare_request
  after insert on welfare_requests
  for each row execute function trg_notify_new_welfare_request();

-- New meeting → everyone
create or replace function public.trg_notify_new_meeting()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform notify_all_approved(
    '📅 New meeting: ' || new.title,
    'Scheduled for ' || to_char(new.meeting_date, 'Dy DD Mon YYYY, HH24:MI')
      || coalesce(' at ' || new.location, ''),
    '/meetings/' || new.id,
    new.created_by
  );
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_new_meeting on meetings;
create trigger trg_notify_new_meeting
  after insert on meetings
  for each row execute function trg_notify_new_meeting();

-- New active member → everyone (welcome)
create or replace function public.trg_notify_new_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' then
    perform notify_all_approved(
      '👋 Karibu ' || new.full_name,
      new.full_name || ' has joined the church family.',
      '/members/' || new.id,
      null
    );
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_new_member on members;
create trigger trg_notify_new_member
  after insert on members
  for each row execute function trg_notify_new_member();

-- Also: when a member is reactivated or status switches to active
create or replace function public.trg_notify_member_activated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and old.status <> 'active' then
    perform notify_all_approved(
      '👋 ' || new.full_name || ' is back',
      new.full_name || ' is once again an active member.',
      '/members/' || new.id,
      null
    );
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_member_activated on members;
create trigger trg_notify_member_activated
  after update of status on members
  for each row execute function trg_notify_member_activated();

-- New inventory item → leadership (members don't care about every spoon)
create or replace function public.trg_notify_new_inventory_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform notify_staff(
    '📦 New inventory: ' || new.name,
    'Stock added: ' || to_char(new.quantity, 'FM999,999,990.##')
      || ' ' || coalesce(new.unit, 'pcs'),
    '/inventory/' || new.id,
    new.created_by
  );
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_new_inventory_item on inventory_items;
create trigger trg_notify_new_inventory_item
  after insert on inventory_items
  for each row execute function trg_notify_new_inventory_item();

-- =========================================================================
-- END
-- =========================================================================
