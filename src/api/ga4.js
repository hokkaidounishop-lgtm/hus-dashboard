/**
 * GA4 realtime client — calls the Vercel serverless proxy at /api/ga4/realtime
 */
export async function fetchGA4Realtime() {
  const res = await fetch('/api/ga4/realtime')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `GA4 fetch failed (HTTP ${res.status})`)
  }
  return res.json()
}
