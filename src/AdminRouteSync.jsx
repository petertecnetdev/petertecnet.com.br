import { useEffect } from 'react'
import { adminTabFromLocation, normalizeAdminPath } from './admin/AdminNavigationConfig.js'
import { requestAdminNavigation } from './admin/AdminUiEvents.js'

const ROUTABLE_PATHS = new Set([
  '/admin/mission-control',
  '/admin/overview',
  '/admin/dashboard',
  '/admin/activity',
  '/admin/financial',
  '/admin/applications',
  '/admin/users',
  '/admin/profiles',
  '/admin/establishments',
  '/admin/items',
  '/admin/site',
  '/admin/audit',
])

export default function AdminRouteSync() {
  useEffect(() => {
    const path = normalizeAdminPath(window.location.pathname)
    if (path === '/admin') return undefined

    const isDetailRoute = /^\/admin\/(users|establishments|items)\/\d+$/.test(path)
    const isMissionRoute = /^\/admin\/mission-control\/(incidents|security|queues|search)$/.test(path)
    if (!ROUTABLE_PATHS.has(path) && !isDetailRoute && !isMissionRoute) return undefined

    const timer = window.setTimeout(() => {
      requestAdminNavigation(adminTabFromLocation(path), { preservePath: true })
    }, 120)

    return () => window.clearTimeout(timer)
  }, [])

  return null
}
