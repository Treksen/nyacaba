-- =========================================================================
-- Nyacaba Welfare Management System - Welfare RLS Fixes + Contribution
-- Self-Reporting Workflow
-- =========================================================================
-- Fixes:
--   1. Welfare chair / treasurer / chairperson couldn't see or create
--      welfare requests because migration 006 missed updating SELECT and
--      INSERT policies (they still used is_admin()).
--   2. Welfare requesters could approve their own requests — now blocked.
--
-- Adds:
--   3. Members can self-record their contributions, which must be
--      verified by an admin or treasurer before they count.
--
-- Run AFTER 011_fix_autonumber.sql. Idempotent.
-- =========================================================================

-- =========================================================================
-- 1. FIX WELFARE_REQUESTS RLS — SELECT + INSERT now welfare-eligible
-- =========================================================================
drop policy if exists "welfare_self_read" on welfare_requests;
create policy "welfare_self_read" on welfare_requests
  for select using (
    can_manage_welfare() or member_id = my_member_id()
  );

drop policy if exists "welfare_self_create" on welfare_requests;
create policy "welfare_self_create" on welfare_requests
  for insert with check (
    can_manage_welfare() or member_id = my_member_id()
  );

-- =========================================================================
-- 2. PREVENT SELF-APPROVAL OF WELFARE REQUESTS
-- =========================================================================
-- A welfare chair / chairperson / treasurer / admin who submitted a
-- request for themselves cannot also approve it.
-- Two OTHER leaders must still independently approve.
-- =========================================================================
create or replace function public.prevent_self_welfare_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_profile uuid;
begin
  -- Only block actual decisions (approve / reject). request_info is fine
  -- because it doesn't move the request toward approval.
  if new.decision not in ('approve', 'reject') then
    return new;
  end if;

  select m.profile_id into v_requester_profile
  from welfare_requests wr
  join members m on m.id = wr.member_id
  where wr.id = new.request_id;

  if v_requester_profile is not null
     and new.approver_id = v_requester_profile then
    raise exception
      'You cannot approve or reject your own welfare request. Two other leaders must decide.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists trg_prevent_self_welfare_approval on welfare_approvals;
create trigger trg_prevent_self_welfare_approval
  before insert or update on welfare_approvals
  for each row execute function prevent_self_welfare_approval();

