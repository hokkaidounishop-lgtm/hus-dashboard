import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { useApp } from './context/AppContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import KPIDashboard from './components/KPIDashboard'
import ProjectTracker from './components/ProjectTracker'
import TaskList from './components/TaskList'
import AlertsPanel from './components/AlertsPanel'
import CalendarView from './components/CalendarView'
import MorningBriefing from './components/MorningBriefing'
import TeamPage from './components/TeamPage'
import RevenueCommand from './components/RevenueCommand'
import MorningDashboard from './components/MorningDashboard'

function ShopifyAlertBanner() {
  const { shopifySync, syncShopify, dismissShopifyError } = useApp()
  if (!shopifySync.error) return null

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 text-sm"
      style={{
        background: '#fee2e2',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        color: '#b91c1c',
      }}
    >
      <AlertTriangle size={16} className="shrink-0" style={{ color: '#dc2626' }} />
      <span className="flex-1">
        <strong>Shopify Sync Failed</strong> — {shopifySync.error}
      </span>
      <button
        onClick={syncShopify}
        disabled={shopifySync.loading}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 transition-colors"
        style={{
          borderRadius: 8,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          color: '#dc2626',
          cursor: shopifySync.loading ? 'not-allowed' : 'pointer',
          opacity: shopifySync.loading ? 0.6 : 1,
        }}
      >
        <RefreshCw size={12} className={shopifySync.loading ? 'animate-spin' : ''} />
        Retry
      </button>
      <button
        onClick={dismissShopifyError}
        className="p-1 transition-colors"
        style={{ color: '#b91c1c', borderRadius: 8 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(185,28,28,0.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function MainContent() {
  const { activeSection } = useApp()
  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ background: '#f5f4f0' }}>
      <ShopifyAlertBanner />
      <Header />
      <main
        className="flex-1 py-6 px-4 sm:px-6 overflow-auto mx-auto w-full"
        style={{ maxWidth: 1120 }}
      >
        {activeSection === 'briefing'  && <MorningBriefing />}
        {activeSection === 'morning'   && <MorningDashboard />}
        {activeSection === 'revenue'   && <RevenueCommand />}
        {activeSection === 'dashboard' && <KPIDashboard />}
        {activeSection === 'projects'  && <ProjectTracker />}
        {activeSection === 'tasks'     && <TaskList />}
        {activeSection === 'team'      && <TeamPage />}
        {activeSection === 'alerts'    && <AlertsPanel />}
        {activeSection === 'calendar'  && <CalendarView />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#f5f4f0' }}>
      <Sidebar />
      <MainContent />
    </div>
  )
}
