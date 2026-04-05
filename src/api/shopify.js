/**
 * Shopify sync client — calls the Vercel serverless proxy at /api/shopify/sync
 * The proxy handles auth and CORS; no Shopify token is exposed to the browser.
 */

export async function syncFromShopify() {
  const res = await fetch('/api/shopify/sync')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Sync failed (HTTP ${res.status})`)
  }
  return res.json()
}

export default { syncFromShopify }
