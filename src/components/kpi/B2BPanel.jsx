import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Building2, FileText, AlertCircle, DollarSign } from 'lucide-react'
import { fetchB2BData } from '../../api/quickbooks'

const STATUS_STYLE = {
  paid:    { bg: '#F0FDF4', color: '#16A34A' },
  unpaid:  { bg: '#f0efe9', color: '#1a1a18' },
  overdue: { bg: '#FEF2F2', color: '#dc2626' },
}

function StatCard({ icon: Icon, label, value, sub, alert }) {
  return (
    <div
      className="flex flex-col gap-1"
      style={{ background: '#f0efe9', border: `1px solid ${alert ? '#fee2e2' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, padding: '14px 16px' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#9b9b94' }}>
        <Icon size={12} />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: alert ? '#dc2626' : '#1a1a18', fontFamily: "'DM Mono', monospace" }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: '#9b9b94' }}>{sub}</div>}
    </div>
  )
}

export default function B2BPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchB2BData()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div
      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div
            className="text-sm font-medium"
            style={{ color: '#1a1a18' }}
          >
            B2B Sales
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>
            QuickBooks — Customers & Invoices
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: loading ? '#CCCCCC' : '#9b9b94', border: '1px solid rgba(0,0,0,0.08)' }}
          onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#1a1a18'; e.currentTarget.style.color = '#1a1a18' } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = loading ? '#CCCCCC' : '#9b9b94' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && !data ? (
        <div className="text-xs py-8 text-center" style={{ color: '#9b9b94' }}>{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard
              icon={Building2}
              label="B2B Customers"
              value={data?.totalCustomers ?? '—'}
            />
            <StatCard
              icon={DollarSign}
              label="Invoice Revenue"
              value={data?.totalRevenue != null ? `$${data.totalRevenue.toLocaleString()}` : '—'}
            />
            <StatCard
              icon={FileText}
              label="Outstanding"
              value={data?.totalOutstanding != null ? `$${data.totalOutstanding.toLocaleString()}` : '—'}
            />
            <StatCard
              icon={AlertCircle}
              label="Overdue"
              value={data?.overdueInvoices ?? '—'}
              sub={data?.unpaidInvoices != null ? `${data.unpaidInvoices} unpaid total` : null}
              alert={data?.overdueInvoices > 0}
            />
          </div>

          {/* Recent invoices */}
          {data?.recentInvoices?.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#9b9b94' }}>
                Recent Invoices
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#f0efe9' }}>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: '#9b9b94' }}>Invoice</th>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: '#9b9b94' }}>Customer</th>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: '#9b9b94' }}>Date</th>
                      <th className="text-right py-2 pr-3 font-medium" style={{ color: '#9b9b94' }}>Total</th>
                      <th className="text-right py-2 font-medium" style={{ color: '#9b9b94' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentInvoices.map((inv) => {
                      const ss = STATUS_STYLE[inv.status] || STATUS_STYLE.unpaid
                      return (
                        <tr
                          key={inv.id}
                          style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0efe9' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <td className="py-2 pr-3 font-medium" style={{ color: '#1a1a18' }}>#{inv.docNumber}</td>
                          <td className="py-2 pr-3" style={{ color: '#9b9b94' }}>{inv.customer}</td>
                          <td className="py-2 pr-3 tabular-nums" style={{ color: '#9b9b94', fontFamily: "'DM Mono', monospace" }}>
                            {inv.date ? new Date(inv.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="py-2 pr-3 tabular-nums font-medium" style={{ color: '#1a1a18', fontFamily: "'DM Mono', monospace", textAlign: 'right' }}>
                            ${inv.total.toLocaleString()}
                          </td>
                          <td className="py-2 text-right">
                            <span
                              className="px-2 py-0.5 text-xs font-medium capitalize"
                              style={{ background: ss.bg, color: ss.color, borderRadius: 20 }}
                            >
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
