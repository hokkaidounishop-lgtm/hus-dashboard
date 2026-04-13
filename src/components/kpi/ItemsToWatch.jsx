import { useMemo } from 'react'
import { AlertTriangle, Info, TrendingDown, ExternalLink, CheckCircle } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { useApp } from '../../context/AppContext'

const SEV = {
  critical: {
    icon: AlertTriangle,
    leftBorder: '#dc2626',
    badge: { bg: '#f0efe9', color: '#dc2626' },
    text: '#dc2626',
  },
  warning: {
    icon: TrendingDown,
    leftBorder: '#1a1a18',
    badge: { bg: '#f0efe9', color: '#1a1a18' },
    text: '#1a1a18',
  },
  info: {
    icon: Info,
    leftBorder: '#9b9b94',
    badge: { bg: '#f0efe9', color: '#9b9b94' },
    text: '#9b9b94',
  },
}

function WatchItem({ item, onNavigate }) {
  const s = SEV[item.severity] || SEV.info
  const Icon = s.icon
  return (
    <div
      className="rounded-lg p-4 flex gap-3"
      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderLeft: `3px solid ${s.leftBorder}`, borderRadius: 12 }}
    >
      <Icon size={16} className="shrink-0 mt-0.5" style={{ color: s.text }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: '#1a1a18' }}>{item.product}</span>
          <span
            className="shrink-0 text-xs px-2 py-0.5 font-medium"
            style={{ background: s.badge.bg, color: s.badge.color, borderRadius: 20 }}
          >
            {item.severity}
          </span>
        </div>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#9b9b94' }}>{item.issue}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs italic" style={{ color: '#9b9b94' }}>{item.action}</span>
          {item.linkedProject && (
            <button
              onClick={() => onNavigate?.('projects')}
              className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: s.text }}
            >
              View project <ExternalLink size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ItemsToWatch({ onNavigate }) {
  const { kpis } = useApp()
  const products = kpis.topProducts ?? []

  const items = useMemo(() => {
    const result = []
    const today = new Date()

    products.forEach((p) => {
      if (p.prevUnitsSold > 0 && p.unitsSold < p.prevUnitsSold * 0.9) {
        const drop = (((p.unitsSold - p.prevUnitsSold) / p.prevUnitsSold) * 100).toFixed(1)
        result.push({
          id: `decline-${p.id}`,
          product: p.name,
          issue: `Sales down ${Math.abs(drop)}% vs previous period (${p.prevUnitsSold} → ${p.unitsSold} units).`,
          severity: Math.abs(Number(drop)) > 20 ? 'critical' : 'warning',
          action: 'Review listing copy, pricing, and ad spend. Consider a promotion.',
          linkedProject: p.linkedProject,
        })
      }

      if (p.unitsSold === 0) {
        result.push({
          id: `zero-${p.id}`,
          product: p.name,
          issue: 'No orders recorded in current period.',
          severity: 'critical',
          action: 'Check listing status, inventory availability, and paid search coverage.',
          linkedProject: p.linkedProject,
        })
      }

      if (p.launchDate) {
        const days = differenceInDays(today, parseISO(p.launchDate))
        if (days > 30 && p.unitsSold < 5) {
          result.push({
            id: `traction-${p.id}`,
            product: p.name,
            issue: `Only ${p.unitsSold} order${p.unitsSold !== 1 ? 's' : ''} after ${days} days since launch (${p.launchDate}).`,
            severity: 'warning',
            action: 'Boost with bundle offer, email campaign, or Tuna Show feature.',
            linkedProject: p.linkedProject,
          })
        }
      }

      if (p.inventory <= p.lowStockThreshold && p.unitsSold > 10) {
        const critical = p.inventory <= Math.floor(p.lowStockThreshold / 2)
        result.push({
          id: `stock-${p.id}`,
          product: p.name,
          issue: `Stock at ${p.inventory} units — ${critical ? 'critically' : ''} below reorder threshold of ${p.lowStockThreshold}.`,
          severity: critical ? 'critical' : 'warning',
          action: critical ? 'Reorder immediately — risk of stockout within days.' : 'Place reorder with supplier.',
          linkedProject: p.linkedProject,
        })
      }
    })

    if (kpis.current.cvr < kpis.targets.cvr) {
      result.push({
        id: 'kpi-cvr',
        product: 'Site-wide CVR',
        issue: `CVR is ${kpis.current.cvr}% vs ${kpis.targets.cvr}% target — every 0.1% improvement adds ~${Math.round(kpis.current.totalOrders * 0.1 * kpis.current.aov / 10)} in monthly revenue.`,
        severity: 'critical',
        action: 'Priority action: CVR Recovery project — PDP redesign & checkout audit.',
        linkedProject: 'proj-001',
      })
    }

    if (kpis.current.aov < kpis.targets.aov) {
      result.push({
        id: 'kpi-aov',
        product: 'Average Order Value',
        issue: `AOV $${kpis.current.aov} is below $${kpis.targets.aov} target. Bundle opportunities exist across top SKUs.`,
        severity: 'warning',
        action: 'Launch cross-sell bundles: e.g. Uni AAA + Wagyu combo box.',
        linkedProject: null,
      })
    }

    const order = { critical: 0, warning: 1, info: 2 }
    return result.sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2))
  }, [products, kpis])

  if (!items.length) {
    return (
      <div
        className="rounded-lg p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}
      >
        <CheckCircle size={32} style={{ color: '#9b9b94', opacity: 0.7 }} />
        <div className="text-sm font-medium" style={{ color: '#1a1a18' }}>Nothing to Watch</div>
        <div className="text-xs" style={{ color: '#9b9b94' }}>All products and KPIs are within healthy ranges.</div>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}
    >
      <div className="flex items-center justify-between" style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div>
          <div
            className="text-sm font-medium"
            style={{ color: '#1a1a18' }}
          >
            Items to Watch
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>Auto-generated from live product and KPI data</div>
        </div>
        <div className="flex gap-1.5 text-xs">
          {['critical', 'warning', 'info'].map((sev) => {
            const count = items.filter((i) => i.severity === sev).length
            if (!count) return null
            return (
              <span
                key={sev}
                className="px-2 py-0.5 font-medium"
                style={{ background: SEV[sev].badge.bg, color: SEV[sev].badge.color, borderRadius: 20 }}
              >
                {count} {sev}
              </span>
            )
          })}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {items.map((item) => (
          <WatchItem key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  )
}
