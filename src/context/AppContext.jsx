import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import kpisData from '../data/kpis.json'
import projectsData from '../data/projects.json'
import tasksData from '../data/tasks.json'
import calendarData from '../data/calendar.json'
import { loadTaskStatuses, persistTaskStatus } from '../api/supabase'
import { syncFromShopify } from '../api/shopify'

const AppContext = createContext(null)

// ── Module-level setter registry ─────────────────────────────────────────────
// Holds stable useState setter references so the HMR handler (outside React)
// can push new data directly into state without a page reload.
const _s = { setKpis: null, setProjects: null, setTasks: null, setEvents: null }

// ── HMR handler (runs once at module scope in dev mode) ───────────────────────
// The Vite plugin (hus-data-hmr) sends the full file content in the event
// payload, so no extra fetch is needed.
if (import.meta.hot) {
  import.meta.hot.on('hus:data-update', ({ file, content }) => {
    try {
      const data = JSON.parse(content)
      const name = file.replace('.json', '')

      if      (name === 'kpis'     && _s.setKpis)     _s.setKpis(data)
      else if (name === 'projects' && _s.setProjects)  _s.setProjects(data)
      else if (name === 'tasks'    && _s.setTasks)     _s.setTasks(data)
      else if (name === 'calendar' && _s.setEvents)    _s.setEvents(data)
    } catch (e) {
      console.error('[HUS HMR] Failed to apply data update:', e)
    }
  })
}

