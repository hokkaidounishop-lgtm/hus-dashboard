import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Building2, FileText, AlertCircle, DollarSign } from 'lucide-react'
import { fetchB2BData } from '../../api/quickbooks'

const STATUS_STYLE = {
  paid:    { bg: '#F0FDF4', color: '#16A34A' },
  unpaid:  { bg: '#F5F5F5', color: '#1A1A1A' },
  overdue: { bg: '#FEF2F2', color: '#DC2626' },
}

function StatCard({ icon: Icon, label, value, sub, alert }) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: '#EDECEA', border: `1px solid ${alert ? '#FECACA' : '#F0F0F0'}` }}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#999999' }}>
        <Icon size={12} />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: alert ? '#DC2626' : '#1A1A1A' }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: '#999999' }}>{sub}</div>}
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
      className="rounded-lg p-5"
      style={{ background: '#FFFFFF', border: '1px solid #F0F0F0', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div
            className="text-sm font-medium"
            style={{ fontFamily: '"Inter", system-ui, sans-serif', color: '#1A1A1A' }}
          >
            B2B Sales
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#999999' }}>
            QuickBooks — Customers & Invoices
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: loading ? '#CCCCCC' : '#999999', border: '1px solid #F0F0F0' }}
          onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#1A1A1A' } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#F0F0F0'; e.currentTarget.style.color = loading ? '#CCCCCC' : '#999999' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && !data ? (
        <div className="text-xs py-8 text-center" style={{ color: '#999999' }}>{error}</div>
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
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#999999' }}>
                Recent Invoices
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: '#999999' }}>Invoice</th>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: '#999999' }}>Customer</th>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: '#999999' }}>Date</th>
                      <th className="text-right py-2 pr-3 font-medium" style={{ color: '#999999' }}>Total</th>
                      <th className="text-right py-2 font-medium" style={{ color: '#999999' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentInvoices.map((inv) => {
                      const ss = STATUS_STYLE[inv.status] || STATUS_STYLE.unpaid
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                          <td className="py-2 pr-3 font-medium" style={{ color: '#1A1A1A' }}>#{inv.docNumber}</td>
                          <td className="py-2 pr-3" style={{ color: '#999999' }}>{inv.customer}</td>
                          <td className="py-2 pr-3 tabular-nums" style={{ color: '#999999' }}>
                            {inv.date ? new Date(inv.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-medium" style={{ color: '#1A1A1A' }}>
                            ${inv.total.toLocaleString()}
                          </td>
                          <td className="py-2 text-right">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                              style={{ background: ss.bg, color: ss.color }}
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
