import { RefreshCw, Users, MousePointerClick, Activity, Globe } from 'lucide-react'
import { useGA4Realtime } from '../../hooks/useGA4Realtime'

const CHANNEL_COLORS = {
  'Organic Search':  '#1a1a18',
  'Direct':          '#2D5B6B',
  'Organic Social':  '#16a34a',
  'Paid Search':     '#dc2626',
  'Email':           '#7C5CFC',
  'Referral':        '#E08B3A',
  'Paid Social':     '#4A90D9',
  'Display':         '#9b9b94',
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div
      className="flex flex-col gap-1"
      style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#9b9b94' }}>
        <Icon size={12} />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: '#1a1a18', fontFamily: "'DM Mono', monospace" }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: '#9b9b94' }}>{sub}</div>}
    </div>
  )
}

export default function GA4RealtimePanel() {
  const { data, loading, error, refresh } = useGA4Realtime()

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
            Live Analytics
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>
            Google Analytics 4 — Realtime
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data?.fetchedAt && (
            <span className="text-xs" style={{ color: '#9b9b94' }}>
              {new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color: loading ? '#CCCCCC' : '#9b9b94',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#1a1a18'; e.currentTarget.style.color = '#1a1a18' } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = loading ? '#CCCCCC' : '#9b9b94' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
            style={{ background: error ? '#FEF2F2' : '#F0FDF4', color: error ? '#dc2626' : '#16A34A', borderRadius: 20 }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: error ? '#dc2626' : '#16A34A' }}
            />
            {error ? 'Offline' : 'Live'}
          </span>
        </div>
      </div>

      {error && !data ? (
        <div className="text-xs py-8 text-center" style={{ color: '#9b9b94' }}>
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              icon={Users}
              label="Active Users"
              value={data?.activeUsers ?? '—'}
              sub="Right now"
            />
            <StatCard
              icon={MousePointerClick}
              label="Today's CVR"
              value={data?.todayCvr != null ? `${data.todayCvr}%` : '—'}
              sub={data?.todayPurchases != null ? `${data.todayPurchases} purchases` : null}
            />
            <StatCard
              icon={Activity}
              label="Sessions"
              value={data?.todaySessions?.toLocaleString() ?? '—'}
              sub="Today"
            />
            <StatCard
              icon={Globe}
              label="Users"
              value={data?.todayUsers?.toLocaleString() ?? '—'}
              sub="Today"
            />
          </div>

          {/* Channel breakdown */}
          {data?.channels?.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#9b9b94' }}>
                Channel Breakdown
              </div>
              <div className="space-y-2">
                {data.channels.map((ch) => {
                  const pct = data.todaySessions > 0
                    ? Math.round((ch.sessions / data.todaySessions) * 100)
                    : 0
                  const color = CHANNEL_COLORS[ch.channel] || '#9b9b94'
                  return (
                    <div key={ch.channel}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: '#1a1a18' }}>{ch.channel}</span>
                        <span style={{ color: '#9b9b94', fontFamily: "'DM Mono', monospace" }}>
                          {ch.sessions} sessions · {pct}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
