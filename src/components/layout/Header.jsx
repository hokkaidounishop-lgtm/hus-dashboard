import { format } from 'date-fns'
import { useApp } from '../../context/AppContext'

const TITLES = {
  cockpit:   { label: 'Founder Cockpit', sub: 'v2.2 · 3 seconds to understand · 30 minutes to decide' },
  morning:   { label: 'Morning',       sub: 'Strategic priorities · cash · today · team pulse' },
  briefing:  { label: "What's Up?",    sub: 'Your morning briefing' },
  revenue:   { label: 'Revenue Command', sub: 'MTD revenue across all channels' },
  dashboard: { label: 'KPI Dashboard', sub: 'Business performance at a glance' },
  projects:  { label: 'Project Tracker', sub: 'All active initiatives' },
  tasks:     { label: 'Task List',     sub: 'Track, assign, and close work' },
  team:      { label: 'Team',          sub: 'Members, roles, and scope' },
  alerts:    { label: 'Alerts',        sub: 'Issues that need your attention' },
  calendar:  { label: 'Calendar',      sub: 'Meetings and milestones' },
}

export default function Header() {
  const { activeSection } = useApp()
  const { label, sub } = TITLES[activeSection] || TITLES.dashboard
  const today = format(new Date(), 'EEEE, MMMM d, yyyy')

  return (
    <header
      className="px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between shrink-0 mx-auto w-full"
      style={{ maxWidth: 1120 }}
    >
      <div>
        <h1
          className="text-lg font-semibold leading-tight"
          style={{
            color: '#1a1a18',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>{sub}</p>
      </div>
      <div
        className="text-sm font-medium font-mono"
        style={{ color: '#9b9b94', letterSpacing: '0.01em', fontFamily: "'DM Mono', monospace" }}
      >
        {today}
      </div>
    </header>
  )
}
