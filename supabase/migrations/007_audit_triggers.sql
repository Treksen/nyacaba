-- =========================================================================
-- Nyacaba Welfare Management System - Audit Triggers
-- =========================================================================
-- Auto-populates the audit_logs table on every INSERT/UPDATE/DELETE on
-- money-handling and trust-critical tables.
--
-- Run AFTER:
--   001..004, 006_extend_roles.sql (pass 1 + pass 2)
--
-- Safe to re-run.
-- =========================================================================

-- Helper to track WHO made the change (auth.uid()) and diff the change
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity_id uuid;
  v_details   jsonb;
  v_old       jsonb;
  v_new       jsonb;
  v_changed   text[];
  k           text;
begin
  if (tg_op = 'DELETE') then
    v_entity_id := old.id;
    v_details := jsonb_build_object('row', to_jsonb(old));
  elsif (tg_op = 'INSERT') then
    v_entity_id := new.id;
    v_details := jsonb_build_object('row', to_jsonb(new));
  else
    v_entity_id := new.id;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    -- compute changed columns
    select array_agg(key) into v_changed
    from jsonb_each(v_old) k
    where v_old->key is distinct from v_new->key;
    v_details := jsonb_build_object(
      'old', v_old,
      'new', v_new,
      'changed', coalesce(v_changed, array[]::text[])
    );
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_details
  );

  return coalesce(new, old);
exception when others then
  -- never let audit logging break a real operation
  return coalesce(new, old);
end $$;

-- Apply the trigger to money-handling and trust-critical tables.
-- We DO NOT audit notifications, meeting_attendance, or audit_logs itself
-- (would be noisy / recursive).
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles',
      'members',
      'member_family',
      'contributions',
      'pledges',
      'welfare_requests',
      'welfare_approvals',
      'projects',
      'project_milestones',
      'project_expenses',
      'inventory_items',
      'inventory_transactions',
      'inventory_categories',
      'welfare_groups',
      'meetings',
      'meeting_minutes',
      'action_items',
      'resolutions',
      'announcements',
      'system_settings'
    ])
  loop
    execute format('drop trigger if exists trg_audit_%I on %I', t, t);
    execute format(
      'create trigger trg_audit_%I
       after insert or update or delete on %I
       for each row execute function public.log_audit()',
      t, t
    );
  end loop;
end $$;
