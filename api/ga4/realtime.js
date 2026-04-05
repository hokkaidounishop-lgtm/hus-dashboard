/**
 * Vercel serverless function — GA4 Data API proxy
 * Endpoint: GET /api/ga4/realtime
 *
 * Environment variables (set in Vercel dashboard):
 *   GA4_PROPERTY_ID          Numeric property ID (e.g. 123456789)
 *   GA4_SERVICE_ACCOUNT_KEY  Full JSON service account key
 */

import { google } from 'googleapis'

function getAuthClient() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GA4_SERVICE_ACCOUNT_KEY not set')

  const key = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) return res.status(500).json({ error: 'GA4_PROPERTY_ID not set' })

  try {
    const auth = getAuthClient()
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })
    const property = `properties/${propertyId}`

    // Run two reports in parallel:
    // 1. Realtime report (active users, sessions)
    // 2. Today's report (sessions, conversions, channel breakdown)
    const [realtimeRes, todayRes] = await Promise.all([
      analyticsData.properties.runRealtimeReport({
        property,
        requestBody: {
          metrics: [
            { name: 'activeUsers' },
          ],
          dimensions: [
            { name: 'unifiedScreenName' },
          ],
          limit: 1,
        },
      }),
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: 'today', endDate: 'today' }],
          metrics: [
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'totalUsers' },
            { name: 'ecommercePurchases' },
          ],
          dimensions: [
            { name: 'sessionDefaultChannelGroup' },
          ],
        },
      }),
    ])

    // Parse realtime
    const realtimeRows = realtimeRes.data.rows || []
    const activeUsers = realtimeRes.data.totals?.[0]?.metricValues?.[0]?.value
      ? parseInt(realtimeRes.data.totals[0].metricValues[0].value)
      : realtimeRows.reduce((s, r) => s + parseInt(r.metricValues?.[0]?.value || '0'), 0)

    // Parse today's report
    const todayRows = todayRes.data.rows || []
    let totalSessions = 0
    let totalConversions = 0
    let totalUsers = 0
    let totalPurchases = 0
    const channels = []

    for (const row of todayRows) {
      const channel = row.dimensionValues?.[0]?.value || 'Unknown'
      const sessions = parseInt(row.metricValues?.[0]?.value || '0')
      const conversions = parseInt(row.metricValues?.[1]?.value || '0')
      const users = parseInt(row.metricValues?.[2]?.value || '0')
      const purchases = parseInt(row.metricValues?.[3]?.value || '0')

      totalSessions += sessions
      totalConversions += conversions
      totalUsers += users
      totalPurchases += purchases

      channels.push({ channel, sessions, conversions, users, purchases })
    }

    // Sort channels by sessions descending
    channels.sort((a, b) => b.sessions - a.sessions)

    const todayCvr = totalSessions > 0
      ? parseFloat(((totalPurchases / totalSessions) * 100).toFixed(2))
      : 0

    return res.status(200).json({
      activeUsers,
      todaySessions: totalSessions,
      todayCvr,
      todayConversions: totalConversions,
      todayUsers: totalUsers,
      todayPurchases: totalPurchases,
      channels: channels.slice(0, 8),
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[GA4 Error]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
