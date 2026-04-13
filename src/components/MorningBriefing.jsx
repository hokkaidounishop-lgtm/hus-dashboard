import { useMemo } from 'react'
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns'
import {
  Sunrise, AlertTriangle, CheckSquare, TrendingUp,
  Lightbulb, Clock, FolderKanban, ArrowRight,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import LevelSystem from './LevelSystem'

const TODAY_STR = new Date().toISOString().slice(0, 10)
const TODAY     = new Date()

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function Section({ icon: Icon, title, accent = false, children }) {
  return (
    <div
      className="rounded-xl space-y-4"
      style={{
        borderRadius: 12,
        padding: '14px 16px',
        background: '#ffffff',
        border: `1px solid ${accent ? 'rgba(220,38,38,0.15)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.04)', color: '#1a1a18' }}
        >
          <Icon size={14} />
        </div>
        <h3
          className="text-sm font-medium"
          style={{ color: '#1a1a18' }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

function PriorityItem({ task, projects }) {
  const project = projects.find((p) => p.id === task.project)
  const due = task.dueDate ? parseISO(task.dueDate) : null
  const overdue = due && task.dueDate < TODAY_STR
  const dueToday = due && isToday(due)
  const dueTomorrow = due && isTomorrow(due)
  const daysUntil = due ? differenceInDays(due, TODAY) : null

  let dueLabel = ''
  if (overdue) dueLabel = `${Math.abs(daysUntil)}d overdue`
  else if (dueToday) dueLabel = 'Due today'
  else if (dueTomorrow) dueLabel = 'Due tomorrow'
  else if (daysUntil !== null) dueLabel = `${daysUntil}d left`

  return (
    <div className="flex items-start gap-3 py-2.5 last:border-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <div
        className="mt-1.5 w-2 h-2 rounded-full shrink-0"
        style={{
          background: task.priority === 'high' ? '#dc2626' :
                      task.priority === 'medium' ? '#1a1a18' : 'rgba(0,0,0,0.08)',
          boxShadow: task.priority === 'high' ? '0 0 6px rgba(220,38,38,0.3)' : 'none',
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: '#1a1a18' }}>{task.task}</div>
        <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>
          {project?.name && <span>{project.name} · </span>}
          {task.owner && <span>{task.owner} · </span>}
          <span
            className="font-medium"
            style={{ color: overdue ? '#dc2626' : dueToday ? '#1a1a18' : '#9b9b94' }}
          >
            {dueLabel}
          </span>
        </div>
      </div>
      <span
        className="shrink-0 text-xs px-2 py-0.5 font-medium"
        style={{
          borderRadius: 20,
          background: task.pdca === 'Do' ? 'rgba(0,0,0,0.04)' :
                      task.pdca === 'Check' ? 'rgba(220,38,38,0.06)' : 'rgba(0,0,0,0.03)',
          color: task.pdca === 'Do' ? '#1a1a18' :
                 task.pdca === 'Check' ? '#dc2626' : '#9b9b94',
        }}
      >
        {task.pdca}
      </span>
    </div>
  )
}

function KPIStatusRow({ label, value, target, unit, prefix = '', invert = false }) {
  const pct = (value / target) * 100
  const isGood = invert ? pct <= 100 : pct >= 100
  const isWarn = invert ? (pct > 100 && pct <= 150) : (pct >= 80 && pct < 100)

  return (
    <div className="flex items-center justify-between py-2.5 last:border-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <span className="text-sm" style={{ color: '#9b9b94' }}>{label}</span>
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold tabular-nums" style={{ color: '#1a1a18', fontFamily: "'DM Mono', monospace" }}>
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{unit}
        </span>
        <span
          className="text-xs px-2 py-0.5 font-medium"
          style={{
            borderRadius: 20,
            background: isGood ? 'rgba(0,0,0,0.03)' : isWarn ? 'rgba(0,0,0,0.04)' : 'rgba(220,38,38,0.06)',
            color: isGood ? '#9b9b94' : isWarn ? '#1a1a18' : '#dc2626',
          }}
        >
          {isGood ? '✓' : isWarn ? '~' : '✗'} {Math.round(pct)}%
        </span>
      </div>
    </div>
  )
}

const AI_SUGGESTIONS = [
  "CVR is critically low at 0.3%. The highest-ROI single action today: book a 30-min Hotjar session review to find the #1 checkout drop-off point, then write one targeted fix brief for Dev Team.",
  "With 5 overdue tasks across CVR Recovery and Yumemakura, consider a 15-min 'unblock' standup with Kenji and Aiko to move the top 2 items from Plan to Do today.",
  "The Tuna Show is 55% done and has strong revenue potential ($80K/event). Prioritize securing the NYC venue this week — venue availability is the critical path constraint.",
  "New York accounts for 62% of revenue. A targeted NY loyalty campaign (email + SMS) to existing customers could lift AOV before the CVR fix is complete.",
]

export default function MorningBriefing() {
  const { kpis, tasks, projects, events, setActiveSection } = useApp()

  const briefing = useMemo(() => {
    const topTasks = [...tasks]
      .filter((t) => t.status !== 'done' && t.status !== 'completed')
      .sort((a, b) => {
        const prio = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
        if (prio !== 0) return prio
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
      .slice(0, 3)

    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < TODAY_STR && t.status !== 'done' && t.status !== 'completed'
    )
    const todayEvents = events.filter((e) => e.date === TODAY_STR)
    const cvrAlert = kpis.current.cvr < kpis.targets.cvr
    const aovAlert = kpis.current.aov < kpis.targets.aov
    const critProjects = projects.filter((p) => p.status === 'stalled' || p.status === 'behind')
    const suggestion = AI_SUGGESTIONS[TODAY.getDate() % AI_SUGGESTIONS.length]

    return { topTasks, overdue, todayEvents, cvrAlert, aovAlert, critProjects, suggestion }
  }, [kpis, tasks, projects, events])

  return (
    <div className="space-y-3 max-w-4xl">
      {/* Level System — most prominent position */}
      <LevelSystem />

      {/* Hero greeting */}
      <div
        className="rounded-xl p-7 text-white relative overflow-hidden"
        style={{
          borderRadius: 12,
          background: '#1a1a18',
        }}
      >
        {/* Subtle wave texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 11px)',
          }}
        />
        <div className="relative flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(255,255,255,0.1)',
            }}
          >
            <Sunrise size={20} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <div
              className="text-xl font-medium"
              style={{ letterSpacing: '-0.01em' }}
            >
              Good morning — here's what's up.
            </div>
            <div className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {format(TODAY, 'EEEE, MMMM d, yyyy')} · HUS Management Dashboard
            </div>
            <div className="flex flex-wrap gap-5 mt-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: briefing.overdue.length > 0 ? '#FF8A8A' : 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm" style={{ color: briefing.overdue.length > 0 ? '#FF9E9E' : 'rgba(255,255,255,0.6)', fontWeight: briefing.overdue.length > 0 ? 600 : 400 }}>
                  {briefing.overdue.length} overdue task{briefing.overdue.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckSquare size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {briefing.todayEvents.length} meeting{briefing.todayEvents.length !== 1 ? 's' : ''} today
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FolderKanban size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {briefing.critProjects.length} project{briefing.critProjects.length !== 1 ? 's' : ''} need attention
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Accent bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top Priorities */}
        <Section icon={CheckSquare} title="Today's Top Priorities">
          {briefing.topTasks.length === 0 ? (
            <p className="text-sm" style={{ color: '#9b9b94' }}>No open tasks. Clear!</p>
          ) : (
            <div>
              {briefing.topTasks.map((t) => (
                <PriorityItem key={t.id} task={t} projects={projects} />
              ))}
            </div>
          )}
          <button
            onClick={() => setActiveSection('tasks')}
            className="flex items-center gap-1 text-xs font-medium mt-1 transition-colors"
            style={{ color: '#1a1a18' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333333' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#1a1a18' }}
          >
            View all tasks <ArrowRight size={11} />
          </button>
        </Section>

        {/* Overdue items */}
        <Section icon={AlertTriangle} title="Overdue Items" accent={briefing.overdue.length > 0}>
          {briefing.overdue.length === 0 ? (
            <p className="text-sm font-medium" style={{ color: '#9b9b94' }}>No overdue tasks — well done!</p>
          ) : (
            <div>
              {briefing.overdue.slice(0, 4).map((t) => {
                const daysLate = differenceInDays(TODAY, parseISO(t.dueDate))
                const project = projects.find((p) => p.id === t.project)
                return (
                  <div key={t.id} className="flex items-start gap-2 py-2.5 last:border-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#1a1a18' }}>{t.task}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#dc2626' }}>{daysLate}d overdue · {project?.name}</div>
                    </div>
                  </div>
                )
              })}
              {briefing.overdue.length > 4 && (
                <div className="text-xs pt-2" style={{ color: '#9b9b94' }}>+{briefing.overdue.length - 4} more overdue</div>
              )}
            </div>
          )}
        </Section>

        {/* KPI Status */}
        <Section icon={TrendingUp} title="KPI Status">
          <KPIStatusRow label="Conversion Rate" value={kpis.current.cvr} target={kpis.targets.cvr} unit="%" />
          <KPIStatusRow label="Avg Order Value" value={kpis.current.aov} target={kpis.targets.aov} prefix="$" />
          <KPIStatusRow
            label="Mar Revenue"
            value={kpis.monthlyRevenue[kpis.monthlyRevenue.length - 1].revenue}
            target={kpis.targets.monthlyRevenue}
            prefix="$"
          />
          <button
            onClick={() => setActiveSection('dashboard')}
            className="flex items-center gap-1 text-xs font-medium mt-1 transition-colors"
            style={{ color: '#1a1a18' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333333' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#1a1a18' }}
          >
            Full KPI dashboard <ArrowRight size={11} />
          </button>
        </Section>

        {/* Today's calendar */}
        <Section icon={Clock} title="Today's Meetings">
          {briefing.todayEvents.length === 0 ? (
            <p className="text-sm" style={{ color: '#9b9b94' }}>No meetings scheduled today.</p>
          ) : (
            <div>
              {briefing.todayEvents.map((e) => {
                const project = projects.find((p) => p.id === e.project)
                return (
                  <div key={e.id} className="flex items-start gap-2 py-2.5 last:border-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <Clock size={13} className="shrink-0 mt-0.5" style={{ color: '#1a1a18' }} />
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#1a1a18' }}>{e.title}</div>
                      {project && <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>{project.name}</div>}
                      {e.notes && <div className="text-xs mt-0.5 italic" style={{ color: '#9b9b94' }}>{e.notes}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button
            onClick={() => setActiveSection('calendar')}
            className="flex items-center gap-1 text-xs font-medium mt-1 transition-colors"
            style={{ color: '#1a1a18' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333333' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#1a1a18' }}
          >
            Open calendar <ArrowRight size={11} />
          </button>
        </Section>
      </div>

      {/* Projects needing attention */}
      {briefing.critProjects.length > 0 && (
        <Section icon={FolderKanban} title="Projects Needing Attention">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {briefing.critProjects.map((p) => (
              <div
                key={p.id}
                className="rounded-xl"
                style={{
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderLeft: `3px solid ${p.status === 'stalled' ? '#dc2626' : '#1a1a18'}`,
                  background: p.status === 'stalled' ? '#fee2e2' : '#ffffff',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: '#1a1a18' }}>{p.name}</span>
                  <span
                    className="text-xs px-2 py-0.5 font-medium"
                    style={{
                      borderRadius: 20,
                      background: p.status === 'stalled' ? 'rgba(220,38,38,0.06)' : 'rgba(0,0,0,0.04)',
                      color: p.status === 'stalled' ? '#dc2626' : '#1a1a18',
                    }}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: '#9b9b94' }}>{p.owner} · {p.progress}% complete</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* AI Suggestion */}
      <div
        className="rounded-xl flex gap-4"
        style={{
          borderRadius: 12,
          padding: '14px 16px',
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,0,0,0.04)' }}
        >
          <Lightbulb size={15} style={{ color: '#1a1a18' }} />
        </div>
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: '#1a1a18', letterSpacing: '0.12em' }}
          >
            AI Suggestion for Today
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#6b6b66' }}>{briefing.suggestion}</p>
        </div>
      </div>
    </div>
  )
}
