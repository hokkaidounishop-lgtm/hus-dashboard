#!/usr/bin/env node
/**
 * HUS Dashboard MCP Server
 * Exposes dashboard data (src/data/*.json) as callable tools to Claude.
 *
 * Transports: stdio (Claude Desktop / Claude Code)
 */

import { Server }              from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname }    from 'path'
import { fileURLToPath }       from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA  = resolve(__dir, '../src/data')

// ── I/O helpers ───────────────────────────────────────────────────────────────

const load = (name) =>
  JSON.parse(readFileSync(`${DATA}/${name}.json`, 'utf-8'))

const save = (name, data) =>
  writeFileSync(`${DATA}/${name}.json`, JSON.stringify(data, null, 2) + '\n', 'utf-8')

const today = () => new Date().toISOString().slice(0, 10)

// ── Fuzzy finder ──────────────────────────────────────────────────────────────

function fuzzy(items, key, query) {
  if (!query) return null
  const q = query.toLowerCase().trim()
  const exact = items.find((i) => (i[key] ?? '').toLowerCase() === q)
  if (exact) return exact
  const subs  = items.filter((i) => (i[key] ?? '').toLowerCase().includes(q))
  if (subs.length === 1) return subs[0]
  if (subs.length > 1) {
    const names = subs.map((i) => i[key]).join(', ')
    throw new McpError(ErrorCode.InvalidParams, `"${query}" matches multiple: ${names}`)
  }
  return null
}

// ── Progress recalculation ────────────────────────────────────────────────────
/**
 * Recalculates project progress from two sources:
 *  1. Blocks (inline checklist items stored on the project)  — preferred when present
 *  2. Tasks in tasks.json linked to this project             — fallback
 * Returns the new integer percentage (0–100), or null if no data.
 */
function recalcProgress(projectId, project, tasks) {
  const blocks = project.blocks ?? []
  const allItems = blocks.flatMap((b) => b.items ?? [])

  if (allItems.length > 0) {
    const done = allItems.filter((i) => i.status === 'done').length
    return Math.round((done / allItems.length) * 100)
  }

  // Fallback: tasks.json
  const projectTasks = tasks.filter((t) => t.project === projectId)
  if (!projectTasks.length) return null
  const done = projectTasks.filter(
    (t) => t.status === 'done' || t.status === 'completed'
  ).length
  return Math.round((done / projectTasks.length) * 100)
}

// ── Status formatter ──────────────────────────────────────────────────────────

function bar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function formatProjectStatus(project, tasks) {
  const pt       = tasks.filter((t) => t.project === project.id)
  const done     = pt.filter((t) => t.status === 'done' || t.status === 'completed')
  const overdue  = pt.filter((t) => t.dueDate && t.dueDate < today() && t.status !== 'done')
  const inprog   = pt.filter((t) => t.status === 'in-progress')
  const notstart = pt.filter((t) => t.status === 'not-started')

  const STATUS_EMOJI = {
    'on-track': '🟢', active: '🔵', planning: '🟡',
    behind: '🟠', stalled: '🔴', completed: '✅',
  }
  const emoji = STATUS_EMOJI[project.status] ?? '⚪'

  const blocks  = project.blocks ?? []
  const followups = project.followups ?? []

  let out = [
    `📊 ${project.name}`,
    '━'.repeat(50),
    `Status:   ${emoji} ${project.status.toUpperCase()}`,
    `Progress: ${bar(project.progress)} ${project.progress}%`,
    `Owner:    ${project.owner || '—'}`,
    `Due:      ${project.dueDate || '—'}`,
    '',
    `Tasks (${pt.length} total)`,
    `  ✅ Done:        ${done.length}`,
    `  🔄 In progress: ${inprog.length}`,
    `  ⚠️  Overdue:    ${overdue.length}`,
    `  📋 Not started: ${notstart.length}`,
  ]

  if (overdue.length) {
    out.push('', 'Overdue tasks:')
    overdue.forEach((t) => out.push(`  • ${t.task}  (due ${t.dueDate})`))
  }

  if (blocks.length) {
    out.push('', 'Checklist blocks:')
    blocks.forEach((b) => {
      const total   = (b.items ?? []).length
      const bdone   = (b.items ?? []).filter((i) => i.status === 'done').length
      out.push(`  📁 ${b.name}  [${bdone}/${total}]`)
      ;(b.items ?? []).forEach((item) => {
        const icon = item.status === 'done' ? '✅' : item.status === 'followup' ? '⚠️' : '☐'
        out.push(`     ${icon} ${item.text}`)
      })
    })
  }

  if (followups.length) {
    out.push('', 'Follow-ups:')
    followups.forEach((f) => out.push(`  ⚠️  ${f.text}  (added ${f.addedAt})`))
  }

  if (project.kpis) out.push('', `KPI targets: ${project.kpis}`)
  if (project.deliverables) out.push('', `Deliverables: ${project.deliverables}`)

  return out.join('\n')
}

