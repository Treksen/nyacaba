-- =========================================================================
-- Nyacaba Welfare Management System - Dual-approval Welfare
-- =========================================================================
-- Requires at least TWO distinct leaders (admin / chair / treasurer /
-- welfare_chair) to approve a welfare request before status flips to
-- 'approved' and the request becomes eligible for disbursement.
--
-- Any single rejection is final.
--
-- Run AFTER 008_notification_triggers.sql. Idempotent.
-- =========================================================================

-- =========================================================================
-- 1. EXPAND can_manage_welfare() TO INCLUDE TREASURER
-- =========================================================================
-- Treasurer now also has welfare-decision authority since they have
-- financial oversight of disbursements.
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
      and role in ('admin', 'chairperson', 'treasurer', 'welfare_chair')
  );
$$;

-- =========================================================================
-- 2. TALLY TRIGGER — recomputes welfare_request status on every approval
-- =========================================================================
-- Logic:
--   • Any distinct rejection → status = 'rejected'   (one veto is enough)
--   • 2+ distinct approvers → status = 'approved'    (eligible for disburse)
--   • 1 distinct approver  → status = 'under_review' (one more needed)
--   • 0                    → status = 'pending'      (no decisions yet)
--
-- amount_approved gets set to the latest approver's specified amount.
-- Requests already 'disbursed' or 'closed' are never touched.
-- =========================================================================
create or replace function public.tally_welfare_approvals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id     uuid;
  v_n_approvers    int;
  v_n_rejecters    int;
  v_latest_amount  numeric(14,2);
  v_new_status     welfare_status;
begin
  v_request_id := coalesce(new.request_id, old.request_id);

  -- Count DISTINCT people who have currently approved / rejected.
  -- If someone approves twice (e.g. changed mind on amount), they still count as 1 approver.
  -- If they approved then later rejected, the latest decision is what's stored
  -- (the UI upserts on (request_id, approver_id)), so they count as 1 rejecter.
  select
    count(distinct approver_id) filter (where decision = 'approve'),
    count(distinct approver_id) filter (where decision = 'reject')
  into v_n_approvers, v_n_rejecters
  from welfare_approvals
  where request_id = v_request_id;

  -- Latest approve amount (most recent approve wins)
  select approved_amount into v_latest_amount
  from welfare_approvals
  where request_id = v_request_id
    and decision = 'approve'
    and approved_amount is not null
  order by decided_at desc
  limit 1;

  if v_n_rejecters > 0 then
    v_new_status := 'rejected';
  elsif v_n_approvers >= 2 then
    v_new_status := 'approved';
  elsif v_n_approvers = 1 then
    v_new_status := 'under_review';
  else
    v_new_status := 'pending';
  end if;

  update welfare_requests
  set status = v_new_status,
      amount_approved = case
        when v_new_status = 'approved' then v_latest_amount
        else amount_approved
      end
  where id = v_request_id
    and status not in ('disbursed', 'closed');

  return coalesce(new, old);
exception when others then
  return coalesce(new, old);
end $$;

drop trigger if exists trg_tally_welfare_ins on welfare_approvals;
create trigger trg_tally_welfare_ins
  after insert on welfare_approvals
  for each row execute function tally_welfare_approvals();

drop trigger if exists trg_tally_welfare_upd on welfare_approvals;
create trigger trg_tally_welfare_upd
  after update on welfare_approvals
  for each row execute function tally_welfare_approvals();

drop trigger if exists trg_tally_welfare_del on welfare_approvals;
create trigger trg_tally_welfare_del
  after delete on welfare_approvals
  for each row execute function tally_welfare_approvals();

-- =========================================================================
-- 3. ENSURE ONE DECISION PER (request, approver)
-- =========================================================================
-- Adding a unique constraint so that re-deciding overwrites instead of
-- piling up. If you already have duplicate approval rows, this will fail —
-- run `delete from welfare_approvals where id in (select id from ... group by approver_id, request_id having count(*) > 1)`
-- first, or skip this constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'welfare_approvals_unique_decision_per_approver'
  ) then
    begin
      alter table welfare_approvals
        add constraint welfare_approvals_unique_decision_per_approver
        unique (request_id, approver_id);
    exception when unique_violation then
      raise notice 'Skipping unique constraint — duplicates exist. Clean up first.';
    end;
  end if;
end $$;

-- =========================================================================
-- 4. WELFARE-DECISION NOTIFICATIONS (status-aware)
-- =========================================================================
-- Fires AFTER the tally trigger has updated welfare_requests.status.
-- Uses count-of-distinct-approvers to send the right message:
--   • 1st approve, more needed → notify other leaders to follow up
--   • 2nd approve, request now approved → notify the requesting member
--   • Any rejection → notify the requesting member
--   • request_info → notify the requesting member
-- =========================================================================
create or replace function public.trg_notify_welfare_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req            welfare_requests%rowtype;
  v_member_profile uuid;
  v_n_approvers    int;
  v_decider_name   text;
begin
  select * into v_req from welfare_requests where id = new.request_id;
  if not found then return new; end if;

  select profile_id into v_member_profile from members where id = v_req.member_id;
  select full_name  into v_decider_name   from profiles where id = new.approver_id;

  select count(distinct approver_id) filter (where decision = 'approve')
    into v_n_approvers
  from welfare_approvals
  where request_id = new.request_id;

  if new.decision = 'reject' then
    if v_member_profile is not null then
      perform notify_user(
        v_member_profile,
        '✗ Welfare request not approved',
        'Your request "' || v_req.title || '" was reviewed and not approved.' ||
          coalesce(' Note: ' || new.comments, ''),
        '/welfare/' || v_req.id
      );
    end if;

  elsif new.decision = 'approve' and v_n_approvers >= 2 then
    -- Fully approved
    if v_member_profile is not null then
      perform notify_user(
        v_member_profile,
        '✓ Welfare request approved',
        'Your request "' || v_req.title || '" has been approved by leadership and is ready for disbursement.',
        '/welfare/' || v_req.id
      );
    end if;

  elsif new.decision = 'approve' and v_n_approvers = 1 then
    -- First approval — ping other leaders that a second is needed
    perform notify_staff(
      '🔔 Second approval needed',
      coalesce(v_decider_name, 'A leader') || ' approved "' || v_req.title || '". One more approval required.',
      '/welfare/' || v_req.id,
      new.approver_id
    );

  elsif new.decision = 'request_info' then
    if v_member_profile is not null then
      perform notify_user(
        v_member_profile,
        '… More info needed',
        coalesce(new.comments, 'A reviewer is asking for more details about: ' || v_req.title),
        '/welfare/' || v_req.id
      );
    end if;
  end if;

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_notify_welfare_decision on welfare_approvals;
create trigger trg_notify_welfare_decision
  after insert on welfare_approvals
  for each row execute function trg_notify_welfare_decision();

-- =========================================================================
-- END
-- =========================================================================
