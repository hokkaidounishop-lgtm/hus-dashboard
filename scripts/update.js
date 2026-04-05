#!/usr/bin/env node
/**
 * HUS Dashboard — Data CLI
 *
 * Writes directly to /src/data JSON files.  The Vite dev-server's file-watcher
 * detects the change and the hus-data-hmr plugin pushes the new content to the
 * browser via a custom HMR event — no page reload required.
 *
 * Usage
 * ─────
 *   node scripts/update.js task   "Checkout UX audit"  status   "in-progress"
 *   node scripts/update.js task   "Meta ads"           pdca     Do
 *   node scripts/update.js kpi    cvr                  0.5
 *   node scripts/update.js kpi    aov                  410
 *   node scripts/update.js project "CVR Recovery"      progress 40
 *   node scripts/update.js project "CVR Recovery"      status   "on-track"
 *   node scripts/update.js event  "Tuna Show"          date     2026-04-10
 *   node scripts/update.js task   list
 *   node scripts/update.js project list
 *   node scripts/update.js --help
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir  = dirname(fileURLToPath(import.meta.url))
const DATA   = resolve(__dir, '../src/data')

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const _ = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  mag:    '\x1b[35m',
}
const ok   = (...a) => console.log(`${_.green}✓${_.reset}`, ...a)
const warn = (...a) => console.log(`${_.yellow}⚠${_.reset}`, ...a)
const die  = (...a) => { console.error(`${_.red}✗${_.reset}`, ...a); process.exit(1) }
const head = (s)    => console.log(`\n${_.cyan}${_.bold}${s}${_.reset}`)
const dim  = (s)    => console.log(`${_.dim}${s}${_.reset}`)

// ── JSON file I/O ─────────────────────────────────────────────────────────────
function load(name) {
  try {
    return JSON.parse(readFileSync(`${DATA}/${name}.json`, 'utf-8'))
  } catch {
    die(`Cannot read ${DATA}/${name}.json`)
  }
}

function save(name, data) {
  writeFileSync(`${DATA}/${name}.json`, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

// ── Value normalisation ───────────────────────────────────────────────────────
// Accepts human-friendly strings and maps them to the exact values stored in JSON.
const STATUS_ALIASES = {
  // task statuses
  'in progress':  'in-progress',
  'in-progress':  'in-progress',
  'inprogress':   'in-progress',
  'not started':  'not-started',
  'not-started':  'not-started',
  'notstarted':   'not-started',
  'done':         'done',
  'complete':     'done',
  'completed':    'done',
  'overdue':      'overdue',
  'blocked':      'blocked',
  // project statuses
  'on track':     'on-track',
  'on-track':     'on-track',
  'ontrack':      'on-track',
  'planning':     'planning',
  'behind':       'behind',
  'stalled':      'stalled',
  'active':       'active',
}

const NUMERIC_FIELDS = new Set([
  'progress', 'aov', 'totalOrders', 'totalRevenue',
])
const FLOAT_FIELDS = new Set(['cvr'])

function coerce(field, raw) {
  if (field === 'status') {
    const mapped = STATUS_ALIASES[raw.toLowerCase()]
    if (!mapped) {
      warn(`Unknown status "${raw}" — storing as-is. Valid values:`)
      dim('  task:    not-started | in-progress | overdue | done | blocked')
      dim('  project: planning | active | on-track | behind | stalled | completed')
    }
    return mapped ?? raw.toLowerCase().replace(/\s+/g, '-')
  }
  if (FLOAT_FIELDS.has(field)) {
    const n = parseFloat(raw)
    if (isNaN(n)) die(`"${raw}" is not a valid number for field "${field}"`)
    return n
  }
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(raw)
    if (isNaN(n)) die(`"${raw}" is not a valid number for field "${field}"`)
    return n
  }
  return raw
}

// ── Fuzzy name matcher ────────────────────────────────────────────────────────
function find(items, nameKey, query) {
  const q = query.toLowerCase().trim()

  // 1. exact match
  let hit = items.find((i) => (i[nameKey] ?? '').toLowerCase() === q)
  if (hit) return hit

  // 2. substring match
  const subs = items.filter((i) => (i[nameKey] ?? '').toLowerCase().includes(q))
  if (subs.length === 1) return subs[0]
  if (subs.length > 1) {
    warn(`"${query}" matches multiple items — be more specific:`)
    subs.forEach((i) => dim(`  • ${i[nameKey]}`))
    process.exit(1)
  }
  return null
}

// ── Pretty diff line ──────────────────────────────────────────────────────────
function diff(field, oldVal, newVal) {
  return `${_.bold}${field}${_.reset}: ${_.yellow}${oldVal}${_.reset} → ${_.green}${newVal}${_.reset}`
}

// ── Command handlers ──────────────────────────────────────────────────────────

function cmdKpi(args) {
  // `kpi` with no args → show current values
  if (!args[0]) {
    const kpis = load('kpis')
    head('KPI — current values')
    const cur = kpis.current
    const tar = kpis.targets
    Object.entries(cur).forEach(([k, v]) => {
      const t = tar[k] ?? '—'
      const ok_ = typeof v === 'number' && typeof t === 'number'
        ? (v >= t ? `${_.green}✓${_.reset}` : `${_.red}✗${_.reset}`)
        : ' '
      console.log(`  ${ok_} ${_.bold}${k}${_.reset}: ${v}  ${_.dim}(target: ${t})${_.reset}`)
    })
    return
  }

  const [field, rawValue] = args
  if (!rawValue) die('Usage: node scripts/update.js kpi <field> <value>')

  const kpis = load('kpis')
  if (!(field in kpis.current)) {
    die(`Unknown KPI field "${field}". Available: ${Object.keys(kpis.current).join(', ')}`)
  }

  const oldVal = kpis.current[field]
  kpis.current[field] = coerce(field, rawValue)
  save('kpis', kpis)
  ok(`kpi — ${diff(field, oldVal, kpis.current[field])}`)
}

function cmdTask(args) {
  if (!args[0] || args[0] === 'list') {
    const tasks = load('tasks')
    const today = new Date().toISOString().slice(0, 10)
    head(`Tasks (${tasks.length})`)
    tasks.forEach((t) => {
      const late = t.dueDate && t.dueDate < today && t.status !== 'done'
      const flag = late ? `${_.red}OVERDUE${_.reset} ` : ''
      console.log(
        `  ${_.dim}${t.id}${_.reset}  ${t.task}\n` +
        `    ${flag}${_.cyan}[${t.status}]${_.reset} ${_.mag}${t.pdca}${_.reset}` +
        ` ${_.dim}due:${_.reset} ${t.dueDate ?? '—'}` +
        ` ${_.dim}owner:${_.reset} ${t.owner ?? '—'}`,
      )
    })
    return
  }

  const [name, field, rawValue] = args
  if (!field || rawValue === undefined) {
    die('Usage: node scripts/update.js task "<name>" <field> <value>')
  }

  const tasks = load('tasks')
  const task  = find(tasks, 'task', name)
  if (!task) die(`Task not found: "${name}"`)

  const oldVal = task[field]
  task[field]  = coerce(field, rawValue)

  // Keep pdcaUpdatedAt current whenever PDCA stage changes
  if (field === 'pdca' && task[field] !== oldVal) {
    task.pdcaUpdatedAt = new Date().toISOString().slice(0, 10)
  }

  save('tasks', tasks)
  ok(`task "${_.bold}${task.task}${_.reset}" — ${diff(field, oldVal, task[field])}`)
}

function cmdProject(args) {
  if (!args[0] || args[0] === 'list') {
    const projects = load('projects')
    head(`Projects (${projects.length})`)
    projects.forEach((p) => {
      const filled = Math.round(p.progress / 10)
      const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled)
      console.log(
        `  ${_.dim}${p.id}${_.reset}  ${p.name}\n` +
        `    ${_.cyan}[${p.status}]${_.reset} ${_.dim}${bar}${_.reset} ${p.progress}%` +
        ` ${_.dim}owner:${_.reset} ${p.owner}`,
      )
    })
    return
  }

  const [name, field, rawValue] = args
  if (!field || rawValue === undefined) {
    die('Usage: node scripts/update.js project "<name>" <field> <value>')
  }

  const projects = load('projects')
  const project  = find(projects, 'name', name)
  if (!project) die(`Project not found: "${name}"`)

  const oldVal    = project[field]
  project[field]  = coerce(field, rawValue)
  save('projects', projects)
  ok(`project "${_.bold}${project.name}${_.reset}" — ${diff(field, oldVal, project[field])}`)
}

function cmdEvent(args) {
  if (!args[0] || args[0] === 'list') {
    const events = load('calendar')
    head(`Calendar events (${events.length})`)
    events.forEach((e) => {
      console.log(`  ${_.dim}${e.id}${_.reset}  ${e.title}  ${_.cyan}[${e.date}]${_.reset}`)
    })
    return
  }

  const [title, field, rawValue] = args
  if (!field || rawValue === undefined) {
    die('Usage: node scripts/update.js event "<title>" <field> <value>')
  }

  const events = load('calendar')
  const event  = find(events, 'title', title)
  if (!event) die(`Event not found: "${title}"`)

  const oldVal   = event[field]
  event[field]   = rawValue          // events have no numeric/status coercion
  save('calendar', events)
  ok(`event "${_.bold}${event.title}${_.reset}" — ${diff(field, oldVal, event[field])}`)
}

// ── Help ──────────────────────────────────────────────────────────────────────
function showHelp() {
  console.log(`
${_.cyan}${_.bold}HUS Dashboard CLI${_.reset}  —  updates /src/data/*.json, Vite pushes changes live

${_.bold}USAGE${_.reset}
  node scripts/update.js <entity> [name] [field] [value]

${_.bold}ENTITIES${_.reset}
  ${_.cyan}task${_.reset}      Update a task           (matched by task name)
  ${_.cyan}project${_.reset}   Update a project        (matched by project name)
  ${_.cyan}kpi${_.reset}       Update a KPI value      (by exact field key)
  ${_.cyan}event${_.reset}     Update a calendar event (matched by title)

${_.bold}EXAMPLES${_.reset}
  ${_.dim}# KPIs${_.reset}
  node scripts/update.js kpi cvr 0.5
  node scripts/update.js kpi aov 410
  node scripts/update.js kpi              ${_.dim}# show all current values${_.reset}

  ${_.dim}# Tasks${_.reset}
  node scripts/update.js task "Checkout UX audit" status "in-progress"
  node scripts/update.js task "Checkout UX audit" pdca   Do
  node scripts/update.js task "Meta ads"          priority high
  node scripts/update.js task "Meta ads"          dueDate  2026-04-01
  node scripts/update.js task "Meta ads"          owner    "Emma Clarke"
  node scripts/update.js task list

  ${_.dim}# Projects${_.reset}
  node scripts/update.js project "CVR Recovery" progress 40
  node scripts/update.js project "CVR Recovery" status   "on-track"
  node scripts/update.js project "Tuna Show"    owner    "Kenji Nakamura"
  node scripts/update.js project list

  ${_.dim}# Calendar events${_.reset}
  node scripts/update.js event "Tuna Show Planning Meeting" date  2026-04-10
  node scripts/update.js event "All-Hands"                  notes "Q2 planning focus"
  node scripts/update.js event list

${_.bold}TASK STATUS VALUES${_.reset}
  not-started  in-progress  overdue  done  blocked

${_.bold}PROJECT STATUS VALUES${_.reset}
  planning  active  on-track  behind  stalled  completed

${_.bold}PDCA STAGES${_.reset}
  Plan  Do  Check  Act

${_.bold}NOTES${_.reset}
  • Name matching is case-insensitive substring search.
  • The Vite dev server must be running for live updates.
    Changes are written to disk immediately regardless.
  • To save changes permanently, edit /src/data/*.json directly.
`)
}

// ── Entry point ───────────────────────────────────────────────────────────────
const [,, entity, ...rest] = process.argv

if (!entity || entity === '--help' || entity === '-h') {
  showHelp()
} else {
  switch (entity.toLowerCase()) {
    case 'task':    cmdTask(rest);    break
    case 'project': cmdProject(rest); break
    case 'kpi':     cmdKpi(rest);     break
    case 'event':   cmdEvent(rest);   break
    default:
      die(`Unknown entity "${entity}". Use: task | project | kpi | event`)
  }
}
