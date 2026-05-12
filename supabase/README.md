# Supabase Migrations

Run these migrations **in order** in the Supabase SQL Editor (or via the Supabase CLI).

## Migration order

1. **`001_initial_schema.sql`** — Tables, enums, indexes, and reporting views.
   Idempotent for enum creation (uses `do $$ ... exception when duplicate_object then null`).
2. **`002_rls_policies.sql`** — Row Level Security enabled on every table, with helper functions:
   - `is_admin()` — true if current user is approved + role=admin
   - `is_approved()` — true if current user has approval_status=approved
   - `my_member_id()` — returns the linked member.id for the current user
3. **`003_functions_triggers.sql`** — Triggers for:
   - Auto-create profile on `auth.users` insert
   - Promote first user to admin
   - Auto-generate `WR-YYYY-NNNN` welfare request numbers
   - Auto-generate `NYM-NNNN` membership numbers
   - Recompute pledge progress on contribution change
   - Auto-adjust inventory quantity on transaction
   - Notify all approved users on new announcement
   - Touch `updated_at` on common tables
4. **`004_seed_data.sql`** *(optional)* — Sample welfare groups, inventory categories, projects, and items. Skip on production after you're past first-time setup.

## Re-running migrations

The migrations are **mostly idempotent** — running them again is safe in development. They use:
- `create extension if not exists`
- `create table if not exists`
- `create or replace function`
- `drop policy if exists` / `create policy`
- `drop trigger if exists` / `create trigger`

⚠️ Seed data uses `on conflict do nothing` and `where not exists` — also safe to re-run.

## Adding new migrations

When you change the schema:
1. Add a new file `005_your_change.sql`
2. Use `alter table ... add column if not exists ...` to stay idempotent
3. Update the relevant RLS policy if you add a new table
4. Document the change here

## Resetting (development only)

```sql
-- DANGER: drops everything and starts fresh
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
```

Then re-run all four migrations.

## Useful views

The schema includes three views you can query directly from the app:

- **`v_member_balances`** — running totals per member
- **`v_monthly_collections`** — monthly contribution aggregates
- **`v_low_stock_items`** — items at or below reorder level

The dashboard uses `v_low_stock_items` for the "Low stock" widget.
