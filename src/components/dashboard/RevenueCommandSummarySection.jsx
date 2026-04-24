import {
  DollarSign, ArrowUpRight, ArrowDownRight, ExternalLink,
  RefreshCw, AlertCircle,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useRevenueSummary } from '../../hooks/useRevenueSummary'

/**
 * Cockpit · Block 1 — Revenue Command summary.
 *
 * Step 6 · C1: Now reads live data via `useRevenueSummary()` instead of the
 * mock constants. B2C MTD comes from `/api/shopify/sync`; Export / Broker
 * come from Supabase `revenue_manual`; B2B is pending-Freshline. Null values
 * render as "——" so the card keeps its shape during loading / partial sync.
 */

const C = {
  text:   '#1a1a18',
  muted:  '#6b6b66',
  faint:  '#9b9b94',
  bg:     '#ffffff',
  border: 'rgba(0,0,0,0.06)',
  hair:   'rgba(0,0,0,0.04)',
  ok:     '#15803d',
  warn:   '#b45309',
  danger: '#dc2626',
}
const MONO = { fontFamily: "'DM Mono', monospace" }

// Distinct but calm palette for the 4 channels (data-viz — unchanged in Step 6).
const CHANNEL_COLORS = {
  B2C:    '#1a1a18',
  B2B:    '#52525b',
  Export: '#a1a1aa',
  Broker: '#d4d4d8',
}

const fmtMoney  = (n) => (n == null ? '——' : '$' + Math.round(n).toLocaleString('en-US'))
const fmtMoneyK = (n) => {
  if (n == null) return '——'
  if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K'
  return '$' + Math.round(n)
}

function DeltaChip({ value, label }) {
  if (value == null) {
    return (
      <span className="text-[11px]" style={{ color: C.faint }}>
        <span className="font-normal">{label}: </span>——
      </span>
    )
  }
  const positive = value >= 0
  const Arrow    = positive ? ArrowUpRight : ArrowDownRight
  const color    = positive ? C.ok : C.danger
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums"
      style={{ ...MONO, color }}
    >
      <Arrow size={11} />
      {positive ? '+' : ''}{value.toFixed(1)}%
      <span className="font-normal" style={{ color: C.faint }}>{label}</span>
    </span>
  )
}

