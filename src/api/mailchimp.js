/**
 * Mailchimp stats client — calls /api/mailchimp/stats
 */
export async function fetchMailchimpStats() {
  const res = await fetch('/api/mailchimp/stats')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Mailchimp fetch failed (HTTP ${res.status})`)
  }
  return res.json()
}
