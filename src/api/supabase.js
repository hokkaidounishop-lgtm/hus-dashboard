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

// ── Full task rows (Supabase as single source of truth) ──────────────────────
// The `tasks` table holds complete task bodies — not just status overrides — so
// MCP-created tasks and frontend edits share one live source. The legacy
// `task_status` overlay above is kept for backward-compat but is superseded by
// this table once it is seeded (see supabase/tasks_table.sql).

const TASK_COLS =
  'id, task, project, priority, owner, due_date, pdca, pdca_updated_at, status, notes, completed_at, deleted'

const rowToTask = (r) => ({
  id:            r.id,
  task:          r.task,
  project:       r.project ?? '',
  priority:      r.priority ?? 'medium',
  owner:         r.owner ?? '',
  dueDate:       r.due_date ?? '',
  pdca:          r.pdca ?? 'Plan',
  pdcaUpdatedAt: r.pdca_updated_at ?? undefined,
  status:        r.status ?? 'not-started',
  notes:         r.notes ?? '',
  ...(r.completed_at ? { completedAt: r.completed_at } : {}),
})

const taskToRow = (t) => ({
  id:              t.id,
  task:            t.task,
  project:         t.project || '',
  priority:        t.priority || 'medium',
  owner:           t.owner || '',
  due_date:        t.dueDate || '',
  pdca:            t.pdca || 'Plan',
  pdca_updated_at: t.pdcaUpdatedAt || null,
  status:          t.status || 'not-started',
  notes:           t.notes || '',
  completed_at:    t.completedAt || null,
  updated_at:      new Date().toISOString(),
})

/**
 * Load the live task list from Supabase (excluding soft-deleted rows).
 * Returns an array of task objects, or null when Supabase is unconfigured or
 * unreachable — the caller then falls back to the bundled tasks.json.
 */
export async function loadTasks() {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_COLS)
    .eq('deleted', false)

  if (error) {
    console.error('[HUS] Supabase loadTasks failed:', error.message)
    return null
  }
  return data.map(rowToTask)
}

/**
 * Upsert a full task row. Called on add/update from the frontend so edits
 * survive deploys and reach every reader. Fire-and-forget.
 */
export async function persistTask(task) {
  if (!supabase) return

  const { error } = await supabase
    .from('tasks')
    .upsert(taskToRow(task), { onConflict: 'id' })

  if (error) console.error('[HUS] Supabase persistTask failed:', error.message)
}

/**
 * Soft-delete a task (deleted = true) so it disappears from every reader
 * without losing the record. Fire-and-forget.
 */
export async function softDeleteTask(id) {
  if (!supabase) return

  const { error } = await supabase
    .from('tasks')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) console.error('[HUS] Supabase softDeleteTask failed:', error.message)
}

// ── Full project rows (Supabase as single source of truth) ───────────────────
// The `projects` table holds complete project rows — scalar fields as columns,
// nested blocks / followups as jsonb — so MCP edits (update_project,
// add_checklist_item, add_followup, progress recalc) and frontend edits share
// one live source. See supabase/projects_table.sql.

const PROJECT_COLS =
  'id, name, description, status, owner, kpis, deliverables, start_date, due_date, progress, blocks, followups, notes, deleted'

const rowToProject = (r) => ({
  id:           r.id,
  name:         r.name ?? '',
  description:  r.description ?? '',
  status:       r.status ?? '',
  owner:        r.owner ?? '',
  kpis:         r.kpis ?? '',
  deliverables: r.deliverables ?? '',
  startDate:    r.start_date ?? '',
  dueDate:      r.due_date ?? '',
  progress:     r.progress ?? 0,
  blocks:       r.blocks ?? [],
  followups:    r.followups ?? [],
  notes:        r.notes ?? '',
})

const projectToRow = (p) => ({
  id:           p.id,
  name:         p.name || '',
  description:  p.description || '',
  status:       p.status || '',
  owner:        p.owner || '',
  kpis:         p.kpis || '',
  deliverables: p.deliverables || '',
  start_date:   p.startDate || '',
  due_date:     p.dueDate || '',
  progress:     typeof p.progress === 'number' ? p.progress : null,
  blocks:       p.blocks ?? [],
  followups:    p.followups ?? [],
  notes:        p.notes || '',
  updated_at:   new Date().toISOString(),
})

/**
 * Load the live project list from Supabase (excluding soft-deleted rows).
 * Returns an array of project objects, or null when Supabase is unconfigured or
 * unreachable — the caller then falls back to the bundled projects.json.
 */
export async function loadProjects() {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLS)
    .eq('deleted', false)

  if (error) {
    console.error('[HUS] Supabase loadProjects failed:', error.message)
    return null
  }
  return data.map(rowToProject)
}

/**
 * Upsert a full project row. Called on add/update from the frontend so edits
 * survive deploys and reach every reader. Fire-and-forget.
 */
export async function persistProject(project) {
  if (!supabase) return

  const { error } = await supabase
    .from('projects')
    .upsert(projectToRow(project), { onConflict: 'id' })

  if (error) console.error('[HUS] Supabase persistProject failed:', error.message)
}

/**
 * Soft-delete a project (deleted = true) so it disappears from every reader
 * without losing the record. Fire-and-forget.
 */
export async function softDeleteProject(id) {
  if (!supabase) return

  const { error } = await supabase
    .from('projects')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) console.error('[HUS] Supabase softDeleteProject failed:', error.message)
}
