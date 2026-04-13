import { useState, useMemo } from 'react'
import { Plus, Trash2, Edit2, Check, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import Modal from './Modal'
import { useApp } from '../context/AppContext'

// ── Date constants ────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)
const IN3   = addDays(new Date(), 3).toISOString().slice(0, 10)
const IN7   = addDays(new Date(), 7).toISOString().slice(0, 10)

// ── Badge configs ─────────────────────────────────────────────────────────────
const PRIORITY = {
  high:   { label: 'High',   bg: '#fee2e2', color: '#b91c1c' },
  medium: { label: 'Medium', bg: '#fef3c7', color: '#92400e' },
  low:    { label: 'Low',    bg: '#f0efe9', color: '#6b6b66' },
}

const PDCA = {
  Plan:  { bg: '#f0efe9', color: '#9b9b94' },
  Do:    { bg: '#f0efe9', color: '#1a1a18' },
  Check: { bg: '#f0efe9', color: '#dc2626' },
  Act:   { bg: '#f0efe9', color: '#9b9b94' },
}

const STATUS = {
  'not-started': { label: 'Not Started', bg: '#f0efe9', color: '#6b6b66' },
  'in-progress': { label: 'In Progress', bg: '#dbeafe', color: '#1e40af' },
  'overdue':     { label: 'Overdue',     bg: '#fee2e2', color: '#b91c1c' },
  'done':        { label: 'Done',        bg: '#dcfce7', color: '#15803d' },
  'blocked':     { label: 'Blocked',     bg: '#fee2e2', color: '#b91c1c' },
  'todo':        { label: 'To Do',       bg: '#f0efe9', color: '#6b6b66' },
}

const BLANK = {
  task: '', project: '', priority: 'medium', owner: '',
  dueDate: '', pdca: 'Plan', status: 'not-started', notes: '',
}

// ── Urgency helper ────────────────────────────────────────────────────────────
// Returns the urgency level for row highlighting
function urgency(t) {
  if (t.status === 'done' || t.status === 'completed' || !t.dueDate) return 'none'
  if (t.dueDate < TODAY) return 'overdue'
  if (t.dueDate === TODAY) return 'today'
  if (t.dueDate <= IN3) return 'soon'
  return 'none'
}

const URGENCY_STYLE = {
  overdue: { leftBorder: '#dc2626', rowBg: 'transparent', hoverBg: '#f0efe9' },
  today:   { leftBorder: '#dc2626', rowBg: 'transparent', hoverBg: '#f0efe9' },
  soon:    { leftBorder: '#1a1a18', rowBg: 'transparent', hoverBg: '#f0efe9' },
  none:    { leftBorder: 'transparent', rowBg: 'transparent', hoverBg: '#f0efe9' },
}

// ── Group config ──────────────────────────────────────────────────────────────
const GROUPS = [
  {
    key: 'overdue',
    label: 'Overdue',
    headerBg: '#f0efe9',
    headerColor: '#dc2626',
    headerBorder: 'rgba(0,0,0,0.08)',
    match: (t) => t.dueDate && t.dueDate < TODAY && t.status !== 'done' && t.status !== 'completed',
  },
  {
    key: 'today',
    label: 'Due Today',
    headerBg: '#f0efe9',
    headerColor: '#dc2626',
    headerBorder: 'rgba(0,0,0,0.08)',
    match: (t) => t.dueDate === TODAY,
  },
  {
    key: 'week',
    label: 'Due This Week',
    headerBg: '#f0efe9',
    headerColor: '#1a1a18',
    headerBorder: 'rgba(0,0,0,0.08)',
    match: (t) => t.dueDate && t.dueDate > TODAY && t.dueDate <= IN7,
  },
  {
    key: 'later',
    label: 'Due Later',
    headerBg: '#f0efe9',
    headerColor: '#9b9b94',
    headerBorder: 'rgba(0,0,0,0.08)',
    match: (t) => t.dueDate && t.dueDate > IN7,
  },
  {
    key: 'none',
    label: 'No Due Date',
    headerBg: '#f0efe9',
    headerColor: '#9b9b94',
    headerBorder: 'rgba(0,0,0,0.08)',
    match: (t) => !t.dueDate,
  },
]

// ── Sort config ───────────────────────────────────────────────────────────────
const SORT_OPTS = [
  { key: 'dueAsc',   label: 'Due Date ↑ (earliest)' },
  { key: 'dueDesc',  label: 'Due Date ↓ (latest)'   },
  { key: 'priority', label: 'Priority (High → Low)'  },
  { key: 'pdca',     label: 'PDCA Stage'             },
  { key: 'project',  label: 'Project'                },
  { key: 'owner',    label: 'Owner'                  },
]

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PDCA_ORDER = { Plan: 0, Do: 1, Check: 2, Act: 3 }

function makeSortFn(sortKey, projectName) {
  return (a, b) => {
    switch (sortKey) {
      case 'dueAsc':
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      case 'dueDesc':
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return b.dueDate.localeCompare(a.dueDate)
      case 'priority':
        return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
      case 'pdca':
        return (PDCA_ORDER[a.pdca] ?? 4) - (PDCA_ORDER[b.pdca] ?? 4)
      case 'project':
        return projectName(a.project).localeCompare(projectName(b.project))
      case 'owner':
        return (a.owner || '').localeCompare(b.owner || '')
      default:
        return 0
    }
  }
}

// ── Quick filter config ───────────────────────────────────────────────────────
const QUICK_FILTERS = [
  {
    key: 'overdue',
    label: 'Overdue',
    activeBg: 'rgba(220,38,38,0.08)',
    activeColor: '#dc2626',
    activeBorder: 'rgba(220,38,38,0.25)',
    match: (t) => t.dueDate && t.dueDate < TODAY && t.status !== 'done' && t.status !== 'completed',
  },
  {
    key: 'today',
    label: 'Due Today',
    activeBg: 'rgba(220,38,38,0.08)',
    activeColor: '#dc2626',
    activeBorder: 'rgba(220,38,38,0.25)',
    match: (t) => t.dueDate === TODAY,
  },
  {
    key: 'thisWeek',
    label: 'Due This Week',
    activeBg: 'rgba(0,0,0,0.04)',
    activeColor: '#1a1a18',
    activeBorder: 'rgba(0,0,0,0.10)',
    match: (t) => t.dueDate && t.dueDate >= TODAY && t.dueDate <= IN7,
  },
  {
    key: 'mine',
    label: 'My Tasks (Tad)',
    activeBg: 'rgba(0,0,0,0.04)',
    activeColor: '#1a1a18',
    activeBorder: 'rgba(0,0,0,0.10)',
    match: (t) => t.owner?.toLowerCase() === 'tad',
  },
]

// ── Form components ───────────────────────────────────────────────────────────
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function TaskForm({ value, onChange, projects }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Task</label>
        <input className="input" value={value.task} onChange={(e) => set('task', e.target.value)} placeholder="Describe the task..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Project</label>
          <Select value={value.project} onChange={(v) => set('project', v)}
            options={[['', '— None —'], ...projects.map((p) => [p.id, p.name])]} />
        </div>
        <div>
          <label className="label">Owner</label>
          <input className="input" value={value.owner} onChange={(e) => set('owner', e.target.value)} />
        </div>
        <div>
          <label className="label">Priority</label>
          <Select value={value.priority} onChange={(v) => set('priority', v)}
            options={Object.entries(PRIORITY).map(([k, v]) => [k, v.label])} />
        </div>
        <div>
          <label className="label">Due Date</label>
          <input type="date" className="input" value={value.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>
        <div>
          <label className="label">PDCA Stage</label>
          <Select value={value.pdca} onChange={(v) => set('pdca', v)}
            options={Object.keys(PDCA).map((k) => [k, k])} />
        </div>
        <div>
          <label className="label">Status</label>
          <Select value={value.status} onChange={(v) => set('status', v)}
            options={Object.entries(STATUS).map(([k, v]) => [k, v.label])} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none h-16" value={value.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none text-xs font-medium pl-3 pr-7 py-2 rounded-lg focus:outline-none cursor-pointer transition-colors"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          color: value ? '#1a1a18' : '#9b9b94',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1a1a18'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
      >
        <option value="">{label}: All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9b9b94' }} />
    </div>
  )
}

function SortSelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none text-xs font-medium pl-3 pr-7 py-2 rounded-lg focus:outline-none cursor-pointer transition-colors"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', color: '#1a1a18' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1a1a18'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
      >
        {SORT_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9b9b94' }} />
    </div>
  )
}

