import { RefreshCw, Users, MousePointerClick, Activity, Globe } from 'lucide-react'
import { useGA4Realtime } from '../../hooks/useGA4Realtime'

const CHANNEL_COLORS = {
  'Organic Search':  '#1A1A1A',
  'Direct':          '#2D5B6B',
  'Organic Social':  '#3D7A5C',
  'Paid Search':     '#C0392B',
  'Email':           '#7C5CFC',
  'Referral':        '#E08B3A',
  'Paid Social':     '#4A90D9',
  'Display':         '#999999',
}

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

export default function GA4RealtimePanel() {
  const { data, loading, error, refresh } = useGA4Realtime()

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
            Live Analytics
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#999999' }}>
            Google Analytics 4 — Realtime
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data?.fetchedAt && (
            <span className="text-xs" style={{ color: '#C4BBB3' }}>
              {new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color: loading ? '#CCCCCC' : '#999999',
              border: '1px solid #F0F0F0',
            }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#1A1A1A' } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#F0F0F0'; e.currentTarget.style.color = loading ? '#CCCCCC' : '#999999' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: error ? '#FEF2F2' : '#F0FDF4', color: error ? '#DC2626' : '#16A34A' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: error ? '#DC2626' : '#16A34A' }}
            />
            {error ? 'Offline' : 'Live'}
          </span>
        </div>
      </div>

      {error && !data ? (
        <div className="text-xs py-8 text-center" style={{ color: '#999999' }}>
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
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#999999' }}>
                Channel Breakdown
              </div>
              <div className="space-y-2">
                {data.channels.map((ch) => {
                  const pct = data.todaySessions > 0
                    ? Math.round((ch.sessions / data.todaySessions) * 100)
                    : 0
                  const color = CHANNEL_COLORS[ch.channel] || '#999999'
                  return (
                    <div key={ch.channel}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: '#1A1A1A' }}>{ch.channel}</span>
                        <span style={{ color: '#999999' }}>
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
