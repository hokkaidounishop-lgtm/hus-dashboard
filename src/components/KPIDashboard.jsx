import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Legend,
} from 'recharts'
import {
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
  Edit2, X, Check, CalendarDays, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import TopProducts from './kpi/TopProducts'
import ItemsToWatch from './kpi/ItemsToWatch'
import GA4RealtimePanel from './kpi/GA4RealtimePanel'
import MailchimpPanel from './kpi/MailchimpPanel'
import B2BPanel from './kpi/B2BPanel'
import LevelSystem from './LevelSystem'
import ShopifySyncButton from './ShopifySyncButton'

// ── Date helpers ──────────────────────────────────────────────────────────────

const ABBR = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 }
const M_S  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const M_L  = ['January','February','March','April','May','June',
               'July','August','September','October','November','December']

const parse = (s) => { const [a,y]=s.split(" '"); return new Date(2000+parseInt(y),ABBR[a],1) }
const fmtS  = (d) => `${M_S[d.getMonth()]} ${d.getFullYear()}`
const fmtL  = (d) => `${M_L[d.getMonth()]} ${d.getFullYear()}`

function curFyYear() {
  const n = new Date(); return n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1
}

// ── Filtering ─────────────────────────────────────────────────────────────────

function applyRange(data, key, customStart, customEnd) {
  if (key === 'this1')  return data.slice(-1)
  if (key === 'last1')  return data.slice(-2, -1)
  if (key === 'last3')  return data.slice(-3)
  if (key === 'last6')  return data.slice(-6)
  if (key === 'last12') return data.slice(-12)
  if (key === 'custom') {
    const s = parse(customStart), e = parse(customEnd)
    return data.filter(r => { const d=parse(r.month); return d>=s && d<=e })
  }
  const fy = curFyYear()
  const [sy,ey] = key==='thisFY' ? [fy,fy+1] : [fy-1,fy]
  const start=new Date(sy,3,1), end=new Date(ey,2,31)
  return data.filter(r => { const d=parse(r.month); return d>=start && d<=end })
}

function getCompData(all, current, mode) {
  if (mode === 'none' || !current.length) return []
  const n = current.length
  if (mode === 'prevPeriod') {
    const idx = all.findIndex(r => r.month === current[0].month)
    return idx >= n ? all.slice(idx-n, idx) : []
  }
  if (mode === 'sameLastYear') {
    return current.map(r => {
      const d = parse(r.month); d.setFullYear(d.getFullYear()-1)
      const key = `${M_S[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`
      return all.find(x => x.month===key) ?? null
    }).filter(Boolean)
  }
  return []
}

function agg(data) {
  if (!data.length) return { revenue:0, orders:0, aov:0 }
  const rev = data.reduce((s,d)=>s+d.revenue,0)
  const ord = data.reduce((s,d)=>s+d.orders,0)
  return { revenue:rev, orders:ord, aov: ord>0 ? Math.round(rev/ord) : 0 }
}

// ── Formatters ────────────────────────────────────────────────────────────────

const f$    = (n) => `$${n>=1000 ? (n/1000).toFixed(0)+'K' : n}`
const fFull$= (n) => `$${n.toLocaleString()}`
const pct   = (a,b) => b>0 ? (((a-b)/b)*100).toFixed(1) : null

// ── Brand colors ──────────────────────────────────────────────────────────────

const REGION_COLORS = {
  newYork: '#1a1a18', california: '#2563eb', texas: '#0d9488', florida: '#dc2626', other: '#9b9b94',
}

// ── KPI Card status config ────────────────────────────────────────────────────

function statusColor(val, tgt) {
  const r = val/tgt
  return r>=1 ? 'green' : r>=0.8 ? 'yellow' : 'red'
}

const SS = {
  green:  { borderColor:'rgba(0,0,0,0.08)', badge:{ bg:'#dcfce7', color:'#15803d' }, bar:'#16a34a', text:'#16a34a', icon:CheckCircle,   label:'On Target'    },
  yellow: { borderColor:'rgba(0,0,0,0.08)', badge:{ bg:'#fef3c7', color:'#92400e' }, bar:'#d97706', text:'#d97706', icon:AlertTriangle, label:'Near Target'  },
  red:    { borderColor:'rgba(0,0,0,0.08)', badge:{ bg:'#fee2e2', color:'#b91c1c' }, bar:'#dc2626', text:'#dc2626', icon:TrendingDown,  label:'Below Target' },
}

