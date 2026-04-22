import { useMemo, useState } from 'react'
import {
  Target, Plus, X, Check, ArrowRight, AlertCircle,
  Sparkles, Eye, Clock, MessageCircle,
} from 'lucide-react'
import { todayFocus as seed, strategicPriorities } from '../../data/dashboardMockData'

const C = {
  text:   '#1a1a18',
  muted:  '#6b6b66',
  faint:  '#9b9b94',
  bg:     '#ffffff',
  border: 'rgba(0,0,0,0.06)',
  hair:   'rgba(0,0,0,0.04)',
  danger: '#dc2626',
  warn:   '#b45309',
  ok:     '#15803d',
}
const MONO = { fontFamily: "'DM Mono', monospace" }

// ── Type configuration ─────────────────────────────────────────────────────

const TYPES = ['Decision', 'Follow-up', 'Review', 'Deadline']

// Icon + chip color per Type. Decision is darkest (highest weight).
const TYPE_META = {
  Decision:    { icon: Sparkles,        bg: '#1a1a18',           fg: '#ffffff', max: 2 },
  'Follow-up': { icon: MessageCircle,   bg: 'rgba(0,0,0,0.05)',  fg: C.text,    max: null },
  Review:     { icon: Eye,              bg: 'rgba(21,128,61,0.10)', fg: C.ok,    max: null, min: 1 },
  Deadline:   { icon: Clock,            bg: 'rgba(220,38,38,0.10)', fg: C.danger, max: 2 },
}

const TAG_STYLE = {
  P1: { bg: '#1a1a18',          fg: '#ffffff' },
  P2: { bg: 'rgba(0,0,0,0.65)', fg: '#ffffff' },
  P3: { bg: 'rgba(0,0,0,0.05)', fg: C.text },
  P4: { bg: 'rgba(0,0,0,0.05)', fg: C.text },
}

const STATUS_STYLE = {
  Open:          { bg: 'rgba(0,0,0,0.04)',     fg: C.muted },
  'In Progress': { bg: 'rgba(180,83,9,0.10)',  fg: C.warn },
  Done:          { bg: 'rgba(21,128,61,0.10)', fg: C.ok },
}

const MAX_TOTAL = 5

// ── Subcomponents ───────────────────────────────────────────────────────────

function TypeChip({ type }) {
  const t = TYPE_META[type]
  const Icon = t.icon
  return (
    <span
      className="text-[10px] font-bold uppercase px-1.5 py-0.5 inline-flex items-center gap-1"
      style={{ borderRadius: 20, background: t.bg, color: t.fg, letterSpacing: '0.06em' }}
    >
      <Icon size={10} />
      {type}
    </span>
  )
}

function TagChip({ tag }) {
  const s = TAG_STYLE[tag] || TAG_STYLE.P3
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 tabular-nums"
      style={{ ...MONO, borderRadius: 20, background: s.bg, color: s.fg, letterSpacing: '0.06em' }}
    >
      {tag}
    </span>
  )
}

function StatusChip({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Open
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 uppercase"
      style={{ borderRadius: 20, background: s.bg, color: s.fg, letterSpacing: '0.06em' }}
    >
      {status}
    </span>
  )
}

