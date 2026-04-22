-- Morning Dashboard — manual-entry tables for Cash Status / Today Focus / Team Pulse.
-- Run once in the Supabase SQL editor for the hus-dashboard project.
--
-- Three tables, each with their own period grain:
--   morning_cash    — monthly  (period = 'YYYY-MM')
--   morning_focus   — daily    (period = 'YYYY-MM-DD'), one row per item per day
--   morning_pulse   — weekly   (period = 'YYYY-Www'),   one row per team per week

----------------------------------------------------------------------------
-- Block 2: Cash Status (monthly)
----------------------------------------------------------------------------
create table if not exists morning_cash (
  period            text primary key,            -- YYYY-MM
  status            text,                        -- 'safe' | 'watch' | 'tight'
  forecast_amount   numeric,                     -- month-end cash forecast
  overdue_ar_count  int,
  risk_note         text,
  updated_at        timestamptz not null default now()
);

alter table morning_cash enable row level security;
drop policy if exists "anon read morning_cash"   on morning_cash;
drop policy if exists "anon write morning_cash"  on morning_cash;
drop policy if exists "anon update morning_cash" on morning_cash;
create policy "anon read morning_cash"   on morning_cash for select to anon using (true);
create policy "anon write morning_cash"  on morning_cash for insert to anon with check (true);
create policy "anon update morning_cash" on morning_cash for update to anon using (true) with check (true);

----------------------------------------------------------------------------
-- Block 3: Today Focus (daily, max 5 per day)
----------------------------------------------------------------------------
create table if not exists morning_focus (
  id            uuid primary key default gen_random_uuid(),
  period        text not null,                   -- YYYY-MM-DD
  type          text not null,                   -- 'decision' | 'follow-up' | 'review' | 'deadline'
  title         text not null,
  why           text,                            -- Why it matters (1 line)
  strategic_tag text,                            -- 'P1' | 'P2' | 'P3' | 'P4'
  position      int  not null default 0,         -- ordering within the day
  updated_at    timestamptz not null default now()
);

create index if not exists morning_focus_period_idx on morning_focus (period);

alter table morning_focus enable row level security;
drop policy if exists "anon read morning_focus"   on morning_focus;
drop policy if exists "anon write morning_focus"  on morning_focus;
drop policy if exists "anon update morning_focus" on morning_focus;
drop policy if exists "anon delete morning_focus" on morning_focus;
create policy "anon read morning_focus"   on morning_focus for select to anon using (true);
create policy "anon write morning_focus"  on morning_focus for insert to anon with check (true);
create policy "anon update morning_focus" on morning_focus for update to anon using (true) with check (true);
create policy "anon delete morning_focus" on morning_focus for delete to anon using (true);

----------------------------------------------------------------------------
-- Block 4: Team Pulse (weekly, one row per team per ISO week)
----------------------------------------------------------------------------
create table if not exists morning_pulse (
  period        text not null,                   -- YYYY-Www  (ISO week)
  team          text not null,                   -- 'B2C Online Growth', 'B2B', etc.
  focus         text,
  current_state text,
  blocker       text,                            -- 'None' if no blocker
  next_review   text,                            -- date or human label
  progress_pct  int,                             -- 0-100, optional
  updated_at    timestamptz not null default now(),
  primary key (period, team)
);

alter table morning_pulse enable row level security;
drop policy if exists "anon read morning_pulse"   on morning_pulse;
drop policy if exists "anon write morning_pulse"  on morning_pulse;
drop policy if exists "anon update morning_pulse" on morning_pulse;
create policy "anon read morning_pulse"   on morning_pulse for select to anon using (true);
create policy "anon write morning_pulse"  on morning_pulse for insert to anon with check (true);
create policy "anon update morning_pulse" on morning_pulse for update to anon using (true) with check (true);
