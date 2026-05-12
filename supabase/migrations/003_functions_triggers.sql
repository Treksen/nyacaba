-- =========================================================================
-- Nyacaba Welfare Management System - Functions & Triggers
-- =========================================================================
-- Run AFTER 002_rls_policies.sql.
-- =========================================================================

-- =========================================================================
-- updated_at autotouch
-- =========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles','welfare_groups','members','pledges',
      'projects','meetings','meeting_minutes',
      'inventory_items'
    ])
  loop
    execute format('drop trigger if exists trg_touch_%I on %I', t, t);
    execute format(
      'create trigger trg_touch_%I before update on %I
       for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- =========================================================================
-- Auto-create a profile row when a new auth user signs up
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, approval_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    'member',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Promote first user to admin automatically (so the very first signup
-- can run the system without manual SQL).
-- =========================================================================
create or replace function public.promote_first_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  count_existing int;
begin
  select count(*) into count_existing from profiles;
  if count_existing = 1 then
    update profiles
    set role = 'admin',
        approval_status = 'approved',
        approved_at = now()
    where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_promote_first_admin on profiles;
create trigger trg_promote_first_admin
  after insert on profiles
  for each row execute function public.promote_first_admin();

-- =========================================================================
-- Generate human-friendly request_no like WR-2026-0001
-- =========================================================================
create or replace function public.gen_welfare_request_no()
returns trigger language plpgsql as $$
declare
  next_num int;
  yr int := extract(year from now());
begin
  if new.request_no is null or new.request_no = '' then
    select coalesce(max((regexp_replace(request_no, '\D','','g'))::int), 0) + 1
      into next_num
    from welfare_requests
    where request_no like 'WR-' || yr || '-%';
    new.request_no := 'WR-' || yr || '-' || lpad(next_num::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_gen_welfare_no on welfare_requests;
create trigger trg_gen_welfare_no
  before insert on welfare_requests
  for each row execute function public.gen_welfare_request_no();

-- =========================================================================
-- Generate membership numbers like NYM-0001
-- =========================================================================
create or replace function public.gen_membership_no()
returns trigger language plpgsql as $$
declare
  next_num int;
begin
  if new.membership_no is null or new.membership_no = '' then
    select coalesce(max((regexp_replace(membership_no, '\D','','g'))::int), 0) + 1
      into next_num
    from members
    where membership_no like 'NYM-%';
    new.membership_no := 'NYM-' || lpad(next_num::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_gen_member_no on members;
create trigger trg_gen_member_no
  before insert on members
  for each row execute function public.gen_membership_no();

-- =========================================================================
-- Keep pledge.paid_amount and status in sync with contributions
-- =========================================================================
create or replace function public.recompute_pledge_progress()
returns trigger language plpgsql as $$
declare
  pid uuid;
  total numeric(14,2);
  pledge_amt numeric(14,2);
begin
  pid := coalesce(new.pledge_id, old.pledge_id);
  if pid is null then return coalesce(new, old); end if;

  select coalesce(sum(amount), 0) into total
  from contributions where pledge_id = pid;

  select pledge_amount into pledge_amt from pledges where id = pid;

  update pledges
  set paid_amount = total,
      status = CASE
  WHEN total >= pledge_amt THEN (SELECT 'closed'::pledge_status)
  WHEN total > 0 THEN (SELECT 'partial'::pledge_status)
  ELSE (SELECT 'open'::pledge_status)
END,
      updated_at = now()
  where id = pid;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_pledge_progress_ins on contributions;
create trigger trg_pledge_progress_ins
  after insert on contributions
  for each row execute function public.recompute_pledge_progress();

drop trigger if exists trg_pledge_progress_upd on contributions;
create trigger trg_pledge_progress_upd
  after update on contributions
  for each row execute function public.recompute_pledge_progress();

drop trigger if exists trg_pledge_progress_del on contributions;
create trigger trg_pledge_progress_del
  after delete on contributions
  for each row execute function public.recompute_pledge_progress();

-- =========================================================================
-- Inventory transactions adjust item quantity
-- =========================================================================
create or replace function public.apply_inventory_txn()
returns trigger language plpgsql as $$
declare
  delta numeric(12,2);
begin
  delta := case new.txn_type
    when 'intake' then new.quantity
    when 'donation' then new.quantity
    when 'purchase' then new.quantity
    when 'issue' then -new.quantity
    when 'disposal' then -new.quantity
    when 'adjustment' then new.quantity  -- can be negative if recorded so
    else 0
  end;

  update inventory_items
  set quantity = quantity + delta,
      updated_at = now()
  where id = new.item_id;

  return new;
end $$;

drop trigger if exists trg_apply_inv_txn on inventory_transactions;
create trigger trg_apply_inv_txn
  after insert on inventory_transactions
  for each row execute function public.apply_inventory_txn();

-- =========================================================================
-- Resolution outcome updater (call manually or schedule)
-- =========================================================================
create or replace function public.tally_resolution(p_resolution_id uuid)
returns table (yes_count int, no_count int, abstain_count int, outcome text)
language plpgsql as $$
declare
  y int; n int; a int;
begin
  select
    count(*) filter (where choice = 'yes'),
    count(*) filter (where choice = 'no'),
    count(*) filter (where choice = 'abstain')
  into y, n, a
  from resolution_votes where resolution_id = p_resolution_id;

  yes_count := y; no_count := n; abstain_count := a;
  outcome := case when y > n then 'passed' else 'rejected' end;
  return next;
end $$;

-- =========================================================================
-- Disbursement ledger trigger: when welfare moves to 'disbursed',
-- create a contribution-like outflow record? (kept simple; system uses
-- amount_disbursed on the request itself.)
-- =========================================================================

-- =========================================================================
-- Convenience: notify all approved members on new announcement
-- =========================================================================
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
        or (new.audience = 'admins' and p.role = 'admin')
        or (new.audience = 'members' and p.role = 'member')
      );
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_announce on announcements;
create trigger trg_notify_announce
  after insert on announcements
  for each row execute function public.notify_on_announcement();
