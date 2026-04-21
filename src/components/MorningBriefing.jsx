import { useMemo } from 'react'
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns'
import {
  Sunrise, AlertTriangle, CheckSquare, TrendingUp,
  Lightbulb, Clock, FolderKanban, ArrowRight, Users, Flame,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import LevelSystem from './LevelSystem'

const TODAY_STR = new Date().toISOString().slice(0, 10)
const TODAY     = new Date()

const PRIORITY_ORDER  = { high: 0, medium: 1, low: 2 }
const OWNER_PRIORITY  = ['Tad', '小池', 'ナランチャ', '脳汁', 'とべぶた', '疾風', 'Les yeux', 'Jus', 'Pino']

const isOpen = (t) => t.status !== 'done' && t.status !== 'completed'

function Section({ icon: Icon, title, accent = false, right, children }) {
  return (
    <div
      className="rounded-xl"
      style={{
        borderRadius: 12,
        padding: '14px 16px',
        background: '#ffffff',
        border: `1px solid ${accent ? 'rgba(220,38,38,0.15)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: accent ? 'rgba(220,38,38,0.08)' : 'rgba(0,0,0,0.04)',
            color: accent ? '#dc2626' : '#1a1a18',
          }}
        >
          <Icon size={14} />
        </div>
        <h3 className="text-sm font-medium" style={{ color: '#1a1a18' }}>{title}</h3>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </div>
  )
}

function dueLabel(task) {
  if (!task.dueDate) return { label: 'No due date', tone: 'muted' }
  const due  = parseISO(task.dueDate)
  const diff = differenceInDays(due, TODAY)
  if (task.dueDate < TODAY_STR) return { label: `${Math.abs(diff)}d overdue`, tone: 'danger' }
  if (isToday(due))             return { label: 'Due today',    tone: 'urgent' }
  if (isTomorrow(due))          return { label: 'Due tomorrow', tone: 'urgent' }
  return { label: `${diff}d left`, tone: 'muted' }
}

const toneColor = { danger: '#dc2626', urgent: '#1a1a18', muted: '#9b9b94' }

function PriorityBadge({ priority }) {
  const label = priority === 'high' ? 'High' : priority === 'medium' ? 'Med' : 'Low'
  const bg = priority === 'high' ? 'rgba(220,38,38,0.08)' : priority === 'medium' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.03)'
  const fg = priority === 'high' ? '#dc2626' : priority === 'medium' ? '#1a1a18' : '#9b9b94'
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wide"
      style={{ borderRadius: 20, background: bg, color: fg, letterSpacing: '0.08em' }}>
      {label}
    </span>
  )
}

function StatusPill({ status }) {
  const map = {
    'in-progress': { label: 'In Progress', bg: 'rgba(0,0,0,0.04)',       fg: '#1a1a18' },
    'not-started': { label: 'Not started', bg: 'rgba(0,0,0,0.03)',       fg: '#9b9b94' },
    'blocked':     { label: 'Blocked',     bg: 'rgba(220,38,38,0.08)',   fg: '#dc2626' },
    'done':        { label: 'Done',        bg: 'rgba(0,0,0,0.04)',       fg: '#9b9b94' },
  }
  const s = map[status] || map['not-started']
  return (
    <span className="text-[10px] font-medium px-2 py-0.5"
      style={{ borderRadius: 20, background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

function PriorityCard({ task, projects }) {
  const project = projects.find((p) => p.id === task.project)
  const { label, tone } = dueLabel(task)
  return (
    <div
      className="flex items-start gap-3 px-3 py-3 rounded-lg"
      style={{
        borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.06)',
        background: tone === 'danger' ? 'rgba(220,38,38,0.02)' : '#ffffff',
        borderLeft: `3px solid ${task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#1a1a18' : 'rgba(0,0,0,0.15)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <PriorityBadge priority={task.priority} />
          <StatusPill status={task.status} />
          <span className="text-[11px] font-medium tabular-nums"
            style={{ color: toneColor[tone], fontFamily: "'DM Mono', monospace" }}>
            {label}
          </span>
        </div>
        <div className="text-sm font-medium leading-snug" style={{ color: '#1a1a18' }}>
          {task.task}
        </div>
        <div className="text-xs mt-1 flex items-center gap-2" style={{ color: '#9b9b94' }}>
          {project?.name && <span>{project.name}</span>}
          {project?.name && task.owner && <span>·</span>}
          {task.owner && (
            <span className="font-medium" style={{ color: '#1a1a18' }}>@{task.owner}</span>
          )}
          {task.pdca && (
            <>
              <span>·</span>
              <span>{task.pdca}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ value, status }) {
  const stalled = status === 'stalled' || status === 'behind'
  const color   = stalled ? '#dc2626' : value >= 80 ? '#1a1a18' : value >= 40 ? '#1a1a18' : '#9b9b94'
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(0,0,0,0.05)' }}>
      <div
        style={{
          height: '100%',
          width: `${Math.max(2, value)}%`,
          background: color,
          transition: 'width 300ms ease',
        }}
      />
    </div>
  )
}

function ProjectProgressRow({ project, openTaskCount }) {
  const stalled = project.status === 'stalled' || project.status === 'behind'
  return (
    <div className="py-2.5 last:border-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium truncate" style={{ color: '#1a1a18' }}>{project.name}</span>
          {stalled && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 uppercase"
              style={{ borderRadius: 20, background: 'rgba(220,38,38,0.08)', color: '#dc2626', letterSpacing: '0.08em' }}>
              {project.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {openTaskCount > 0 && (
            <span className="text-[11px]" style={{ color: '#9b9b94' }}>
              {openTaskCount} open
            </span>
          )}
          <span className="text-sm font-semibold tabular-nums"
            style={{ color: '#1a1a18', fontFamily: "'DM Mono', monospace" }}>
            {project.progress}%
          </span>
        </div>
      </div>
      <ProgressBar value={project.progress} status={project.status} />
      <div className="text-[11px] mt-1" style={{ color: '#9b9b94' }}>
        Owner: {project.owner || '—'}
      </div>
    </div>
  )
}

function OverdueRow({ task, projects }) {
  const daysLate = differenceInDays(TODAY, parseISO(task.dueDate))
  const project  = projects.find((p) => p.id === task.project)
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
      style={{
        borderRadius: 10,
        background: 'rgba(220,38,38,0.04)',
        border: '1px solid rgba(220,38,38,0.12)',
      }}
    >
      <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: '#1a1a18' }}>{task.task}</div>
        <div className="text-xs mt-0.5 flex items-center gap-2">
          <span className="font-semibold" style={{ color: '#dc2626' }}>{daysLate}d overdue</span>
          {project?.name && <span style={{ color: '#9b9b94' }}>· {project.name}</span>}
          {task.owner && (
            <span className="font-medium" style={{ color: '#1a1a18' }}>· @{task.owner}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function OwnerColumn({ owner, tasks, projects, isSelf }) {
  const overdue    = tasks.filter((t) => t.dueDate && t.dueDate < TODAY_STR).length
  const dueToday   = tasks.filter((t) => t.dueDate === TODAY_STR).length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2"
      style={{
        borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.06)',
        background: isSelf ? '#1a1a18' : '#ffffff',
        color:      isSelf ? '#ffffff' : '#1a1a18',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">@{owner || 'Unassigned'}</span>
        <span className="text-xs tabular-nums"
          style={{
            color: isSelf ? 'rgba(255,255,255,0.6)' : '#9b9b94',
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {overdue > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5"
            style={{ borderRadius: 20, background: 'rgba(220,38,38,0.15)', color: '#FF8A8A' }}>
            {overdue} overdue
          </span>
        )}
        {dueToday > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5"
            style={{
              borderRadius: 20,
              background: isSelf ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
              color:      isSelf ? '#ffffff' : '#1a1a18',
            }}>
            {dueToday} today
          </span>
        )}
        {inProgress > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5"
            style={{
              borderRadius: 20,
              background: isSelf ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              color:      isSelf ? 'rgba(255,255,255,0.7)' : '#6b6b66',
            }}>
            {inProgress} active
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 mt-1">
        {tasks.slice(0, 3).map((t) => {
          const project = projects.find((p) => p.id === t.project)
          const { label, tone } = dueLabel(t)
          return (
            <div key={t.id} className="text-xs leading-snug">
              <div className="truncate" style={{ color: isSelf ? 'rgba(255,255,255,0.9)' : '#1a1a18' }}>
                • {t.task}
              </div>
              <div className="text-[10px] flex items-center gap-1.5 ml-2"
                style={{ color: isSelf ? 'rgba(255,255,255,0.5)' : '#9b9b94' }}>
                <span style={{
                  color: tone === 'danger' ? (isSelf ? '#FF9E9E' : '#dc2626')
                       : tone === 'urgent' ? (isSelf ? '#ffffff' : '#1a1a18')
                       : (isSelf ? 'rgba(255,255,255,0.5)' : '#9b9b94'),
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: tone === 'danger' ? 600 : 400,
                }}>
                  {label}
                </span>
                {project?.name && <span>· {project.name}</span>}
              </div>
            </div>
          )
        })}
        {tasks.length > 3 && (
          <div className="text-[10px]" style={{ color: isSelf ? 'rgba(255,255,255,0.5)' : '#9b9b94' }}>
            +{tasks.length - 3} more
          </div>
        )}
      </div>
    </div>
  )
}

export default function MorningBriefing() {
  const { tasks, projects, setActiveSection } = useApp()

  const briefing = useMemo(() => {
    const openTasks = tasks.filter(isOpen)

    const topTasks = [...openTasks]
      .sort((a, b) => {
        const prio = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
        if (prio !== 0) return prio
        const aOver = a.dueDate && a.dueDate < TODAY_STR ? 0 : 1
        const bOver = b.dueDate && b.dueDate < TODAY_STR ? 0 : 1
        if (aOver !== bOver) return aOver - bOver
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
      .slice(0, 5)

    const overdue = openTasks
      .filter((t) => t.dueDate && t.dueDate < TODAY_STR)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

    const dueToday = openTasks.filter((t) => t.dueDate === TODAY_STR)

    // Project progress — sort stalled first, then by progress ascending (surface stuck ones)
    const activeProjects = [...projects].sort((a, b) => {
      const aStuck = (a.status === 'stalled' || a.status === 'behind') ? 0 : 1
      const bStuck = (b.status === 'stalled' || b.status === 'behind') ? 0 : 1
      if (aStuck !== bStuck) return aStuck - bStuck
      return a.progress - b.progress
    })

    const openCountByProject = openTasks.reduce((acc, t) => {
      if (!t.project) return acc
      acc[t.project] = (acc[t.project] || 0) + 1
      return acc
    }, {})

    // Group by owner
    const byOwner = new Map()
    openTasks.forEach((t) => {
      const key = t.owner || 'Unassigned'
      if (!byOwner.has(key)) byOwner.set(key, [])
      byOwner.get(key).push(t)
    })
    // Sort each owner's tasks by priority → dueDate
    byOwner.forEach((list) => {
      list.sort((a, b) => {
        const prio = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
        if (prio !== 0) return prio
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    })
    // Order owners: preferred list first, then by task count desc
    const orderedOwners = Array.from(byOwner.entries()).sort((a, b) => {
      const ai = OWNER_PRIORITY.indexOf(a[0])
      const bi = OWNER_PRIORITY.indexOf(b[0])
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return b[1].length - a[1].length
    })

    return { topTasks, overdue, dueToday, activeProjects, openCountByProject, orderedOwners, openCount: openTasks.length }
  }, [tasks, projects])

  return (
    <div className="space-y-3">
      {/* Hero greeting — at-a-glance summary */}
      <div
        className="rounded-xl p-6 text-white relative overflow-hidden"
        style={{ borderRadius: 12, background: '#1a1a18' }}
      >
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 11px)',
          }}
        />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Sunrise size={20} style={{ color: '#ffffff' }} />
          </div>
          <div className="flex-1">
            <div className="text-xl font-medium" style={{ letterSpacing: '-0.01em' }}>
              What's up — here's where everyone is.
            </div>
            <div className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {format(TODAY, 'EEEE, MMMM d, yyyy')} · HUS Management Dashboard
            </div>
            <div className="flex flex-wrap gap-5 mt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: briefing.overdue.length > 0 ? '#FF8A8A' : 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm"
                  style={{
                    color: briefing.overdue.length > 0 ? '#FF9E9E' : 'rgba(255,255,255,0.6)',
                    fontWeight: briefing.overdue.length > 0 ? 600 : 400,
                  }}>
                  {briefing.overdue.length} overdue
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Flame size={14} style={{ color: briefing.dueToday.length > 0 ? '#ffffff' : 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {briefing.dueToday.length} due today
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckSquare size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {briefing.openCount} open tasks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FolderKanban size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {briefing.activeProjects.length} projects
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1 — Today's TOP priorities (cards) */}
      <Section
        icon={Flame}
        title="Today's TOP priorities"
        right={
          <button
            onClick={() => setActiveSection('tasks')}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: '#1a1a18' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333333' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#1a1a18' }}
          >
            All tasks <ArrowRight size={11} />
          </button>
        }
      >
        {briefing.topTasks.length === 0 ? (
          <p className="text-sm" style={{ color: '#9b9b94' }}>No open tasks. Clear!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {briefing.topTasks.map((t) => (
              <PriorityCard key={t.id} task={t} projects={projects} />
            ))}
          </div>
        )}
      </Section>

      {/* Section 2 — Project progress */}
      <Section
        icon={FolderKanban}
        title="Project progress"
        right={
          <button
            onClick={() => setActiveSection('projects')}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: '#1a1a18' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333333' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#1a1a18' }}
          >
            Open projects <ArrowRight size={11} />
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
          {briefing.activeProjects.map((p) => (
            <ProjectProgressRow
              key={p.id}
              project={p}
              openTaskCount={briefing.openCountByProject[p.id] || 0}
            />
          ))}
        </div>
      </Section>

      {/* Section 3 — Overdue (red) */}
      <Section
        icon={AlertTriangle}
        title={`Overdue · ${briefing.overdue.length}`}
        accent={briefing.overdue.length > 0}
      >
        {briefing.overdue.length === 0 ? (
          <p className="text-sm font-medium" style={{ color: '#9b9b94' }}>No overdue tasks — well done.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {briefing.overdue.map((t) => (
              <OverdueRow key={t.id} task={t} projects={projects} />
            ))}
          </div>
        )}
      </Section>

      {/* Section 4 — By assignee */}
      <Section icon={Users} title="By assignee">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {briefing.orderedOwners.map(([owner, list]) => (
            <OwnerColumn
              key={owner}
              owner={owner}
              tasks={list}
              projects={projects}
              isSelf={owner === 'Tad'}
            />
          ))}
        </div>
      </Section>

      {/* Level system — secondary */}
      <LevelSystem />
    </div>
  )
}
