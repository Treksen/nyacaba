-- =========================================================================
-- Nyacaba Welfare Management System - Deposit Pattern Analytics
-- =========================================================================
-- Extends church_finance_summary() to also return the day-of-month deposit
-- pattern — sum of confirmed contributions grouped by day of the month
-- (1..31) across the last 12 months. Used by the dashboard to show when in
-- the month members typically give, so the treasurer can time reminders.
--
-- Still aggregate-only, no member identities exposed.
--
-- Run AFTER 014_polish_and_aggregates.sql. Idempotent.
-- =========================================================================

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
  ),
  -- NEW: day-of-month pattern across last 12 months
  d_pattern as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day', day_of_month,
          'total', total_amount,
          'count', txn_count
        )
        order by day_of_month
      ),
      '[]'::jsonb
    ) as data
    from (
      select
        extract(day from contribution_date)::int as day_of_month,
        sum(amount) as total_amount,
        count(*) as txn_count
      from confirmed
      where contribution_date >= (now() - interval '12 months')
      group by extract(day from contribution_date)
    ) d
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
    'day_of_month_pattern', d_pattern.data,
    'generated_at', now()
  )
  into v_result
  from m_breakdown, t_breakdown, d_pattern;

  return v_result;
end $$;

grant execute on function public.church_finance_summary() to authenticated;

-- =========================================================================
-- END
-- =========================================================================
