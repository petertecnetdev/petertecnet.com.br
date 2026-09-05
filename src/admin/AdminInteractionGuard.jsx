import { useEffect } from 'react'
import { ADMIN_NAVIGATION_CHANGED_EVENT } from './AdminUiEvents.js'
import { ADMIN_INTERACTION_GUARD_VERSION, repairAdminInteractionState } from './adminInteractionSafety.js'
import './AdminInteractionGuard.css'

export default function AdminInteractionGuard() {
  useEffect(() => {
    let frame = 0
    const scheduleRepair = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => repairAdminInteractionState())
    }

    const onVisibility = () => {
      if (!document.hidden) scheduleRepair()
    }

    repairAdminInteractionState()
    window.__PETER_ADMIN_INTERACTION_GUARD__ = Object.freeze({
      version: ADMIN_INTERACTION_GUARD_VERSION,
      repair: repairAdminInteractionState,
    })

    const observer = new MutationObserver(scheduleRepair)
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('pageshow', scheduleRepair)
    window.addEventListener('popstate', scheduleRepair)
    window.addEventListener('resize', scheduleRepair)
    window.addEventListener('orientationchange', scheduleRepair)
    window.addEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, scheduleRepair)
    document.addEventListener('visibilitychange', onVisibility)

    // A low-frequency safety pass handles BFCache, browser extensions and
    // third-party scripts that can change interaction-affecting attributes
    // without inserting/removing DOM nodes.
    const interval = window.setInterval(() => {
      if (!document.hidden) repairAdminInteractionState()
    }, 2000)

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      window.clearInterval(interval)
      window.removeEventListener('pageshow', scheduleRepair)
      window.removeEventListener('popstate', scheduleRepair)
      window.removeEventListener('resize', scheduleRepair)
      window.removeEventListener('orientationchange', scheduleRepair)
      window.removeEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, scheduleRepair)
      document.removeEventListener('visibilitychange', onVisibility)
      document.body.classList.remove('admin-interaction-guard-active')
      if (window.__PETER_ADMIN_INTERACTION_GUARD__?.version === ADMIN_INTERACTION_GUARD_VERSION) {
        delete window.__PETER_ADMIN_INTERACTION_GUARD__
      }
    }
  }, [])

  return null
}
