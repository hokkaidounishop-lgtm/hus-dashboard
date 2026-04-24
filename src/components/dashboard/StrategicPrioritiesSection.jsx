import { strategicPriorities } from '../../data/dashboardMockData'
import { priority as PRIORITY } from '../../config/theme'

// La Main 再設計（2026-04-24）：
// P1 = 白 bg + 左 3px accent bar + accent-tint badge
// P2 = 白 bg + 左 2px accent bar + neutral badge（accent は細い縦 bar 1本のみ）
// P3/P4 = paperWarm + neutral（accent ゼロ）
// solid 塗りつぶしは廃止。accent は P1 の 3px + P2 の 2px の計 2 本のみ。

export default function StrategicPrioritiesSection() {
  return (
    <section
      aria-label="Strategic Priorities"
      className="grid grid-cols-2 lg:grid-cols-4 gap-2"
    >
      {strategicPriorities.map((p) => {
        const t = PRIORITY[p.id].pill
        return (
          <div
            key={p.id}
            title={p.description}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{
              background:   t.bg,
              color:        t.fg,
              border:       t.border,
              borderLeft:   t.borderLeft,
              borderRadius: 10,
            }}
          >
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 tabular-nums shrink-0"
              style={{
                fontFamily:    "'DM Mono', monospace",
                borderRadius:  20,
                background:    t.badgeBg,
                color:         t.badgeFg,
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
