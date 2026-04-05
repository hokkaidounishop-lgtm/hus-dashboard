import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Mail, Users, MousePointerClick, ExternalLink } from 'lucide-react'
import { fetchMailchimpStats } from '../../api/mailchimp'

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: '#EDECEA', border: '1px solid #F0F0F0' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#999999' }}>
        <Icon size={12} />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: '#1A1A1A' }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: '#999999' }}>{sub}</div>}
    </div>
  )
}

export default function MailchimpPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchMailchimpStats()
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
            Email Marketing
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#999999' }}>
            Mailchimp{data?.listName ? ` — ${data.listName}` : ''}
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
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard
              icon={Users}
              label="Subscribers"
              value={data?.subscribers?.toLocaleString() ?? '—'}
            />
            <StatCard
              icon={Mail}
              label="Avg Open Rate"
              value={data?.avgOpenRate != null ? `${data.avgOpenRate}%` : '—'}
            />
            <StatCard
              icon={MousePointerClick}
              label="Avg Click Rate"
              value={data?.avgClickRate != null ? `${data.avgClickRate}%` : '—'}
            />
          </div>

          {/* Recent campaigns */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#999999' }}>
              Recent Campaigns
            </div>
            <div className="space-y-2">
              {(data?.recentCampaigns || []).map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg px-4 py-3 flex items-center gap-4"
                  style={{ background: '#EDECEA', border: '1px solid #F0F0F0' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>
                      {c.title}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#999999' }}>
                      {c.sendTime
                        ? new Date(c.sendTime).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })
                        : '—'}
                      {' · '}
                      {c.recipientCount.toLocaleString()} recipients
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-center">
                      <div className="font-bold tabular-nums" style={{ color: '#1A1A1A' }}>
                        {c.openRate != null ? `${c.openRate}%` : '—'}
                      </div>
                      <div style={{ color: '#999999' }}>opens</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold tabular-nums" style={{ color: '#1A1A1A' }}>
                        {c.clickRate != null ? `${c.clickRate}%` : '—'}
                      </div>
                      <div style={{ color: '#999999' }}>clicks</div>
                    </div>
                  </div>
                </div>
              ))}
              {data && !data.recentCampaigns?.length && (
                <div className="text-xs py-4 text-center" style={{ color: '#999999' }}>No campaigns found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
