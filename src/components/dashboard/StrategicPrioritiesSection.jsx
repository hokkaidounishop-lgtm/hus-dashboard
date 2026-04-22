import { strategicPriorities } from '../../data/dashboardMockData'

// Visual treatment: P1/P2 dark (primary anchors), P3/P4 light (supporting).
// Distinct but calm — per v2.2 spec.
const TONE = {
  P1: { bg: '#1a1a18',          fg: '#ffffff', badgeBg: 'rgba(255,255,255,0.15)' },
  P2: { bg: '#27272a',          fg: '#ffffff', badgeBg: 'rgba(255,255,255,0.12)' },
  P3: { bg: '#ffffff',          fg: '#1a1a18', badgeBg: 'rgba(0,0,0,0.06)', border: true },
  P4: { bg: '#ffffff',          fg: '#1a1a18', badgeBg: 'rgba(0,0,0,0.06)', border: true },
}

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
