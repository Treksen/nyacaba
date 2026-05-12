-- =========================================================================
-- Nyacaba Welfare Management System - Automated Reminders
-- =========================================================================
-- Adds two pg_cron jobs:
--   • Monthly contribution reminder — fires at 8:00 on the 20th of every
--     month. Pings any active member who hasn't yet recorded a 'monthly'
--     contribution for the current month.
--   • Pledge due reminder — fires daily at 9:00. Pings any pledger whose
--     open/partial pledge falls due within 7 days, dedupe within 3 days.
--
-- PREREQUISITE: pg_cron extension must be enabled.
--   Supabase Dashboard → Database → Extensions → search "pg_cron" → enable.
--
-- Run AFTER 015_deposit_pattern.sql. Idempotent.
-- =========================================================================

-- =========================================================================
-- 1. MONTHLY CONTRIBUTION REMINDER FUNCTION
-- =========================================================================
create or replace function public.send_monthly_contribution_reminders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year  int := extract(year  from now())::int;
  v_month int := extract(month from now())::int;
begin
  insert into notifications (user_id, title, body, link, channel)
  select
    m.profile_id,
    '💰 Monthly contribution reminder',
    'Friendly reminder — your monthly contribution for '
      || to_char(now(), 'FMMonth YYYY')
      || ' has not yet been recorded. You can submit yours from My Giving.',
    '/my-giving',
    'in_app'
  from members m
  where m.status = 'active'
    and m.profile_id is not null
    and not exists (
      select 1 from contributions c
      where c.member_id = m.id
        and c.contribution_type = 'monthly'
        and extract(year  from c.contribution_date) = v_year
        and extract(month from c.contribution_date) = v_month
        and c.verification_status in ('pending', 'confirmed')
    )
    -- avoid double-sending in case the cron fires twice in a month
    and not exists (
      select 1 from notifications n
      where n.user_id = m.profile_id
        and n.title = '💰 Monthly contribution reminder'
        and n.created_at >= date_trunc('month', now())
    );
end $$;

-- =========================================================================
-- 2. PLEDGE DUE REMINDER FUNCTION
-- =========================================================================
create or replace function public.send_pledge_due_reminders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into notifications (user_id, title, body, link, channel)
  select
    m.profile_id,
    '⏰ Pledge due soon',
    'Your pledge "' || p.purpose || '" of KSh '
      || to_char(p.pledge_amount, 'FM999,999,990')
      || ' is due on ' || to_char(p.due_date, 'DD Mon YYYY')
      || '. You have paid KSh ' || to_char(p.paid_amount, 'FM999,999,990') || ' so far.',
    '/my-giving',
    'in_app'
  from pledges p
  join members m on m.id = p.member_id
  where p.status in ('open', 'partial')
    and p.due_date is not null
    and p.due_date <= (current_date + interval '7 days')
    and p.due_date >= current_date
    and m.profile_id is not null
    -- dedupe within 3 days
    and not exists (
      select 1 from notifications n
      where n.user_id = m.profile_id
        and n.title = '⏰ Pledge due soon'
        and n.created_at > (now() - interval '3 days')
        and n.body like '%' || p.purpose || '%'
    );
end $$;

-- =========================================================================
-- 3. SCHEDULE WITH pg_cron
-- =========================================================================
-- If pg_cron is not enabled, the queries below will fail. Enable it via
-- the Supabase Dashboard then re-run this migration.

-- Drop any existing schedule with the same name (idempotent)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname in ('nyacaba-monthly-reminders', 'nyacaba-pledge-due-reminders');

    perform cron.schedule(
      'nyacaba-monthly-reminders',
      '0 8 20 * *',
      $cron$ select public.send_monthly_contribution_reminders() $cron$
    );

    perform cron.schedule(
      'nyacaba-pledge-due-reminders',
      '0 9 * * *',
      $cron$ select public.send_pledge_due_reminders() $cron$
    );
  else
    raise notice 'pg_cron extension not enabled — enable it in Supabase Dashboard → Database → Extensions, then re-run this migration.';
  end if;
end $$;

-- =========================================================================
-- END
-- =========================================================================
