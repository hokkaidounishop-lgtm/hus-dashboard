import { format } from 'date-fns'
import { useApp } from '../../context/AppContext'

const TITLES = {
  briefing:  { label: "What's Up?",    sub: 'Your morning briefing' },
  dashboard: { label: 'KPI Dashboard', sub: 'Business performance at a glance' },
  projects:  { label: 'Project Tracker', sub: 'All active initiatives' },
  tasks:     { label: 'Task List',     sub: 'Track, assign, and close work' },
  alerts:    { label: 'Alerts',        sub: 'Issues that need your attention' },
  calendar:  { label: 'Calendar',      sub: 'Meetings and milestones' },
}

export default function Header() {
  const { activeSection } = useApp()
  const { label, sub } = TITLES[activeSection] || TITLES.dashboard
  const today = format(new Date(), 'EEEE, MMMM d, yyyy')

  return (
    <header
      className="px-8 py-5 flex items-center justify-between shrink-0"
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #EAE7E2',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div>
        <h1
          className="text-lg font-medium leading-tight"
          style={{
            fontFamily: '"Noto Serif JP", Georgia, serif',
            color: '#1A1A1A',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#9B9590' }}>{sub}</p>
      </div>
      <div
        className="text-sm font-medium"
        style={{ color: '#9B9590', letterSpacing: '0.01em' }}
      >
        {today}
      </div>
    </header>
  )
}
