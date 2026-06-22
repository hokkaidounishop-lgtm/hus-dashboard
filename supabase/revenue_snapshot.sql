-- HUS Dashboard — `revenue_snapshot` table: Supabase as the shared revenue SoT.
-- Run ONCE in the Supabase SQL editor for the hus-dashboard project.
--
-- Why: B2C revenue is computed live by /api/shopify/sync and was never stored
-- anywhere — the dashboard recomputed it on each load, and the MCP briefing had
-- no way to see it (it read the frozen kpis.json mock, hence "Mar '25" forever).
--
-- Now the sync endpoint upserts its result here (singleton id='latest'), so the
-- MCP briefing/ryoiki read the SAME B2C numbers the dashboard last synced. The
-- manual channels (Export / Broker / Tuna) live in `revenue_manual`; B2B
-- (Freshline) is still pending. Mirrors useRevenueSummary's resolution order.

create table if not exists revenue_snapshot (
  id              text primary key,                       -- singleton: 'latest'
  current_month   jsonb        not null default '{}'::jsonb,  -- { mtd, forecast, daysInMonth, asOfDay, lastMonthToSameDay, lastYearSameMonth, periodKey }
  totals          jsonb        not null default '{}'::jsonb,  -- { totalRevenue, totalOrders, aov, cvr }
  monthly_revenue jsonb        not null default '[]'::jsonb,  -- [{ month, revenue, orders }, ...]
  synced_at       timestamptz  not null default now()
);

alter table revenue_snapshot enable row level security;

-- The dashboard uses the public anon key; RLS is what protects the data.
drop policy if exists "anon read revenue_snapshot"   on revenue_snapshot;
drop policy if exists "anon write revenue_snapshot"  on revenue_snapshot;
drop policy if exists "anon update revenue_snapshot" on revenue_snapshot;
create policy "anon read revenue_snapshot"   on revenue_snapshot for select to anon using (true);
create policy "anon write revenue_snapshot"  on revenue_snapshot for insert to anon with check (true);
create policy "anon update revenue_snapshot" on revenue_snapshot for update to anon using (true) with check (true);

-- Seed the singleton row so the table is never empty. The sync endpoint
-- overwrites current_month / totals / monthly_revenue on the next sync; until
-- then the MCP briefing detects the empty payload and shows "sync pending"
-- rather than a stale mock number.
insert into revenue_snapshot (id) values ('latest')
on conflict (id) do nothing;
