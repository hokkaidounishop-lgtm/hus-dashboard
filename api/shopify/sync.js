/**
 * Vercel serverless function — Shopify Admin API proxy
 * Endpoint: GET /api/shopify/sync
 *
 * Environment variables (set in Vercel dashboard):
 *   SHOPIFY_STORE_URL      e.g. hokkaidouni.myshopify.com
 *   SHOPIFY_CLIENT_ID      Shopify app client ID (for token refresh)
 *   SHOPIFY_CLIENT_SECRET  Shopify app client secret (for token refresh)
 *   SHOPIFY_ACCESS_TOKEN   Fallback token if refresh fails (read_orders, read_products)
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const API_VERSION = '2024-01'

// ── Token refresh ────────────────────────────────────────────────────────────

/**
 * Exchange client credentials for a fresh shpat_ access token.
 * Requires env vars: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 * Posts to the store's OAuth token endpoint.
 */
async function refreshAccessToken(store) {
  const clientId     = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set in environment variables.'
    )
  }

  const url = `https://${store}/admin/oauth/access_token`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  if (!json.access_token) {
    throw new Error('Token refresh response missing access_token')
  }

  console.log('[Shopify] Refreshed access token, prefix:', json.access_token.slice(0, 10))
  return json.access_token
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthKey(isoDate) {
  const d = new Date(isoDate)
  return `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(-2)}`
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] : null
}

async function fetchAllPages(baseUrl, headers, params = {}, maxPages = 15) {
  const results = []
  const qs = new URLSearchParams(params).toString()
  let nextUrl = `${baseUrl}?${qs}`
  let page = 0

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl, { headers })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Shopify ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    // Shopify wraps results in a key like { orders: [...] } or { products: [...] }
    const key = Object.keys(json)[0]
    results.push(...(json[key] || []))
    nextUrl = parseNextLink(res.headers.get('link'))
    page++
  }

  return results
}

// ── Data transformations ──────────────────────────────────────────────────────

/** Build monthly revenue/orders array for the last 12 months with data */
function buildMonthly(orders) {
  const map = new Map()

  for (const order of orders) {
    const key = monthKey(order.created_at)
    const rev = parseFloat(order.subtotal_price) || 0
    if (!map.has(key)) {
      map.set(key, { month: key, revenue: 0, orders: 0, _ts: new Date(order.created_at).getTime() })
    }
    const entry = map.get(key)
    entry.revenue += rev
    entry.orders += 1
  }

  return [...map.values()]
    .sort((a, b) => a._ts - b._ts)
    .slice(-12)
    .map(({ _ts, ...rest }) => ({ ...rest, revenue: Math.round(rest.revenue) }))
}

/** Map US state code → region key used by the dashboard */
const REGION_CODE = { NY: 'newYork', CA: 'california', TX: 'texas', FL: 'florida' }
function regionOf(order) {
  const code = order.shipping_address?.province_code || ''
  return REGION_CODE[code] || 'other'
}

const REGION_NAMES = {
  newYork: 'New York', california: 'California',
  texas: 'Texas', florida: 'Florida', other: 'Other States',
}

/** Build regionBreakdown and regionTrend arrays */
function buildRegional(orders) {
  const keys = ['newYork', 'california', 'texas', 'florida', 'other']
  const totRev = Object.fromEntries(keys.map(k => [k, 0]))
  const totOrd = Object.fromEntries(keys.map(k => [k, 0]))
  const monthly = new Map()

  for (const order of orders) {
    const region = regionOf(order)
    const rev = parseFloat(order.subtotal_price) || 0
    totRev[region] += rev
    totOrd[region] += 1

    const mkey = monthKey(order.created_at)
    if (!monthly.has(mkey)) {
      monthly.set(mkey, {
        month: mkey, _ts: new Date(order.created_at).getTime(),
        newYork: 0, california: 0, texas: 0, florida: 0, other: 0,
      })
    }
    monthly.get(mkey)[region] += rev
  }

  const grandTotal = Object.values(totRev).reduce((s, v) => s + v, 0)

  const breakdown = keys.map(k => ({
    region: REGION_NAMES[k],
    revenue: Math.round(totRev[k]),
    orders: totOrd[k],
    pct: grandTotal > 0 ? Math.round((totRev[k] / grandTotal) * 100) : 0,
  }))

  const trend = [...monthly.values()]
    .sort((a, b) => a._ts - b._ts)
    .slice(-12)
    .map(({ _ts, ...rest }) => ({
      ...rest,
      newYork:    Math.round(rest.newYork),
      california: Math.round(rest.california),
      texas:      Math.round(rest.texas),
      florida:    Math.round(rest.florida),
      other:      Math.round(rest.other),
    }))

  return { breakdown, trend }
}

/**
 * Build top products list from order line_items + current inventory from products API.
 * Compares "current period" (last 6 months) vs "previous period" (prior 6 months).
 */
