import { useEffect, useMemo, useState } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Check, X,
  RefreshCw, Target, Zap, Pencil,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  currentPeriodKey, loadRevenueManual, saveRevenueManual,
} from '../api/revenueManual'

// ── Formatting helpers ──────────────────────────────────────────────────────

const fmtMoney = (n) => {
  if (n == null || n === '' || Number.isNaN(n)) return '——'
  return '$' + Math.round(Number(n)).toLocaleString('en-US')
}
const fmtPct = (n, digits = 1) => {
  if (n == null || Number.isNaN(n)) return '——'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

// ── Chips ───────────────────────────────────────────────────────────────────

function SourceChip({ kind }) {
  const map = {
    auto:    { label: 'Auto',    bg: '#dcfce7', fg: '#15803d' },
    pending: { label: 'Pending', bg: '#fef3c7', fg: '#92400e' },
    manual:  { label: 'Manual',  bg: 'rgba(0,0,0,0.05)', fg: '#6b6b66' },
  }
  const s = map[kind] || map.manual
  return (
    <span
      className="badge"
      style={{
        background: s.bg, color: s.fg,
        fontSize: 10, padding: '1px 8px',
        letterSpacing: '0.02em', fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  )
}

function DeltaChip({ pct, label }) {
  if (pct == null || Number.isNaN(pct)) {
    return (
      <span className="text-[11px]" style={{ color: '#9b9b94' }}>
        {label}: ——
      </span>
    )
  }
  const up = pct >= 0
  const color = up ? '#15803d' : '#b91c1c'
  const bg    = up ? '#dcfce7' : '#fee2e2'
  const Arrow = up ? TrendingUp : TrendingDown
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold"
      style={{
        background: bg, color, padding: '2px 8px', borderRadius: 20,
      }}
    >
      <Arrow size={10} />
      <span className="num">{fmtPct(pct)}</span>
      <span style={{ opacity: 0.75, fontWeight: 500 }}>{label}</span>
    </span>
  )
}

// ── Forecast progress bar ───────────────────────────────────────────────────

function ForecastProgress({ forecast, target }) {
  const pct = target > 0 ? (forecast / target) * 100 : 0
  const capped = Math.min(pct, 120)
  const onPace = pct >= 100
  const fillColor = onPace ? '#16a34a' : pct >= 80 ? '#d97706' : '#dc2626'

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span style={{ color: '#6b6b66' }}>Forecast vs Target</span>
        <span className="num font-semibold" style={{ color: '#1a1a18' }}>
          {pct > 0 ? `${pct.toFixed(0)}%` : '——'}
        </span>
      </div>
      <div
        className="relative"
        style={{
          height: 10, borderRadius: 999,
          background: 'rgba(0,0,0,0.05)', overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.max(capped, 0)}%`,
            height: '100%',
            background: fillColor,
            borderRadius: 999,
            transition: 'width 0.6s ease',
          }}
        />
        {/* target marker at 100% */}
        <div
          style={{
            position: 'absolute', top: -2, bottom: -2, left: '100%',
            width: 2, background: '#1a1a18', transform: 'translateX(-1px)',
            opacity: 0.35,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] mt-1.5">
        <span className="num" style={{ color: '#9b9b94' }}>
          Forecast {fmtMoney(forecast)}
        </span>
        <span className="num" style={{ color: '#9b9b94' }}>
          Target {fmtMoney(target)}
        </span>
      </div>
    </div>
  )
}

// ── Revenue mix (horizontal stacked bar) ────────────────────────────────────

const MIX_COLORS = {
  B2C:      '#2563eb',
  B2B:      '#0d9488',
  Export:   '#db2777',
  Broker:   '#d97706',
  'Tuna Show': '#7c3aed',
}

function RevenueMix({ rows }) {
  const known = rows.filter((r) => r.amount != null && r.amount > 0)
  const total = known.reduce((s, r) => s + r.amount, 0)
  if (total === 0) {
    return (
      <div className="text-[12px] mt-3" style={{ color: '#9b9b94' }}>
        No revenue booked yet this month.
      </div>
    )
  }
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span style={{ color: '#6b6b66' }}>Revenue Mix (MTD)</span>
        <span className="num" style={{ color: '#9b9b94' }}>
          Total {fmtMoney(total)}
        </span>
      </div>
      <div
        className="flex"
        style={{
          height: 10, borderRadius: 999, overflow: 'hidden',
          background: 'rgba(0,0,0,0.05)',
        }}
      >
        {known.map((r) => (
          <div
            key={r.key}
            title={`${r.label} · ${fmtMoney(r.amount)} · ${((r.amount / total) * 100).toFixed(0)}%`}
            style={{
              width: `${(r.amount / total) * 100}%`,
              background: MIX_COLORS[r.key] || '#1a1a18',
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {known.map((r) => (
          <div key={r.key} className="flex items-center gap-1.5 text-[11px]">
            <span
              style={{
                width: 8, height: 8, borderRadius: 2,
                background: MIX_COLORS[r.key] || '#1a1a18',
              }}
            />
            <span style={{ color: '#6b6b66' }}>{r.label}</span>
            <span className="num font-semibold" style={{ color: '#1a1a18' }}>
              {((r.amount / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Breakdown row with inline edit ──────────────────────────────────────────

function BreakdownRow({ row, total, onSave }) {
  const { label, amount, source, note, editable } = row
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const isEmpty = amount == null
  const share = total > 0 && amount ? (amount / total) * 100 : 0

  const startEdit = () => {
    setValue(amount == null ? '' : String(amount))
    setEditing(true)
  }
  const commit = async () => {
    const trimmed = value.replace(/[^0-9.]/g, '')
    const n = trimmed === '' ? null : Number(trimmed)
    if (n != null && Number.isNaN(n)) return
    setSaving(true)
    await onSave(n)
    setSaving(false)
    setEditing(false)
  }
  const cancel = () => { setEditing(false); setValue('') }

  return (
    <div
      className="flex items-center gap-3 py-2.5"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
    >
      {/* Label + source */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[13px] font-medium"
            style={{ color: '#1a1a18' }}
          >
            {label}
          </span>
          <SourceChip kind={source} />
        </div>
        {note && (
          <div className="text-[11px] mt-0.5" style={{ color: '#9b9b94' }}>
            {note}
          </div>
        )}
      </div>

      {/* Mini share bar */}
      <div className="w-20 shrink-0 hidden sm:block">
        <div
          style={{
            height: 4, borderRadius: 999,
            background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(share, 100)}%`,
              height: '100%',
              background: MIX_COLORS[row.key] || '#1a1a18',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div
          className="text-[10px] mt-0.5 num"
          style={{ color: '#9b9b94', textAlign: 'right' }}
        >
          {isEmpty ? '' : `${share.toFixed(0)}%`}
        </div>
      </div>

      {/* Amount / editor */}
      <div className="w-36 shrink-0 text-right">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              disabled={saving}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') cancel()
              }}
              placeholder="0"
              className="num text-[13px] text-right"
              style={{
                width: 96,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.15)',
                background: '#fff',
              }}
            />
            <button
              onClick={commit}
              disabled={saving}
              className="p-1"
              style={{ color: '#15803d', opacity: saving ? 0.5 : 1 }}
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="p-1"
              style={{ color: '#9b9b94' }}
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : editable ? (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 text-[14px] num font-semibold transition-opacity hover:opacity-70"
            style={{ color: isEmpty ? '#9b9b94' : '#1a1a18' }}
            title="Click to edit"
          >
            {isEmpty ? (
              <>
                <Plus size={12} />
                <span className="text-[12px] font-medium">Add</span>
              </>
            ) : (
              <>
                {fmtMoney(amount)}
                <Pencil size={11} style={{ opacity: 0.4 }} />
              </>
            )}
          </button>
        ) : (
          <span
            className="text-[14px] num font-semibold"
            style={{ color: isEmpty ? '#9b9b94' : '#1a1a18' }}
          >
            {fmtMoney(amount)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Mini KPI card ───────────────────────────────────────────────────────────

function MiniKPI({ label, value, target, suffix = '' }) {
  const onTarget = target != null && value != null && value >= target
  return (
    <div
      className="hus-card"
      style={{ padding: '12px 14px' }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider"
           style={{ color: '#9b9b94', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span
          className="num font-semibold"
          style={{ fontSize: 22, color: '#1a1a18', lineHeight: 1 }}
        >
          {value == null ? '——' : value.toLocaleString('en-US')}
        </span>
        {suffix && (
          <span className="text-[12px]" style={{ color: '#9b9b94' }}>{suffix}</span>
        )}
      </div>
      {target != null && (
        <div className="text-[11px] mt-1" style={{ color: onTarget ? '#15803d' : '#9b9b94' }}>
          Target {target.toLocaleString('en-US')}{suffix}
        </div>
      )}
    </div>
  )
}

// ── Main Revenue Command section ────────────────────────────────────────────

export default function RevenueCommand() {
  const { kpis, shopifySync, syncShopify } = useApp()

  const [period] = useState(currentPeriodKey())
  const [manual, setManual] = useState({
    export_amount:    null,
    broker_amount:    null,
    tuna_show_amount: null,
  })
  const [manualLoaded, setManualLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadRevenueManual(period).then((data) => {
      if (cancelled) return
      setManual({
        export_amount:    data.export_amount    ?? null,
        broker_amount:    data.broker_amount    ?? null,
        tuna_show_amount: data.tuna_show_amount ?? null,
      })
      setManualLoaded(true)
    })
    return () => { cancelled = true }
  }, [period])

  const saveField = async (field, next) => {
    const prev = manual
    setManual({ ...manual, [field]: next })
    const result = await saveRevenueManual(period, { [field]: next })
    if (!result?.ok) setManual(prev)
  }

  // Shopify-backed metrics
  const cm = kpis.currentMonth || {}
  const b2cMtd         = cm.mtd ?? null
  const forecastShopify= cm.forecast ?? null
  const lmSamePoint    = cm.lastMonthToSameDay ?? null
  const lySameMonth    = cm.lastYearSameMonth ?? null

  // Manual sources
  const exportAmt = manual.export_amount
  const brokerAmt = manual.broker_amount
  const tunaAmt   = manual.tuna_show_amount

  // B2B is pending Freshline — no amount yet
  const b2bAmt = null

  // MTD across all sources (ignore nulls)
  const totalMtd = [b2cMtd, b2bAmt, exportAmt, brokerAmt, tunaAmt]
    .filter((v) => v != null)
    .reduce((s, v) => s + Number(v), 0)

  // Target from kpis.json (monthly target number)
  const target = kpis?.targets?.monthlyRevenue ?? null

  // Forecast: for now, run-rate on total known MTD (Shopify + any manual entered)
  const now = new Date()
  const day = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const forecast = day > 0 && totalMtd > 0
    ? Math.round((totalMtd / day) * daysInMonth)
    : null

  // Deltas
  const deltaLM = useMemo(() => {
    if (!b2cMtd || !lmSamePoint) return null
    return ((b2cMtd - lmSamePoint) / lmSamePoint) * 100
  }, [b2cMtd, lmSamePoint])

  const deltaLY = useMemo(() => {
    if (!b2cMtd || !lySameMonth) return null
    // LY is FULL last-year-same-month; prorate to same day for fair comparison
    const lyToSamePoint = (lySameMonth / daysInMonth) * day
    if (lyToSamePoint === 0) return null
    return ((b2cMtd - lyToSamePoint) / lyToSamePoint) * 100
  }, [b2cMtd, lySameMonth, day, daysInMonth])

  const rows = [
    {
      key: 'B2C', label: 'B2C',
      source: b2cMtd != null ? 'auto' : 'pending',
      note: 'Shopify · MTD',
      amount: b2cMtd, editable: false,
    },
    {
      key: 'B2B', label: 'B2B',
      source: 'pending',
      note: 'Freshline 確認中',
      amount: b2bAmt, editable: false,
    },
    {
      key: 'Export', label: 'Export',
      source: 'manual',
      note: 'Manual entry',
      amount: exportAmt, editable: true,
      field: 'export_amount',
    },
    {
      key: 'Broker', label: 'Broker / Spot',
      source: 'manual',
      note: 'Manual entry · not yet configured',
      amount: brokerAmt, editable: true,
      field: 'broker_amount',
    },
    {
      key: 'Tuna Show', label: 'Tuna Show',
      source: 'manual',
      note: 'Manual entry · not yet configured',
      amount: tunaAmt, editable: true,
      field: 'tuna_show_amount',
    },
  ]

  const cvr = kpis?.current?.cvr ?? null
  const aov = kpis?.current?.aov ?? null
  const cvrTarget = kpis?.targets?.cvr ?? null
  const aovTarget = kpis?.targets?.aov ?? null

  return (
    <div className="space-y-4">
      {/* ── Sub-header (period + sync status) ────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[12px]" style={{ color: '#9b9b94' }}>
          <span className="num font-medium" style={{ color: '#6b6b66' }}>
            {period}
          </span>
          <span className="mx-1.5">·</span>
          Day {day} of {daysInMonth}
          {shopifySync.lastSync && (
            <>
              <span className="mx-1.5">·</span>
              Shopify synced {new Date(shopifySync.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </>
          )}
        </p>
        <button
          onClick={syncShopify}
          disabled={shopifySync.loading}
          className="btn-ghost inline-flex items-center gap-1.5"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          <RefreshCw
            size={12}
            className={shopifySync.loading ? 'animate-spin' : ''}
          />
          {shopifySync.loading ? 'Syncing…' : 'Sync Shopify'}
        </button>
      </div>

      {/* ── Hero row: MTD + mini KPIs ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hero MTD card (spans 2) */}
        <div
          className="hus-card lg:col-span-2"
          style={{ padding: '18px 20px' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
              >
                <DollarSign size={16} />
              </div>
              <div>
                <div
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#9b9b94', letterSpacing: '0.08em' }}
                >
                  MTD Sales
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: '#9b9b94' }}
                >
                  All sources · month-to-date
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <DeltaChip pct={deltaLM} label="vs LM" />
              <DeltaChip pct={deltaLY} label="vs LY" />
            </div>
          </div>

          <div className="flex items-baseline gap-3 mt-3">
            <span
              className="num font-semibold"
              style={{
                fontSize: 44, color: '#1a1a18',
                lineHeight: 1, letterSpacing: '-0.02em',
              }}
            >
              {totalMtd > 0 ? fmtMoney(totalMtd) : '——'}
            </span>
          </div>

          <ForecastProgress forecast={forecast} target={target} />

          <RevenueMix rows={rows} />
        </div>

        {/* Mini KPIs */}
        <div className="space-y-3">
          <MiniKPI
            label="CVR"
            value={cvr}
            target={cvrTarget}
            suffix="%"
          />
          <MiniKPI
            label="AOV"
            value={aov}
            target={aovTarget}
            suffix=""
          />
          <div
            className="hus-card"
            style={{ padding: '12px 14px' }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider"
                 style={{ color: '#9b9b94', letterSpacing: '0.08em' }}>
              Forecast vs Target
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className="num font-semibold"
                style={{ fontSize: 22, color: '#1a1a18', lineHeight: 1 }}
              >
                {forecast != null && target ? `${Math.round((forecast / target) * 100)}%` : '——'}
              </span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: '#9b9b94' }}>
              {forecast != null ? fmtMoney(forecast) : '——'} / {fmtMoney(target)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue breakdown rows ────────────────────────────── */}
      <div className="hus-card" style={{ padding: '14px 18px' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target size={14} style={{ color: '#6b6b66' }} />
            <h3
              className="hus-heading"
              style={{ fontSize: 14 }}
            >
              Revenue Breakdown
            </h3>
          </div>
          <span className="text-[11px]" style={{ color: '#9b9b94' }}>
            {manualLoaded ? '' : 'Loading manual entries…'}
          </span>
        </div>

        <div>
          {rows.map((row) => (
            <BreakdownRow
              key={row.key}
              row={row}
              total={totalMtd}
              onSave={(n) => row.field ? saveField(row.field, n) : null}
            />
          ))}
        </div>

        <div
          className="flex items-center justify-between pt-3 mt-1"
          style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
        >
          <span
            className="text-[12px] font-medium uppercase tracking-wider"
            style={{ color: '#6b6b66', letterSpacing: '0.06em' }}
          >
            Total MTD
          </span>
          <span
            className="num font-semibold"
            style={{ fontSize: 16, color: '#1a1a18' }}
          >
            {totalMtd > 0 ? fmtMoney(totalMtd) : '——'}
          </span>
        </div>
      </div>

      {/* ── Footnote ─────────────────────────────────────────── */}
      <div
        className="flex items-start gap-2 text-[11px] px-1"
        style={{ color: '#9b9b94' }}
      >
        <Zap size={12} className="mt-0.5 shrink-0" />
        <span>
          B2C auto-synced from Shopify (uni-guy.myshopify.com). B2B pending Freshline.
          Export / Broker / Tuna Show saved to Supabase per calendar month.
        </span>
      </div>
    </div>
  )
}
