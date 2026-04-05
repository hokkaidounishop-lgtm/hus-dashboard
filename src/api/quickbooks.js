/**
 * QuickBooks B2B client — calls /api/quickbooks/b2b
 */
export async function fetchB2BData() {
  const res = await fetch('/api/quickbooks/b2b')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `QuickBooks fetch failed (HTTP ${res.status})`)
  }
  return res.json()
}
