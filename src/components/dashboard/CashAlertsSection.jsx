import {
  ShieldCheck, Activity, AlertTriangle, AlertCircle, Bell,
} from 'lucide-react'
import { cashStatus, weeklyAlerts } from '../../data/dashboardMockData'

const C = {
  text:   '#1a1a18',
  muted:  '#6b6b66',
  faint:  '#9b9b94',
  bg:     '#ffffff',
  border: 'rgba(0,0,0,0.06)',
  hair:   'rgba(0,0,0,0.04)',
}

const MONO = { fontFamily: "'DM Mono', monospace" }

const fmtMoney = (n) =>
  n == null ? '——' : '$' + Math.round(n).toLocaleString('en-US')

// ── Cash Status ─────────────────────────────────────────────────────────────

const CASH_LEVEL = {
  Safe:  { bg: 'rgba(21,128,61,0.10)',  fg: '#15803d', icon: ShieldCheck,    line: '#15803d' },
  Watch: { bg: 'rgba(180,83,9,0.10)',   fg: '#b45309', icon: Activity,        line: '#b45309' },
  Tight: { bg: 'rgba(220,38,38,0.10)',  fg: '#dc2626', icon: AlertTriangle,   line: '#dc2626' },
}

function CashCard() {
  const tone = CASH_LEVEL[cashStatus.level] || CASH_LEVEL.Watch
  const Icon = tone.icon
  return (
    <div
      className="rounded-xl p-4"
      style={{
        borderRadius: 12,
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${tone.line}`,
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: tone.bg, color: tone.fg }}
        >
          <Icon size={14} />
        </div>
        <h3 className="text-sm font-medium" style={{ color: C.text }}>Cash Status</h3>
        <span
          className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5"
          style={{
            borderRadius: 20,
            background: tone.bg,
            color: tone.fg,
            letterSpacing: '0.08em',
          }}
        >
          {cashStatus.level}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div
            className="text-[10px] uppercase font-semibold tracking-wider"
            style={{ color: C.faint, letterSpacing: '0.08em' }}
          >
            Month-end Forecast
          </div>
          <div className="text-xl font-semibold tabular-nums mt-0.5" style={{ ...MONO, color: C.text }}>
            {fmtMoney(cashStatus.monthEndForecast)}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] uppercase font-semibold tracking-wider"
            style={{ color: C.faint, letterSpacing: '0.08em' }}
          >
            Overdue AR
          </div>
          <div className="text-xl font-semibold tabular-nums mt-0.5" style={{ ...MONO, color: C.text }}>
            {cashStatus.overdueArCount} <span className="text-xs font-normal" style={{ color: C.faint }}>open</span>
          </div>
        </div>
      </div>

      {cashStatus.riskNote && (
        <div
          className="mt-3 rounded-lg p-2.5 text-xs leading-snug flex items-start gap-2"
          style={{
            borderRadius: 8,
            background: 'rgba(220,38,38,0.04)',
            border: '1px solid rgba(220,38,38,0.12)',
            color: C.text,
          }}
        >
          <AlertTriangle size={12} style={{ color: '#dc2626', marginTop: 2 }} className="shrink-0" />
          <span>
            <span className="font-semibold" style={{ color: '#dc2626' }}>Risk · </span>
            {cashStatus.riskNote}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Weekly Alerts ───────────────────────────────────────────────────────────

const SEVERITY = {
  high:   { dot: '#dc2626', label: 'HIGH',   bg: 'rgba(220,38,38,0.04)',  border: 'rgba(220,38,38,0.18)', icon: AlertCircle,    iconColor: '#dc2626' },
  medium: { dot: '#b45309', label: 'MED',    bg: 'rgba(180,83,9,0.04)',   border: 'rgba(180,83,9,0.18)',  icon: AlertTriangle,  iconColor: '#b45309' },
  low:    { dot: '#9b9b94', label: 'LOW',    bg: 'rgba(0,0,0,0.02)',      border: C.border,                icon: Bell,            iconColor: '#9b9b94' },
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 }

function AlertRow({ alert }) {
  const s = SEVERITY[alert.severity] || SEVERITY.low
  const Icon = s.icon
  return (
    <div
      className="rounded-lg p-2.5 flex items-start gap-2.5"
      style={{
        borderRadius: 10,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `3px solid ${s.dot}`,
      }}
    >
      <Icon size={13} className="shrink-0 mt-0.5" style={{ color: s.iconColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-sm font-semibold leading-tight" style={{ color: C.text }}>
            {alert.title}
          </span>
          <span
            className="text-[11px] tabular-nums shrink-0"
            style={{ ...MONO, color: C.muted }}
          >
            <span className="font-semibold" style={{ color: s.iconColor }}>{alert.current}</span>
            <span style={{ color: C.faint }}> · {alert.target}</span>
          </span>
        </div>
        <div className="text-xs mt-0.5 leading-snug" style={{ color: C.muted }}>
          {alert.impact}
        </div>
        <div className="text-[10px] uppercase font-semibold mt-1" style={{ color: C.faint, letterSpacing: '0.08em' }}>
          Owner · <span style={{ color: C.text }}>@{alert.owner}</span>
        </div>
      </div>
    </div>
  )
}

const MAX_ALERTS = 5

function WeeklyAlertsCard() {
  const alerts = [...weeklyAlerts]
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    .slice(0, MAX_ALERTS)

  const highCount = alerts.filter((a) => a.severity === 'high').length

  return (
    <div
      className="rounded-xl p-4"
      style={{
        borderRadius: 12,
        background: C.bg,
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.04)', color: C.text }}
        >
          <Bell size={14} />
        </div>
        <h3 className="text-sm font-medium" style={{ color: C.text }}>Weekly Alerts</h3>
        <span
          className="ml-auto text-[10px] tabular-nums"
          style={{ ...MONO, color: C.faint }}
        >
          {alerts.length}/{MAX_ALERTS}
          {highCount > 0 && (
            <span
              className="ml-2 font-bold"
              style={{ color: '#dc2626' }}
            >
              · {highCount} high
            </span>
          )}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: C.faint }}>
          No active alerts this week.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
        </div>
      )}
    </div>
  )
}

// ── Combined Section ────────────────────────────────────────────────────────

export default function CashAlertsSection() {
  return (
    <div className="space-y-3">
      <CashCard />
      <WeeklyAlertsCard />
    </div>
  )
}
