-- =========================================================================
-- Nyacaba Welfare Management System - Fix Auto-numbering Functions
-- =========================================================================
-- The original gen_welfare_request_no() and gen_membership_no() functions
-- used `count(*) + 1` which causes duplicate-key violations after a row is
-- deleted (the count drops back, and the next insert reuses a number that
-- already exists).
--
-- Switching to MAX(suffix) + 1 makes the numbering monotonic regardless of
-- deletions.
--
-- Run AFTER 010_more_notifications.sql. Idempotent and safe to re-run.
-- =========================================================================

-- =========================================================================
-- 1. WELFARE REQUEST NUMBER GENERATOR
-- =========================================================================
create or replace function public.gen_welfare_request_no()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year text := extract(year from coalesce(new.submitted_at, now()))::text;
  v_next int;
begin
  if new.request_no is null then
    select coalesce(
      max(nullif(substring(request_no from 'WR-\d+-(\d+)'), '')::int),
      0
    ) + 1
    into v_next
    from welfare_requests
    where request_no like 'WR-' || v_year || '-%';

    new.request_no := 'WR-' || v_year || '-' || lpad(v_next::text, 4, '0');
  end if;
  return new;
end $$;

-- =========================================================================
-- 2. MEMBERSHIP NUMBER GENERATOR (same pattern — fix preemptively)
-- =========================================================================
create or replace function public.gen_membership_no()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next int;
begin
  if new.membership_no is null then
    select coalesce(
      max(nullif(substring(membership_no from 'NYM-(\d+)'), '')::int),
      0
    ) + 1
    into v_next
    from members
    where membership_no like 'NYM-%';

    new.membership_no := 'NYM-' || lpad(v_next::text, 4, '0');
  end if;
  return new;
end $$;

-- The triggers themselves are unchanged from migration 003; replacing
-- the underlying functions is all that's needed.

-- =========================================================================
-- END
-- =========================================================================
