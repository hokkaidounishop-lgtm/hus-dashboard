import { strategicPriorities } from '../../data/dashboardMockData'
import { priority as TONE } from '../../config/theme'

// Visual treatment per Step 6: P1/P2 terracotta (HUS accent #B15A3C, 規定書 v1.0),
// P3/P4 light. P1 at full strength, P2 at 70 % tint. Shared tokens live in
// src/config/theme.js so every P1/P2 surface across the app matches.

export default function StrategicPrioritiesSection() {
  return (
    <section
      aria-label="Strategic Priorities"
      className="grid grid-cols-2 lg:grid-cols-4 gap-2"
    >
      {strategicPriorities.map((p) => {
        const t = TONE[p.id]
        return (
          <div
            key={p.id}
            title={p.description}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{
              background:   t.bg,
              color:        t.fg,
              border:       t.border ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
              borderRadius: 10,
            }}
          >
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 tabular-nums shrink-0"
              style={{
                fontFamily:   "'DM Mono', monospace",
                borderRadius: 20,
                background:   t.badgeBg,
                letterSpacing: '0.06em',
              }}
            >
              {p.id}
            </span>
            <span className="text-sm font-semibold leading-tight truncate">{p.title}</span>
          </div>
        )
      })}
    </section>
  )
}
