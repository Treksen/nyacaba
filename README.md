# Nyacaba Welfare Management System

A church welfare management platform built for the Nyacaba congregation: contributions, pledges, welfare requests with dual approval, projects, inventory, meetings, announcements, and audit logging — designed for Kenyan church operations with M-Pesa reference tracking and KES currency throughout.

## Stack

- **Frontend**: React 18 + Vite, Tailwind CSS, React Router v6, Recharts, lucide-react
- **Backend**: Supabase (Postgres + Auth + Realtime + Storage + RLS)
- **Cron**: pg_cron (monthly contribution reminders, pledge due alerts)
- **PWA**: installable on mobile via vite-plugin-pwa

## Features

- 5-role RBAC: admin, chairperson, treasurer, welfare chair, member
- Member self-recorded contributions with treasurer verification flow
- Dual-approval welfare requests (two distinct leaders, self-approval blocked)
- Realtime welfare decision updates
- Anonymous church-wide finance transparency widget
- Tabbed dashboard (church-wide and personal views)
- Day-of-month deposit pattern analytics
- Profile photos with browser-side compression
- Automated monthly + pledge-due cron reminders
- Full audit log on 20+ tables
- Print-friendly statements paginated by year

## Local development

### Prerequisites

- Node.js 18 or higher
- A Supabase project ([create one](https://supabase.com/dashboard))

### Setup

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

npm install

cp .env.example .env
# Edit .env and paste your Supabase Project URL + anon key
# Get them from: Supabase Dashboard -> Settings -> API

npm run dev
```

The app will be at `http://localhost:5173`.

### Database setup

The schema lives in `supabase/migrations/`. Apply migrations **in order** via the Supabase SQL Editor:

```
001_initial_schema.sql              # tables, enums, base RLS scaffolding
002_rls_policies.sql                # row-level security policies
003_functions_triggers.sql          # auto-numbering, auto-profile creation
004_seed_data.sql                   # OPTIONAL — sample welfare groups + inventory
006_extend_roles.sql                # chairperson, treasurer, welfare_chair roles
007_audit_triggers.sql              # audit_logs trigger on 20 tables
008_notification_triggers.sql       # in-app notification fanout
009_dual_approval.sql               # welfare 2-leader approval logic
010_more_notifications.sql          # additional notification triggers
011_fix_autonumber.sql              # safer auto-numbering
012_welfare_rls_and_contribution_verification.sql
013_more_fixes.sql
014_polish_and_aggregates.sql       # church_finance_summary() function
015_deposit_pattern.sql             # day-of-month pattern aggregate
016_cron_reminders.sql              # monthly + pledge due reminders
017_profile_avatars.sql             # avatar Storage bucket + RLS
```

> **Note**: `005` was reserved and skipped during development. The gap is intentional.

### Enabling pg_cron

Before running `016_cron_reminders.sql`:

1. Open the Supabase Dashboard
2. Go to **Database -> Extensions**
3. Search for **pg_cron** and toggle it on

Then run the migration. Verify with `select * from cron.job;` — you should see two scheduled jobs.

### Creating the first admin

After running the migrations, the first user who signs up needs to be promoted to admin manually:

```sql
update public.profiles
set role = 'admin',
    approval_status = 'approved'
where email = 'your-admin-email@example.com';
```

Subsequent admins, chairs, etc. can be promoted from the in-app Admin Panel.

## Deploying to Vercel

This guide assumes you have already created the GitHub repository.

### One-time setup

1. **Push your code to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```

2. **Import the repo into Vercel**

   - Go to [vercel.com/new](https://vercel.com/new)
   - Pick your GitHub repo
   - Vercel auto-detects Vite — no build settings to change

3. **Set environment variables in Vercel**

   In the import screen (or Settings → Environment Variables later), add:

   | Name | Value | Environments |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://<project>.supabase.co` | Production, Preview, Development |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Production, Preview, Development |

4. **Deploy**

   Click **Deploy**. Vercel builds and ships in about 2 minutes.

### Subsequent deploys

Every push to `main` auto-deploys. Pull requests get preview URLs automatically.

## Going-live checklist

Before sharing the URL with members:

- [ ] Production cleanup SQL run (`scripts/clean-database.sql`)
- [ ] Admin account exists and works (`update profiles set role='admin' where email = ...`)
- [ ] At least one welfare group created (otherwise registrations fail)
- [ ] `pg_cron` enabled and migration 016 run; verify two jobs in `cron.job`
- [ ] Avatars storage bucket exists and RLS policies are present (migration 017)
- [ ] Vercel domain set up (custom domain optional)
- [ ] Supabase site URL updated to the Vercel URL: **Authentication → URL Configuration**
- [ ] Email templates customized: **Authentication → Email Templates**
- [ ] Backups confirmed: **Database → Backups**
- [ ] Supabase Free tier limits reviewed (500MB DB, 1GB storage, 2GB egress/month — upgrade if you'll exceed)

## Project structure

```
nyacaba-welfare/
├── public/                      # static assets, PWA manifest
├── scripts/
│   └── clean-database.sql       # production cleanup script
├── src/
│   ├── components/
│   │   ├── dashboard/           # StatCard, ChurchFinances, MySection
│   │   ├── layout/              # DashboardLayout, Sidebar, Topbar
│   │   └── ui/                  # Avatar, Modal, PageHeader, etc.
│   ├── context/                 # AuthContext, ToastContext
│   ├── lib/                     # supabase.js, format.js, avatar.js, constants.js
│   └── pages/
│       ├── auth/                # Login, Register, PendingApproval
│       ├── contributions/       # list, form, receipt, statement, pledges
│       ├── welfare/             # list, form, detail
│       ├── members/             # list, detail, form
│       ├── projects/, meetings/, inventory/, announcements/
│       ├── notifications/, reports/, admin/
│       └── settings/            # Profile, AdminPanel, LookupsPanel
├── supabase/
│   └── migrations/              # 17 SQL files, run in order
├── .env.example
├── .gitignore
├── vercel.json
└── README.md
```

## Security notes

- `VITE_SUPABASE_ANON_KEY` is intentionally public — it's the key the browser uses. RLS policies are what actually protect data.
- The Supabase `service_role` key must **never** appear in this codebase, environment files, or the browser. It bypasses RLS.
- All 23 tables have RLS enabled by default.
- The audit log captures all writes to 20 tables; admins can review at `/admin/audit`.
- Avatar uploads are limited to the user's own folder via Storage RLS.

## Support

Built incrementally over Claude.ai conversations. For changes, modify the relevant migration or component, run locally with `npm run dev`, then push — Vercel will rebuild automatically.

## License

Private — for use by the Nyacaba congregation. Not for redistribution.
