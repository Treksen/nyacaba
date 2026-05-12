-- =========================================================================
-- Nyacaba Welfare Management System - Production Seed Data
-- =========================================================================
-- Populates:
--   1. system_settings table (created inline below)
--   2. Welfare groups
--   3. Inventory categories
--   4. Initial church projects
--   5. Initial kitchen / cleaning inventory
--   6. Welcome & operational announcements
--   7. Meeting records (with minutes for the inaugural meeting)
--   8. System settings / operational defaults
--
-- Based on:
--   Nyacaba Church Initial Organizational Meeting
--   Held on 2nd May 2026
-- =========================================================================
-- Run AFTER:
--   001_initial_schema.sql
--   002_rls_policies.sql
--   003_functions_triggers.sql
-- =========================================================================

-- =========================================================================
-- 1. SYSTEM_SETTINGS TABLE (created inline so this file is self-contained)
-- =========================================================================
create table if not exists system_settings (
  key         text primary key,
  value       text,
  description text,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_touch_system_settings on system_settings;
create trigger trg_touch_system_settings
  before update on system_settings
  for each row execute function public.touch_updated_at();

alter table system_settings enable row level security;

drop policy if exists "settings_read_all_approved" on system_settings;
create policy "settings_read_all_approved" on system_settings
  for select using (is_approved());

drop policy if exists "settings_admin_write" on system_settings;
create policy "settings_admin_write" on system_settings
  for all using (is_admin()) with check (is_admin());

-- =========================================================================
-- 2. WELFARE GROUPS / FELLOWSHIPS
-- =========================================================================
insert into welfare_groups (name, description) values
  ('Main Welfare Committee',          'Primary welfare management committee responsible for church welfare operations and coordination.'),
  ('Kitchen & Hospitality Team',      'Responsible for church kitchen management, meal preparation, utensils and hospitality coordination.'),
  ('Church Cleaning Team',            'Responsible for cleanliness, sanitation and compound maintenance.'),
  ('Finance & Contributions Team',    'Responsible for contribution tracking, accountability and treasury operations.'),
  ('Member Welfare Team',             'Responsible for member support, welfare follow-up and emergency assistance.'),
  ('Projects & Development Team',     'Responsible for church development projects and welfare infrastructure initiatives.')
on conflict (name) do nothing;

-- =========================================================================
-- 3. INVENTORY CATEGORIES
-- =========================================================================
insert into inventory_categories (name, description) values
  ('Kitchen Equipment',          'Cookers, gas cylinders, sufurias, utensils and food preparation equipment.'),
  ('Kitchen Utensils',           'Spoons, cups, plates, frying pans and serving equipment.'),
  ('Kitchen Consumables',        'Tea leaves, sugar, cooking oil, flour and food supplies.'),
  ('Cleaning Supplies',          'Soap, detergents, buckets, towels and sanitation equipment.'),
  ('Water Supply',               'Drinking water containers, water storage and distribution equipment.'),
  ('Furniture',                  'Chairs, tables and welfare meeting furniture.'),
  ('Utilities',                  'Electricity tokens, water bills and utility management.'),
  ('Beddings & Welfare Support', 'Blankets, mattresses and emergency welfare support materials.')
on conflict (name) do nothing;

-- =========================================================================
-- 4. INITIAL CHURCH PROJECTS
-- =========================================================================
insert into projects (name, code, description, budget, status, start_date, target_end_date, progress_pct) values
  ('Church Kitchen Equipping',      'PRJ-KITCHEN-2026', 'Procurement and organization of church kitchen equipment including gas supply, sufurias, utensils, jikos, cups, plates and water containers.', 120000, 'active',   '2026-05-02', '2026-05-30', 35),
  ('Church Welfare Support Program','PRJ-WELFARE-2026', 'Provision of meals, emergency welfare support, tokens and member assistance initiatives.',                                                     200000, 'active',   '2026-05-02', '2026-12-31', 20),
  ('Church Cleaning & Sanitation',  'PRJ-CLEAN-2026',   'Improvement of church cleanliness, sanitation supplies and compound maintenance.',                                                              45000, 'active',   '2026-05-02', '2026-09-30', 25),
  ('Water Provision Initiative',    'PRJ-WATER-2026',   'Provision and management of safe drinking water for church members and meetings.',                                                              60000, 'active',   '2026-05-02', '2026-10-30', 15),
  ('Monthly Meals Program',         'PRJ-MEALS-2026',   'Structured meal support and hospitality during church meetings and events.',                                                                   150000, 'planning', '2026-06-01', '2026-12-31',  5)
on conflict (code) do nothing;

-- =========================================================================
-- 5. INITIAL INVENTORY ITEMS
-- =========================================================================
-- NOTE: condition must be one of: 'new', 'good', 'fair', 'poor', 'damaged'.
-- Items not yet delivered are tracked with quantity=0 (so they appear in
-- the low-stock dashboard widget) rather than via a "pending" condition.
-- =========================================================================

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Church Jiko',          'INV-JIKO-001', (select id from inventory_categories where name = 'Kitchen Equipment'), 'pcs', 1, 1, 8500, 'good', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-JIKO-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Gas Cylinder',         'INV-GAS-001',  (select id from inventory_categories where name = 'Kitchen Equipment'), 'pcs', 1, 1, 9500, 'good', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-GAS-001');

-- Sufuria pledged but not yet delivered → quantity 0, will appear under "Low stock"
insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Large Sufuria',        'INV-SUF-001',  (select id from inventory_categories where name = 'Kitchen Equipment'), 'pcs', 0, 1, 4500, 'fair', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-SUF-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Serving Spoons',       'INV-SPN-001',  (select id from inventory_categories where name = 'Kitchen Utensils'),  'pcs', 12, 6, 120, 'good', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-SPN-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Tea Cups',             'INV-CUP-001',  (select id from inventory_categories where name = 'Kitchen Utensils'),  'pcs', 24, 10, 150, 'good', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-CUP-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Serving Plates',       'INV-PLT-001',  (select id from inventory_categories where name = 'Kitchen Utensils'),  'pcs', 24, 10, 250, 'good', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-PLT-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Frying Pan',           'INV-FRY-001',  (select id from inventory_categories where name = 'Kitchen Utensils'),  'pcs', 1, 1, 1800, 'good', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-FRY-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Water Jugs',            'INV-JUG-001', (select id from inventory_categories where name = 'Water Supply'),       'pcs', 2, 1, 650, 'good', 'Church Kitchen'
where not exists (select 1 from inventory_items where sku = 'INV-JUG-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Plastic Basins',        'INV-BSN-001', (select id from inventory_categories where name = 'Cleaning Supplies'), 'pcs',   2, 1, 850, 'good', 'Cleaning Store'
where not exists (select 1 from inventory_items where sku = 'INV-BSN-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Tissue Paper Rolls',    'INV-TIS-001', (select id from inventory_categories where name = 'Cleaning Supplies'), 'rolls', 10, 10, 60, 'new', 'Cleaning Store'
where not exists (select 1 from inventory_items where sku = 'INV-TIS-001');

-- Soap below reorder level → will surface in low-stock widget
insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Menengai Soap Bar',     'INV-SOAP-001', (select id from inventory_categories where name = 'Cleaning Supplies'), 'bars',  1, 5, 250, 'new', 'Cleaning Store'
where not exists (select 1 from inventory_items where sku = 'INV-SOAP-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Cleaning Buckets',      'INV-BKT-001', (select id from inventory_categories where name = 'Cleaning Supplies'), 'pcs',   4, 2, 450, 'good', 'Cleaning Store'
where not exists (select 1 from inventory_items where sku = 'INV-BKT-001');

insert into inventory_items (name, sku, category_id, unit, quantity, reorder_level, unit_cost, condition, location)
select 'Church Towels',         'INV-TWL-001', (select id from inventory_categories where name = 'Cleaning Supplies'), 'pcs',   6, 4, 300, 'good', 'Cleaning Store'
where not exists (select 1 from inventory_items where sku = 'INV-TWL-001');

-- =========================================================================
-- 6. INITIAL ANNOUNCEMENTS
-- =========================================================================
-- The notify_on_announcement trigger will automatically create per-user
-- in-app notifications for every approved member when these are inserted.
-- =========================================================================

insert into announcements (title, body, audience, pinned, published, created_by)
select
  'Welcome to Nyacaba Welfare Management System',
  'Welcome to the Nyacaba Church Welfare Management System. Members are encouraged to actively participate in monthly welfare contributions, church projects and welfare initiatives. Kindly ensure your profile information is updated and remain committed to the growth and unity of the welfare ministry. Mungu awabariki.',
  'all', true, true, null
where not exists (select 1 from announcements where title = 'Welcome to Nyacaba Welfare Management System');

insert into announcements (title, body, audience, pinned, published, created_by)
select
  'Monthly Contributions Reminder',
  'Members are reminded that the agreed minimum monthly contribution is KES 200. Kindly submit your contributions on time to support church welfare activities and operational needs.',
  'members', true, true, null
where not exists (select 1 from announcements where title = 'Monthly Contributions Reminder');

insert into announcements (title, body, audience, pinned, published, created_by)
select
  'Pledge Deliverables Deadline',
  'All members who pledged kitchen equipment, utensils and welfare support items are kindly requested to fulfill their commitments by 30th May 2026.',
  'members', true, true, null
where not exists (select 1 from announcements where title = 'Pledge Deliverables Deadline');

-- =========================================================================
-- 7. MEETING RECORDS
-- =========================================================================
-- meetings.meeting_date is timestamptz. Minutes live in a SEPARATE
-- meeting_minutes table (one row per meeting), not on meetings itself.
-- =========================================================================

insert into meetings (title, meeting_date, agenda, status)
select
  'Initial Welfare Organizational Meeting',
  '2026-05-02 10:00:00+03'::timestamptz,
  'Formation of church welfare structure, kitchen equipping, welfare planning, monthly contributions and leadership appointments.',
  'completed'
where not exists (select 1 from meetings where title = 'Initial Welfare Organizational Meeting');

insert into meetings (title, meeting_date, agenda, status)
select
  'Monthly Welfare Follow-up Meeting',
  '2026-05-30 10:00:00+03'::timestamptz,
  'Review of pledge deliverables, contributions and operational progress.',
  'scheduled'
where not exists (select 1 from meetings where title = 'Monthly Welfare Follow-up Meeting');

-- Minutes for the May 2nd meeting (linked via meeting_id)
insert into meeting_minutes (meeting_id, content)
select m.id,
       'The meeting resolved to establish a structured welfare management system, equip the church kitchen, introduce monthly member contributions of KES 200 minimum, strengthen member welfare support and appoint welfare leadership representatives.'
from meetings m
where m.title = 'Initial Welfare Organizational Meeting'
  and not exists (select 1 from meeting_minutes mm where mm.meeting_id = m.id);

-- =========================================================================
-- 8. SYSTEM SETTINGS / OPERATIONAL DEFAULTS
-- =========================================================================
insert into system_settings (key, value, description) values
  ('minimum_monthly_contribution', '200',                          'Minimum monthly welfare contribution amount in Kenyan Shillings.'),
  ('pledge_deadline',              '2026-05-30',                   'Deadline for pledged kitchen and welfare items.'),
  ('meeting_frequency',            'monthly',                      'Official welfare committee meeting frequency.'),
  ('default_currency',             'KES',                          'System operating currency.'),
  ('water_support_period',         'May 2026 - September 2026',    'Utility token support operational period.')
on conflict (key) do nothing;

-- =========================================================================
-- END OF SEED DATA
-- =========================================================================