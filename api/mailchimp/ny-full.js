/**
 * Mailchimp NY Full Analysis — paginates all 4301 members
 * GET /api/mailchimp/ny-full
 */

function parseDC(apiKey) { return apiKey.split('-').pop() }

async function mcFetch(dc, apiKey, path) {
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}` },
  })
  if (!res.ok) throw new Error(`Mailchimp ${res.status}: ${(await res.text()).slice(0,200)}`)
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
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

    // Paginate all subscribed members
    const pageSize = 500
    let offset = 0
    let allMembers = []

    while (true) {
      const page = await mcFetch(dc, apiKey,
        `/lists/${listId}/members?status=subscribed&count=${pageSize}&offset=${offset}&fields=members.email_address,members.tags,members.stats,members.location,members.merge_fields,members.last_changed`
      )
      const batch = page.members || []
      allMembers = allMembers.concat(batch)
      if (batch.length < pageSize) break
      offset += pageSize
    }

    // Segment by tags
    const nyMembers = allMembers.filter(m =>
      (m.tags || []).some(t => {
        const name = (t.name || '').toLowerCase()
        return name.includes('new york') || name === 'ny'
      })
    )

    // Further segment NY by engagement
    const now = Date.now()
    const months6 = 180 * 86400000
    const months12 = 365 * 86400000

    const nyEngaged6m  = nyMembers.filter(m => m.stats?.avg_open_rate > 0 &&
      new Date(m.last_changed).getTime() > now - months6)
    const nyEngaged12m = nyMembers.filter(m => m.stats?.avg_open_rate > 0)
    const nyNeverOpen  = nyMembers.filter(m => !m.stats?.avg_open_rate || m.stats.avg_open_rate === 0)

    // All member tag distribution
    const tagCounts = {}
    allMembers.forEach(m => {
      (m.tags || []).forEach(t => {
        tagCounts[t.name] = (tagCounts[t.name] || 0) + 1
      })
    })
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }))

    // NY avg open rate
    const nyWithStats = nyMembers.filter(m => m.stats?.avg_open_rate > 0)
    const nyAvgOpen = nyWithStats.length
      ? (nyWithStats.reduce((s, m) => s + m.stats.avg_open_rate, 0) / nyWithStats.length * 100).toFixed(1)
      : 0

    return res.status(200).json({
      totalFetched: allMembers.length,
      ny: {
        total: nyMembers.length,
        pctOfList: Math.round(nyMembers.length / allMembers.length * 100),
        engaged12m: nyEngaged12m.length,
        engaged6m: nyEngaged6m.length,
        neverOpened: nyNeverOpen.length,
        avgOpenRate: nyAvgOpen + '%',
      },
      allList: {
        total: allMembers.length,
        withTags: allMembers.filter(m => m.tags?.length > 0).length,
        noTags: allMembers.filter(m => !m.tags?.length).length,
      },
      topTags,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
