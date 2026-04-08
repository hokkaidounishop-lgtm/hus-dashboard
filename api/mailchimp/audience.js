/**
 * Vercel serverless function — Mailchimp Audience Deep Analysis
 * Endpoint: GET /api/mailchimp/audience
 * Returns engagement breakdown, tag summary, and growth stats
 */

function parseDC(apiKey) {
  return apiKey.split('-').pop()
}

async function mcFetch(dc, apiKey, path) {
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
    },
  })
  if (!res.ok) throw new Error(`Mailchimp ${res.status}: ${(await res.text()).slice(0, 200)}`)
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
    if (!listId) {
      const lists = await mcFetch(dc, apiKey, '/lists?count=1')
      listId = lists.lists?.[0]?.id
      if (!listId) return res.status(500).json({ error: 'No Mailchimp audiences found' })
    }

    // Fetch in parallel: list stats, segments by engagement, tags, growth
    const [listData, tagsData, growthData] = await Promise.all([
      mcFetch(dc, apiKey, `/lists/${listId}?fields=stats,name`),
      mcFetch(dc, apiKey, `/lists/${listId}/tag-search?count=50`),
      mcFetch(dc, apiKey, `/lists/${listId}/growth-history?count=12&sort_field=month&sort_dir=DESC`),
    ])

    // Fetch engagement segments counts in parallel
    const [engaged90, engaged180, engaged365, neverOpened] = await Promise.all([
      // Opened in last 90 days
      mcFetch(dc, apiKey, `/lists/${listId}/members?status=subscribed&since_last_open=${new Date(Date.now()-90*86400000).toISOString()}&count=1&fields=total_items`),
      // Opened in last 180 days
      mcFetch(dc, apiKey, `/lists/${listId}/members?status=subscribed&since_last_open=${new Date(Date.now()-180*86400000).toISOString()}&count=1&fields=total_items`),
      // Opened in last 365 days
      mcFetch(dc, apiKey, `/lists/${listId}/members?status=subscribed&since_last_open=${new Date(Date.now()-365*86400000).toISOString()}&count=1&fields=total_items`),
      // Never opened (no last open date — use before very old date)
      mcFetch(dc, apiKey, `/lists/${listId}/members?status=subscribed&before_last_open=2000-01-01T00:00:00Z&count=1&fields=total_items`),
    ])

    const stats = listData.stats || {}
    const totalSubscribed = stats.member_count || 0

    const engaged90Count = engaged90.total_items || 0
    const engaged180Count = engaged180.total_items || 0
    const engaged365Count = engaged365.total_items || 0
    const neverOpenedCount = neverOpened.total_items || 0

    // Derived segments
    const hotCount = engaged90Count
    const warmCount = engaged180Count - engaged90Count
    const coldCount = engaged365Count - engaged180Count
    const frozenCount = totalSubscribed - engaged365Count - neverOpenedCount
    // zombie = never opened + more than 365 days since open
    const zombieCount = neverOpenedCount + Math.max(0, frozenCount)

    return res.status(200).json({
      listName: listData.name,
      listId,
      totalSubscribed,
      unsubscribed: stats.unsubscribe_count || 0,
      cleaned: stats.cleaned_count || 0,
      avgOpenRate: stats.open_rate != null ? parseFloat((stats.open_rate * 100).toFixed(1)) : null,
      avgClickRate: stats.click_rate != null ? parseFloat((stats.click_rate * 100).toFixed(1)) : null,
      engagement: {
        hot:    { count: hotCount,    label: 'Opened in last 90 days',         pct: Math.round(hotCount/totalSubscribed*100) },
        warm:   { count: warmCount,   label: 'Opened 90-180 days ago',         pct: Math.round(warmCount/totalSubscribed*100) },
        cold:   { count: coldCount,   label: 'Opened 180-365 days ago',        pct: Math.round(coldCount/totalSubscribed*100) },
        zombie: { count: zombieCount, label: 'Never opened or 365+ days ago',  pct: Math.round(zombieCount/totalSubscribed*100) },
      },
      tags: (tagsData.tags || []).slice(0, 20).map(t => ({ name: t.name, count: t.subscriber_count || 0 })),
      growth: (growthData.history || []).map(g => ({
        month: g.month,
        subscribed: g.subscribed,
        unsubscribed: g.unsubscribed,
        netGrowth: (g.subscribed || 0) - (g.unsubscribed || 0),
      })),
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Mailchimp Audience Error]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
