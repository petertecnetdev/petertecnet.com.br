import { useEffect } from 'react'
import { adminTabFromLocation, isLegacyAdminTab, normalizeAdminPath } from './admin/AdminNavigationConfig.js'
import { requestAdminNavigation } from './admin/AdminUiEvents.js'

export default function AdminRouteSync() {
  useEffect(() => {
    const path = normalizeAdminPath(window.location.pathname)
    const key = adminTabFromLocation(path)
    if (!isLegacyAdminTab(key)) return undefined

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        requestAdminNavigation(key, { preservePath: true })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [])

  return null
}
