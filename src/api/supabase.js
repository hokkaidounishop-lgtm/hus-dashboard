/**
 * Supabase client — persists task status changes so they survive
 * Vercel deployments (where the filesystem is read-only).
 *
 * Environment variables (set in Vercel + local .env):
 *   VITE_SUPABASE_URL       Project URL
 *   VITE_SUPABASE_ANON_KEY  Public anon key (RLS protects data)
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = url && key ? createClient(url, key) : null

/**
 * Upsert a task's status into the `task_status` table.
 * Called from toggleDone and updateTask — fire-and-forget style.
 * Accepts optional extras like { pdca, pdca_updated_at }.
 */
export async function persistTaskStatus(id, status, extras = {}) {
  if (!supabase) return

  const row = { id, status, updated_at: new Date().toISOString(), ...extras }

  if (status === 'done' && !row.completed_at) {
    row.completed_at = new Date().toISOString().slice(0, 10)
  } else if (status !== 'done') {
    row.completed_at = null
  }

  const { error } = await supabase
    .from('task_status')
    .upsert(row, { onConflict: 'id' })

  if (error) console.error('[HUS] Supabase upsert failed:', error.message)
}

/**
 * Fetch all status overrides from Supabase.
 * Returns a Map<taskId, { status, completed_at }> for easy merging.
 */
export async function loadTaskStatuses() {
  if (!supabase) return new Map()

  const { data, error } = await supabase
    .from('task_status')
    .select('id, status, completed_at, pdca, pdca_updated_at')

  if (error) {
    console.error('[HUS] Supabase load failed:', error.message)
    return new Map()
  }

  const map = new Map()
  for (const row of data) {
    map.set(row.id, {
      status: row.status,
      completedAt: row.completed_at || undefined,
      pdca: row.pdca || undefined,
      pdcaUpdatedAt: row.pdca_updated_at || undefined,
    })
  }
  return map
}