function CompDelta({ current, comp, prefix='', unit='' }) {
  if (comp == null) return null
  const p = pct(current, comp)
  if (p == null) return null
  const up = Number(p) > 0
  return (
    <div
      className="inline-flex items-center gap-1 text-xs font-medium mt-1"
      style={{ color: up ? '#9b9b94' : '#dc2626' }}
    >
      {up ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
      {prefix}{Math.abs(Number(p)).toFixed(1)}% vs prev
    </div>
  )
}

function KPICard({ label, value, target, unit='', prefix='', description, periodLabel, compValue, compLabel }) {
  const color = statusColor(value, target)
  const s = SS[color]
  const Icon = s.icon
  const p = Math.round((value/target)*100)

  return (
    <div
      className="rounded-lg flex flex-col gap-3"
      style={{
        background: '#ffffff',
        border: `1px solid ${s.borderColor}`,
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: '#9b9b94' }}
          >
            {label}
          </div>
          <div
            className="text-2xl font-bold mt-1.5 leading-none tabular-nums"
            style={{ color: '#1a1a18', fontFamily: "'DM Mono', monospace" }}
          >
            {prefix}{typeof value==='number' ? value.toLocaleString() : value}{unit}
          </div>
          {compValue != null && (
            <CompDelta current={value} comp={compValue} prefix={prefix} unit={unit} />
          )}
          {compValue != null && (
            <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>
              Prev: {prefix}{compValue.toLocaleString()}{unit}
              {compLabel && <span className="ml-1" style={{ color: '#9b9b94' }}>({compLabel})</span>}
            </div>
          )}
          {description && !compValue && (
            <div className="text-xs mt-1" style={{ color: '#9b9b94' }}>{description}</div>
          )}
          {periodLabel && (
            <div
              className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs font-medium"
              style={{ background: '#f0efe9', color: '#9b9b94' }}
            >
              <CalendarDays size={10} className="shrink-0"/>
              {periodLabel}
            </div>
          )}
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
          style={{ background: s.badge.bg, color: s.badge.color }}
        >
          <Icon size={11}/> {s.label}
        </span>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1.5" style={{ color: '#9b9b94' }}>
          <span>Target: {prefix}{target.toLocaleString()}{unit}</span>
          <span style={{ color: s.text }}>{p}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width:`${Math.min(p,100)}%` }} />
        </div>
      </div>
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}
    >
      <div className="font-medium mb-1" style={{ color: '#9b9b94' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name.toLowerCase().includes('revenue') || p.name.toLowerCase().includes('rev')
            ? fFull$(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Controls ─────────────────────────────────────────────────────────────────

const RANGE_OPTS = [
  { key:'this1',  label:'This Month'    },
  { key:'last1',  label:'Last Month'    },
  { key:'last3',  label:'Last 3 Mo.'   },
  { key:'last6',  label:'Last 6 Mo.'   },
  { key:'last12', label:'Last 12 Mo.'  },
  { key:'custom', label:'Custom Range' },
]

const COMP_OPTS = [
  { key:'none',         label:'No Comparison'        },
  { key:'prevPeriod',   label:'Previous Period'       },
  { key:'sameLastYear', label:'Same Period Last Year' },
]

function SegmentedControl({ options, value, onChange }) {
  return (
    <div
      className="flex items-center rounded-lg p-0.5 gap-0.5 flex-wrap"
      style={{ background: '#f0efe9' }}
    >
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
          style={{
            background: value===o.key ? '#ffffff' : 'transparent',
            color: value===o.key ? '#1a1a18' : '#9b9b94',
            boxShadow: value===o.key ? '0 1px 3px rgba(26,18,8,0.10)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Regional Spotlight ────────────────────────────────────────────────────────

function RegionalSpotlight({ kpis, filteredTrend }) {
  const regionColors = [
    '#1a1a18', '#2563eb', '#0d9488', '#dc2626', '#9b9b94',
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
      {/* NY vs States trend */}
      <div
        className="xl:col-span-2 rounded-lg"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
      >
        <div
          className="text-sm font-medium mb-0.5"
          style={{ color: '#1a1a18' }}
        >
          Revenue by Region — Trend
        </div>
        <div
          className="inline-flex items-center gap-1 mb-4 px-2 py-0.5 rounded text-xs font-medium"
          style={{ background: '#f0efe9', color: '#9b9b94' }}
        >
          <CalendarDays size={10}/>
          {filteredTrend.length
            ? `${fmtS(parse(filteredTrend[0].month))} – ${fmtS(parse(filteredTrend[filteredTrend.length-1].month))}`
            : 'No data'}
        </div>
        {filteredTrend.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredTrend} margin={{ top:4,right:4,left:0,bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize:10, fill:'#9b9b94', fontFamily:'DM Mono' }} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={f$} tick={{ fontSize:10, fill:'#9b9b94', fontFamily:'DM Mono' }} axisLine={false} tickLine={false} width={42}/>
              <Tooltip formatter={(v,n)=>[fFull$(v),n]} contentStyle={{ background:'#ffffff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'10px', fontSize:11 }}/>
              <Legend wrapperStyle={{ fontSize:11, color:'#9b9b94' }}/>
              <Line type="monotone" dataKey="newYork"    name="New York"   stroke="#1a1a18" strokeWidth={2.5} dot={false}/>
              <Line type="monotone" dataKey="california" name="California" stroke="#2563eb" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="texas"      name="Texas"      stroke="#0d9488" strokeWidth={2} dot={false} strokeDasharray="4 2"/>
              <Line type="monotone" dataKey="florida"    name="Florida"    stroke="#dc2626" strokeWidth={2} dot={false} strokeDasharray="4 2"/>
              <Line type="monotone" dataKey="other"      name="Other"      stroke="#9b9b94" strokeWidth={1.5} dot={false} strokeDasharray="2 3"/>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm" style={{ color: '#9b9b94' }}>
            No data for selected period
          </div>
        )}
      </div>

      {/* NY city breakdown */}
      <div
        className="rounded-lg"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
      >
        <div
          className="text-sm font-medium mb-0.5"
          style={{ color: '#1a1a18' }}
        >
          New York — City Breakdown
        </div>
        <div className="text-xs mb-4" style={{ color: '#9b9b94' }}>62% of total B2C revenue</div>
        <div className="space-y-3">
          {kpis.nyBreakdown.map((a) => (
            <div key={a.area}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium" style={{ color: '#1a1a18' }}>{a.area}</span>
                <span style={{ color: '#9b9b94' }}>{a.pct}% · {a.orders} orders</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width:`${a.pct}%` }}/>
              </div>
              <div className="text-xs mt-0.5 flex justify-between" style={{ color: '#9b9b94' }}>
                <span>{fFull$(a.revenue)}</span>
                <span>{a.avgFreq}x avg order freq</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="text-xs font-medium mb-2" style={{ color: '#9b9b94' }}>Repeat order rate by state</div>
          {kpis.regionBreakdown.map((r, i) => (
            <div key={r.region} className="flex items-center gap-2 text-xs py-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: regionColors[i] }}/>
              <span className="flex-1" style={{ color: '#9b9b94' }}>{r.region}</span>
              <span style={{ color: '#9b9b94' }}>{r.orders} orders</span>
              <span className="font-medium" style={{ color: '#1a1a18' }}>{r.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function KPIDashboard() {
  const { kpis, updateKpis, setActiveSection } = useApp()

  const allData     = kpis.monthlyRevenue
  const allMonths   = allData.map(r => r.month)
  const [rangeKey,     setRangeKey]     = useState('last12')
  const [compMode,     setCompMode]     = useState('prevPeriod')
  const [customStart,  setCustomStart]  = useState(allMonths[0])
  const [customEnd,    setCustomEnd]    = useState(allMonths[allMonths.length-1])
  const [editing,      setEditing]      = useState(false)
  const [draft,        setDraft]        = useState({})
  const [showCustom,   setShowCustom]   = useState(false)

  const currentData = useMemo(
    () => applyRange(allData, rangeKey, customStart, customEnd),
    [allData, rangeKey, customStart, customEnd]
  )

  const compData = useMemo(
    () => getCompData(allData, currentData, compMode),
    [allData, currentData, compMode]
  )

  const hasComp = compData.length > 0
  const cur = useMemo(() => agg(currentData), [currentData])
  const cmp = useMemo(() => agg(compData),    [compData])

  const chartTitle = useMemo(() => {
    if (!currentData.length) return 'No data'
    const s = fmtS(parse(currentData[0].month))
    const e = fmtS(parse(currentData[currentData.length-1].month))
    if (!hasComp) return `${s} – ${e}`
    const cs = compData.length ? fmtS(parse(compData[0].month)) : null
    const ce = compData.length ? fmtS(parse(compData[compData.length-1].month)) : null
    return cs ? `${s} – ${e}  vs  ${cs} – ${ce}` : `${s} – ${e}`
  }, [currentData, compData, hasComp])

  const periodLabel = useMemo(() => {
    if (!currentData.length) return ''
    const s = fmtS(parse(currentData[0].month))
    const e = fmtS(parse(currentData[currentData.length-1].month))
    return s === e ? s : `${s} – ${e}`
  }, [currentData])

  const latestEntry     = allData[allData.length-1]
  const prevEntry       = allData[allData.length-2]
  const latestMonthFull = fmtL(parse(latestEntry.month))

  const mergedChartData = useMemo(() => {
    return currentData.map((row, i) => ({
      label: row.month,
      revenue: row.revenue,
      orders:  row.orders,
      compRevenue: compData[i]?.revenue ?? null,
      compOrders:  compData[i]?.orders  ?? null,
    }))
  }, [currentData, compData])

  const filteredTrend = useMemo(
    () => applyRange(kpis.regionTrend ?? [], rangeKey, customStart, customEnd),
    [kpis.regionTrend, rangeKey, customStart, customEnd]
  )

  const dataFirst  = parse(allData[0].month)
  const dataLast   = parse(allData[allData.length-1].month)
  const fyCardLabel = `FY ${fmtS(dataFirst)} – ${fmtS(dataLast)}`

  const startEdit = () => { setDraft({...kpis.current}); setEditing(true) }
  const saveEdit  = () => {
    updateKpis({
      cvr:          parseFloat(draft.cvr),
      aov:          parseFloat(draft.aov),
      totalOrders:  parseInt(draft.totalOrders),
      totalRevenue: parseInt(draft.totalRevenue),
    })
    setEditing(false)
  }

  return (
    <div className="space-y-3">

      {/* ── HUS Level System ── */}
      <LevelSystem />

      {/* ── Controls bar ── */}
      <div
        className="rounded-lg space-y-3"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
      >
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9b9b94' }}>Period</span>
            <SegmentedControl options={RANGE_OPTS} value={rangeKey} onChange={(k)=>{setRangeKey(k);setShowCustom(k==='custom')}}/>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ShopifySyncButton />
            {!editing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#9b9b94' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#1a1a18' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9b9b94' }}
              >
                <Edit2 size={13}/> Edit KPIs
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={saveEdit} className="flex items-center gap-1 text-xs" style={{ color: '#1a1a18' }}><Check size={13}/> Save</button>
                <button onClick={()=>setEditing(false)} className="flex items-center gap-1 text-xs" style={{ color: '#9b9b94' }}><X size={13}/> Cancel</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9b9b94' }}>Compare to</span>
          <SegmentedControl options={COMP_OPTS} value={compMode} onChange={setCompMode}/>
          {hasComp && (
            <span className="text-xs italic" style={{ color: '#9b9b94' }}>
              Comparing {currentData.length} vs {compData.length} month{compData.length!==1?'s':''}
            </span>
          )}
          {compMode !== 'none' && !hasComp && currentData.length > 0 && (
            <span className="text-xs" style={{ color: '#1a1a18' }}>No comparison data available for this period</span>
          )}
        </div>
        {showCustom && (
          <div className="flex items-center gap-3 pt-1" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <span className="text-xs" style={{ color: '#9b9b94' }}>From</span>
            <select
              value={customStart}
              onChange={e=>setCustomStart(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-xs"
              style={{ border: '1px solid rgba(0,0,0,0.08)', color: '#1a1a18' }}
            >
              {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-xs" style={{ color: '#9b9b94' }}>to</span>
            <select
              value={customEnd}
              onChange={e=>setCustomEnd(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-xs"
              style={{ border: '1px solid rgba(0,0,0,0.08)', color: '#1a1a18' }}
            >
              {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      {editing ? (
        <div
          className="rounded-lg"
          style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key:'cvr',         label:'CVR (%)',          step:'0.01' },
              { key:'aov',         label:'AOV ($)',          step:'1'    },
              { key:'totalOrders', label:'Total Orders',     step:'1'    },
              { key:'totalRevenue',label:'Total Revenue ($)',step:'100'  },
            ].map(({key,label,step}) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" step={step} value={draft[key]??''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))} className="input" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            label="Conversion Rate"
            value={kpis.current.cvr}
            target={kpis.targets.cvr}
            unit="%"
            description="Site visitors → orders"
            periodLabel={fyCardLabel}
          />
          <KPICard
            label="Avg Order Value"
            value={kpis.current.aov}
            target={kpis.targets.aov}
            prefix="$"
            description="Average per order"
            periodLabel={fyCardLabel}
          />
          <KPICard
            label="Total Orders"
            value={cur.orders || kpis.current.totalOrders}
            target={kpis.targets.totalOrders * Math.max(currentData.length,1)}
            description="Period cumulative"
            periodLabel={periodLabel}
            compValue={hasComp ? cmp.orders : null}
          />
          <KPICard
            label={`${latestMonthFull} Revenue`}
            value={cur.revenue || latestEntry.revenue}
            target={kpis.targets.monthlyRevenue * Math.max(currentData.length,1)}
            prefix="$"
            description={`${((latestEntry.revenue-prevEntry.revenue)/prevEntry.revenue*100).toFixed(1)}% vs ${fmtS(parse(prevEntry.month))}`}
            periodLabel={periodLabel}
            compValue={hasComp ? cmp.revenue : null}
          />
        </div>
      )}

      {/* ── Revenue & Orders chart ── */}
      <div
        className="rounded-lg"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div
              className="text-sm font-medium"
              style={{ color: '#1a1a18' }}
            >
              Monthly Revenue &amp; Orders
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>{chartTitle}</div>
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: '#9b9b94' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded inline-block" style={{ background: '#1a1a18' }}/> Revenue
            </span>
            {hasComp && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block" style={{ background: '#9b9b94' }}/> Prev Revenue
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded inline-block" style={{ background: '#9b9b94' }}/> Orders
            </span>
          </div>
        </div>
        {currentData.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={mergedChartData} barGap={2} barCategoryGap={hasComp ? '20%' : '30%'} margin={{ top:4,right:4,left:0,bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'#9b9b94', fontFamily:'DM Mono' }} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="l" tickFormatter={f$} tick={{ fontSize:10, fill:'#9b9b94', fontFamily:'DM Mono' }} axisLine={false} tickLine={false} width={42}/>
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize:10, fill:'#9b9b94', fontFamily:'DM Mono' }} axisLine={false} tickLine={false} width={32}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Bar yAxisId="l" dataKey="revenue"     name="Revenue"      fill="#1a1a18" radius={[4,4,0,0]} barSize={hasComp?14:18}/>
              {hasComp && <Bar yAxisId="l" dataKey="compRevenue" name="Prev Revenue" fill="#9b9b94" radius={[4,4,0,0]} barSize={14}/>}
              <Line yAxisId="r" type="monotone" dataKey="orders" name="Orders" stroke="#9b9b94" strokeWidth={2} dot={{ r:3, fill:'#9b9b94' }}/>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex flex-col items-center justify-center gap-2" style={{ color: '#9b9b94' }}>
            <CalendarDays size={28}/>
            <div className="text-sm">No data for this period</div>
          </div>
        )}
      </div>

      {/* ── GA4 Live Analytics ── */}
      <div>
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: '#9b9b94', letterSpacing: '0.12em' }}
        >
          Live Analytics
        </h3>
        <GA4RealtimePanel />
      </div>

      {/* ── Email Marketing ── */}
      <div>
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: '#9b9b94', letterSpacing: '0.12em' }}
        >
          Email Marketing
        </h3>
        <MailchimpPanel />
      </div>

      {/* ── B2B Sales ── */}
      <div>
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: '#9b9b94', letterSpacing: '0.12em' }}
        >
          B2B Sales
        </h3>
        <B2BPanel />
      </div>

      {/* ── NY Customer Acquisition KPIs ── */}
      {kpis.nyMetrics && (
        <div>
          <h3
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: '#9b9b94', letterSpacing: '0.12em' }}
          >
            NY Customer Acquisition
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'NY Customers', value: kpis.nyMetrics.nyCustomers?.toLocaleString(), sub: 'Unique buyers' },
              { label: 'NY Orders', value: kpis.nyMetrics.nyOrders?.toLocaleString(), sub: `${((kpis.nyMetrics.nyOrders / kpis.current.totalOrders) * 100).toFixed(0)}% of total` },
              { label: 'NY Revenue', value: `$${(kpis.nyMetrics.nyRevenue || 0).toLocaleString()}`, sub: `${((kpis.nyMetrics.nyRevenue / kpis.current.totalRevenue) * 100).toFixed(0)}% of total` },
              { label: 'Avg Shipping', value: `$${kpis.nyMetrics.nyAvgShippingCost}`, sub: 'Per NY order' },
              { label: 'Shipping % of Rev', value: `${kpis.nyMetrics.nyShippingAsPercentOfRevenue}%`, sub: `$${(kpis.nyMetrics.nyTotalShippingCost || 0).toLocaleString()} total`, alert: kpis.nyMetrics.nyShippingAsPercentOfRevenue > 5 },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg"
                style={{
                  background: '#ffffff',
                  border: `1px solid ${card.alert ? '#fee2e2' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div className="text-xs font-medium uppercase tracking-wide" style={{ color: '#9b9b94' }}>
                  {card.label}
                </div>
                <div
                  className="text-xl font-bold mt-1 tabular-nums"
                  style={{ color: card.alert ? '#dc2626' : '#1a1a18', fontFamily: "'DM Mono', monospace" }}
                >
                  {card.value}
                </div>
                {card.sub && <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>{card.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Regional Spotlight ── */}
      <div>
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: '#9b9b94', letterSpacing: '0.12em' }}
        >
          Regional Spotlight
        </h3>
        <RegionalSpotlight kpis={kpis} filteredTrend={filteredTrend}/>
      </div>

      {/* ── Top Products + Items to Watch ── */}
      <div>
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: '#9b9b94', letterSpacing: '0.12em' }}
        >
          Product Intelligence
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <TopProducts onNavigateToProject={()=>setActiveSection('projects')}/>
          <ItemsToWatch onNavigate={setActiveSection}/>
        </div>
      </div>

      {/* ── CVR alert banner ── */}
      {kpis.current.cvr < kpis.targets.cvr && (
        <div
          className="rounded-lg flex items-start gap-3"
          style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderLeft: '3px solid #dc2626', borderRadius: 12, padding: '14px 16px' }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#dc2626' }}/>
          <div>
            <div className="text-sm font-semibold" style={{ color: '#dc2626' }}>CVR Critical Alert</div>
            <div className="text-xs mt-0.5" style={{ color: '#9b9b94' }}>
              CVR is <strong style={{ color: '#1a1a18' }}>{kpis.current.cvr}%</strong> — {((kpis.current.cvr/kpis.targets.cvr)*100).toFixed(0)}% of the{' '}
              <strong style={{ color: '#1a1a18' }}>{kpis.targets.cvr}%</strong> target. Immediate action needed on checkout UX audit and A/B test framework.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
