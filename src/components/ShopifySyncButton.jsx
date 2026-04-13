import { RefreshCw, CheckCircle, AlertCircle, Timer } from 'lucide-react'
import { format } from 'date-fns'
import { useShopifySync } from '../hooks/useShopifySync'

export default function ShopifySyncButton() {
  const { sync, loading, error, lastSync } = useShopifySync()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {lastSync && !error && (
        <span
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: '#9b9b94' }}
        >
          <CheckCircle size={11} />
          Synced {format(lastSync, 'HH:mm')}
        </span>
      )}
      {lastSync && !error && (
        <span
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: 'rgba(155,155,148,0.6)' }}
          title="Auto-syncs every 6 hours"
        >
          <Timer size={10} />
          auto
        </span>
      )}
      {error && (
        <span
          className="inline-flex items-center gap-1 text-xs max-w-[220px] truncate"
          style={{ color: '#dc2626' }}
          title={error}
        >
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </span>
      )}
      <button
        onClick={sync}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 transition-all"
        style={{
          borderRadius: 8,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          color: loading ? '#9b9b94' : '#6b6b66',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#1a1a18'
            e.currentTarget.style.color = '#1a1a18'
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
            e.currentTarget.style.color = '#6b6b66'
          }
        }}
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Syncing...' : 'Sync Shopify'}
      </button>
    </div>
  )
}
