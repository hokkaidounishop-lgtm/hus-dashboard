/**
 * Vercel serverless function — Mailchimp NY Members Analysis
 * Endpoint: GET /api/mailchimp/ny
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

  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'MAILCHIMP_API_KEY not set' })

  const dc = parseDC(apiKey)
  let listId = process.env.MAILCHIMP_LIST_ID

  try {
    if (!listId) {
      const lists = await mcFetch(dc, apiKey, '/lists?count=1')
      listId = lists.lists?.[0]?.id
    }

    // Fetch NY members by state and by tag in parallel
    const [nyByState, nyByTag, totalSubscribed] = await Promise.all([
      // Members with NY in address
      mcFetch(dc, apiKey, `/lists/${listId}/members?status=subscribed&count=1000&fields=members.email_address,members.location,members.tags,members.last_changed,members.stats&offset=0`),
      // Members with "New York" tag
      mcFetch(dc, apiKey, `/lists/${listId}/members?status=subscribed&count=1&fields=total_items&tag_id=New+York`).catch(() => ({ total_items: 0 })),
      // Total
      mcFetch(dc, apiKey, `/lists/${listId}?fields=stats.member_count`),
    ])

    // Filter NY members from address data
    const allMembers = nyByState.members || []
    const nyMembers = allMembers.filter(m => {
      const loc = m.location || {}
      return loc.country_code === 'US' && (
        loc.region === 'NY' || 
        (m.merge_fields?.STATE || '').toUpperCase() === 'NY' ||
        (m.merge_fields?.ADDRESS || '').includes('NY')
      )
    })

    // Also check tags
    const nyTaggedMembers = allMembers.filter(m =>
      (m.tags || []).some(t => t.name?.toLowerCase().includes('new york') || t.name?.toLowerCase() === 'ny')
    )

    // Get a sample of NY members for verification
    const nySample = nyMembers.slice(0, 10).map(m => ({
      email: m.email_address?.replace(/(.{2}).*@/, '$1***@'),
      region: m.location?.region,
      country: m.location?.country_code,
      openRate: m.stats?.avg_open_rate,
      clickRate: m.stats?.avg_click_rate,
    }))

    // Engagement breakdown for NY members
    const nyEngaged = nyMembers.filter(m => (m.stats?.avg_open_rate || 0) > 0)
    const nyHighValue = nyMembers.filter(m => (m.stats?.avg_open_rate || 0) > 0.2)

    return res.status(200).json({
      listId,
      totalSubscribed: totalSubscribed.stats?.member_count,
      totalFetched: allMembers.length,
      ny: {
        byAddress: nyMembers.length,
        byTag: nyTaggedMembers.length,
        engaged: nyEngaged.length,
        highValue: nyHighValue.length,
        sample: nySample,
      },
      note: allMembers.length === 1000 ? 'Only first 1000 members fetched - may be incomplete' : `All ${allMembers.length} members fetched`,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Mailchimp NY Error]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
