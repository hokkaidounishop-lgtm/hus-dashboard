/**
 * Revenue Command — manual-entry revenue sources persisted to Supabase.
 * Shopify (B2C) and Freshline (B2B) are handled elsewhere; this module covers
 * Export, Broker/Spot, and Tuna Show, which have no upstream data source yet.
 *
 * Schema: see /supabase/revenue_manual.sql
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = url && key ? createClient(url, key) : null

const EMPTY_ROW = {
  export_amount:    null,
  broker_amount:    null,
  tuna_show_amount: null,
}

export function currentPeriodKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function loadRevenueManual(period = currentPeriodKey()) {
  if (!supabase) return { period, ...EMPTY_ROW }

  const { data, error } = await supabase
    .from('revenue_manual')
    .select('period, export_amount, broker_amount, tuna_show_amount, updated_at')
    .eq('period', period)
    .maybeSingle()

  if (error) {
    console.error('[HUS] revenue_manual load failed:', error.message)
    return { period, ...EMPTY_ROW }
  }
  return data || { period, ...EMPTY_ROW }
}

export async function saveRevenueManual(period, updates) {
  if (!supabase) return { ok: false, reason: 'supabase-not-configured' }

  const row = {
    period,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('revenue_manual')
    .upsert(row, { onConflict: 'period' })

  if (error) {
    console.error('[HUS] revenue_manual save failed:', error.message)
    return { ok: false, reason: error.message }
  }
  return { ok: true }
}
