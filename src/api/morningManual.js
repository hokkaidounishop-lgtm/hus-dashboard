/**
 * Morning Dashboard — manual entry persistence (Cash / Focus / Pulse).
 * Schema: see /supabase/morning_manual.sql
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = url && key ? createClient(url, key) : null

// ── Period helpers ──────────────────────────────────────────────────────────
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}
export function weekKey(d = new Date()) {
  // ISO week — Mon=1..Sun=7
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// ── Block 2: Cash Status ────────────────────────────────────────────────────
const EMPTY_CASH = {
  status: null,
  forecast_amount: null,
  overdue_ar_count: null,
  risk_note: '',
}

export async function loadCashStatus(period = monthKey()) {
  if (!supabase) return { period, ...EMPTY_CASH }
  const { data, error } = await supabase
    .from('morning_cash')
    .select('period, status, forecast_amount, overdue_ar_count, risk_note, updated_at')
    .eq('period', period)
    .maybeSingle()
  if (error) {
    console.error('[HUS] morning_cash load failed:', error.message)
    return { period, ...EMPTY_CASH }
  }
  return data || { period, ...EMPTY_CASH }
}

export async function saveCashStatus(period, updates) {
  if (!supabase) return { ok: false, reason: 'supabase-not-configured' }
  const { error } = await supabase
    .from('morning_cash')
    .upsert({ period, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'period' })
  if (error) {
    console.error('[HUS] morning_cash save failed:', error.message)
    return { ok: false, reason: error.message }
  }
  return { ok: true }
}

// ── Block 3: Today Focus ────────────────────────────────────────────────────
export async function loadFocusItems(period = dayKey()) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('morning_focus')
    .select('id, period, type, title, why, strategic_tag, position')
    .eq('period', period)
    .order('position', { ascending: true })
  if (error) {
    console.error('[HUS] morning_focus load failed:', error.message)
    return []
  }
  return data || []
}

export async function upsertFocusItem(item) {
  if (!supabase) return { ok: false, reason: 'supabase-not-configured' }
  const row = { ...item, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('morning_focus')
    .upsert(row)
    .select()
    .maybeSingle()
  if (error) {
    console.error('[HUS] morning_focus upsert failed:', error.message)
    return { ok: false, reason: error.message }
  }
  return { ok: true, row: data }
}

export async function deleteFocusItem(id) {
  if (!supabase) return { ok: false, reason: 'supabase-not-configured' }
  const { error } = await supabase.from('morning_focus').delete().eq('id', id)
  if (error) {
    console.error('[HUS] morning_focus delete failed:', error.message)
    return { ok: false, reason: error.message }
  }
  return { ok: true }
}

// ── Block 4: Team Pulse ─────────────────────────────────────────────────────
export async function loadTeamPulse(period = weekKey()) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('morning_pulse')
    .select('period, team, focus, current_state, blocker, next_review, progress_pct')
    .eq('period', period)
  if (error) {
    console.error('[HUS] morning_pulse load failed:', error.message)
    return []
  }
  return data || []
}

export async function saveTeamPulse(period, team, updates) {
  if (!supabase) return { ok: false, reason: 'supabase-not-configured' }
  const { error } = await supabase
    .from('morning_pulse')
    .upsert(
      { period, team, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'period,team' },
    )
  if (error) {
    console.error('[HUS] morning_pulse save failed:', error.message)
    return { ok: false, reason: error.message }
  }
  return { ok: true }
}
