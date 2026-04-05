import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Bell,
  Calendar,
  Sunrise,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

const NAV = [
  { id: 'briefing',  label: "What's up?",   icon: Sunrise },
  { id: 'dashboard', label: 'KPI Dashboard', icon: LayoutDashboard },
  { id: 'projects',  label: 'Projects',      icon: FolderKanban },
  { id: 'tasks',     label: 'Task List',     icon: CheckSquare },
  { id: 'alerts',    label: 'Alerts',        icon: Bell },
  { id: 'calendar',  label: 'Calendar',      icon: Calendar },
]

export default function Sidebar() {
  const { activeSection, setActiveSection, tasks } = useApp()

  const overdueCount = tasks.filter(
    (t) => t.status === 'overdue' || (t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done' && t.status !== 'completed')
  ).length

  return (
    <aside
      className="w-56 shrink-0 flex flex-col min-h-screen"
      style={{
        background: '#EDECEA',
        borderRight: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: '#1A1A1A',
          }}
        >
          HOKKAIDO UNI SHOP
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = activeSection === id
          return (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all text-left rounded-md"
              style={{
                color: isActive ? '#FFFFFF' : '#666666',
                background: isActive ? '#1A1A1A' : 'transparent',
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
              <Icon size={15} className="shrink-0" />
              <span>{label}</span>
              {id === 'alerts' && overdueCount > 0 && (
                <span
                  className="ml-auto text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ background: '#C0392B' }}
                >
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="text-xs" style={{ color: '#999999' }}>Dashboard v1.0</div>
        <div className="text-xs mt-0.5" style={{ color: '#BBBBBB' }}>HUS Inc.</div>
      </div>
    </aside>
  )
}
