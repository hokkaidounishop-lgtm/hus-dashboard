/**
 * Vercel serverless function — Mailchimp API proxy
 * Endpoint: GET /api/mailchimp/stats
 *
 * Environment variables (set in Vercel dashboard):
 *   MAILCHIMP_API_KEY     API key (ends with -usXX data center suffix)
 *   MAILCHIMP_LIST_ID     Audience/List ID (optional, auto-detects first list)
 */

function parseDC(apiKey) {
  const parts = apiKey.split('-')
  return parts[parts.length - 1] // e.g. "us21"
}

async function mcFetch(dc, apiKey, path) {
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Mailchimp ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'MAILCHIMP_API_KEY not set' })

  const dc = parseDC(apiKey)
  let listId = process.env.MAILCHIMP_LIST_ID

  try {
    // Auto-detect list if not set
    if (!listId) {
      const lists = await mcFetch(dc, apiKey, '/lists?count=1')
      listId = lists.lists?.[0]?.id
      if (!listId) return res.status(500).json({ error: 'No Mailchimp audiences found' })
    }

    // Fetch list stats + recent campaigns in parallel
    const [listData, campaignsData] = await Promise.all([
      mcFetch(dc, apiKey, `/lists/${listId}?fields=stats,name`),
      mcFetch(dc, apiKey, `/campaigns?list_id=${listId}&count=5&sort_field=send_time&sort_dir=DESC&status=sent`),
    ])

    const stats = listData.stats || {}
    const campaigns = (campaignsData.campaigns || []).map((c) => ({
      id: c.id,
      title: c.settings?.title || c.settings?.subject_line || 'Untitled',
      subject: c.settings?.subject_line || '',
      sendTime: c.send_time,
      recipientCount: c.recipients?.recipient_count || 0,
      openRate: c.report_summary?.open_rate != null
        ? parseFloat((c.report_summary.open_rate * 100).toFixed(1))
        : null,
      clickRate: c.report_summary?.click_rate != null
        ? parseFloat((c.report_summary.click_rate * 100).toFixed(1))
        : null,
      unsubscribed: c.report_summary?.unsubscribed || 0,
    }))

    return res.status(200).json({
      listName: listData.name,
      subscribers: stats.member_count || 0,
      unsubscribed: stats.unsubscribe_count || 0,
      avgOpenRate: stats.open_rate != null
        ? parseFloat(stats.open_rate.toFixed(1))
        : null,
      avgClickRate: stats.click_rate != null
        ? parseFloat(stats.click_rate.toFixed(1))
        : null,
      recentCampaigns: campaigns,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Mailchimp Error]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
