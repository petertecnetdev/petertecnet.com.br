import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { connectMissionControlRealtime } from './missionControlRealtime.js'
import { ADMIN_TOKEN_KEY, useAdminAuth } from './adminAuth.js'
import { AdminDataContext } from './adminData.js'

const CACHE_KEY = 'petertecnet_admin_data_cache_v2'
const CACHE_TTL_MS = 120000

const ENDPOINTS = {
  dashboard: '/admin/ecosystem/dashboard',
  activity: '/admin/ecosystem/activity',
  financial: '/admin/ecosystem/financial/dashboard',
  command: '/admin/ecosystem/command/overview',
  applications: '/admin/applications',
  support: '/admin/support/summary',
  telemetry: '/admin/ecosystem/telemetry/health',
  journeys: '/admin/ecosystem/telemetry/journeys?limit=12',
  orders: '/admin/ecosystem/financial/orders?per_page=1&page=1',
}

function emptyData() {
  return { dashboard: null, activity: null, financial: null, command: null, applications: [], support: null, telemetry: null, journeys: null, orders: null }
}

function normalize(key, payload) {
  if (key === 'applications') return payload?.applications || payload?.data || (Array.isArray(payload) ? payload : [])
  if (key === 'support') return payload?.summary || payload || null
  return payload
}

function readCache() {
  try {
    const payload = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    if (!payload?.storedAt || Date.now() - payload.storedAt > CACHE_TTL_MS) return null
    return payload
  } catch {
    return null
  }
}

function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ storedAt: Date.now(), data })) } catch { /* storage unavailable */ }
}

export function AdminDataProvider({ children }) {
  const { isAuthenticated, request, bootstrapDashboard } = useAdminAuth()
  const cached = useMemo(() => readCache(), [])
  const [data, setData] = useState(() => cached?.data || emptyData())
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(Boolean(!cached && isAuthenticated))
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(cached?.storedAt ? new Date(cached.storedAt) : null)
  const [realtimeState, setRealtimeState] = useState('idle')
  const realtimeStateRef = useRef('idle')
  const requestSequence = useRef(0)
  const refreshTimer = useRef(null)
  const [lastSeenAt] = useState(() => localStorage.getItem('petertecnet_admin_last_seen_at') || '')

  const loadKeys = useCallback(async (keys, { quiet = false } = {}) => {
    if (!isAuthenticated) return
    const sequence = ++requestSequence.current
    if (quiet) setRefreshing(true)
    else setLoading(true)

    const nextErrors = {}
    const settled = await Promise.allSettled(keys.map(key => request(ENDPOINTS[key])))
    if (sequence !== requestSequence.current) return

    setData(current => {
      const next = { ...current }
      settled.forEach((result, index) => {
        const key = keys[index]
        if (result.status === 'fulfilled') next[key] = normalize(key, result.value)
        else nextErrors[key] = result.reason?.message || 'Fonte indisponível.'
      })
      writeCache(next)
      return next
    })
    setErrors(current => {
      const next = { ...current }
      keys.forEach(key => delete next[key])
      return { ...next, ...nextErrors }
    })
    setUpdatedAt(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [isAuthenticated, request])

  const refresh = useCallback((options = {}) => loadKeys(Object.keys(ENDPOINTS), options), [loadKeys])
  const retry = useCallback(key => ENDPOINTS[key] ? loadKeys([key], { quiet: true }) : Promise.resolve(), [loadKeys])

  useEffect(() => {
    if (!isAuthenticated) {
      requestSequence.current += 1
      return
    }

    if (bootstrapDashboard) {
      setData(current => ({ ...current, dashboard: bootstrapDashboard }))
    }

    const keys = Object.keys(ENDPOINTS).filter(key => !(key === 'dashboard' && bootstrapDashboard))
    void loadKeys(keys, { quiet: Boolean(cached) })
  }, [isAuthenticated, bootstrapDashboard, loadKeys, cached])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let fallback = null

    const queueRefresh = () => {
      window.clearTimeout(refreshTimer.current)
      refreshTimer.current = window.setTimeout(() => void refresh({ quiet: true }), 350)
    }

    const disconnect = connectMissionControlRealtime({
      token: () => localStorage.getItem(ADMIN_TOKEN_KEY),
      events: ['ecosystem.updated'],
      onUpdate: queueRefresh,
      onState: state => { realtimeStateRef.current = state; setRealtimeState(state) },
    })

    fallback = window.setInterval(() => {
      if (document.visibilityState === 'visible' && realtimeStateRef.current !== 'connected') queueRefresh()
    }, 60000)

    const visible = () => { if (document.visibilityState === 'visible') queueRefresh() }
    document.addEventListener('visibilitychange', visible)
    return () => {
      disconnect?.()
      window.clearInterval(fallback)
      window.clearTimeout(refreshTimer.current)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [isAuthenticated, refresh])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    const markSeen = () => localStorage.setItem('petertecnet_admin_last_seen_at', new Date().toISOString())
    window.addEventListener('pagehide', markSeen)
    return () => {
      window.removeEventListener('pagehide', markSeen)
      markSeen()
    }
  }, [isAuthenticated])

  const value = useMemo(() => ({
    data,
    errors,
    loading,
    refreshing,
    updatedAt,
    realtimeState,
    lastSeenAt,
    refresh,
    retry,
  }), [data, errors, loading, refreshing, updatedAt, realtimeState, lastSeenAt, refresh, retry])

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}