// ════════════════════════════════════════════════════════════════════════════
//  Tool handlers
// ════════════════════════════════════════════════════════════════════════════

// ── 1. complete_task ──────────────────────────────────────────────────────────
async function handleCompleteTask({ project_name, task_name }) {
  if (!task_name) throw new McpError(ErrorCode.InvalidParams, 'task_name is required')

  const tasks    = load('tasks')
  const projects = load('projects')

  // Optionally narrow by project first
  let pool = tasks
  let proj = null
  if (project_name) {
    proj = fuzzy(projects, 'name', project_name)
    if (!proj) throw new McpError(ErrorCode.InvalidParams, `Project not found: "${project_name}"`)
    pool = tasks.filter((t) => t.project === proj.id)
  }

  const task = fuzzy(pool, 'task', task_name)
  if (!task) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Task not found: "${task_name}"${project_name ? ` in project "${project_name}"` : ''}`
    )
  }

  const oldStatus = task.status
  task.status      = 'done'
  task.completedAt = today()
  if (task.pdca === 'Plan' || task.pdca === 'Do' || task.pdca === 'Check') {
    task.pdca            = 'Act'
    task.pdcaUpdatedAt   = today()
  }

  // Recalculate project progress
  const linkedProj = projects.find((p) => p.id === task.project)
  let progressNote = ''
  if (linkedProj) {
    const newPct = recalcProgress(linkedProj.id, linkedProj, tasks)
    if (newPct !== null) {
      const oldPct = linkedProj.progress
      linkedProj.progress = newPct
      progressNote = `\nProject "${linkedProj.name}" progress: ${oldPct}% → ${newPct}%`
    }
  }

  save('tasks',    tasks)
  save('projects', projects)

  return {
    content: [{
      type: 'text',
      text: [
        `✅ Task completed: "${task.task}"`,
        `   Status: ${oldStatus} → done`,
        `   Completed: ${task.completedAt}`,
        `   PDCA stage: Act`,
        progressNote,
      ].filter(Boolean).join('\n'),
    }],
  }
}

// ── 2. update_project ─────────────────────────────────────────────────────────
async function handleUpdateProject({ project_name, field, value }) {
  if (!project_name || !field || value === undefined) {
    throw new McpError(ErrorCode.InvalidParams, 'project_name, field, and value are all required')
  }

  const projects = load('projects')
  const project  = fuzzy(projects, 'name', project_name)
  if (!project) throw new McpError(ErrorCode.InvalidParams, `Project not found: "${project_name}"`)

  const NUMERIC = new Set(['progress'])
  const oldVal  = project[field]
  project[field] = NUMERIC.has(field) ? parseInt(value, 10) : value

  save('projects', projects)

  return {
    content: [{
      type: 'text',
      text: `✅ Updated "${project.name}"\n   ${field}: ${JSON.stringify(oldVal)} → ${JSON.stringify(project[field])}`,
    }],
  }
}

// ── 3. add_checklist_item ─────────────────────────────────────────────────────
async function handleAddChecklistItem({ project_name, block_name, item_text, status = 'pending' }) {
  if (!project_name || !item_text) {
    throw new McpError(ErrorCode.InvalidParams, 'project_name and item_text are required')
  }

  const VALID_STATUS = ['done', 'pending', 'followup']
  if (!VALID_STATUS.includes(status)) {
    throw new McpError(ErrorCode.InvalidParams, `status must be one of: ${VALID_STATUS.join(', ')}`)
  }

  const projects = load('projects')
  const project  = fuzzy(projects, 'name', project_name)
  if (!project) throw new McpError(ErrorCode.InvalidParams, `Project not found: "${project_name}"`)

  if (!project.blocks) project.blocks = []

  const bName    = block_name || 'General'
  let   block    = project.blocks.find((b) => b.name.toLowerCase() === bName.toLowerCase())
  if (!block) {
    block = { name: bName, items: [] }
    project.blocks.push(block)
  }

  const itemId = `blk-${Date.now()}`
  block.items.push({
    id:          itemId,
    text:        item_text,
    status,
    completedAt: status === 'done' ? today() : null,
  })

  // Recalculate progress
  const newPct = recalcProgress(project.id, project, load('tasks'))
  let progressNote = ''
  if (newPct !== null) {
    const old = project.progress
    project.progress = newPct
    progressNote = `\nProject progress recalculated: ${old}% → ${newPct}%`
  }

  save('projects', projects)

  return {
    content: [{
      type: 'text',
      text: [
        `✅ Added checklist item to "${project.name}" / block "${block.name}"`,
        `   Item: ${item_text}`,
        `   Status: ${status}`,
        progressNote,
      ].filter(Boolean).join('\n'),
    }],
  }
}

// ── 4. update_project_progress ────────────────────────────────────────────────
async function handleUpdateProjectProgress({ project_name }) {
  if (!project_name) throw new McpError(ErrorCode.InvalidParams, 'project_name is required')

  const projects = load('projects')
  const tasks    = load('tasks')
  const project  = fuzzy(projects, 'name', project_name)
  if (!project) throw new McpError(ErrorCode.InvalidParams, `Project not found: "${project_name}"`)

  const oldPct = project.progress
  const newPct = recalcProgress(project.id, project, tasks)

  if (newPct === null) {
    return { content: [{ type: 'text', text: `ℹ️ No tasks or checklist items found for "${project.name}" — progress unchanged (${oldPct}%).` }] }
  }

  project.progress = newPct
  save('projects', projects)

  const src = (project.blocks ?? []).flatMap((b) => b.items ?? []).length > 0
    ? 'checklist blocks'
    : 'linked tasks'

  return {
    content: [{
      type: 'text',
      text: `✅ "${project.name}" progress updated from ${oldPct}% → ${newPct}% (calculated from ${src})`,
    }],
  }
}

// ── 5. add_task ──────────────────────────────────────────────────────────────
async function handleAddTask({ title, project_name, priority = 'medium', due, owner = '', pdca = 'Plan', status = 'not-started', notes = '' }) {
  if (!title) throw new McpError(ErrorCode.InvalidParams, 'title is required')

  const VALID_PRIORITY = ['high', 'medium', 'low']
  const VALID_STATUS   = ['not-started', 'in-progress', 'done', 'blocked', 'todo']
  const VALID_PDCA     = ['Plan', 'Do', 'Check', 'Act']

  if (!VALID_PRIORITY.includes(priority)) throw new McpError(ErrorCode.InvalidParams, `priority must be one of: ${VALID_PRIORITY.join(', ')}`)
  if (!VALID_STATUS.includes(status))     throw new McpError(ErrorCode.InvalidParams, `status must be one of: ${VALID_STATUS.join(', ')}`)
  if (!VALID_PDCA.includes(pdca))         throw new McpError(ErrorCode.InvalidParams, `pdca must be one of: ${VALID_PDCA.join(', ')}`)

  const tasks    = load('tasks')
  const projects = load('projects')

  let projectId = ''
  let projectLabel = ''
  if (project_name) {
    const proj = fuzzy(projects, 'name', project_name)
    if (!proj) throw new McpError(ErrorCode.InvalidParams, `Project not found: "${project_name}"`)
    projectId = proj.id
    projectLabel = proj.name
  }

  const taskId = `task-${Date.now()}`
  const newTask = {
    id:            taskId,
    task:          title,
    project:       projectId,
    priority,
    owner,
    dueDate:       due || '',
    pdca,
    pdcaUpdatedAt: today(),
    status,
    notes,
    ...(status === 'done' ? { completedAt: today() } : {}),
  }

  tasks.push(newTask)
  save('tasks', tasks)

  // Recalculate project progress if linked
  if (projectId) {
    const proj = projects.find(p => p.id === projectId)
    if (proj) {
      const newPct = recalcProgress(proj.id, proj, tasks)
      if (newPct !== null) {
        proj.progress = newPct
        save('projects', projects)
      }
    }
  }

  return {
    content: [{
      type: 'text',
      text: [
        `✅ Task added: "${title}"`,
        `   ID: ${taskId}`,
        projectLabel ? `   Project: ${projectLabel}` : null,
        `   Priority: ${priority} · PDCA: ${pdca} · Status: ${status}`,
        due ? `   Due: ${due}` : null,
        owner ? `   Owner: ${owner}` : null,
      ].filter(Boolean).join('\n'),
    }],
  }
}

// ── 6. add_followup ───────────────────────────────────────────────────────────
async function handleAddFollowup({ project_name, item_text }) {
  if (!project_name || !item_text) {
    throw new McpError(ErrorCode.InvalidParams, 'project_name and item_text are required')
  }

  const projects = load('projects')
  const tasks    = load('tasks')
  const project  = fuzzy(projects, 'name', project_name)
  if (!project) throw new McpError(ErrorCode.InvalidParams, `Project not found: "${project_name}"`)

  // Add to project's followups array (visible in get_project_status)
  if (!project.followups) project.followups = []
  const fuId = `fu-${Date.now()}`
  project.followups.push({ id: fuId, text: item_text, addedAt: today(), status: 'pending' })
  save('projects', projects)

  // Also add to tasks.json so it surfaces in Alerts panel
  const taskId = `task-${Date.now()}`
  tasks.push({
    id:           taskId,
    task:         `⚠️ [Follow-up] ${item_text}`,
    project:      project.id,
    priority:     'medium',
    owner:        '',
    dueDate:      '',
    pdca:         'Act',
    pdcaUpdatedAt: today(),
    status:       'not-started',
    notes:        `Follow-up added ${today()} via MCP`,
  })
  save('tasks', tasks)

  return {
    content: [{
      type: 'text',
      text: [
        `⚠️  Follow-up added to "${project.name}"`,
        `   "${item_text}"`,
        `   It will appear in the Alerts panel and Task List.`,
        `   Task ID: ${taskId}  |  Follow-up ID: ${fuId}`,
      ].join('\n'),
    }],
  }
}

// ── 6. get_project_status ─────────────────────────────────────────────────────
async function handleGetProjectStatus({ project_name }) {
  const projects = load('projects')
  const tasks    = load('tasks')

  if (!project_name || project_name.toLowerCase() === 'all') {
    const lines = ['📋 All Projects Summary', '━'.repeat(50)]
    projects.forEach((p) => {
      const pt     = tasks.filter((t) => t.project === p.id)
      const done   = pt.filter((t) => t.status === 'done').length
      const over   = pt.filter((t) => t.dueDate && t.dueDate < today() && t.status !== 'done').length
      const STATUS_EMOJI = { 'on-track':'🟢', active:'🔵', planning:'🟡', behind:'🟠', stalled:'🔴', completed:'✅' }
      lines.push(
        `\n${STATUS_EMOJI[p.status] ?? '⚪'} ${p.name}  (${p.progress}%)`,
        `   ${bar(p.progress, 15)}  Owner: ${p.owner}  Due: ${p.dueDate || '—'}`,
        `   Tasks: ${done}/${pt.length} done${over ? `  ⚠️ ${over} overdue` : ''}`,
      )
    })
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  }

  const project = fuzzy(projects, 'name', project_name)
  if (!project) throw new McpError(ErrorCode.InvalidParams, `Project not found: "${project_name}"`)

  return { content: [{ type: 'text', text: formatProjectStatus(project, tasks) }] }
}

// ── 7. get_daily_briefing ─────────────────────────────────────────────────────
async function handleGetDailyBriefing() {
  const projects = load('projects')
  const tasks    = load('tasks')
  const kpis     = load('kpis')
  const events   = load('calendar')

  const todayStr  = today()
  const overdue   = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== 'done' && t.status !== 'completed')
  const followups = tasks.filter((t) => t.task?.startsWith('⚠️'))
  const todayEvts = events.filter((e) => e.date === todayStr)

  // Top 3 priorities: high priority, not done, sorted by due date
  const PRIO = { high: 0, medium: 1, low: 2 }
  const topTasks = [...tasks]
    .filter((t) => t.status !== 'done' && t.status !== 'completed')
    .sort((a, b) => {
      const pd = (PRIO[a.priority] ?? 2) - (PRIO[b.priority] ?? 2)
      if (pd !== 0) return pd
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
    .slice(0, 3)

  const critProjs = projects.filter((p) => p.status === 'stalled' || p.status === 'behind')
  const allMonths = kpis.monthlyRevenue
  const latest    = allMonths[allMonths.length - 1]
  const prev      = allMonths[allMonths.length - 2]
  const revGrowth = (((latest.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1)

  const lines = [
    `🌅 HUS Daily Briefing — ${todayStr}`,
    '═'.repeat(50),
    '',
  ]

  // KPI summary
  lines.push('📊 KPI Status')
  lines.push(`   CVR:     ${kpis.current.cvr}%  (target ${kpis.targets.cvr}%)  ${kpis.current.cvr < kpis.targets.cvr ? '🔴 BELOW TARGET' : '🟢'}`)
  lines.push(`   AOV:     $${kpis.current.aov}  (target $${kpis.targets.aov})  ${kpis.current.aov < kpis.targets.aov ? '🟡' : '🟢'}`)
  lines.push(`   ${latest.month} Revenue: $${latest.revenue.toLocaleString()}  (${Number(revGrowth)>0?'▲':'▼'}${Math.abs(revGrowth)}% vs prev month)`)

  // Overdue
  lines.push('', `⚠️  Overdue Tasks (${overdue.length})`)
  if (overdue.length === 0) {
    lines.push('   None — all clear!')
  } else {
    overdue.slice(0, 5).forEach((t) => {
      const proj = projects.find((p) => p.id === t.project)
      const days = Math.round((Date.now() - new Date(t.dueDate).getTime()) / 86400000)
      lines.push(`   • ${t.task}  [${days}d late · ${proj?.name ?? '—'}]`)
    })
    if (overdue.length > 5) lines.push(`   … and ${overdue.length - 5} more`)
  }

  // Follow-ups
  if (followups.length) {
    lines.push('', `📌 Open Follow-ups (${followups.length})`)
    followups.slice(0, 4).forEach((t) => {
      const proj = projects.find((p) => p.id === t.project)
      lines.push(`   ${t.task}  [${proj?.name ?? '—'}]`)
    })
  }

  // Top priorities
  lines.push('', '🎯 Top 3 Priorities')
  topTasks.forEach((t, i) => {
    const proj = projects.find((p) => p.id === t.project)
    const due  = t.dueDate ? `due ${t.dueDate}` : 'no date'
    lines.push(`   ${i+1}. ${t.task}`)
    lines.push(`      ${t.pdca} · ${t.priority} · ${due} · ${proj?.name ?? '—'}`)
  })

  // Projects needing attention
  if (critProjs.length) {
    lines.push('', '🔥 Projects Needing Attention')
    critProjs.forEach((p) => {
      lines.push(`   • ${p.name}  [${p.status} · ${p.progress}% · ${p.owner}]`)
    })
  }

  // Today's meetings
  if (todayEvts.length) {
    lines.push('', `📅 Today's Meetings (${todayEvts.length})`)
    todayEvts.forEach((e) => {
      const proj = projects.find((p) => p.id === e.project)
      lines.push(`   • ${e.title}${proj ? `  [${proj.name}]` : ''}`)
    })
  } else {
    lines.push('', '📅 No meetings scheduled today')
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] }
}