-- =========================================================================
-- 3. CONTRIBUTION VERIFICATION SCHEMA
-- =========================================================================
-- New enum + columns to track verification state.
-- Existing rows default to 'confirmed' (they were recorded by staff and
-- are already trusted).
-- =========================================================================
do $$ begin
  create type contribution_verification as enum ('pending', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

alter table contributions
  add column if not exists verification_status contribution_verification not null default 'confirmed',
  add column if not exists verified_by uuid references profiles(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists rejection_reason text;

create index if not exists idx_contributions_verification_status
  on contributions(verification_status)
  where verification_status = 'pending';

-- =========================================================================
-- 4. HELPER: who can verify contributions
-- =========================================================================
-- Only admin or treasurer. NOT chairperson (per user spec).
create or replace function public.can_verify_contributions()
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
      and role in ('admin', 'treasurer')
  );
$$;

-- =========================================================================
-- 5. AUTO-SET VERIFICATION ON INSERT
-- =========================================================================
-- When a contribution is inserted:
--   • If the recorder is an admin / chair / treasurer → 'confirmed'
--   • Otherwise (a regular member self-reporting)     → 'pending'
-- =========================================================================
create or replace function public.set_contribution_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recorder_role user_role;
begin
  -- If a value was explicitly passed, leave it alone (lets staff override if needed)
  if new.verification_status is null then
    new.verification_status := 'confirmed';
  end if;

  -- Force pending if the recorder is just a member
  select role into v_recorder_role from profiles where id = new.recorded_by;
  if v_recorder_role = 'member' then
    new.verification_status := 'pending';
    new.verified_by := null;
    new.verified_at := null;
  elsif new.verification_status = 'confirmed' then
    -- Staff recording: stamp verified info automatically
    new.verified_by := coalesce(new.verified_by, new.recorded_by);
    new.verified_at := coalesce(new.verified_at, now());
  end if;

  return new;
end $$;

drop trigger if exists trg_set_contribution_verification on contributions;
create trigger trg_set_contribution_verification
  before insert on contributions
  for each row execute function set_contribution_verification();

-- =========================================================================
-- 6. GUARD: only admin/treasurer can change verification status
-- =========================================================================
create or replace function public.guard_contribution_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
begin
  if old.verification_status is distinct from new.verification_status then
    select role into v_role from profiles where id = auth.uid();
    if v_role not in ('admin', 'treasurer') then
      raise exception
        'Only admin or treasurer can change a contribution''s verification status.'
        using errcode = 'P0001';
    end if;
    -- Stamp who verified and when
    if new.verification_status in ('confirmed', 'rejected') then
      new.verified_by := auth.uid();
      new.verified_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_contribution_verification on contributions;
create trigger trg_guard_contribution_verification
  before update on contributions
  for each row execute function guard_contribution_verification_change();

-- =========================================================================
-- 7. RLS UPDATES FOR contributions
-- =========================================================================
-- Members can:
--   • INSERT contributions for themselves (will be pending)
--   • UPDATE their own pending contributions (edit before verification)
-- Staff with can_manage_finances() can still do everything (existing).

-- Allow self-insert for members
drop policy if exists "contrib_member_self_insert" on contributions;
create policy "contrib_member_self_insert" on contributions
  for insert with check (
    can_manage_finances()
    or (
      member_id = my_member_id()
      and recorded_by = auth.uid()
      and is_approved()
    )
  );

-- Make sure the staff-write policy stays
drop policy if exists "contrib_admin_write" on contributions;
create policy "contrib_admin_write" on contributions
  for all using (can_manage_finances()) with check (can_manage_finances());

-- Allow member to edit their own PENDING contribution (resubmit-before-verify)
drop policy if exists "contrib_member_self_update_pending" on contributions;
create policy "contrib_member_self_update_pending" on contributions
  for update using (
    can_manage_finances()
    or (
      member_id = my_member_id()
      and recorded_by = auth.uid()
      and verification_status = 'pending'
    )
  ) with check (
    can_manage_finances()
    or (
      member_id = my_member_id()
      and recorded_by = auth.uid()
      and verification_status = 'pending'
    )
  );

-- Members can delete their OWN pending self-reports (in case of typos)
drop policy if exists "contrib_member_self_delete_pending" on contributions;
create policy "contrib_member_self_delete_pending" on contributions
  for delete using (
    can_manage_finances()
    or (
      member_id = my_member_id()
      and recorded_by = auth.uid()
      and verification_status = 'pending'
    )
  );

-- =========================================================================
-- 8. PLEDGE-PROGRESS RECOMPUTE — confirmed contributions only
-- =========================================================================
create or replace function public.recompute_pledge_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pledge_id uuid;
  v_paid numeric(14,2);
begin
  -- Find the affected pledge (if any)
  v_pledge_id := coalesce(new.pledge_id, old.pledge_id);
  if v_pledge_id is null then return coalesce(new, old); end if;

  -- Sum only CONFIRMED contributions
  select coalesce(sum(amount), 0)
    into v_paid
  from contributions
  where pledge_id = v_pledge_id
    and verification_status = 'confirmed';

  update pledges
  set paid_amount = v_paid,
      status = case
        when v_paid >= pledge_amount then 'fulfilled'
        when v_paid > 0              then 'partial'
        else 'open'
      end
  where id = v_pledge_id;

  return coalesce(new, old);
exception when others then return coalesce(new, old);
end $$;

-- The trigger needs to also fire on verification_status changes (so when
-- a pending contribution becomes confirmed, the pledge updates). Recreate
-- with the broader trigger spec.
drop trigger if exists trg_recompute_pledge_on_contrib on contributions;
create trigger trg_recompute_pledge_on_contrib
  after insert or update or delete on contributions
  for each row execute function recompute_pledge_progress();

-- =========================================================================
-- 9. NOTIFICATIONS — self-report, verified, rejected
-- =========================================================================
-- (a) Member self-reports → ping admin/treasurer to verify.
-- (b) The original trg_notify_new_contribution (from migration 010) only
--     pings the contributor on insert. We want it to fire only AFTER the
--     contribution is confirmed, not when first submitted. Rewriting it
--     to fire on UPDATE when verification_status flips to 'confirmed',
--     and the INSERT case only fires for already-confirmed (staff-recorded).
-- (c) Rejected contributions ping the member with the reason.
-- =========================================================================

-- (a) Notify verifiers when a member submits a pending self-report
create or replace function public.trg_notify_pending_contribution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_name text;
begin
  if new.verification_status <> 'pending' then
    return new;
  end if;

  select full_name into v_member_name from members where id = new.member_id;

  insert into notifications (user_id, title, body, link, channel)
  select p.id,
         '🔔 Contribution awaiting verification',
         coalesce(v_member_name, 'A member') || ' submitted KSh '
           || to_char(new.amount, 'FM999,999,990.##')
           || coalesce(' (ref ' || new.reference_no || ')', '')
           || ' for your verification.',
         '/contributions?pending=1',
         'in_app'
  from profiles p
  where p.approval_status = 'approved'
    and p.role in ('admin', 'treasurer')
    and p.id <> coalesce(new.recorded_by, '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_pending_contribution on contributions;
create trigger trg_notify_pending_contribution
  after insert on contributions
  for each row execute function trg_notify_pending_contribution();

-- (b) Rewrite the contributor's confirmation notification:
-- Fires on INSERT if status is 'confirmed' (staff-recorded), or on UPDATE
-- when status transitions to 'confirmed' (member self-report just verified).
create or replace function public.trg_notify_new_contribution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_profile uuid;
  v_type_label     text;
  v_should_notify  boolean := false;
begin
  if tg_op = 'INSERT' and new.verification_status = 'confirmed' then
    v_should_notify := true;
  elsif tg_op = 'UPDATE'
        and old.verification_status <> 'confirmed'
        and new.verification_status = 'confirmed' then
    v_should_notify := true;
  end if;

  if not v_should_notify then return new; end if;

  select profile_id into v_member_profile from members where id = new.member_id;
  if v_member_profile is null then return new; end if;

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
      || ' has been ' || (case when tg_op = 'INSERT' then 'recorded' else 'verified and added to your record' end)
      || coalesce(' (ref ' || new.reference_no || ')', '') || '.',
    '/my-giving'
  );

  return new;
exception when others then return new;
end $$;

-- Re-bind trigger to fire on insert AND verification-status update
drop trigger if exists trg_notify_new_contribution on contributions;
create trigger trg_notify_new_contribution
  after insert or update of verification_status on contributions
  for each row execute function trg_notify_new_contribution();

-- (c) Notify member when their contribution is rejected
create or replace function public.trg_notify_rejected_contribution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_profile uuid;
begin
  if old.verification_status = 'rejected' or new.verification_status <> 'rejected' then
    return new;
  end if;

  select profile_id into v_member_profile from members where id = new.member_id;
  if v_member_profile is null then return new; end if;

  perform notify_user(
    v_member_profile,
    '✗ Contribution not verified',
    'Your contribution of KSh ' || to_char(new.amount, 'FM999,999,990.##')
      || ' was not verified.' || coalesce(' Reason: ' || new.rejection_reason, '')
      || ' Please re-submit with the correct details.',
    '/my-giving'
  );

  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_notify_rejected_contribution on contributions;
create trigger trg_notify_rejected_contribution
  after update of verification_status on contributions
  for each row execute function trg_notify_rejected_contribution();

-- =========================================================================
-- END
-- =========================================================================