function buildProducts(orders, products) {
  const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000

  const cur = new Map()  // product_id → { title, sku, units, revenue }
  const prev = new Map()

  for (const order of orders) {
    const isCur = new Date(order.created_at).getTime() >= sixMonthsAgo
    const target = isCur ? cur : prev

    for (const item of order.line_items || []) {
      const pid = String(item.product_id)
      if (!target.has(pid)) {
        target.set(pid, { title: item.title, sku: item.sku || '', units: 0, revenue: 0 })
      }
      const e = target.get(pid)
      e.units += item.quantity || 0
      e.revenue += (parseFloat(item.price) || 0) * (item.quantity || 0)
    }
  }

  // Build inventory + launch date lookup from products API
  const invMap = new Map()
  const priceMap = new Map()
  const launchMap = new Map()

  for (const p of products) {
    const pid = String(p.id)
    const inv = (p.variants || []).reduce((s, v) => s + (v.inventory_quantity || 0), 0)
    invMap.set(pid, Math.max(0, inv))
    const firstVariant = p.variants?.[0]
    if (firstVariant) priceMap.set(pid, parseFloat(firstVariant.price) || 0)
    launchMap.set(pid, (p.published_at || p.created_at || '').slice(0, 10))
  }

  const totalRev = [...cur.values()].reduce((s, p) => s + p.revenue, 0)

  return [...cur.entries()]
    .map(([pid, c]) => {
      const p = prev.get(pid) || { units: 0, revenue: 0 }
      return {
        id: `shopify-${pid}`,
        name: c.title,
        sku: c.sku,
        unitsSold:     c.units,
        prevUnitsSold: p.units,
        revenue:     Math.round(c.revenue),
        prevRevenue: Math.round(p.revenue),
        pctOfTotal: totalRev > 0 ? parseFloat(((c.revenue / totalRev) * 100).toFixed(1)) : 0,
        inventory:          invMap.get(pid) ?? 0,
        lowStockThreshold:  20,
        price:    priceMap.get(pid) || 0,
        launchDate: launchMap.get(pid) || null,
        linkedProject: null,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
}

/** Compute current-period totals (AOV, totalOrders, totalRevenue) */
function buildTotals(orders) {
  let totalRevenue = 0
  for (const o of orders) totalRevenue += parseFloat(o.subtotal_price) || 0
  const totalOrders = orders.length
  return {
    totalOrders,
    totalRevenue: Math.round(totalRevenue),
    aov: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
  }
}

/** Build NY-specific customer acquisition and shipping cost KPIs */
function buildNYMetrics(orders) {
  const nyOrders = orders.filter((o) => {
    const code = o.shipping_address?.province_code
    return code === 'NY'
  })

  const uniqueCustomers = new Set()
  let totalShippingCost = 0
  let shippingOrderCount = 0
  let nyRevenue = 0

  for (const o of nyOrders) {
    if (o.customer?.id) uniqueCustomers.add(o.customer.id)
    else if (o.shipping_address?.name) uniqueCustomers.add(o.shipping_address.name)

    nyRevenue += parseFloat(o.subtotal_price) || 0

    // shipping_lines contains actual shipping costs
    for (const sl of o.shipping_lines || []) {
      const cost = parseFloat(sl.price) || 0
      if (cost > 0) {
        totalShippingCost += cost
        shippingOrderCount++
      }
    }
  }

  return {
    nyCustomers: uniqueCustomers.size,
    nyOrders: nyOrders.length,
    nyRevenue: Math.round(nyRevenue),
    nyAvgShippingCost: shippingOrderCount > 0
      ? parseFloat((totalShippingCost / shippingOrderCount).toFixed(2))
      : 0,
    nyTotalShippingCost: Math.round(totalShippingCost),
    nyShippingAsPercentOfRevenue: nyRevenue > 0
      ? parseFloat(((totalShippingCost / nyRevenue) * 100).toFixed(1))
      : 0,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')  return res.status(405).json({ error: 'Method not allowed' })

  const STORE = process.env.SHOPIFY_STORE_URL || 'hokkaidouni.myshopify.com'

  let TOKEN
  try {
    TOKEN = await refreshAccessToken(STORE)
  } catch (refreshErr) {
    // Fall back to stored token if refresh fails
    TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
    if (TOKEN) {
      console.warn('[Shopify] Token refresh failed, using stored token:', refreshErr.message)
    } else {
      return res.status(500).json({
        error: `Token refresh failed and no SHOPIFY_ACCESS_TOKEN fallback is set. ${refreshErr.message}`,
      })
    }
  }

  const API_BASE = `https://${STORE}/admin/api/${API_VERSION}`
  console.log('[Shopify Debug] API_BASE:', API_BASE)
  console.log('[Shopify Debug] TOKEN prefix:', TOKEN?.slice(0, 10))
  const shopHeaders = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  }

  // 13-month window: covers 12 full months of trend data
  const since = new Date()
  since.setMonth(since.getMonth() - 13)

  try {
    const [orders, products] = await Promise.all([
      fetchAllPages(`${API_BASE}/orders.json`, shopHeaders, {
        status: 'any',
        limit: 250,
        created_at_min: since.toISOString(),
        fields: 'id,created_at,subtotal_price,line_items,shipping_address,customer,shipping_lines',
      }),
      fetchAllPages(`${API_BASE}/products.json`, shopHeaders, {
        limit: 250,
        fields: 'id,title,handle,variants,published_at,created_at',
      }),
    ])

    const monthly    = buildMonthly(orders)
    const { breakdown, trend } = buildRegional(orders)
    const topProducts = buildProducts(orders, products)
    const totals     = buildTotals(orders)
    const nyMetrics  = buildNYMetrics(orders)

    return res.status(200).json({
      current: {
        ...totals,
        cvr: null, // CVR requires Shopify Analytics API — kept from dashboard manual entry
      },
      monthlyRevenue:  monthly,
      regionBreakdown: breakdown,
      regionTrend:     trend,
      topProducts,
      nyMetrics,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Shopify Sync Error]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