// ── Group header row ──────────────────────────────────────────────────────────
function GroupHeaderRow({ group, count, collapsed, onToggle }) {
  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-colors"
          style={{
            background: group.headerBg,
            borderTop: `1px solid ${group.headerBorder}`,
            borderBottom: `1px solid ${group.headerBorder}`,
            color: group.headerColor,
            letterSpacing: '0.04em',
          }}
        >
          {collapsed
            ? <ChevronRight size={13} className="shrink-0" />
            : <ChevronDown  size={13} className="shrink-0" />
          }
          <span className="uppercase tracking-wide">{group.label}</span>
          <span
            className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={{ background: group.headerColor, color: '#ffffff', opacity: 0.85 }}
          >
            {count}
          </span>
        </button>
      </td>
    </tr>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ t, projectName, expandedId, setExpandedId, toggleDone, openEdit, handleDelete }) {
  const u = urgency(t)
  const us = URGENCY_STYLE[u]
  const isDone = t.status === 'done'
  const expanded = expandedId === t.id

  return [
    <tr
      key={t.id}
      className="cursor-pointer transition-colors"
      style={{
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        background: us.rowBg,
        opacity: isDone ? 0.45 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = us.hoverBg }}
      onMouseLeave={(e) => { e.currentTarget.style.background = us.rowBg }}
      onClick={() => setExpandedId(expanded ? null : t.id)}
    >
      {/* Checkbox — carries the urgency left border */}
      <td
        className="px-4 py-3"
        style={{ borderLeft: `3px solid ${us.leftBorder}` }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggleDone(t) }}
          className="w-4 h-4 rounded flex items-center justify-center transition-colors"
          style={{
            background: isDone ? '#1a1a18' : 'transparent',
            border: `1.5px solid ${isDone ? '#1a1a18' : '#DDDDDD'}`,
            color: '#ffffff',
          }}
        >
          {isDone && <Check size={10} />}
        </button>
      </td>

      <td className="px-3 py-3">
        <span
          className="text-sm font-medium"
          style={{ color: '#1a1a18', textDecoration: isDone ? 'line-through' : 'none' }}
        >
          {t.task}
        </span>
      </td>

      <td className="px-3 py-3 hidden md:table-cell">
        <span className="text-xs" style={{ color: '#9b9b94' }}>{projectName(t.project)}</span>
      </td>

      <td className="px-3 py-3 hidden lg:table-cell">
        <span className="text-xs" style={{ color: '#9b9b94' }}>{t.owner || '—'}</span>
      </td>

      <td className="px-3 py-3">
        {t.priority && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: PRIORITY[t.priority]?.bg, color: PRIORITY[t.priority]?.color, borderRadius: 20 }}
          >
            {PRIORITY[t.priority]?.label}
          </span>
        )}
      </td>

      <td className="px-3 py-3 hidden sm:table-cell">
        <span
          className="text-xs"
          style={{
            color: u === 'overdue' ? '#dc2626' : u === 'today' ? '#dc2626' : u === 'soon' ? '#1a1a18' : '#9b9b94',
            fontWeight: u !== 'none' ? 500 : 400,
          }}
        >
          {t.dueDate ? format(parseISO(t.dueDate), 'MMM d') : '—'}
          {u === 'overdue' && ' ⚠'}
          {u === 'today'   && ' ●'}
        </span>
      </td>

      <td className="px-3 py-3 hidden md:table-cell">
        {t.pdca && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: PDCA[t.pdca]?.bg, color: PDCA[t.pdca]?.color, borderRadius: 20 }}
          >
            {t.pdca}
          </span>
        )}
      </td>

      <td className="px-3 py-3">
        {t.status && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: STATUS[t.status]?.bg, color: STATUS[t.status]?.color, borderRadius: 20 }}
          >
            {STATUS[t.status]?.label}
          </span>
        )}
      </td>

      <td className="px-3 py-3">
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(t) }}
            className="p-1 rounded transition-colors"
            style={{ color: '#DDDDDD' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#1a1a18' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#DDDDDD' }}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
            className="p-1 rounded transition-colors"
            style={{ color: '#DDDDDD' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = '#dc2626' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#DDDDDD' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>,

    expanded && t.notes && (
      <tr key={`${t.id}-exp`} style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#ffffff' }}>
        <td style={{ borderLeft: `3px solid ${URGENCY_STYLE[u].leftBorder}` }} />
        <td colSpan={8} className="px-3 pb-3 pt-1">
          <div className="text-xs italic" style={{ color: '#9b9b94' }}>{t.notes}</div>
        </td>
      </tr>
    ),
  ]
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TaskList() {
  const { tasks, projects, addTask, updateTask, deleteTask } = useApp()

  const [filters,         setFilters]         = useState({ project: '', priority: '', pdca: '', status: '' })
  const [activeQuick,     setActiveQuick]     = useState(new Set())
  const [sortKey,         setSortKey]         = useState('dueAsc')
  const [groupByDate,     setGroupByDate]     = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [modal,           setModal]           = useState(null)
  const [expandedId,      setExpandedId]      = useState(null)

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }))

  const toggleQuick = (key) => {
    setActiveQuick((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const projectName = (pid) => projects.find((p) => p.id === pid)?.name || '—'

  // Apply all filters (base + quick)
  const filtered = useMemo(() => {
    let result = tasks.filter((t) => {
      if (filters.project  && t.project  !== filters.project)  return false
      if (filters.priority && t.priority !== filters.priority) return false
      if (filters.pdca     && t.pdca     !== filters.pdca)     return false
      if (filters.status   && t.status   !== filters.status)   return false
      return true
    })

    if (activeQuick.size > 0) {
      const qfs = QUICK_FILTERS.filter((qf) => activeQuick.has(qf.key))
      result = result.filter((t) => qfs.some((qf) => qf.match(t)))
    }

    return result
  }, [tasks, filters, activeQuick])

  // Sorted list
  const sorted = useMemo(
    () => [...filtered].sort(makeSortFn(sortKey, projectName)),
    [filtered, sortKey, projects]
  )

  // Grouped list
  const groups = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      tasks: sorted.filter((t) => g.match(t)),
    })).filter((g) => g.tasks.length > 0)
  }, [sorted])

  const openAdd    = () => setModal({ mode: 'add', data: { ...BLANK } })
  const openEdit   = (t) => setModal({ mode: 'edit', data: { ...t } })
  const closeModal = () => setModal(null)

  const handleSave = () => {
    if (!modal.data.task.trim()) return
    if (modal.mode === 'add') addTask(modal.data)
    else updateTask(modal.data.id, modal.data)
    closeModal()
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this task?')) deleteTask(id)
  }

  const toggleDone = (t) => {
    const newStatus = t.status === 'done' ? 'in-progress' : 'done'
    updateTask(t.id, { status: newStatus })
    // Persist to tasks.json via Vite dev middleware (local dev only, no-op in prod)
    fetch('/__api/tasks/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, updates: { status: newStatus } }),
    }).catch(() => {}) // silently ignore in prod where this endpoint doesn't exist
  }

  const isTaskOverdue = (t) => t.dueDate && t.dueDate < TODAY && t.status !== 'done'

  const counts = {
    total:   tasks.length,
    done:    tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter(isTaskOverdue).length,
  }

  const hasAnyFilter = Object.values(filters).some(Boolean) || activeQuick.size > 0

  const TABLE_HEADER = (
    <thead>
      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#f0efe9' }}>
        <th className="text-left text-xs font-medium px-4 py-3 w-8"  style={{ color: '#9b9b94' }}></th>
        <th className="text-left text-xs font-medium px-3 py-3"       style={{ color: '#9b9b94' }}>Task</th>
        <th className="text-left text-xs font-medium px-3 py-3 hidden md:table-cell" style={{ color: '#9b9b94' }}>Project</th>
        <th className="text-left text-xs font-medium px-3 py-3 hidden lg:table-cell" style={{ color: '#9b9b94' }}>Owner</th>
        <th className="text-left text-xs font-medium px-3 py-3"       style={{ color: '#9b9b94' }}>Priority</th>
        <th className="text-left text-xs font-medium px-3 py-3 hidden sm:table-cell" style={{ color: '#9b9b94' }}>Due</th>
        <th className="text-left text-xs font-medium px-3 py-3 hidden md:table-cell" style={{ color: '#9b9b94' }}>PDCA</th>
        <th className="text-left text-xs font-medium px-3 py-3"       style={{ color: '#9b9b94' }}>Status</th>
        <th className="px-3 py-3 w-16"></th>
      </tr>
    </thead>
  )

  const rowProps = { projectName, expandedId, setExpandedId, toggleDone, openEdit, handleDelete }

  return (
    <div className="space-y-4">

      {/* ── Stats strip ── */}
      <div className="flex gap-4 text-xs">
        <span style={{ color: '#9b9b94' }}>{counts.total} tasks total</span>
        <span style={{ color: '#9b9b94' }}>{counts.done} done</span>
        {counts.overdue > 0 && (
          <span style={{ color: '#dc2626', fontWeight: 500 }}>{counts.overdue} overdue</span>
        )}
      </div>

      {/* ── Quick filter pills ── */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((qf) => {
          const active = activeQuick.has(qf.key)
          const matchCount = tasks.filter(qf.match).length
          return (
            <button
              key={qf.key}
              onClick={() => toggleQuick(qf.key)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
              style={{
                background: active ? qf.activeBg : '#f0efe9',
                color:      active ? qf.activeColor : '#9b9b94',
                border:     `1px solid ${active ? qf.activeBorder : 'rgba(0,0,0,0.08)'}`,
                boxShadow:  active ? `0 0 0 2px ${qf.activeBg}` : 'none',
              }}
            >
              {qf.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-xs font-bold leading-none"
                style={{
                  background: active ? qf.activeColor : '#DDDDDD',
                  color: '#ffffff',
                  minWidth: 18,
                  textAlign: 'center',
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {matchCount}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Regular filters */}
          <FilterSelect label="Project"  value={filters.project}  onChange={(v) => setFilter('project', v)}  options={projects.map((p) => [p.id, p.name])} />
          <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilter('priority', v)} options={Object.entries(PRIORITY).map(([k, v]) => [k, v.label])} />
          <FilterSelect label="PDCA"     value={filters.pdca}     onChange={(v) => setFilter('pdca', v)}     options={Object.keys(PDCA).map((k) => [k, k])} />
          <FilterSelect label="Status"   value={filters.status}   onChange={(v) => setFilter('status', v)}   options={Object.entries(STATUS).map(([k, v]) => [k, v.label])} />

          {/* Divider */}
          <div className="w-px h-5 mx-1" style={{ background: 'rgba(0,0,0,0.08)' }} />

          {/* Sort */}
          <SortSelect value={sortKey} onChange={setSortKey} />

          {/* Group by toggle */}
          <button
            onClick={() => setGroupByDate((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
            style={{
              background: groupByDate ? 'rgba(0,0,0,0.04)' : '#ffffff',
              border: `1px solid ${groupByDate ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.08)'}`,
              color: groupByDate ? '#1a1a18' : '#9b9b94',
            }}
          >
            <Layers size={13} />
            Group by date
          </button>

          {hasAnyFilter && (
            <button
              onClick={() => { setFilters({ project: '', priority: '', pdca: '', status: '' }); setActiveQuick(new Set()) }}
              className="text-xs px-2 font-medium"
              style={{ color: '#1a1a18' }}
            >
              Clear all
            </button>
          )}
        </div>

        <button onClick={openAdd} className="btn-primary">
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* ── Table ── */}
      <div
        className="overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
      >
        {groupByDate ? (
          /* ── Grouped view ── */
          groups.length === 0 ? (
            <table className="w-full">
              {TABLE_HEADER}
              <tbody>
                <tr>
                  <td colSpan={9} className="text-center text-sm py-12" style={{ color: '#9b9b94' }}>
                    No tasks match the current filters.
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              {TABLE_HEADER}
              <tbody>
                {groups.map((g) => {
                  const collapsed = collapsedGroups.has(g.key)
                  return [
                    <GroupHeaderRow
                      key={`gh-${g.key}`}
                      group={g}
                      count={g.tasks.length}
                      collapsed={collapsed}
                      onToggle={() => toggleGroup(g.key)}
                    />,
                    !collapsed && g.tasks.map((t) => (
                      <TaskRow key={t.id} t={t} {...rowProps} />
                    )),
                  ]
                })}
              </tbody>
            </table>
          )
        ) : (
          /* ── Flat view ── */
          <table className="w-full text-sm">
            {TABLE_HEADER}
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-sm py-12" style={{ color: '#9b9b94' }}>
                    No tasks match the current filters.
                  </td>
                </tr>
              )}
              {sorted.map((t) => (
                <TaskRow key={t.id} t={t} {...rowProps} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-right" style={{ color: '#9b9b94' }}>
        Showing {filtered.length} of {tasks.length} tasks · Click row to expand notes
      </div>

      {/* ── Modal ── */}
      <Modal
        isOpen={!!modal}
        onClose={closeModal}
        title={modal?.mode === 'add' ? 'Add Task' : 'Edit Task'}
        size="lg"
      >
        {modal && (
          <>
            <TaskForm value={modal.data} onChange={(data) => setModal((m) => ({ ...m, data }))} projects={projects} />
            <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <button onClick={closeModal} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} className="btn-primary">
                {modal.mode === 'add' ? 'Add Task' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
