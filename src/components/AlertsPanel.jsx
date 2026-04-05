import { useMemo } from 'react'
import { AlertTriangle, Clock, PauseCircle, ExternalLink, CheckCircle } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { useApp } from '../context/AppContext'

const TODAY = new Date().toISOString().slice(0, 10)

const SEVERITY = {
  critical: {
    icon: AlertTriangle,
    leftBorder: '#C0392B',
    text: '#C0392B',
    badge: { bg: '#F5F5F5', color: '#C0392B' },
    dot: '#C0392B',
  },
  warning: {
    icon: Clock,
    leftBorder: '#C9A96E',
    text: '#C9A96E',
    badge: { bg: '#F5F5F5', color: '#C9A96E' },
    dot: '#C9A96E',
  },
  info: {
    icon: PauseCircle,
    leftBorder: '#999999',
    text: '#999999',
    badge: { bg: '#F5F5F5', color: '#999999' },
    dot: '#999999',
  },
}

function AlertCard({ alert, onNavigate }) {
  const s = SEVERITY[alert.severity] || SEVERITY.warning
  const Icon = s.icon

  return (
    <div
      className="rounded-xl p-4 flex gap-3"
      style={{ background: '#FFFFFF', border: '1px solid #F0F0F0', borderLeft: `3px solid ${s.leftBorder}` }}
    >
      <Icon size={17} className="shrink-0 mt-0.5" style={{ color: s.text }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{alert.title}</div>
          <span
            className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: s.badge.bg, color: s.badge.color }}
          >
            {alert.severity}
          </span>
        </div>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#999999' }}>{alert.description}</p>
        {alert.action && (
          <button
            onClick={() => onNavigate && onNavigate(alert.link)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: s.text }}
          >
            {alert.action} <ExternalLink size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3
          className="text-sm font-medium"
          style={{ fontFamily: '"Noto Serif JP", Georgia, serif', color: '#1A1A1A' }}
        >
          {title}
        </h3>
        {count > 0 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#F5F5F5', color: '#999999' }}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export default function AlertsPanel() {
  const { kpis, tasks, projects, setActiveSection } = useApp()

  const alerts = useMemo(() => {
    const kpiAlerts = []
    const taskAlerts = []
    const projectAlerts = []

    if (kpis.current.cvr < kpis.targets.cvr) {
      kpiAlerts.push({
        id: 'kpi-cvr',
        severity: 'critical',
        title: 'CVR Below Target',
        description: `Current conversion rate is ${kpis.current.cvr}% vs ${kpis.targets.cvr}% target — ${((kpis.current.cvr / kpis.targets.cvr) * 100).toFixed(0)}% of goal. This is the primary revenue lever. Immediate action required on CVR Recovery project.`,
        action: 'View CVR Recovery project',
        link: 'projects',
      })
    }

    if (kpis.current.aov < kpis.targets.aov) {
      const pct = ((kpis.current.aov / kpis.targets.aov) * 100).toFixed(0)
      kpiAlerts.push({
        id: 'kpi-aov',
        severity: 'warning',
        title: 'AOV Below Target',
        description: `Average order value is $${kpis.current.aov} vs $${kpis.targets.aov} target (${pct}%). Consider bundle offers, upsells, or premium product launches (Tsushima New Products may help).`,
        action: 'View KPI Dashboard',
        link: 'dashboard',
      })
    }

    const overdueTasks = tasks.filter(
      (t) => t.dueDate && t.dueDate < TODAY && t.status !== 'done' && t.status !== 'completed'
    )
    overdueTasks.forEach((t) => {
      const daysLate = differenceInDays(new Date(), parseISO(t.dueDate))
      const project = projects.find((p) => p.id === t.project)
      taskAlerts.push({
        id: `overdue-${t.id}`,
        severity: daysLate > 7 ? 'critical' : 'warning',
        title: `Overdue: ${t.task}`,
        description: `${daysLate} day${daysLate !== 1 ? 's' : ''} overdue${project ? ` · ${project.name}` : ''}. Owner: ${t.owner || 'Unassigned'}. Current PDCA stage: ${t.pdca}.`,
        action: 'Go to Tasks',
        link: 'tasks',
      })
    })

    tasks.forEach((t) => {
      if (t.status === 'done' || t.status === 'completed') return
      if (!t.pdcaUpdatedAt) return
      const daysStuck = differenceInDays(new Date(), parseISO(t.pdcaUpdatedAt))
      if (daysStuck > 7) {
        taskAlerts.push({
          id: `pdca-stuck-${t.id}`,
          severity: 'info',
          title: `Stuck in "${t.pdca}" stage`,
          description: `"${t.task}" has been in the ${t.pdca} stage for ${daysStuck} days without progressing. Owner: ${t.owner || 'Unassigned'}. Consider a check-in or unblocking action.`,
          action: 'Review task',
          link: 'tasks',
        })
      }
    })

    projects.forEach((p) => {
      if (p.status === 'stalled') {
        projectAlerts.push({
          id: `proj-stalled-${p.id}`,
          severity: 'critical',
          title: `Project Stalled: ${p.name}`,
          description: `"${p.name}" (owner: ${p.owner}) is marked as stalled at ${p.progress}% progress. Recommend immediate stakeholder review and unblocking action.`,
          action: 'View project',
          link: 'projects',
        })
      }
      if (p.status === 'behind') {
        projectAlerts.push({
          id: `proj-behind-${p.id}`,
          severity: 'warning',
          title: `Project Behind: ${p.name}`,
          description: `"${p.name}" (owner: ${p.owner}) is behind schedule at ${p.progress}% progress with due date ${p.dueDate ? format(parseISO(p.dueDate), 'MMM d, yyyy') : 'TBD'}.`,
          action: 'View project',
          link: 'projects',
        })
      }
    })

    return { kpiAlerts, taskAlerts, projectAlerts }
  }, [kpis, tasks, projects])

  const total = alerts.kpiAlerts.length + alerts.taskAlerts.length + alerts.projectAlerts.length
  const navigate = (section) => setActiveSection(section)

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <CheckCircle size={48} style={{ color: '#999999', opacity: 0.7 }} />
        <div className="text-center">
          <div
            className="text-lg font-medium"
            style={{ fontFamily: '"Noto Serif JP", Georgia, serif', color: '#1A1A1A' }}
          >
            All Clear
          </div>
          <div className="text-sm mt-1" style={{ color: '#999999' }}>No active alerts. Everything looks good.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-xs" style={{ color: '#999999' }}>
        {total} active alert{total !== 1 ? 's' : ''} — auto-computed from live data
      </div>

      {alerts.kpiAlerts.length > 0 && (
        <Section title="KPI Alerts" count={alerts.kpiAlerts.length}>
          {alerts.kpiAlerts.map((a) => <AlertCard key={a.id} alert={a} onNavigate={navigate} />)}
        </Section>
      )}

      {alerts.projectAlerts.length > 0 && (
        <Section title="Project Status" count={alerts.projectAlerts.length}>
          {alerts.projectAlerts.map((a) => <AlertCard key={a.id} alert={a} onNavigate={navigate} />)}
        </Section>
      )}

      {alerts.taskAlerts.length > 0 && (
        <Section title="Task Alerts" count={alerts.taskAlerts.length}>
          {alerts.taskAlerts.map((a) => <AlertCard key={a.id} alert={a} onNavigate={navigate} />)}
        </Section>
      )}
    </div>
  )
}
