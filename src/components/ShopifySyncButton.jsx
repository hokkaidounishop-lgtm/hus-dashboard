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
          style={{ color: '#999999' }}
        >
          <CheckCircle size={11} />
          Synced {format(lastSync, 'HH:mm')}
        </span>
      )}
      {lastSync && !error && (
        <span
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: 'rgba(153,153,153,0.6)' }}
          title="Auto-syncs every 6 hours"
        >
          <Timer size={10} />
          auto
        </span>
      )}
      {error && (
        <span
          className="inline-flex items-center gap-1 text-xs max-w-[220px] truncate"
          style={{ color: '#C0392B' }}
          title={error}
        >
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </span>
      )}
      <button
        onClick={sync}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-all"
        style={{
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          color: loading ? '#CCCCCC' : '#999999',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#C9A96E'
            e.currentTarget.style.color = '#C9A96E'
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#F0F0F0'
            e.currentTarget.style.color = '#999999'
          }
        }}
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Syncing...' : 'Sync Shopify'}
      </button>
    </div>
  )
}
