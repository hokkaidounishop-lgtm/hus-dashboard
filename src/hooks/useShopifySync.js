import { useApp } from '../context/AppContext'

/**
 * Thin wrapper around the global Shopify sync state in AppContext.
 * Keeps the existing API surface so ShopifySyncButton doesn't change.
 */
export function useShopifySync() {
  const { shopifySync, syncShopify } = useApp()
  return {
    sync: syncShopify,
    loading: shopifySync.loading,
    error: shopifySync.error,
    lastSync: shopifySync.lastSync,
  }
}
