import { useContext, useEffect, useRef } from 'react'
import { connectMissionControlRealtime } from '../missionControlRealtime.js'
import { AdminUiContext } from './AdminUiState.js'

const TOKEN_KEY = 'token'
const REALTIME_EVENT = 'ecosystem.updated'
const FALLBACK_INTERVAL_MS = 15000
const REFRESH_DEBOUNCE_MS = 300
const LEGACY_MODULES = new Set([
  'dashboard',
  'activity',
  'applications',
  'users',
  'profiles',
  'establishments',
  'items',
  'site',
  'audit',
])

function findRefreshButton() {
  return [...document.querySelectorAll('.ecosystem-top .top-actions button')]
    .find(button => button.textContent?.trim() === 'Atualizar') || null
}

function refreshLegacyWorkspace() {
  const button = findRefreshButton()
  if (!button || button.disabled) return false

  const hadIgnore = button.hasAttribute('data-telemetry-ignore')
  if (!hadIgnore) button.setAttribute('data-telemetry-ignore', 'realtime-refresh')

  try {
    button.click()
  } finally {
    if (!hadIgnore) button.removeAttribute('data-telemetry-ignore')
  }

  return true
}

export default function AdminRealtimeBridge() {
  const ui = useContext(AdminUiContext)
  const activeTabRef = useRef(ui?.activeTab || 'command')
  const dirtyModulesRef = useRef(new Set())
  const refreshTimerRef = useRef(null)
  const fallbackTimerRef = useRef(null)

  const scheduleRefresh = module => {
    if (!LEGACY_MODULES.has(module) || document.visibilityState !== 'visible') return
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      if (activeTabRef.current !== module) return
      if (refreshLegacyWorkspace()) dirtyModulesRef.current.delete(module)
    }, REFRESH_DEBOUNCE_MS)
  }

  const stopFallbackPolling = () => {
    if (!fallbackTimerRef.current) return
    window.clearInterval(fallbackTimerRef.current)
    fallbackTimerRef.current = null
  }

  const startFallbackPolling = () => {
    if (fallbackTimerRef.current) return
    fallbackTimerRef.current = window.setInterval(() => {
      const active = activeTabRef.current
      if (LEGACY_MODULES.has(active) && document.visibilityState === 'visible') {
        refreshLegacyWorkspace()
      }
    }, FALLBACK_INTERVAL_MS)
  }

  useEffect(() => {
    const next = ui?.activeTab || 'command'
    activeTabRef.current = next
    if (dirtyModulesRef.current.has(next)) scheduleRefresh(next)
  }, [ui?.activeTab])

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return undefined

    const stop = connectMissionControlRealtime({
      token,
      events: [REALTIME_EVENT],
      onState: state => {
        if (state === 'connected') stopFallbackPolling()
        else if (state === 'fallback') startFallbackPolling()
      },
      onUpdate: (payload, eventName) => {
        if (eventName !== REALTIME_EVENT) return
        const modules = Array.isArray(payload?.modules) ? payload.modules : []
        modules.forEach(module => {
          if (LEGACY_MODULES.has(module)) dirtyModulesRef.current.add(module)
        })

        const active = activeTabRef.current
        if (dirtyModulesRef.current.has(active)) scheduleRefresh(active)
      },
    })

    const onVisibility = () => {
      const active = activeTabRef.current
      if (document.visibilityState === 'visible' && dirtyModulesRef.current.has(active)) {
        scheduleRefresh(active)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      stopFallbackPolling()
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