function SyncIndicator({ status, syncedAt }) {
  if (status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: C.faint }}>
        <RefreshCw size={10} className="animate-spin" /> syncing
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: C.warn }}>
        <AlertCircle size={10} /> sync pending
      </span>
    )
  }
  if (status === 'synced' && syncedAt) {
    const t = syncedAt instanceof Date ? syncedAt : new Date(syncedAt)
    return (
      <span className="text-[10px] tabular-nums" style={{ ...MONO, color: C.faint }}>
        synced&nbsp;
        {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }
  return (
    <span className="text-[10px]" style={{ color: C.faint }}>awaiting sync</span>
  )
}

export default function RevenueCommandSummarySection() {
  const { setActiveSection } = useApp()
  const {
    mtdSales, forecast, target,
    deltaVsLastMonth, deltaVsLastYear,
    breakdown,
    cvr, cvrTarget, aov, aovTarget,
    status, syncedAt,
  } = useRevenueSummary()

  const forecastPct = target > 0 && forecast != null
    ? Math.min(100, Math.round((forecast / target) * 100))
    : null
  const onPace   = forecastPct != null && forecastPct >= 95
  const cvrBelow = cvr != null && cvrTarget != null && cvr < cvrTarget
  const aovBelow = aov != null && aovTarget != null && aov < aovTarget

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{ borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.04)', color: C.text }}
        >
          <DollarSign size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium" style={{ color: C.text }}>Revenue Command</h3>
          <div className="flex items-center gap-2 text-[11px]" style={{ color: C.faint }}>
            <span>MTD across all channels · summary</span>
            <span style={{ color: C.hair }}>·</span>
            <SyncIndicator status={status} syncedAt={syncedAt} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveSection('revenue')}
          className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md"
          style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.bg }}
          title="Open full Revenue Command page"
        >
          Details <ExternalLink size={10} />
        </button>
      </div>

      {/* Hero MTD */}
      <div>
        <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint, letterSpacing: '0.08em' }}>
          MTD Sales
        </div>
        <div
          className="font-bold tabular-nums leading-none mt-1"
          style={{ ...MONO, fontSize: 40, color: C.text, letterSpacing: '-0.02em' }}
        >
          {fmtMoney(mtdSales)}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <DeltaChip value={deltaVsLastMonth} label="vs LM" />
          <DeltaChip value={deltaVsLastYear}  label="vs LY" />
        </div>
      </div>

      {/* Forecast vs Target */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="uppercase font-semibold tracking-wider" style={{ color: C.faint, letterSpacing: '0.08em' }}>
            Forecast vs Target
          </span>
          <span
            className="font-semibold tabular-nums"
            style={{ ...MONO, color: forecastPct == null ? C.faint : (onPace ? C.ok : C.warn) }}
          >
            {forecastPct == null ? '——' : `${forecastPct}%`}
          </span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 8, background: 'rgba(0,0,0,0.05)' }}
        >
          <div
            style={{
              height: '100%',
              width: `${forecastPct ?? 0}%`,
              background: forecastPct == null
                ? 'transparent'
                : onPace ? C.ok : (forecastPct >= 75 ? '#1a1a18' : C.warn),
              transition: 'width 300ms ease',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] mt-1 tabular-nums" style={{ ...MONO, color: C.muted }}>
          <span>Forecast {fmtMoneyK(forecast)}</span>
          <span>Target {fmtMoneyK(target)}</span>
        </div>
      </div>

      {/* Channel Mix */}
      <div>
        <div className="text-[10px] uppercase font-semibold tracking-wider mb-1.5" style={{ color: C.faint, letterSpacing: '0.08em' }}>
          Channel Mix
        </div>
        <div className="w-full flex rounded-full overflow-hidden" style={{ height: 10, background: 'rgba(0,0,0,0.05)' }}>
          {breakdown.map((c) => (
            c.amount ? (
              <div
                key={c.key}
                style={{
                  width: `${c.share * 100}%`,
                  background: CHANNEL_COLORS[c.key] || '#9b9b94',
                }}
                title={`${c.label} · ${(c.share * 100).toFixed(1)}% · ${fmtMoney(c.amount)}`}
              />
            ) : null
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
          {breakdown.map((c) => {
            const pending = c.amount == null
            return (
              <div key={c.key} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: pending ? 'transparent' : CHANNEL_COLORS[c.key],
                    border: pending ? `1px dashed ${C.faint}` : 'none',
                  }}
                />
                <span className="font-medium" style={{ color: pending ? C.faint : C.text }}>
                  {c.label}
                </span>
                <span className="tabular-nums" style={{ ...MONO, color: C.faint }}>
                  {pending ? (c.source === 'pending' ? 'pending' : 'manual') : `${(c.share * 100).toFixed(0)}%`}
                </span>
                <span className="tabular-nums ml-auto" style={{ ...MONO, color: pending ? C.faint : C.muted }}>
                  {fmtMoneyK(c.amount)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* CVR + AOV mini KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-lg p-3"
          style={{
            borderRadius: 10,
            background: 'rgba(0,0,0,0.02)',
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${cvrBelow ? C.danger : (cvr == null ? C.faint : C.ok)}`,
          }}
        >
          <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint, letterSpacing: '0.08em' }}>
            CVR
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-bold tabular-nums" style={{ ...MONO, color: cvr == null ? C.faint : (cvrBelow ? C.danger : C.text) }}>
              {cvr == null ? '——' : `${cvr.toFixed(2)}%`}
            </span>
            <span className="text-[11px] tabular-nums" style={{ ...MONO, color: C.faint }}>
              {cvrTarget != null && `· target ${cvrTarget.toFixed(2)}%`}
            </span>
          </div>
        </div>
        <div
          className="rounded-lg p-3"
          style={{
            borderRadius: 10,
            background: 'rgba(0,0,0,0.02)',
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${aovBelow ? C.warn : (aov == null ? C.faint : C.ok)}`,
          }}
        >
          <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint, letterSpacing: '0.08em' }}>
            AOV
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-bold tabular-nums" style={{ ...MONO, color: aov == null ? C.faint : (aovBelow ? C.warn : C.text) }}>
              {aov == null ? '——' : `$${aov}`}
            </span>
            <span className="text-[11px] tabular-nums" style={{ ...MONO, color: C.faint }}>
              {aovTarget != null && `· target $${aovTarget}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
