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

function ShopifyAlertBanner() {
  const { shopifySync, syncShopify, dismissShopifyError } = useApp()
  if (!shopifySync.error) return null

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 text-sm"
      style={{
        background: '#FEF2F2',
        borderBottom: '1px solid #FECACA',
        color: '#991B1B',
      }}
    >
      <AlertTriangle size={16} className="shrink-0" style={{ color: '#DC2626' }} />
      <span className="flex-1">
        <strong>Shopify Sync Failed</strong> — {shopifySync.error}
      </span>
      <button
        onClick={syncShopify}
        disabled={shopifySync.loading}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
        style={{
          background: '#FFFFFF',
          border: '1px solid #FECACA',
          color: '#DC2626',
          cursor: shopifySync.loading ? 'not-allowed' : 'pointer',
          opacity: shopifySync.loading ? 0.6 : 1,
        }}
      >
        <RefreshCw size={12} className={shopifySync.loading ? 'animate-spin' : ''} />
        Retry
      </button>
      <button
        onClick={dismissShopifyError}
        className="p-1 rounded-lg transition-colors"
        style={{ color: '#991B1B' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(153,27,27,0.1)' }}
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
    <div className="flex-1 flex flex-col min-w-0 min-h-screen" style={{ background: '#EDECEA' }}>
      <ShopifyAlertBanner />
      <Header />
      <main className="flex-1 p-7 overflow-auto">
        {activeSection === 'briefing'  && <MorningBriefing />}
        {activeSection === 'dashboard' && <KPIDashboard />}
        {activeSection === 'projects'  && <ProjectTracker />}
        {activeSection === 'tasks'     && <TaskList />}
        {activeSection === 'alerts'    && <AlertsPanel />}
        {activeSection === 'calendar'  && <CalendarView />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen" style={{ background: '#EDECEA' }}>
      <Sidebar />
      <MainContent />
    </div>
  )
}