// ── 9. ryoiki_tenkai (領域展開) ───────────────────────────────────────────────
async function handleRyoikiTenkai() {
  const projects = load('projects')
  const tasks    = load('tasks')
  const kpis     = load('kpis')
  const events   = load('calendar')
  const todayStr = today()

  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════════╗',
    '║                    領 域 展 開                                   ║',
    '║               — DOMAIN EXPANSION —                              ║',
    '║            HUS Full Status Report                               ║',
    '╚══════════════════════════════════════════════════════════════════╝',
    '',
    `📅 Generated: ${todayStr}`,
    '',
  ]

  // ── KPI Overview ──
  const monthly = kpis.monthlyRevenue
  const latest  = monthly[monthly.length - 1]
  const prev    = monthly[monthly.length - 2]
  const growth  = ((latest.revenue - prev.revenue) / prev.revenue * 100).toFixed(1)

  lines.push('━━━ 📊 KPI OVERVIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push(`  CVR:           ${kpis.current.cvr}%  (target: ${kpis.targets.cvr}%)  ${kpis.current.cvr >= kpis.targets.cvr ? '🟢' : '🔴 BELOW'}`)
  lines.push(`  AOV:           $${kpis.current.aov}  (target: $${kpis.targets.aov})  ${kpis.current.aov >= kpis.targets.aov ? '🟢' : '🟡'}`)
  lines.push(`  ${latest.month} Revenue:  $${latest.revenue.toLocaleString()}  (${Number(growth) > 0 ? '▲' : '▼'}${Math.abs(growth)}% MoM)`)
  lines.push(`  Total Revenue: $${kpis.current.totalRevenue.toLocaleString()}`)
  lines.push(`  Total Orders:  ${kpis.current.totalOrders}`)
  lines.push('')

  // ── Task Statistics ──
  const allTasks    = tasks
  const doneTasks   = allTasks.filter(t => t.status === 'done' || t.status === 'completed')
  const overdue     = allTasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done' && t.status !== 'completed')
  const inProgress  = allTasks.filter(t => t.status === 'in-progress')
  const notStarted  = allTasks.filter(t => t.status === 'not-started')

  lines.push('━━━ ✅ TASK STATISTICS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push(`  Total:       ${allTasks.length}`)
  lines.push(`  Done:        ${doneTasks.length}  (${Math.round(doneTasks.length / allTasks.length * 100)}%)`)
  lines.push(`  In Progress: ${inProgress.length}`)
  lines.push(`  Not Started: ${notStarted.length}`)
  lines.push(`  Overdue:     ${overdue.length}  ${overdue.length > 0 ? '⚠️' : '✅'}`)
  lines.push('')

  if (overdue.length > 0) {
    lines.push('  ⚠️  OVERDUE TASKS:')
    overdue.forEach(t => {
      const proj = projects.find(p => p.id === t.project)
      const days = Math.round((Date.now() - new Date(t.dueDate).getTime()) / 86400000)
      lines.push(`    • ${t.task}  [${days}d late · ${proj?.name ?? '—'} · ${t.owner || '—'}]`)
    })
    lines.push('')
  }

  // ── All Projects ──
  lines.push('━━━ 📁 ALL PROJECTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  const STATUS_EMOJI = {
    'on-track': '🟢', active: '🔵', planning: '🟡',
    behind: '🟠', stalled: '🔴', completed: '✅',
  }

  projects.forEach((p, idx) => {
    const pt       = tasks.filter(t => t.project === p.id)
    const ptDone   = pt.filter(t => t.status === 'done' || t.status === 'completed').length
    const ptOver   = pt.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done').length
    const ptInProg = pt.filter(t => t.status === 'in-progress').length
    const emoji    = STATUS_EMOJI[p.status] ?? '⚪'
    const blocks   = p.blocks ?? []
    const followups = p.followups ?? []

    lines.push(`  ${emoji} ${idx + 1}. ${p.name}`)
    lines.push(`     ${bar(p.progress)} ${p.progress}%`)
    lines.push(`     Status: ${p.status.toUpperCase()} · Owner: ${p.owner || '—'} · Due: ${p.dueDate || '—'}`)
    lines.push(`     Tasks: ${ptDone}/${pt.length} done${ptOver ? ` · ⚠️ ${ptOver} overdue` : ''}${ptInProg ? ` · 🔄 ${ptInProg} in-progress` : ''}`)

    if (blocks.length) {
      blocks.forEach(b => {
        const bTotal = (b.items ?? []).length
        const bDone  = (b.items ?? []).filter(i => i.status === 'done').length
        lines.push(`     📋 ${b.name}: ${bDone}/${bTotal}`)
      })
    }

    if (followups.filter(f => f.status === 'pending').length > 0) {
      lines.push(`     ⚠️  ${followups.filter(f => f.status === 'pending').length} open follow-up(s)`)
    }

    if (p.kpis) lines.push(`     KPIs: ${p.kpis}`)
    lines.push('')
  })

  // ── Upcoming Events ──
  const upcoming = events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  if (upcoming.length > 0) {
    lines.push('━━━ 📅 UPCOMING EVENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    upcoming.forEach(e => {
      const proj = projects.find(p => p.id === e.project)
      lines.push(`  ${e.date} · ${e.title}${proj ? `  [${proj.name}]` : ''}`)
    })
    lines.push('')
  }

  // ── Summary ──
  const activeCount   = projects.filter(p => p.status !== 'completed').length
  const avgProgress   = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0
  const criticalCount = projects.filter(p => p.status === 'stalled' || p.status === 'behind').length

  lines.push('━━━ 🏁 SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push(`  Active Projects:   ${activeCount}`)
  lines.push(`  Avg Progress:      ${avgProgress}%`)
  lines.push(`  Critical Projects: ${criticalCount}  ${criticalCount > 0 ? '🔥' : '✅'}`)
  lines.push(`  Overdue Tasks:     ${overdue.length}  ${overdue.length > 0 ? '⚠️' : '✅'}`)
  lines.push(`  Revenue Trend:     ${Number(growth) > 0 ? '📈' : '📉'} ${growth}% MoM`)
  lines.push('')
  lines.push('╔══════════════════════════════════════════════════════════════════╗')
  lines.push('║                     領域展開 完了                                ║')
  lines.push('╚══════════════════════════════════════════════════════════════════╝')

  return { content: [{ type: 'text', text: lines.join('\n') }] }
}

// ════════════════════════════════════════════════════════════════════════════
//  Tool definitions (JSON Schema)
// ════════════════════════════════════════════════════════════════════════════

const TOOLS = [
  {
    name: 'complete_task',
    description: 'Marks a task as done, stamps completedAt with today\'s date, advances PDCA to Act, and recalculates the project\'s progress percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Project name (fuzzy match) — optional but helps with disambiguation' },
        task_name:    { type: 'string', description: 'Task name (fuzzy match, case-insensitive substring)' },
      },
      required: ['task_name'],
    },
  },
  {
    name: 'update_project',
    description: 'Updates any field on a project (e.g. status, progress, owner, dueDate, kpis, deliverables).',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Project name (fuzzy match)' },
        field:        { type: 'string', description: 'Field name to update' },
        value:        { type: 'string', description: 'New value (numbers are coerced automatically for progress)' },
      },
      required: ['project_name', 'field', 'value'],
    },
  },
  {
    name: 'add_checklist_item',
    description: 'Adds a checklist item to a named block within a project. Creates the block if it does not exist. Recalculates project progress.',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Project name (fuzzy match)' },
        block_name:   { type: 'string', description: 'Block/phase name, e.g. "Research", "Implementation". Defaults to "General".' },
        item_text:    { type: 'string', description: 'Checklist item description' },
        status:       { type: 'string', enum: ['pending', 'done', 'followup'], description: 'Item status (default: pending)' },
      },
      required: ['project_name', 'item_text'],
    },
  },
  {
    name: 'update_project_progress',
    description: 'Auto-recalculates a project\'s progress % from its checklist blocks (if present) or linked tasks. Writes result to projects.json.',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Project name (fuzzy match)' },
      },
      required: ['project_name'],
    },
  },
  {
    name: 'add_task',
    description: 'Adds a new task directly to tasks.json. The task appears in the Task List view immediately. Supports all task fields: title, project, priority, due date, owner, PDCA stage, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        title:        { type: 'string', description: 'Task title / description' },
        project_name: { type: 'string', description: 'Project name (fuzzy match) — optional' },
        priority:     { type: 'string', enum: ['high', 'medium', 'low'], description: 'Task priority (default: medium)' },
        due:          { type: 'string', description: 'Due date in YYYY-MM-DD format — optional' },
        owner:        { type: 'string', description: 'Task owner name — optional' },
        pdca:         { type: 'string', enum: ['Plan', 'Do', 'Check', 'Act'], description: 'PDCA stage (default: Plan)' },
        status:       { type: 'string', enum: ['not-started', 'in-progress', 'done', 'blocked', 'todo'], description: 'Task status (default: not-started)' },
        notes:        { type: 'string', description: 'Additional notes — optional' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_followup',
    description: 'Adds a ⚠️ follow-up item to a project. It appears in both the project\'s followups list and the Task List / Alerts panel in the dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Project name (fuzzy match)' },
        item_text:    { type: 'string', description: 'Follow-up action description' },
      },
      required: ['project_name', 'item_text'],
    },
  },
  {
    name: 'get_project_status',
    description: 'Returns a full status summary for a project: progress, tasks (done/overdue/in-progress), checklist blocks, follow-ups, KPI targets. Pass "all" for a multi-project overview.',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Project name (fuzzy match), or "all" for all projects' },
      },
      required: ['project_name'],
    },
  },
  {
    name: 'get_daily_briefing',
    description: 'Returns today\'s full morning briefing: KPI status, overdue tasks, open follow-ups, top 3 priorities, projects needing attention, and today\'s meetings.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ryoiki_tenkai',
    description: '領域展開 — Full domain expansion status report. Returns a comprehensive report covering all KPIs, every project with progress/blocks/follow-ups, all task statistics, overdue items, and upcoming events. The ultimate "show me everything" command.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

// ════════════════════════════════════════════════════════════════════════════
//  MCP Server
// ════════════════════════════════════════════════════════════════════════════

const server = new Server(
  { name: 'hus-dashboard', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params

  try {
    switch (name) {
      case 'complete_task':           return await handleCompleteTask(args)
      case 'update_project':          return await handleUpdateProject(args)
      case 'add_checklist_item':      return await handleAddChecklistItem(args)
      case 'update_project_progress': return await handleUpdateProjectProgress(args)
      case 'add_task':                 return await handleAddTask(args)
      case 'add_followup':            return await handleAddFollowup(args)
      case 'get_project_status':      return await handleGetProjectStatus(args)
      case 'get_daily_briefing':      return await handleGetDailyBriefing()
      case 'ryoiki_tenkai':          return await handleRyoikiTenkai()
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: "${name}"`)
    }
  } catch (err) {
    if (err instanceof McpError) throw err
    return {
      content: [{ type: 'text', text: `❌ Error: ${err.message}` }],
      isError: true,
    }
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Log to stderr so it doesn't corrupt the MCP stdio stream
  process.stderr.write('[HUS MCP] Server started — listening on stdio\n')
}

main().catch((err) => {
  process.stderr.write(`[HUS MCP] Fatal: ${err.message}\n`)
  process.exit(1)
})
