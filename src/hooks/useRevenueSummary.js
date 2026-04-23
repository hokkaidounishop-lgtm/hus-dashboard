/**
 * useRevenueSummary — shared data source for Cockpit's Revenue Command
 * summary card AND the full `/revenue` page.
 *
 * Resolution order:
 *   - B2C             ← Shopify sync (`kpis.currentMonth.mtd`)
 *   - B2B             ← Freshline (pending — always null for now)
 *   - Export          ← Supabase `revenue_manual.export_amount`
 *   - Broker / Spot   ← Supabase `revenue_manual.broker_amount` + `tuna_show_amount`
 *
 * CVR/AOV + their targets come from `kpis.json` (CVR is manual, AOV is
 * Shopify-refreshed). Monthly target comes from `kpis.targets.monthlyRevenue`.
 *
 * Returned status reflects the Shopify sync first (because it drives B2C —
 * the largest channel). Manual-source errors degrade gracefully: the hook
 * still returns whatever B2C has, and callers can show a "sync pending"
 * hint for the null-valued channels.
 *
 * Step 6 · C1 — replaces the hard-coded mock `revenueSummary` /
 * `revenueBreakdown` constants that the Cockpit summary card was using.
 */
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { currentPeriodKey, loadRevenueManual } from '../api/revenueManual'

const NULL_MANUAL = {
  export_amount:    null,
  broker_amount:    null,
  tuna_show_amount: null,
}

export function useRevenueSummary() {
  const { kpis, shopifySync } = useApp()

  const [period] = useState(currentPeriodKey())
  const [manual, setManual] = useState(NULL_MANUAL)
  const [manualStatus, setManualStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false
    loadRevenueManual(period)
      .then((data) => {
        if (cancelled) return
        setManual({
          export_amount:    data?.export_amount    ?? null,
          broker_amount:    data?.broker_amount    ?? null,
          tuna_show_amount: data?.tuna_show_amount ?? null,
        })
        setManualStatus('ready')
      })
      .catch(() => {
        // Table may be missing in Supabase — fall through without blocking B2C.
        if (cancelled) return
        setManualStatus('error')
      })
    return () => { cancelled = true }
  }, [period])

  return useMemo(() => {
    const cm        = kpis?.currentMonth || {}
    const b2cMtd    = cm.mtd ?? null
    const b2bMtd    = null // Freshline pending
    const exportAmt = manual.export_amount
    // Broker slot in the summary rolls up spot + tuna show, since the Cockpit
    // pane doesn't have room for four distinct manual rows; `/revenue` still
    // breaks them out separately.
    const brokerRollup =
      (manual.broker_amount ?? 0) + (manual.tuna_show_amount ?? 0) || null

    const now         = new Date()
    const day         = now.getDate()
    const daysInMonth =
      cm.daysInMonth ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const knownChannels = [b2cMtd, b2bMtd, exportAmt, brokerRollup]
    const mtdSales = knownChannels
      .filter((v) => v != null)
      .reduce((sum, v) => sum + Number(v), 0)

    const forecast =
      day > 0 && mtdSales > 0 ? Math.round((mtdSales / day) * daysInMonth) : null

    const target = kpis?.targets?.monthlyRevenue ?? null

    // Deltas currently track Shopify (B2C) only — the channel with LM/LY anchors.
    const deltaVsLastMonth =
      b2cMtd && cm.lastMonthToSameDay
        ? ((b2cMtd - cm.lastMonthToSameDay) / cm.lastMonthToSameDay) * 100
        : null

    let deltaVsLastYear = null
    if (b2cMtd && cm.lastYearSameMonth) {
      const lyToPoint = (cm.lastYearSameMonth / daysInMonth) * day
      if (lyToPoint > 0) {
        deltaVsLastYear = ((b2cMtd - lyToPoint) / lyToPoint) * 100
      }
    }

    const channels = [
      { key: 'B2C',    label: 'B2C',           amount: b2cMtd,       source: b2cMtd != null ? 'auto' : 'pending' },
      { key: 'B2B',    label: 'B2B',           amount: b2bMtd,       source: 'pending' },
      { key: 'Export', label: 'Export',        amount: exportAmt,    source: 'manual'  },
      { key: 'Broker', label: 'Broker / Spot', amount: brokerRollup, source: 'manual'  },
    ]

    const breakdown = channels.map((c) => ({
      ...c,
      share: mtdSales > 0 && c.amount ? c.amount / mtdSales : 0,
    }))

    const status =
      shopifySync?.loading                  ? 'loading'
      : shopifySync?.error                  ? 'error'
      : shopifySync?.lastSync               ? 'synced'
      : manualStatus === 'loading'          ? 'loading'
                                            : 'pending'

    return {
      // Totals
      mtdSales: mtdSales || null,
      forecast,
      target,
      deltaVsLastMonth,
      deltaVsLastYear,
      // Channel mix (always 4 rows, nulls preserved for "pending" chips)
      breakdown,
      // CVR / AOV (come straight from kpis.json; CVR is manual, AOV is Shopify)
      cvr:       kpis?.current?.cvr ?? null,
      cvrTarget: kpis?.targets?.cvr ?? null,
      aov:       kpis?.current?.aov ?? null,
      aovTarget: kpis?.targets?.aov ?? null,
      // Sync meta
      status,
      syncedAt:  shopifySync?.lastSync ?? null,
      error:
        shopifySync?.error ??
        (manualStatus === 'error' ? 'manual-source-unavailable' : null),
    }
  }, [kpis, manual, manualStatus, shopifySync])
}

export default useRevenueSummary