export function AppProvider({ children }) {
  const [kpis,     setKpis]     = useState(kpisData)
  const [projects, setProjects] = useState(projectsData)
  const [tasks,    setTasks]    = useState(tasksData)
  const [events,   setEvents]   = useState(calendarData)
  const [activeSection, setActiveSection] = useState('briefing')

  // Register setters into the module-level registry on mount.
  // useState setters are stable (same reference forever), so this only runs once.
  useEffect(() => {
    _s.setKpis     = setKpis
    _s.setProjects = setProjects
    _s.setTasks    = setTasks
    _s.setEvents   = setEvents
    return () => {
      _s.setKpis = _s.setProjects = _s.setTasks = _s.setEvents = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Merge Supabase task status overrides on mount (production persistence)
  useEffect(() => {
    loadTaskStatuses().then((overrides) => {
      if (overrides.size === 0) return
      setTasks((prev) =>
        prev.map((t) => {
          const o = overrides.get(t.id)
          if (!o) return t
          return {
            ...t,
            status: o.status,
            ...(o.completedAt ? { completedAt: o.completedAt } : {}),
            ...(o.pdca ? { pdca: o.pdca, pdcaUpdatedAt: o.pdcaUpdatedAt } : {}),
          }
        })
      )
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Projects CRUD ──────────────────────────────────────────────────────────
  const addProject = (project) =>
    setProjects((prev) => [...prev, { ...project, id: `proj-${Date.now()}` }])

  const updateProject = (id, updates) =>
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))

  const deleteProject = (id) =>
    setProjects((prev) => prev.filter((p) => p.id !== id))

  // ── Tasks CRUD ─────────────────────────────────────────────────────────────
  const addTask = (task) =>
    setTasks((prev) => [
      ...prev,
      { ...task, id: `task-${Date.now()}`, pdcaUpdatedAt: new Date().toISOString().slice(0, 10) },
    ])

  const updateTask = (id, updates) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const pdcaUpdatedAt =
          updates.pdca && updates.pdca !== t.pdca
            ? new Date().toISOString().slice(0, 10)
            : t.pdcaUpdatedAt
        return { ...t, ...updates, pdcaUpdatedAt }
      })
    )
    // Persist status/pdca changes to Supabase
    if (updates.status || updates.pdca) {
      const extras = {}
      if (updates.pdca) {
        extras.pdca = updates.pdca
        extras.pdca_updated_at = new Date().toISOString().slice(0, 10)
      }
      const status = updates.status
      if (status) {
        persistTaskStatus(id, status, extras)
      } else {
        // pdca-only change: read current status from state
        const current = tasks.find((t) => t.id === id)
        if (current) persistTaskStatus(id, current.status, extras)
      }
    }
  }

  const deleteTask = (id) =>
    setTasks((prev) => prev.filter((t) => t.id !== id))

  // ── Calendar Events CRUD ───────────────────────────────────────────────────
  const addEvent = (event) =>
    setEvents((prev) => [...prev, { ...event, id: `evt-${Date.now()}` }])

  const updateEvent = (id, updates) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))

  const deleteEvent = (id) =>
    setEvents((prev) => prev.filter((e) => e.id !== id))

  // ── KPI updates ────────────────────────────────────────────────────────────
  const updateKpis = (updates) =>
    setKpis((prev) => ({ ...prev, current: { ...prev.current, ...updates } }))

  // ── Shopify live data replace ───────────────────────────────────────────────
  // Called after a successful /api/shopify/sync. Merges live data while
  // preserving targets and any fields Shopify can't provide (e.g. CVR).
  const replaceKpiData = useCallback((shopifyData) =>
    setKpis((prev) => ({
      ...prev,
      ...(shopifyData.monthlyRevenue  ? { monthlyRevenue:  shopifyData.monthlyRevenue  } : {}),
      ...(shopifyData.regionBreakdown ? { regionBreakdown: shopifyData.regionBreakdown } : {}),
      ...(shopifyData.regionTrend     ? { regionTrend:     shopifyData.regionTrend     } : {}),
      ...(shopifyData.topProducts     ? { topProducts:     shopifyData.topProducts     } : {}),
      ...(shopifyData.nyMetrics       ? { nyMetrics:       shopifyData.nyMetrics       } : {}),
      ...(shopifyData.currentMonth    ? { currentMonth:    shopifyData.currentMonth    } : {}),
      current: {
        ...prev.current,
        ...shopifyData.current,
        cvr: shopifyData.current?.cvr ?? prev.current.cvr,
      },
    })), [])

  // ── Shopify sync state (global) ────────────────────────────────────────────
  const [shopifySync, setShopifySync] = useState({
    loading: false,
    error: null,
    lastSync: (() => {
      const stored = localStorage.getItem('hus:shopify-last-sync')
      return stored ? new Date(stored) : null
    })(),
  })
  const shopifySyncIntervalRef = useRef(null)

  const SIX_HOURS = 6 * 60 * 60 * 1000

  const syncShopify = useCallback(async () => {
    setShopifySync((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await syncFromShopify()
      replaceKpiData(data)
      const now = new Date()
      setShopifySync({ loading: false, error: null, lastSync: now })
      localStorage.setItem('hus:shopify-last-sync', now.toISOString())
    } catch (err) {
      setShopifySync((s) => ({ ...s, loading: false, error: err.message }))
    }
  }, [replaceKpiData])

  const dismissShopifyError = useCallback(() => {
    setShopifySync((s) => ({ ...s, error: null }))
  }, [])

  // Auto-sync every 6 hours
  useEffect(() => {
    const shouldAutoSync =
      !shopifySync.lastSync || (Date.now() - shopifySync.lastSync.getTime()) > SIX_HOURS
    if (shouldAutoSync) syncShopify()

    shopifySyncIntervalRef.current = setInterval(syncShopify, SIX_HOURS)
    return () => {
      if (shopifySyncIntervalRef.current) clearInterval(shopifySyncIntervalRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider
      value={{
        kpis,
        projects,
        tasks,
        events,
        activeSection,
        setActiveSection,
        addProject,
        updateProject,
        deleteProject,
        addTask,
        updateTask,
        deleteTask,
        addEvent,
        updateEvent,
        deleteEvent,
        updateKpis,
        replaceKpiData,
        shopifySync,
        syncShopify,
        dismissShopifyError,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
