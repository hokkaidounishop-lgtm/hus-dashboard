import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Bell,
  Calendar,
  Sunrise,
  Users,
  DollarSign,
  Compass,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

const NAV = [
  { id: 'morning',   label: 'Morning',       icon: Compass },
  { id: 'briefing',  label: "What's up?",   icon: Sunrise },
  { id: 'revenue',   label: 'Revenue',       icon: DollarSign },
  { id: 'dashboard', label: 'KPI Dashboard', icon: LayoutDashboard },
  { id: 'projects',  label: 'Projects',      icon: FolderKanban },
  { id: 'tasks',     label: 'Task List',     icon: CheckSquare },
  { id: 'team',      label: 'Team',          icon: Users },
  { id: 'alerts',    label: 'Alerts',        icon: Bell },
  { id: 'calendar',  label: 'Calendar',      icon: Calendar },
]

export default function Sidebar() {
  const { activeSection, setActiveSection, tasks } = useApp()

  const overdueCount = tasks.filter(
    (t) => t.status === 'overdue' || (t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done' && t.status !== 'completed')
  ).length

  return (
    <nav
      className="sticky top-0 z-50 shrink-0"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <div
        className="flex items-center gap-6 px-6 py-2.5 mx-auto"
        style={{ maxWidth: 1120 }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0 mr-2">
          <img
            src="/hus-logo.png"
            alt="HUS"
            className="w-7 h-7 object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ color: '#1a1a18' }}
          >
            HUS
          </span>
        </div>

        {/* Nav items */}
        <div className="flex items-center gap-1 flex-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-all relative"
                style={{
                  color: isActive ? '#ffffff' : '#6b6b66',
                  background: isActive ? '#1a1a18' : 'transparent',
                  borderRadius: 20,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon size={14} className="shrink-0" />
                <span>{label}</span>
                {id === 'alerts' && overdueCount > 0 && (
                  <span
                    className="text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    style={{ background: '#dc2626' }}
                  >
                    {overdueCount > 9 ? '9+' : overdueCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
