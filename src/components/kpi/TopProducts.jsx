import { useState } from 'react'
import { ArrowUp, ArrowDown, Minus, AlertTriangle, ArrowUpDown, ExternalLink } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const fmt$ = (n) => `$${n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n}`

function TrendBadge({ current, prev }) {
  if (!prev || prev === 0) {
    return <span className="text-xs italic" style={{ color: '#999999' }}>New</span>
  }
  const pct = ((current - prev) / prev) * 100
  const up  = pct > 0
  const flat = Math.abs(pct) < 1
  if (flat) return (
    <span className="text-xs flex items-center gap-0.5" style={{ color: '#999999' }}>
      <Minus size={11} /> 0%
    </span>
  )
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium"
      style={{ color: up ? '#999999' : '#C0392B' }}
    >
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function SortHeader({ label, sortKey, current, direction, onSort }) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors"
      style={{ color: active ? '#1A1A1A' : '#999999' }}
    >
      {label}
      <ArrowUpDown size={11} style={{ color: active ? '#1A1A1A' : '#D4C9BC' }} />
    </button>
  )
}

export default function TopProducts({ onNavigateToProject }) {
  const { kpis } = useApp()
  const products = kpis.topProducts ?? []

  const [sortKey, setSortKey] = useState('revenue')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...products].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: '#FFFFFF', border: '1px solid #F0F0F0', boxShadow: '0 1px 4px 0 rgba(26,18,8,0.05)' }}
    >
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F0F0F0' }}>
        <div>
          <div
            className="text-sm font-medium"
            style={{ fontFamily: '"Inter", system-ui, sans-serif', color: '#1A1A1A' }}
          >
            Top Products
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#999999' }}>Ranked by revenue — click headers to sort</div>
        </div>
        <div className="text-xs" style={{ color: '#999999' }}>
          FY Total: <span className="font-semibold" style={{ color: '#999999' }}>${totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #F0F0F0', background: '#FFFFFF' }}>
              <th className="text-left px-4 py-3 w-6 text-xs font-medium" style={{ color: '#999999' }}>#</th>
              <th className="text-left px-3 py-3">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#999999' }}>Product</span>
              </th>
              <th className="text-right px-3 py-3">
                <SortHeader label="Units" sortKey="unitsSold" current={sortKey} direction={sortDir} onSort={handleSort} />
              </th>
              <th className="text-right px-3 py-3">
                <SortHeader label="Revenue" sortKey="revenue" current={sortKey} direction={sortDir} onSort={handleSort} />
              </th>
              <th className="text-right px-3 py-3 hidden md:table-cell">
                <SortHeader label="% Total" sortKey="pctOfTotal" current={sortKey} direction={sortDir} onSort={handleSort} />
              </th>
              <th className="text-right px-3 py-3">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#999999' }}>Trend</span>
              </th>
              <th className="text-right px-3 py-3 hidden lg:table-cell">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#999999' }}>Stock</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const lowStock = p.inventory <= p.lowStockThreshold
              const criticalStock = p.inventory <= Math.floor(p.lowStockThreshold / 2)
              return (
                <tr
                  key={p.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid #F0F0F0' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F9F9F9' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: '#D4C9BC' }}>{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{p.name}</span>
                      {lowStock && (
                        <span
                          className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{
                            background: '#F5F5F5',
                            color: criticalStock ? '#C0392B' : '#1A1A1A',
                          }}
                        >
                          <AlertTriangle size={10} />
                          {criticalStock ? 'Critical' : 'Low stock'}
                        </span>
                      )}
                      {p.linkedProject && (
                        <button
                          onClick={() => onNavigateToProject?.()}
                          className="transition-colors"
                          title="View linked project"
                          style={{ color: '#1A1A1A', opacity: 0.6 }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
                        >
                          <ExternalLink size={11} />
                        </button>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#999999' }}>{p.sku}</div>
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium tabular-nums" style={{ color: '#1A1A1A' }}>
                    {p.unitsSold.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium tabular-nums" style={{ color: '#1A1A1A' }}>
                    {fmt$(p.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right hidden md:table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F0F0' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(p.pctOfTotal, 100)}%`,
                            background: '#1A1A1A',
                          }}
                        />
                      </div>
                      <span className="text-xs w-8 text-right tabular-nums" style={{ color: '#999999' }}>
                        {p.pctOfTotal.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <TrendBadge current={p.unitsSold} prev={p.prevUnitsSold} />
                  </td>
                  <td className="px-3 py-3 text-right hidden lg:table-cell">
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{
                        color: criticalStock ? '#C0392B' : lowStock ? '#1A1A1A' : '#999999',
                      }}
                    >
                      {p.inventory} units
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
