import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Compass, DollarSign, Target, Users, Plus, X, Pencil, Check,
  AlertTriangle, ShieldCheck, Activity, ArrowRight,
} from 'lucide-react'
import {
  monthKey, dayKey, weekKey,
  loadCashStatus, saveCashStatus,
  loadFocusItems, upsertFocusItem, deleteFocusItem,
  loadTeamPulse, saveTeamPulse,
} from '../api/morningManual'
import { priority as PRIORITY_TOKENS } from '../config/theme'

// ── Style primitives ────────────────────────────────────────────────────────

const C = {
  text:   '#1a1a18',
  muted:  '#6b6b66',
  faint:  '#9b9b94',
  bg:     '#ffffff',
  page:   '#f7f6f1',
  border: 'rgba(0,0,0,0.06)',
  hair:   'rgba(0,0,0,0.04)',
  danger: '#dc2626',
  warn:   '#b45309',
  ok:     '#15803d',
}

const MONO = { fontFamily: "'DM Mono', monospace" }

function Section({ icon: Icon, title, subtitle, right, children, accent }) {
  return (
    <div
      className="rounded-xl"
      style={{
        borderRadius: 12,
        padding: '16px 18px',
        background: C.bg,
        border: `1px solid ${accent ? 'rgba(220,38,38,0.15)' : C.border}`,
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: accent ? 'rgba(220,38,38,0.08)' : 'rgba(0,0,0,0.04)',
            color:      accent ? C.danger : C.text,
          }}
        >
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium leading-tight" style={{ color: C.text }}>{title}</h3>
          {subtitle && (
            <div className="text-[11px] mt-0.5" style={{ color: C.faint }}>{subtitle}</div>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Block 0 — Strategic Priorities (static P1–P4)
// ────────────────────────────────────────────────────────────────────────────

export const STRATEGIC_PRIORITIES = [
  { id: 'P1', title: 'NY B2C Growth',         hint: 'New York-first DTC engine' },
  { id: 'P2', title: 'B2B Expansion',          hint: 'Freshline + direct accounts' },
  { id: 'P3', title: 'New Revenue Lines',      hint: 'Tuna Show / Broker / Export' },
  { id: 'P4', title: 'KPI-first Execution',    hint: 'Measure → adjust weekly' },
]

// Priorities pull from src/config/theme.js — the same token powers
// StrategicPrioritiesSection / TeamPulseSection / TodayFocusSection.
const PRIORITY_COLORS = PRIORITY_TOKENS

function StrategicPriorities() {
  return (
    <Section
      icon={Compass}
      title="Strategic Priorities"
      subtitle="HUS's permanent focus — reviewed monthly"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {STRATEGIC_PRIORITIES.map((p) => {
          const c = PRIORITY_COLORS[p.id]
          return (
            <div
              key={p.id}
              className="rounded-lg p-3 flex flex-col gap-1.5"
              style={{
                borderRadius: 10,
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.bg === C.bg ? C.border : 'transparent'}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 tabular-nums"
                  style={{
                    ...MONO,
                    borderRadius: 20,
                    background: c.badgeBg,
                    letterSpacing: '0.06em',
                  }}
                >
                  {p.id}
                </span>
                <span className="text-sm font-semibold leading-tight">{p.title}</span>
              </div>
              <div
                className="text-[11px] leading-snug"
                style={{ color: c.fg === '#ffffff' ? 'rgba(255,255,255,0.6)' : C.faint }}
              >
                {p.hint}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Block 2 — Cash Status (manual, monthly)
// ────────────────────────────────────────────────────────────────────────────

const CASH_STATUS = {
  safe:  { label: 'Safe',  bg: 'rgba(21,128,61,0.10)',  fg: C.ok,    icon: ShieldCheck },
  watch: { label: 'Watch', bg: 'rgba(180,83,9,0.10)',   fg: C.warn,  icon: Activity },
  tight: { label: 'Tight', bg: 'rgba(220,38,38,0.10)',  fg: C.danger, icon: AlertTriangle },
}

const fmtMoney = (n) => {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '——'
  return '$' + Math.round(Number(n)).toLocaleString('en-US')
}

function CashStatus() {
  const period = monthKey()
  const [row, setRow] = useState({
    period, status: null, forecast_amount: null, overdue_ar_count: null, risk_note: '',
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCashStatus(period).then((r) => { setRow(r); setDraft(r) })
  }, [period])

  const status = row.status && CASH_STATUS[row.status]
  const StatusIcon = status?.icon || Activity

  async function commit() {
    setSaving(true)
    const updates = {
      status:           draft.status || null,
      forecast_amount:  draft.forecast_amount === '' || draft.forecast_amount == null ? null : Number(draft.forecast_amount),
      overdue_ar_count: draft.overdue_ar_count === '' || draft.overdue_ar_count == null ? null : Number(draft.overdue_ar_count),
      risk_note:        draft.risk_note || '',
    }
    const res = await saveCashStatus(period, updates)
    setSaving(false)
    if (res.ok) {
      setRow({ period, ...updates })
      setEditing(false)
    } else {
      alert(`Cash save failed: ${res.reason}`)
    }
  }

  return (
    <Section
      icon={DollarSign}
      title="Cash Status"
      subtitle={`Period ${period} · manual entry`}
      right={
        editing ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
              style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.bg }}
              onClick={() => { setDraft(row); setEditing(false) }}
            >
              <X size={11} /> Cancel
            </button>
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
              style={{ background: C.text, color: C.bg }}
              onClick={commit}
              disabled={saving}
            >
              <Check size={11} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
            style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.bg }}
            onClick={() => setEditing(true)}
          >
            <Pencil size={11} /> Edit
          </button>
        )
      }
    >
      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="rounded-lg p-3 flex items-center gap-2.5"
            style={{
              borderRadius: 10,
              background: status?.bg || 'rgba(0,0,0,0.03)',
              color:      status?.fg || C.faint,
            }}
          >
            <StatusIcon size={18} />
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider opacity-70">Status</div>
              <div className="text-base font-semibold">{status?.label || '——'}</div>
            </div>
          </div>
          <div
            className="rounded-lg p-3"
            style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg }}
          >
            <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint }}>
              Month-end Forecast
            </div>
            <div className="text-base font-semibold tabular-nums" style={{ ...MONO, color: C.text }}>
              {fmtMoney(row.forecast_amount)}
            </div>
          </div>
          <div
            className="rounded-lg p-3"
            style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg }}
          >
            <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint }}>
              Overdue AR
            </div>
            <div className="text-base font-semibold tabular-nums" style={{ ...MONO, color: C.text }}>
              {row.overdue_ar_count ?? '——'} <span className="text-xs font-normal" style={{ color: C.faint }}>open</span>
            </div>
          </div>
          {row.risk_note && (
            <div
              className="sm:col-span-3 rounded-lg p-3 text-xs leading-snug flex items-start gap-2"
              style={{
                borderRadius: 10,
                background: 'rgba(220,38,38,0.04)',
                border: '1px solid rgba(220,38,38,0.12)',
                color: C.text,
              }}
            >
              <AlertTriangle size={13} style={{ color: C.danger, marginTop: 2 }} className="shrink-0" />
              <span><span className="font-semibold" style={{ color: C.danger }}>Risk · </span>{row.risk_note}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Status">
            <select
              className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
              style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
              value={draft.status || ''}
              onChange={(e) => setDraft({ ...draft, status: e.target.value || null })}
            >
              <option value="">——</option>
              <option value="safe">Safe</option>
              <option value="watch">Watch</option>
              <option value="tight">Tight</option>
            </select>
          </Field>
          <Field label="Month-end Forecast (USD)">
            <input
              type="number"
              className="w-full text-sm px-2 py-1.5 rounded-md outline-none tabular-nums"
              style={{ ...MONO, border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
              value={draft.forecast_amount ?? ''}
              onChange={(e) => setDraft({ ...draft, forecast_amount: e.target.value })}
              placeholder="120000"
            />
          </Field>
          <Field label="Overdue AR (count)">
            <input
              type="number"
              className="w-full text-sm px-2 py-1.5 rounded-md outline-none tabular-nums"
              style={{ ...MONO, border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
              value={draft.overdue_ar_count ?? ''}
              onChange={(e) => setDraft({ ...draft, overdue_ar_count: e.target.value })}
              placeholder="0"
            />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Risk Note (optional · 1 line)">
              <input
                type="text"
                className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                value={draft.risk_note || ''}
                onChange={(e) => setDraft({ ...draft, risk_note: e.target.value })}
                placeholder="Q2 inventory deposit due May 10 — confirm Freshline timing"
              />
            </Field>
          </div>
        </div>
      )}
    </Section>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint }}>
        {label}
      </span>
      {children}
    </label>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Block 3 — Today Focus (manual, daily, max 5)
// ────────────────────────────────────────────────────────────────────────────

const FOCUS_TYPES = {
  decision:    { label: 'Decision',   bg: 'rgba(0,0,0,0.85)',     fg: '#ffffff' },
  'follow-up': { label: 'Follow-up',  bg: 'rgba(0,0,0,0.05)',     fg: C.text },
  review:     { label: 'Review',     bg: 'rgba(21,128,61,0.10)', fg: C.ok },
  deadline:   { label: 'Deadline',   bg: 'rgba(220,38,38,0.10)', fg: C.danger },
}

const TAG_STYLE = {
  P1: { bg: 'rgba(0,0,0,0.85)',  fg: '#ffffff' },
  P2: { bg: 'rgba(0,0,0,0.65)',  fg: '#ffffff' },
  P3: { bg: 'rgba(0,0,0,0.05)',  fg: C.text },
  P4: { bg: 'rgba(0,0,0,0.05)',  fg: C.text },
}

const MAX_FOCUS = 5

function TodayFocus() {
  const period = dayKey()
  const [items, setItems]   = useState([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft]   = useState({ type: 'decision', title: '', why: '', strategic_tag: 'P1' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadFocusItems(period).then(setItems) }, [period])

  async function add() {
    if (!draft.title.trim()) return
    setSaving(true)
    const res = await upsertFocusItem({
      period,
      type:          draft.type,
      title:         draft.title.trim(),
      why:           draft.why.trim() || null,
      strategic_tag: draft.strategic_tag || null,
      position:      items.length,
    })
    setSaving(false)
    if (res.ok && res.row) {
      setItems([...items, res.row])
      setDraft({ type: 'decision', title: '', why: '', strategic_tag: 'P1' })
      setAdding(false)
    } else {
      alert(`Focus save failed: ${res.reason || 'unknown'}`)
    }
  }

  async function remove(id) {
    const res = await deleteFocusItem(id)
    if (res.ok) setItems(items.filter((i) => i.id !== id))
  }

  const canAdd = items.length < MAX_FOCUS

  return (
    <Section
      icon={Target}
      title="Today Focus"
      subtitle={`${format(new Date(), 'EEEE, MMM d')} · executive call-list (max ${MAX_FOCUS})`}
      right={
        canAdd && !adding && (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
            style={{ background: C.text, color: C.bg }}
            onClick={() => setAdding(true)}
          >
            <Plus size={11} /> Add
          </button>
        )
      }
    >
      <div className="flex flex-col gap-2">
        {items.length === 0 && !adding && (
          <div className="text-xs py-4 text-center" style={{ color: C.faint }}>
            No focus items for today. Click <span className="font-semibold" style={{ color: C.text }}>Add</span> to log a decision, follow-up, review, or deadline.
          </div>
        )}

        {items.map((item) => {
          const tt = FOCUS_TYPES[item.type] || FOCUS_TYPES.decision
          const tag = item.strategic_tag && TAG_STYLE[item.strategic_tag]
          return (
            <div
              key={item.id}
              className="rounded-lg p-3 flex items-start gap-3"
              style={{
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.bg,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 uppercase"
                    style={{ borderRadius: 20, background: tt.bg, color: tt.fg, letterSpacing: '0.06em' }}
                  >
                    {tt.label}
                  </span>
                  {tag && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5"
                      style={{ ...MONO, borderRadius: 20, background: tag.bg, color: tag.fg, letterSpacing: '0.06em' }}
                    >
                      {item.strategic_tag}
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium leading-snug" style={{ color: C.text }}>
                  {item.title}
                </div>
                {item.why && (
                  <div className="text-xs mt-1 leading-snug flex items-start gap-1.5" style={{ color: C.muted }}>
                    <ArrowRight size={11} style={{ marginTop: 3, color: C.faint }} className="shrink-0" />
                    <span>{item.why}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: C.muted }}
                onClick={() => remove(item.id)}
                aria-label="Delete focus item"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}

        {adding && (
          <div
            className="rounded-lg p-3 flex flex-col gap-2.5"
            style={{ borderRadius: 10, border: `1px dashed ${C.border}`, background: 'rgba(0,0,0,0.015)' }}
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <select
                  className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                  style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                >
                  {Object.entries(FOCUS_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Strategic Tag">
                <select
                  className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                  style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                  value={draft.strategic_tag || ''}
                  onChange={(e) => setDraft({ ...draft, strategic_tag: e.target.value || null })}
                >
                  <option value="">None</option>
                  {STRATEGIC_PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>{p.id} — {p.title}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Title">
              <input
                type="text"
                className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Decide on Freshline May order quantity"
                autoFocus
              />
            </Field>
            <Field label="Why it matters (1 line)">
              <input
                type="text"
                className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                value={draft.why}
                onChange={(e) => setDraft({ ...draft, why: e.target.value })}
                placeholder="Locks in B2B Q2 supply — affects forecast"
              />
            </Field>
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
                style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.bg }}
                onClick={() => { setAdding(false); setDraft({ type: 'decision', title: '', why: '', strategic_tag: 'P1' }) }}
              >
                <X size={11} /> Cancel
              </button>
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
                style={{ background: C.text, color: C.bg }}
                onClick={add}
                disabled={saving || !draft.title.trim()}
              >
                <Check size={11} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Block 4 — Team Pulse (manual, weekly per team)
// ────────────────────────────────────────────────────────────────────────────

const TEAMS = [
  { id: 'b2c',     name: 'B2C Growth (NY)',         lead: 'とべぶた' },
  { id: 'b2b',     name: 'B2B Sales',                lead: 'Tad' },
  { id: 'newrev',  name: 'New Revenue Lines',        lead: 'Jus' },
  { id: 'ops',     name: 'Ops / Export',             lead: '疾風' },
]

function TeamPulse() {
  const period = weekKey()
  const [rows, setRows]     = useState([])
  const [editing, setEditing] = useState(null) // team id
  const [draft, setDraft]   = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTeamPulse(period).then(setRows)
  }, [period])

  const byTeam = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => m.set(r.team, r))
    return m
  }, [rows])

  function startEdit(team) {
    const existing = byTeam.get(team.name) || {}
    setDraft({
      focus:         existing.focus || '',
      current_state: existing.current_state || '',
      blocker:       existing.blocker || '',
      next_review:   existing.next_review || '',
      progress_pct:  existing.progress_pct ?? '',
    })
    setEditing(team.id)
  }

  async function commit(team) {
    setSaving(true)
    const updates = {
      focus:         draft.focus || null,
      current_state: draft.current_state || null,
      blocker:       (draft.blocker || '').trim() || 'None',
      next_review:   draft.next_review || null,
      progress_pct:  draft.progress_pct === '' ? null : Number(draft.progress_pct),
    }
    const res = await saveTeamPulse(period, team.name, updates)
    setSaving(false)
    if (res.ok) {
      const next = new Map(byTeam)
      next.set(team.name, { period, team: team.name, ...updates })
      setRows(Array.from(next.values()))
      setEditing(null)
    } else {
      alert(`Pulse save failed: ${res.reason}`)
    }
  }

  return (
    <Section
      icon={Users}
      title="Team Pulse"
      subtitle={`${period} · weekly forward motion (not task counts)`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {TEAMS.map((team) => {
          const r = byTeam.get(team.name)
          const isEditing = editing === team.id
          const blockerHasIssue = r?.blocker && r.blocker.trim() && r.blocker.trim().toLowerCase() !== 'none'

          return (
            <div
              key={team.id}
              className="rounded-lg p-3 flex flex-col gap-2"
              style={{
                borderRadius: 10,
                border: `1px solid ${blockerHasIssue && !isEditing ? 'rgba(220,38,38,0.18)' : C.border}`,
                background: C.bg,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight" style={{ color: C.text }}>
                    {team.name}
                  </div>
                  <div className="text-[11px]" style={{ color: C.faint }}>
                    Lead · @{team.lead}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r?.progress_pct != null && !isEditing && (
                    <span
                      className="text-[11px] font-semibold tabular-nums"
                      style={{ ...MONO, color: C.muted }}
                    >
                      {r.progress_pct}%
                    </span>
                  )}
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.bg }}
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ background: C.text, color: C.bg }}
                        onClick={() => commit(team)}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1"
                      style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.bg }}
                      onClick={() => startEdit(team)}
                    >
                      <Pencil size={10} /> Edit
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="grid grid-cols-1 gap-2">
                  <Field label="Focus this week">
                    <input
                      type="text"
                      className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                      style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                      value={draft.focus}
                      onChange={(e) => setDraft({ ...draft, focus: e.target.value })}
                      placeholder="Launch DropShip Meta campaign"
                    />
                  </Field>
                  <Field label="Current state">
                    <input
                      type="text"
                      className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                      style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                      value={draft.current_state}
                      onChange={(e) => setDraft({ ...draft, current_state: e.target.value })}
                      placeholder="Creative library 70% — pending Tad review"
                    />
                  </Field>
                  <Field label="Blocker (leave blank for None)">
                    <input
                      type="text"
                      className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                      style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                      value={draft.blocker}
                      onChange={(e) => setDraft({ ...draft, blocker: e.target.value })}
                      placeholder="None"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Next review">
                      <input
                        type="text"
                        className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
                        style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                        value={draft.next_review}
                        onChange={(e) => setDraft({ ...draft, next_review: e.target.value })}
                        placeholder="Fri 4/26"
                      />
                    </Field>
                    <Field label="Progress %">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full text-sm px-2 py-1.5 rounded-md outline-none tabular-nums"
                        style={{ ...MONO, border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
                        value={draft.progress_pct}
                        onChange={(e) => setDraft({ ...draft, progress_pct: e.target.value })}
                        placeholder="65"
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <PulseRow k="Focus"   v={r?.focus} />
                  <PulseRow k="State"   v={r?.current_state} />
                  <PulseRow k="Blocker" v={r?.blocker || 'None'}
                    danger={blockerHasIssue} />
                  <PulseRow k="Review"  v={r?.next_review} mono />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function PulseRow({ k, v, danger, mono }) {
  return (
    <div className="flex gap-2">
      <span
        className="text-[10px] uppercase font-semibold tracking-wider w-16 shrink-0 pt-0.5"
        style={{ color: C.faint }}
      >
        {k}
      </span>
      <span
        className="flex-1"
        style={{
          color: danger ? C.danger : (v ? C.text : C.faint),
          fontWeight: danger ? 600 : 400,
          ...(mono ? MONO : {}),
        }}
      >
        {v || '—'}
      </span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function MorningDashboard() {
  return (
    <div className="space-y-3">
      <StrategicPriorities />
      <CashStatus />
      <TodayFocus />
      <TeamPulse />
    </div>
  )
}
