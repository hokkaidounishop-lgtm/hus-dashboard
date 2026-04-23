import { Users, AlertTriangle, Target as TargetIcon } from 'lucide-react'
import { teamPulse } from '../../data/dashboardMockData'
import { priority as PRIORITY_TOKENS, colors as THEME } from '../../config/theme'

const C = {
  text:   '#1a1a18',
  muted:  '#6b6b66',
  faint:  '#9b9b94',
  bg:     '#ffffff',
  border: 'rgba(0,0,0,0.06)',
  hair:   'rgba(0,0,0,0.04)',
  danger: '#dc2626',
  ok:     '#15803d',
}
const MONO = { fontFamily: "'DM Mono', monospace" }

// P1/P2 share the HUS-accent treatment sourced from src/config/theme.js.
// P3/P4 stay neutral so the eye lands on the real priorities.
const TAG_STYLE = {
  P1: { bg: PRIORITY_TOKENS.P1.bg, fg: PRIORITY_TOKENS.P1.fg },
  P2: { bg: PRIORITY_TOKENS.P2.bg, fg: PRIORITY_TOKENS.P2.fg },
  P3: { bg: 'rgba(0,0,0,0.05)',    fg: THEME.text },
  P4: { bg: 'rgba(0,0,0,0.05)',    fg: THEME.text },
}

function hasBlocker(t) {
  return t.blocker && t.blocker.trim() && t.blocker.trim().toLowerCase() !== 'none'
}

function TagChip({ tag }) {
  const s = TAG_STYLE[tag] || TAG_STYLE.P3
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 tabular-nums shrink-0"
      style={{ ...MONO, borderRadius: 20, background: s.bg, color: s.fg, letterSpacing: '0.06em' }}
    >
      {tag}
    </span>
  )
}

function PulseRow({ k, v, danger, mono, accent }) {
  return (
    <div className="flex gap-2">
      <span
        className="text-[10px] uppercase font-semibold tracking-wider w-14 shrink-0 pt-0.5"
        style={{ color: C.faint, letterSpacing: '0.08em' }}
      >
        {k}
      </span>
      <span
        className="flex-1 text-xs leading-snug"
        style={{
          color: danger ? C.danger : (accent ? C.text : (v ? C.muted : C.faint)),
          fontWeight: danger ? 600 : (accent ? 500 : 400),
          ...(mono ? MONO : {}),
        }}
      >
        {v || '—'}
      </span>
    </div>
  )
}

function TeamCard({ team }) {
  const blocked = hasBlocker(team)
  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2"
      style={{
        borderRadius: 12,
        background: C.bg,
        border: `1px solid ${blocked ? 'rgba(220,38,38,0.35)' : C.border}`,
        // subtle red wash if blocker present, to amplify
        boxShadow: blocked ? 'inset 0 0 0 1px rgba(220,38,38,0.15)' : 'none',
      }}
    >
      {/* Header — name, lead, tag, secondary progress */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate" style={{ color: C.text }}>
            {team.team}
          </div>
          <div className="text-[11px]" style={{ color: C.faint }}>
            Lead · @{team.lead}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {team.progress != null && (
            <span
              className="text-[10px] tabular-nums"
              style={{ ...MONO, color: C.faint }}
              title="Progress (secondary)"
            >
              {team.progress}%
            </span>
          )}
          <TagChip tag={team.strategicTag} />
        </div>
      </div>

      {/* Focus — most prominent line */}
      <div
        className="text-sm font-medium leading-snug"
        style={{ color: C.text }}
      >
        {team.focus}
      </div>

      {/* KPI Link — always shown */}
      <div
        className="rounded-md px-2 py-1.5 flex items-center gap-1.5"
        style={{ borderRadius: 6, background: 'rgba(0,0,0,0.03)' }}
      >
        <TargetIcon size={11} style={{ color: C.muted }} />
        <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: C.faint, letterSpacing: '0.08em' }}>
          KPI
        </span>
        <span className="text-xs font-medium tabular-nums" style={{ ...MONO, color: C.text }}>
          {team.kpiLink}
        </span>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col gap-1.5 mt-0.5">
        <PulseRow k="State"   v={team.currentState} />
        <PulseRow k="Review"  v={team.reviewNeeded} accent />
        <PulseRow
          k="Blocker"
          v={team.blocker || 'None'}
          danger={blocked}
        />
        <PulseRow k="Next"    v={team.nextReview} mono />
      </div>

      {/* Blocker callout — extra emphasis when present */}
      {blocked && (
        <div
          className="rounded-md px-2 py-1.5 flex items-start gap-1.5 mt-0.5"
          style={{
            borderRadius: 6,
            background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.18)',
          }}
        >
          <AlertTriangle size={11} style={{ color: C.danger, marginTop: 2 }} className="shrink-0" />
          <span className="text-[11px] font-semibold leading-snug" style={{ color: C.danger }}>
            Blocked — needs attention
          </span>
        </div>
      )}
    </div>
  )
}

export default function TeamPulseSection() {
  const blockedCount = teamPulse.filter(hasBlocker).length

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
          <Users size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium" style={{ color: C.text }}>Team Pulse</h3>
          <div className="text-[11px]" style={{ color: C.faint }}>
            Weekly forward motion · {teamPulse.length} teams
            {blockedCount > 0 && (
              <span className="ml-2 font-semibold" style={{ color: C.danger }}>
                · {blockedCount} blocked
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {teamPulse.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  )
}
