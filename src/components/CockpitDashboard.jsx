import StrategicPrioritiesSection from './dashboard/StrategicPrioritiesSection'
import CashAlertsSection from './dashboard/CashAlertsSection'
import TodayFocusSection from './dashboard/TodayFocusSection'
import TeamPulseSection from './dashboard/TeamPulseSection'

const C = { faint: '#9b9b94', border: 'rgba(0,0,0,0.10)' }

function ComingSoonCard({ label, hint }) {
  return (
    <div
      className="rounded-xl flex flex-col items-center justify-center text-center px-4 py-12"
      style={{
        borderRadius: 12,
        border: `1px dashed ${C.border}`,
        background: 'rgba(0,0,0,0.015)',
        color: C.faint,
        minHeight: 240,
      }}
    >
      <div className="text-xs uppercase font-semibold tracking-wider mb-1" style={{ letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div className="text-[11px]">{hint}</div>
    </div>
  )
}

/**
 * Founder dashboard v2.2 — single-page morning operating cockpit.
 *
 * Layout (per PRD):
 *   Top thin row : Strategic Priorities (Block 0)
 *   Upper grid   : Revenue Command (left) | Cash + Alerts (right)
 *   Middle full  : Today Focus
 *   Bottom full  : Team Pulse
 *
 * Step status:
 *   ✓ Block 0 — Strategic Priorities
 *   ✓ Block 2 — Cash Status + Weekly Alerts
 *   ✓ Block 3 — Today Focus
 *   ✓ Block 4 — Team Pulse
 *   · Block 1 — Revenue Command (summary card, links to /revenue)  [Step 5]
 */
export default function CockpitDashboard() {
  return (
    <div className="space-y-3">
      {/* Block 0 — Strategic Priorities */}
      <StrategicPrioritiesSection />

      {/* Upper grid — Revenue Command (placeholder) | Cash + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ComingSoonCard
          label="Block 1 · Revenue Command"
          hint="Step 5 — summary card linking to /revenue (MTD KPI · forecast · channel mix · CVR · AOV)"
        />
        <CashAlertsSection />
      </div>

      {/* Block 3 — Today Focus (full-width middle) */}
      <TodayFocusSection />

      {/* Block 4 — Team Pulse (full-width bottom) */}
      <TeamPulseSection />

      {/* Step 5 placeholder */}
      <div
        className="rounded-xl px-4 py-6 text-center text-xs"
        style={{
          borderRadius: 12,
          border: `1px dashed ${C.border}`,
          background: 'rgba(0,0,0,0.015)',
          color: C.faint,
        }}
      >
        Steps 1–4 of 5 complete · awaiting Koike review before Step 5 (Revenue Command summary + final layout integration)
      </div>
    </div>
  )
}
