-- =========================================================================
-- Nyacaba Welfare Management System - Polish + Anonymous Totals
-- =========================================================================
-- 1. Unique partial index on contributions(member_id, reference_no) so the
--    same M-Pesa code can't be recorded twice for the same member.
--    (Skipped if duplicates already exist — clean those up first.)
--
-- 2. SECURITY DEFINER function church_finance_summary() that returns
--    aggregate church-wide contribution totals as a JSONB blob.
--    All authenticated users can call it, regardless of role — but the
--    function never exposes any member names or per-member breakdowns.
--    This powers the "Church Finances" transparency widget.
--
-- Run AFTER 013. Idempotent.
-- =========================================================================

-- =========================================================================
-- 1. DUPLICATE-CONTRIBUTION GUARD
-- =========================================================================
do $$ begin
  if not exists (
    select 1 from pg_indexes
    where indexname = 'idx_contributions_unique_member_ref'
  ) then
    begin
      create unique index idx_contributions_unique_member_ref
        on contributions(member_id, reference_no)
        where reference_no is not null and reference_no <> '';
    exception when unique_violation then
      raise notice
        'Skipping unique constraint on (member_id, reference_no): duplicates already exist. Clean up first.';
    end;
  end if;
end $$;

-- =========================================================================
-- 2. CHURCH-WIDE ANONYMOUS FINANCE SUMMARY
-- =========================================================================
-- Returns aggregates only — no member IDs, names, or per-member amounts.
-- Used by the public-facing Church Finances widget on the Dashboard.
create or replace function public.church_finance_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  with confirmed as (
    select amount, contribution_type, contribution_date
    from contributions
    where verification_status = 'confirmed'
  ),
  m_breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('month', label, 'total', total)
        order by month_start
      ),
      '[]'::jsonb
    ) as data
    from (
      select
        date_trunc('month', contribution_date) as month_start,
        to_char(date_trunc('month', contribution_date), 'Mon ''YY') as label,
        sum(amount) as total
      from confirmed
      where contribution_date >= (now() - interval '12 months')
      group by 1, 2
    ) m
  ),
  t_breakdown as (
    select coalesce(jsonb_object_agg(contribution_type, total), '{}'::jsonb) as data
    from (
      select contribution_type, sum(amount) as total
      from confirmed
      where extract(year from contribution_date) = extract(year from now())
      group by 1
    ) t
  )
  select jsonb_build_object(
    'this_year_total', (
      select coalesce(sum(amount), 0) from confirmed
      where extract(year from contribution_date) = extract(year from now())
    ),
    'this_month_total', (
      select coalesce(sum(amount), 0) from confirmed
      where date_trunc('month', contribution_date) = date_trunc('month', now())
    ),
    'last_month_total', (
      select coalesce(sum(amount), 0) from confirmed
      where date_trunc('month', contribution_date) = date_trunc('month', now() - interval '1 month')
    ),
    'total_members', (select count(*) from members),
    'active_members', (select count(*) from members where status = 'active'),
    'monthly_breakdown', m_breakdown.data,
    'type_breakdown', t_breakdown.data,
    'generated_at', now()
  )
  into v_result
  from m_breakdown, t_breakdown;

  return v_result;
end $$;

grant execute on function public.church_finance_summary() to authenticated;

-- =========================================================================
-- END
-- =========================================================================
