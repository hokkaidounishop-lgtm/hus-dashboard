/**
 * Vercel serverless function — QuickBooks B2B customer/invoice proxy
 * Endpoint: GET /api/quickbooks/b2b
 *
 * Environment variables (set in Vercel dashboard):
 *   QUICKBOOKS_REALM_ID        Company ID (Realm ID)
 *   QUICKBOOKS_ACCESS_TOKEN    OAuth 2.0 access token
 *   QUICKBOOKS_REFRESH_TOKEN   OAuth 2.0 refresh token
 *   QUICKBOOKS_CLIENT_ID       App client ID
 *   QUICKBOOKS_CLIENT_SECRET   App client secret
 *   QUICKBOOKS_ENVIRONMENT     "sandbox" or "production" (default: production)
 */

const BASE = {
  production: 'https://quickbooks.api.intuit.com',
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
}

async function refreshToken() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const refreshToken = process.env.QUICKBOOKS_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) return null

  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) return null
  const json = await res.json()
  return json.access_token || null
}

async function qbQuery(token, realmId, baseUrl, query) {
  const url = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`QuickBooks ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const realmId = process.env.QUICKBOOKS_REALM_ID
  if (!realmId) return res.status(500).json({ error: 'QUICKBOOKS_REALM_ID not set' })

  let token = process.env.QUICKBOOKS_ACCESS_TOKEN
  if (!token) {
    token = await refreshToken()
    if (!token) return res.status(500).json({ error: 'No QuickBooks access token available' })
  }

  const env = process.env.QUICKBOOKS_ENVIRONMENT || 'production'
  const baseUrl = BASE[env] || BASE.production

  try {
    // Fetch active customers + recent invoices in parallel
    const [custResult, invResult] = await Promise.all([
      qbQuery(token, realmId, baseUrl, "SELECT * FROM Customer WHERE Active = true MAXRESULTS 200"),
      qbQuery(token, realmId, baseUrl, "SELECT * FROM Invoice ORDER BY TxnDate DESC MAXRESULTS 100"),
    ])

    const customers = custResult?.QueryResponse?.Customer || []
    const invoices = invResult?.QueryResponse?.Invoice || []

    // Build customer summary
    const customerSummary = customers.map((c) => ({
      id: c.Id,
      name: c.DisplayName || c.CompanyName || `${c.GivenName || ''} ${c.FamilyName || ''}`.trim(),
      company: c.CompanyName || null,
      email: c.PrimaryEmailAddr?.Address || null,
      balance: parseFloat(c.Balance) || 0,
      active: c.Active,
    }))

    // Build invoice stats
    let totalRevenue = 0
    let paidCount = 0
    let unpaidCount = 0
    let overdueCount = 0
    const today = new Date().toISOString().slice(0, 10)

    for (const inv of invoices) {
      const total = parseFloat(inv.TotalAmt) || 0
      totalRevenue += total

      const balance = parseFloat(inv.Balance) || 0
      if (balance === 0) {
        paidCount++
      } else {
        unpaidCount++
        if (inv.DueDate && inv.DueDate < today) overdueCount++
      }
    }

    const totalOutstanding = customerSummary.reduce((s, c) => s + c.balance, 0)

    return res.status(200).json({
      totalCustomers: customers.length,
      totalInvoices: invoices.length,
      totalRevenue: Math.round(totalRevenue),
      totalOutstanding: Math.round(totalOutstanding),
      paidInvoices: paidCount,
      unpaidInvoices: unpaidCount,
      overdueInvoices: overdueCount,
      customers: customerSummary.sort((a, b) => b.balance - a.balance).slice(0, 20),
      recentInvoices: invoices.slice(0, 10).map((inv) => ({
        id: inv.Id,
        docNumber: inv.DocNumber,
        customer: inv.CustomerRef?.name || 'Unknown',
        date: inv.TxnDate,
        dueDate: inv.DueDate,
        total: parseFloat(inv.TotalAmt) || 0,
        balance: parseFloat(inv.Balance) || 0,
        status: parseFloat(inv.Balance) === 0 ? 'paid'
          : (inv.DueDate && inv.DueDate < today) ? 'overdue' : 'unpaid',
      })),
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    // If 401, try token refresh and retry once
    if (err.message.includes('401')) {
      const newToken = await refreshToken()
      if (newToken) {
        // One retry with refreshed token
        try {
          const [custResult, invResult] = await Promise.all([
            qbQuery(newToken, realmId, baseUrl, "SELECT * FROM Customer WHERE Active = true MAXRESULTS 200"),
            qbQuery(newToken, realmId, baseUrl, "SELECT * FROM Invoice ORDER BY TxnDate DESC MAXRESULTS 100"),
          ])
          // Re-process (simplified — same logic)
          const customers = custResult?.QueryResponse?.Customer || []
          const invoices = invResult?.QueryResponse?.Invoice || []
          return res.status(200).json({
            totalCustomers: customers.length,
            totalInvoices: invoices.length,
            customers: [],
            recentInvoices: [],
            fetchedAt: new Date().toISOString(),
            note: 'Token was refreshed — partial data returned. Reload for full data.',
          })
        } catch (retryErr) {
          return res.status(500).json({ error: retryErr.message })
        }
      }
    }
    console.error('[QuickBooks Error]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
