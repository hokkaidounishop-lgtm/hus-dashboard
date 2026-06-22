import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import kpisData from '../data/kpis.json'
import projectsData from '../data/projects.json'
import tasksData from '../data/tasks.json'
import calendarData from '../data/calendar.json'
import {
  loadTasks, persistTask, softDeleteTask,
  loadProjects, persistProject, softDeleteProject,
} from '../api/supabase'
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

  // Load the live task list from Supabase (single source of truth) on mount.
  // The bundled tasks.json is only the first-paint seed / offline fallback —
  // when Supabase returns rows, they replace it wholesale so MCP-created tasks,
  // edits, and deletions all reflect here. Falls back to the bundle when
  // Supabase is unconfigured, unreachable, or the table is empty.
  useEffect(() => {
    loadTasks().then((live) => {
      if (live && live.length > 0) setTasks(live)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the live project list from Supabase (single source of truth) on mount,
  // same contract as tasks: the bundled projects.json is only the first-paint
  // seed / offline fallback. Falls back to the bundle when Supabase is
  // unconfigured, unreachable, or the table is empty.
  useEffect(() => {
    loadProjects().then((live) => {
      if (live && live.length > 0) setProjects(live)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Projects CRUD ──────────────────────────────────────────────────────────
  const addProject = (project) => {
    const newProject = { ...project, id: `proj-${Date.now()}` }
    setProjects((prev) => [...prev, newProject])
    persistProject(newProject) // full row → Supabase (single source of truth)
  }

  const updateProject = (id, updates) => {
    let merged = null
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        merged = { ...p, ...updates }
        return merged
      })
    )
    if (merged) persistProject(merged) // persist the full updated row
  }

  const deleteProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    softDeleteProject(id) // soft-delete in Supabase so it vanishes everywhere
  }

  // ── Tasks CRUD ─────────────────────────────────────────────────────────────
  const addTask = (task) => {
    const newTask = {
      ...task,
      id: `task-${Date.now()}`,
      pdcaUpdatedAt: new Date().toISOString().slice(0, 10),
    }
    setTasks((prev) => [...prev, newTask])
    persistTask(newTask) // full row → Supabase (single source of truth)
  }

  const updateTask = (id, updates) => {
    let merged = null
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const pdcaUpdatedAt =
          updates.pdca && updates.pdca !== t.pdca
            ? new Date().toISOString().slice(0, 10)
            : t.pdcaUpdatedAt
        merged = { ...t, ...updates, pdcaUpdatedAt }
        return merged
      })
    )
    // Persist the full updated row so every reader sees it after a deploy.
    if (merged) persistTask(merged)
  }

  const deleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    softDeleteTask(id) // soft-delete in Supabase so it vanishes everywhere
  }

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
