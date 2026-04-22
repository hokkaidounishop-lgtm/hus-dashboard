-- Revenue Command — manual-entry revenue sources (Export, Broker/Spot, Tuna Show)
-- Run this once in the Supabase SQL editor for the hus-dashboard project.
--
-- Shape: one row per calendar month (period = 'YYYY-MM').
-- B2C and B2B are NOT stored here — they come from Shopify / Freshline.

create table if not exists revenue_manual (
  period             text primary key,
  export_amount      numeric,
  broker_amount      numeric,
  tuna_show_amount   numeric,
  updated_at         timestamptz not null default now()
);

alter table revenue_manual enable row level security;

-- The dashboard uses the public anon key; RLS is what protects the data.
-- Only allow the anon role to read + upsert revenue_manual rows.
drop policy if exists "anon read revenue_manual"  on revenue_manual;
drop policy if exists "anon write revenue_manual" on revenue_manual;
drop policy if exists "anon update revenue_manual" on revenue_manual;

create policy "anon read revenue_manual"
  on revenue_manual for select to anon using (true);

create policy "anon write revenue_manual"
  on revenue_manual for insert to anon with check (true);

create policy "anon update revenue_manual"
  on revenue_manual for update to anon using (true) with check (true);
