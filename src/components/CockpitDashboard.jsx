import StrategicPrioritiesSection from './dashboard/StrategicPrioritiesSection'
import RevenueCommandSummarySection from './dashboard/RevenueCommandSummarySection'
import CashAlertsSection from './dashboard/CashAlertsSection'
import TodayFocusSection from './dashboard/TodayFocusSection'
import TeamPulseSection from './dashboard/TeamPulseSection'

/**
 * Founder Cockpit v2.2 — single-page morning operating cockpit.
 *
 * Layout (per PRD):
 *   Top thin row : Strategic Priorities (Block 0)
 *   Upper grid   : Revenue Command (left) | Cash + Alerts (right)
 *   Middle full  : Today Focus
 *   Bottom full  : Team Pulse
 */
export default function CockpitDashboard() {
  return (
    <div className="space-y-3">
      <StrategicPrioritiesSection />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <RevenueCommandSummarySection />
        <CashAlertsSection />
      </div>

      <TodayFocusSection />

      <TeamPulseSection />
    </div>
  )
}
