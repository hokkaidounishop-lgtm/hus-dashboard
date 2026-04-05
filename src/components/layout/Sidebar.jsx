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
  { id: 'briefing',  label: "What's up?",   icon: Sunrise,         highlight: true },
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
      className="w-60 shrink-0 flex flex-col min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #1C2B3A 0%, #162230 100%)',
        boxShadow: '2px 0 24px rgba(0,0,0,0.12)',
      }}
    >
      {/* Logo + brand */}
      <div className="px-5 pt-7 pb-6" style={{ borderBottom: '1px solid rgba(232,224,212,0.08)' }}>
        <div className="flex flex-col items-center gap-3">
          <img
            src="/hus-logo.png"
            alt="Hokkaido Uni Shop"
            className="rounded-xl object-cover"
            style={{
              width: 140,
              height: 'auto',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <div className="text-center">
            <div
              className="text-sm tracking-[0.18em] uppercase"
              style={{
                color: '#C9A96E',
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              Hokkaido Uni Shop
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV.map(({ id, label, icon: Icon, highlight }) => {
          const isActive = activeSection === id
          return (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all relative text-left rounded-xl"
              style={{
                color: isActive
                  ? '#D4BC8A'
                  : highlight
                  ? 'rgba(201,169,110,0.8)'
                  : 'rgba(232,224,212,0.7)',
                background: isActive
                  ? 'rgba(201,169,110,0.10)'
                  : 'transparent',
                borderLeft: isActive ? '2px solid #C9A96E' : '2px solid transparent',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(232,224,212,0.06)'
                  e.currentTarget.style.color = 'rgba(232,224,212,0.9)'
                  e.currentTarget.style.borderLeftColor = 'rgba(201,169,110,0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                  e.currentTarget.style.color = highlight
                    ? 'rgba(201,169,110,0.8)'
                    : 'rgba(232,224,212,0.7)'
                }
              }}
            >
              <Icon size={15} className="shrink-0" />
              <span>{label}</span>
              {id === 'alerts' && overdueCount > 0 && (
                <span
                  className="ml-auto text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #C0392B, #A93226)',
                    boxShadow: '0 1px 4px rgba(192,57,43,0.4)',
                  }}
                >
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(232,224,212,0.06)' }}>
        <div className="text-xs" style={{ color: 'rgba(232,224,212,0.25)' }}>Dashboard v1.0</div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(232,224,212,0.15)' }}>HUS Inc.</div>
      </div>
    </aside>
  )
}
