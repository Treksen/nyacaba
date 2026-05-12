-- =========================================================================
-- Nyacaba Welfare Management System - More Fixes
-- =========================================================================
-- 1. The leader who SUBMITS a welfare request on behalf of someone cannot
--    approve or reject that same request. Two OTHER leaders must decide.
--    (Previously the trigger only checked the beneficiary's profile.)
--
-- 2. The submitter of a welfare request can delete it while it is still
--    pending — useful for fixing mistakes before any leader has decided.
--
-- Run AFTER 012. Idempotent.
-- =========================================================================

-- =========================================================================
-- 1. EXPAND SELF-APPROVAL BAN — submitter is also blocked
-- =========================================================================
create or replace function public.prevent_self_welfare_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_profile uuid;
  v_submitter         uuid;
begin
  -- Only block actual decisions; "request_info" is fine.
  if new.decision not in ('approve', 'reject') then
    return new;
  end if;

  -- Beneficiary's linked profile (who the request is FOR)
  select m.profile_id into v_requester_profile
  from welfare_requests wr
  join members m on m.id = wr.member_id
  where wr.id = new.request_id;

  -- Submitter (who entered the request into the system)
  select submitted_by into v_submitter
  from welfare_requests
  where id = new.request_id;

  if (v_requester_profile is not null and new.approver_id = v_requester_profile) then
    raise exception
      'You cannot approve or reject a welfare request that is for you. Two other leaders must decide.'
      using errcode = 'P0001';
  end if;

  if (v_submitter is not null and new.approver_id = v_submitter) then
    raise exception
      'You cannot approve or reject a welfare request you submitted. Two other leaders must decide.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

-- =========================================================================
-- 2. SUBMITTER CAN DELETE WHILE PENDING
-- =========================================================================
drop policy if exists "welfare_admin_delete" on welfare_requests;
create policy "welfare_admin_delete" on welfare_requests
  for delete using (
    is_admin_or_chair()
    or (submitted_by = auth.uid() and status in ('pending', 'under_review'))
  );

-- =========================================================================
-- END
-- =========================================================================