function FocusRow({ item, onDelete }) {
  return (
    <div
      className="rounded-lg p-3 flex items-start gap-3"
      style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg }}
    >
      {/* Priority number */}
      <div
        className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-sm font-bold tabular-nums"
        style={{
          ...MONO,
          background: 'rgba(0,0,0,0.04)',
          color: C.text,
          borderRadius: 8,
        }}
      >
        {item.priority}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <TypeChip type={item.type} />
          <TagChip tag={item.strategicTag} />
          <StatusChip status={item.status} />
        </div>
        <div className="text-sm font-semibold leading-snug" style={{ color: C.text }}>
          {item.item}
        </div>
        <div
          className="text-xs mt-1 leading-snug flex items-start gap-1.5"
          style={{ color: C.muted }}
        >
          <ArrowRight size={11} style={{ marginTop: 3, color: C.faint }} className="shrink-0" />
          <span>{item.whyItMatters}</span>
        </div>
        <div className="text-[11px] mt-1.5 flex items-center gap-3" style={{ color: C.faint }}>
          <span>
            Owner · <span className="font-medium" style={{ color: C.text }}>@{item.owner}</span>
          </span>
          <span style={{ ...MONO, color: C.muted }}>Due {item.due}</span>
        </div>
      </div>

      <button
        type="button"
        className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
        style={{ color: C.muted }}
        onClick={() => onDelete(item.id)}
        aria-label="Delete focus item"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function AddForm({ initialType, onCancel, onSave, saving }) {
  const [draft, setDraft] = useState({
    priority:     3,
    type:         initialType || 'Decision',
    item:         '',
    owner:        '',
    whyItMatters: '',
    strategicTag: '',
    due:          'Today',
    status:       'Open',
  })

  const valid =
    draft.item.trim() &&
    draft.whyItMatters.trim() &&
    draft.strategicTag

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2.5"
      style={{ borderRadius: 10, border: `1px dashed ${C.border}`, background: 'rgba(0,0,0,0.015)' }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="Priority">
          <select
            className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>#{n}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select
            className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Strategic Tag *">
          <select
            className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
            style={{
              border: `1px solid ${draft.strategicTag ? C.border : 'rgba(220,38,38,0.4)'}`,
              background: C.bg,
              color: C.text,
            }}
            value={draft.strategicTag}
            onChange={(e) => setDraft({ ...draft, strategicTag: e.target.value })}
          >
            <option value="">— required —</option>
            {strategicPriorities.map((p) => (
              <option key={p.id} value={p.id}>{p.id} — {p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            {Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Item *">
        <input
          type="text"
          autoFocus
          className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
          style={{
            border: `1px solid ${draft.item.trim() ? C.border : 'rgba(220,38,38,0.4)'}`,
            background: C.bg,
            color: C.text,
          }}
          value={draft.item}
          onChange={(e) => setDraft({ ...draft, item: e.target.value })}
          placeholder="Approve Freshline May order quantity"
        />
      </Field>

      <Field label="Why it matters * (1 line)">
        <input
          type="text"
          className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
          style={{
            border: `1px solid ${draft.whyItMatters.trim() ? C.border : 'rgba(220,38,38,0.4)'}`,
            background: C.bg,
            color: C.text,
          }}
          value={draft.whyItMatters}
          onChange={(e) => setDraft({ ...draft, whyItMatters: e.target.value })}
          placeholder="Locks in B2B Q2 supply — affects forecast"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Owner">
          <input
            type="text"
            className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            placeholder="Tad"
          />
        </Field>
        <Field label="Due">
          <input
            type="text"
            className="w-full text-sm px-2 py-1.5 rounded-md outline-none"
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
            value={draft.due}
            onChange={(e) => setDraft({ ...draft, due: e.target.value })}
            placeholder="Today / Fri 4/26"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="text-[11px]" style={{ color: valid ? C.faint : C.danger }}>
          {valid ? 'All required fields filled' : '* Item, Why it matters, and Strategic Tag are required'}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
            style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.bg }}
            onClick={onCancel}
          >
            <X size={11} /> Cancel
          </button>
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
            style={{
              background: valid && !saving ? C.text : 'rgba(0,0,0,0.15)',
              color: '#ffffff',
              cursor: valid && !saving ? 'pointer' : 'not-allowed',
            }}
            onClick={() => valid && onSave({ ...draft, item: draft.item.trim(), whyItMatters: draft.whyItMatters.trim() })}
            disabled={!valid || saving}
          >
            <Check size={11} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint, letterSpacing: '0.08em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

// ── Main Section ────────────────────────────────────────────────────────────

export default function TodayFocusSection() {
  const [items, setItems] = useState(seed)
  const [addingType, setAddingType] = useState(null)   // 'Decision' | ... | null

  const counts = useMemo(() => {
    const c = { Decision: 0, 'Follow-up': 0, Review: 0, Deadline: 0 }
    items.forEach((i) => { c[i.type] = (c[i.type] || 0) + 1 })
    return c
  }, [items])

  const totalAtMax = items.length >= MAX_TOTAL
  const reviewMissing = counts.Review === 0 && items.length > 0

  function isTypeDisabled(type) {
    if (totalAtMax) return true
    const meta = TYPE_META[type]
    return meta.max != null && counts[type] >= meta.max
  }

  function add(item) {
    setItems([...items, { ...item, id: `tf-${Date.now()}` }])
    setAddingType(null)
  }

  function remove(id) {
    setItems(items.filter((i) => i.id !== id))
  }

  const sorted = [...items].sort((a, b) => a.priority - b.priority)

  return (
    <div
      className="rounded-xl p-4"
      style={{ borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.04)', color: C.text }}
        >
          <Target size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium" style={{ color: C.text }}>Today Focus</h3>
          <div className="text-[11px]" style={{ color: C.faint }}>
            Founder action queue · {items.length}/{MAX_TOTAL} items
            {reviewMissing && (
              <span className="ml-2 font-semibold" style={{ color: C.warn }}>
                · ⚠ at least 1 Review recommended
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Type-aware Add buttons */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {TYPES.map((type) => {
          const meta = TYPE_META[type]
          const Icon = meta.icon
          const count = counts[type]
          const disabled = isTypeDisabled(type)
          const limitReason = totalAtMax
            ? `${MAX_TOTAL}/${MAX_TOTAL} total`
            : meta.max != null
              ? `${count}/${meta.max}`
              : `${count}`
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => setAddingType(type)}
              className="text-[11px] px-2 py-1 rounded-md inline-flex items-center gap-1.5 transition-opacity"
              style={{
                border: `1px solid ${C.border}`,
                background: disabled ? 'rgba(0,0,0,0.02)' : C.bg,
                color: disabled ? C.faint : C.text,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
              title={disabled ? `Limit reached (${limitReason})` : `Add ${type}`}
            >
              <Plus size={11} />
              <Icon size={11} />
              <span>{type}</span>
              <span className="tabular-nums" style={{ ...MONO, color: C.faint, marginLeft: 2 }}>
                {limitReason}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((item) => (
          <FocusRow key={item.id} item={item} onDelete={remove} />
        ))}

        {items.length === 0 && !addingType && (
          <div className="text-xs py-4 text-center" style={{ color: C.faint }}>
            No focus items yet. Pick a Type above to add the first action.
          </div>
        )}

        {addingType && (
          <AddForm
            initialType={addingType}
            onCancel={() => setAddingType(null)}
            onSave={add}
          />
        )}
      </div>
    </div>
  )
}
