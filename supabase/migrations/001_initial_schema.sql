-- =========================================================================
-- Nyacaba Welfare Management System - Initial Schema
-- =========================================================================
-- Run this in the Supabase SQL editor (or via the CLI) to set up all tables.
-- After this, run 002_rls_policies.sql, then 003_functions_triggers.sql,
-- then optionally 004_seed_data.sql.
-- =========================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================================
-- ENUMS
-- =========================================================================
do $$ begin
  create type user_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'rejected', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contribution_type as enum ('monthly', 'tithe', 'offering', 'pledge', 'project', 'special');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash', 'mpesa', 'bank', 'cheque', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pledge_status as enum ('open', 'partial', 'fulfilled', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type welfare_category as enum ('hospital', 'rent', 'food', 'electricity', 'burial', 'school_fees', 'emergency', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type welfare_status as enum ('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('planning', 'active', 'on_hold', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'absent', 'apology', 'late');
exception when duplicate_object then null; end $$;

do $$ begin
  create type resolution_status as enum ('proposed', 'voting', 'passed', 'rejected', 'tabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vote_choice as enum ('yes', 'no', 'abstain');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_condition as enum ('new', 'good', 'fair', 'poor', 'damaged');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inventory_txn_type as enum ('intake', 'issue', 'donation', 'purchase', 'adjustment', 'disposal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('in_app', 'email');
exception when duplicate_object then null; end $$;

-- =========================================================================
-- PROFILES (links to Supabase auth.users)
-- =========================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role user_role not null default 'member',
  approval_status approval_status not null default 'pending',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_status on profiles(approval_status);

-- =========================================================================
-- WELFARE GROUPS (cells/zones/small groups)
-- =========================================================================
create table if not exists welfare_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  leader_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- MEMBERS (extended church-member records, 1-1 with profile when applicable)
-- =========================================================================
create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid unique references profiles(id) on delete set null,
  membership_no text unique,
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  marital_status text,
  occupation text,
  phone text,
  email text,
  address text,
  city text,
  county text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  group_id uuid references welfare_groups(id) on delete set null,
  status member_status not null default 'active',
  joined_on date default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_members_status on members(status);
create index if not exists idx_members_group on members(group_id);
create index if not exists idx_members_profile on members(profile_id);

-- Family relationships (one member -> dependents/relations)
create table if not exists member_family (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete cascade,
  related_name text not null,
  relation text not null,
  date_of_birth date,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_member_family_member on member_family(member_id);

-- =========================================================================
-- CONTRIBUTIONS
-- =========================================================================
create table if not exists contributions (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  contribution_type contribution_type not null default 'monthly',
  payment_method payment_method not null default 'cash',
  reference_no text,
  contribution_date date not null default current_date,
  period_month int check (period_month between 1 and 12),
  period_year int,
  project_id uuid,
  pledge_id uuid,
  notes text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_contrib_member on contributions(member_id);
create index if not exists idx_contrib_date on contributions(contribution_date);
create index if not exists idx_contrib_type on contributions(contribution_type);
create index if not exists idx_contrib_period on contributions(period_year, period_month);

-- =========================================================================
-- PLEDGES
-- =========================================================================
create table if not exists pledges (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete restrict,
  pledge_amount numeric(14,2) not null check (pledge_amount > 0),
  paid_amount numeric(14,2) not null default 0,
  purpose text not null,
  project_id uuid,
  pledge_date date not null default current_date,
  due_date date,
  status pledge_status not null default 'open',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pledges_member on pledges(member_id);
create index if not exists idx_pledges_status on pledges(status);

-- back-reference now that pledges exists
alter table contributions
  drop constraint if exists contributions_pledge_id_fkey,
  add constraint contributions_pledge_id_fkey
    foreign key (pledge_id) references pledges(id) on delete set null;

-- =========================================================================
-- WELFARE REQUESTS & APPROVALS
-- =========================================================================
create table if not exists welfare_requests (
  id uuid primary key default uuid_generate_v4(),
  request_no text unique,
  member_id uuid not null references members(id) on delete restrict,
  category welfare_category not null,
  title text not null,
  description text not null,
  amount_requested numeric(14,2) not null check (amount_requested >= 0),
  amount_approved numeric(14,2),
  amount_disbursed numeric(14,2) not null default 0,
  status welfare_status not null default 'pending',
  urgency text check (urgency in ('low', 'medium', 'high', 'critical')) default 'medium',
  supporting_docs jsonb default '[]'::jsonb,
  submitted_by uuid references profiles(id),
  submitted_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text
);
create index if not exists idx_welfare_member on welfare_requests(member_id);
create index if not exists idx_welfare_status on welfare_requests(status);
create index if not exists idx_welfare_category on welfare_requests(category);

create table if not exists welfare_approvals (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references welfare_requests(id) on delete cascade,
  approver_id uuid not null references profiles(id),
  decision text not null check (decision in ('approve', 'reject', 'request_info')),
  approved_amount numeric(14,2),
  comments text,
  decided_at timestamptz not null default now()
);
create index if not exists idx_welfare_appr_request on welfare_approvals(request_id);

-- =========================================================================
-- PROJECTS
-- =========================================================================
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique,
  description text,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  status project_status not null default 'planning',
  start_date date,
  target_end_date date,
  actual_end_date date,
  progress_pct int check (progress_pct between 0 and 100) default 0,
  cover_image_url text,
  lead_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_projects_status on projects(status);

-- back-reference for contributions.project_id, pledges.project_id
alter table contributions
  drop constraint if exists contributions_project_id_fkey,
  add constraint contributions_project_id_fkey
    foreign key (project_id) references projects(id) on delete set null;

alter table pledges
  drop constraint if exists pledges_project_id_fkey,
  add constraint pledges_project_id_fkey
    foreign key (project_id) references projects(id) on delete set null;

create table if not exists project_milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_milestones_project on project_milestones(project_id);

create table if not exists project_expenses (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  vendor text,
  receipt_url text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_project on project_expenses(project_id);

-- =========================================================================
-- MEETINGS, ATTENDANCE, MINUTES, RESOLUTIONS, VOTES
-- =========================================================================
create table if not exists meetings (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  agenda text,
  meeting_date timestamptz not null,
  location text,
  status meeting_status not null default 'scheduled',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_meetings_date on meetings(meeting_date);
create index if not exists idx_meetings_status on meetings(status);

create table if not exists meeting_attendance (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  status attendance_status not null default 'present',
  recorded_at timestamptz not null default now(),
  unique (meeting_id, member_id),
  unique (meeting_id, profile_id)
);
create index if not exists idx_attend_meeting on meeting_attendance(meeting_id);

create table if not exists meeting_minutes (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  content text not null,
  document_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_minutes_meeting on meeting_minutes(meeting_id);

create table if not exists action_items (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid references meetings(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references profiles(id),
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_actions_assigned on action_items(assigned_to);
create index if not exists idx_actions_meeting on action_items(meeting_id);

create table if not exists resolutions (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid references meetings(id) on delete set null,
  title text not null,
  description text not null,
  status resolution_status not null default 'proposed',
  voting_opens_at timestamptz,
  voting_closes_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_resolutions_status on resolutions(status);

create table if not exists resolution_votes (
  id uuid primary key default uuid_generate_v4(),
  resolution_id uuid not null references resolutions(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  choice vote_choice not null,
  voted_at timestamptz not null default now(),
  unique (resolution_id, voter_id)
);
create index if not exists idx_votes_resolution on resolution_votes(resolution_id);

-- =========================================================================
-- INVENTORY
-- =========================================================================
create table if not exists inventory_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text
);

create table if not exists inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sku text unique,
  category_id uuid references inventory_categories(id) on delete set null,
  description text,
  unit text default 'pcs',
  quantity numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  unit_cost numeric(14,2) default 0,
  condition item_condition default 'good',
  location text,
  supplier_name text,
  donor_name text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inv_category on inventory_items(category_id);
create index if not exists idx_inv_quantity on inventory_items(quantity);

create table if not exists inventory_transactions (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  txn_type inventory_txn_type not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_cost numeric(14,2) default 0,
  reference text,
  notes text,
  performed_by uuid references profiles(id),
  performed_at timestamptz not null default now()
);
create index if not exists idx_inv_txn_item on inventory_transactions(item_id);
create index if not exists idx_inv_txn_date on inventory_transactions(performed_at);

-- =========================================================================
-- ANNOUNCEMENTS & NOTIFICATIONS
-- =========================================================================
create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'admins', 'members')),
  pinned boolean not null default false,
  published boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_announcements_published on announcements(published, created_at desc);

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  channel notification_channel not null default 'in_app',
  link text,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user_unread on notifications(user_id, read, created_at desc);

-- =========================================================================
-- AUDIT LOG
-- =========================================================================
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_actor on audit_logs(actor_id);
create index if not exists idx_audit_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_date on audit_logs(created_at desc);

-- =========================================================================
-- HELPFUL VIEWS
-- =========================================================================
create or replace view v_member_balances as
select
  m.id as member_id,
  m.full_name,
  coalesce(sum(c.amount) filter (where c.contribution_type = 'monthly'), 0) as total_monthly,
  coalesce(sum(c.amount) filter (where c.contribution_type = 'tithe'), 0) as total_tithes,
  coalesce(sum(c.amount), 0) as total_contributed,
  coalesce(sum(p.pledge_amount) filter (where p.status in ('open','partial')), 0) as pledged_open,
  coalesce(sum(p.paid_amount), 0) as pledge_paid
from members m
left join contributions c on c.member_id = m.id
left join pledges p on p.member_id = m.id
group by m.id, m.full_name;

create or replace view v_monthly_collections as
select
  c.period_year as year,
  c.period_month as month,
  sum(c.amount) as total_collected,
  count(*) as txn_count
from contributions c
where c.period_year is not null and c.period_month is not null
group by c.period_year, c.period_month
order by c.period_year desc, c.period_month desc;

create or replace view v_low_stock_items as
select
  i.id, i.name, i.sku, i.quantity, i.reorder_level, i.unit, c.name as category
from inventory_items i
left join inventory_categories c on c.id = i.category_id
where i.quantity <= i.reorder_level;
