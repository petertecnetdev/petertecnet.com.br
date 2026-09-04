import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ADMIN_LEGACY_DOM_ORDER,
  ADMIN_TABS,
  ADMIN_TAB_BY_KEY,
  adminTabFromLocation,
  adminTabLabel,
  adminTabPath,
  isLegacyAdminTab,
  normalizeAdminPath,
} from './AdminNavigationConfig.js'
import {
  ADMIN_BEFORE_NAVIGATE_EVENT,
  ADMIN_NAVIGATE_EVENT,
  ADMIN_NAVIGATION_CHANGED_EVENT,
} from './AdminUiEvents.js'
import { AdminUiContext } from './AdminUiState.js'

const AUXILIARY_NAV_SELECTOR = '.admin-home-nav-button, [data-pto-onboarding], [data-admin-aux-nav]'

function clearNavigationMetadata(button) {
  delete button.dataset.adminTab
  delete button.dataset.icon
  delete button.dataset.group
  delete button.dataset.groupStart
}

function annotateLegacyNavigation(nav) {
  if (!nav || nav.closest('.admin-persistent-sidebar')) return

  const buttons = [...nav.querySelectorAll('button')].filter(button => !button.matches(AUXILIARY_NAV_SELECTOR))
  let previousGroup = ''

  buttons.forEach((button, index) => {
    const item = ADMIN_TAB_BY_KEY[ADMIN_LEGACY_DOM_ORDER[index]]
    if (!item) {
      clearNavigationMetadata(button)
      return
    }

    button.dataset.adminTab = item.key
    button.dataset.icon = item.icon
    button.dataset.group = item.group
    button.setAttribute('aria-label', item.label)

    if (item.group !== previousGroup) button.dataset.groupStart = item.group
    else delete button.dataset.groupStart
    previousGroup = item.group
  })

  nav.dataset.adminLegacyNavigation = 'true'
  nav.setAttribute('aria-label', 'Navegação interna do workspace administrativo')
}

function annotateNavigation() {
  const navs = [...document.querySelectorAll('.ecosystem-sidebar nav')]
  navs.forEach(annotateLegacyNavigation)
  return navs
}

function clickLegacyTabButton(key) {
  annotateNavigation()
  const button = document.querySelector(`nav[data-admin-legacy-navigation="true"] button[data-admin-tab="${key}"]`)
  if (!button) return { found: false, clicked: false }
  if (button.classList.contains('active')) return { found: true, clicked: false }

  // The hidden legacy workspace still owns its React tab state. Trigger that
  // state transition normally, then let the canonical router normalize the URL.
  // Avoid replacing History.pushState at runtime: browsers/extensions may reject
  // that mutation and leave the Admin Center navigation in a broken state.
  button.click()
  return { found: true, clicked: true }
}

function announceNavigation(item, source = 'programmatic') {
  document.title = `${item.label} · Admin Center · Peter Tecnet`
  window.dispatchEvent(new CustomEvent(ADMIN_NAVIGATION_CHANGED_EVENT, {
    detail: { key: item.key, label: item.label, path: adminTabPath(item.key), source },
  }))
}

export default function AdminUiProvider({ children }) {
  const [activeTab, setActiveTab] = useState(() => adminTabFromLocation())

  const syncFromLocation = useCallback((source = 'location') => {
    const key = adminTabFromLocation()
    const item = ADMIN_TAB_BY_KEY[key] || ADMIN_TABS[0]
    setActiveTab(item.key)
    if (isLegacyAdminTab(item.key)) {
      window.requestAnimationFrame(() => {
        const transition = clickLegacyTabButton(item.key)
        const targetPath = normalizeAdminPath(adminTabPath(item.key))
        if (transition.clicked && normalizeAdminPath(window.location.pathname) !== targetPath) {
          window.history.replaceState({ adminTab: item.key }, '', targetPath)
        }
      })
    }
    announceNavigation(item, source)
    return item.key
  }, [])

  const navigate = useCallback((key, { replace = false, preservePath = false } = {}) => {
    const item = ADMIN_TAB_BY_KEY[key] || ADMIN_TABS[0]
    const currentPath = normalizeAdminPath(window.location.pathname)
    const nextPath = normalizeAdminPath(adminTabPath(item.key))

    window.dispatchEvent(new CustomEvent(ADMIN_BEFORE_NAVIGATE_EVENT, {
      detail: { from: currentPath, to: nextPath, key: item.key },
    }))

    const legacyTransition = isLegacyAdminTab(item.key)
      ? clickLegacyTabButton(item.key)
      : { found: false, clicked: false }

    if (!preservePath && currentPath !== nextPath) {
      const method = legacyTransition.clicked ? 'replaceState' : replace ? 'replaceState' : 'pushState'
      window.history[method]({ adminTab: item.key }, '', nextPath)
    } else if (!preservePath && legacyTransition.clicked && normalizeAdminPath(window.location.pathname) !== nextPath) {
      window.history.replaceState({ adminTab: item.key }, '', nextPath)
    }

    setActiveTab(item.key)
    announceNavigation(item, 'navigate')
    return item.key
  }, [])

  useEffect(() => {
    annotateNavigation()
    const observer = new MutationObserver(() => annotateNavigation())
    observer.observe(document.body, { childList: true, subtree: true })

    const onClick = event => {
      const button = event.target.closest?.('nav[data-admin-legacy-navigation="true"] button[data-admin-tab]')
      if (!button) return
      const key = button.dataset.adminTab
      const item = ADMIN_TAB_BY_KEY[key]
      if (!item) return
      setActiveTab(key)
      announceNavigation(item, 'legacy-click')
    }
    const onPop = () => syncFromLocation('popstate')
    const onNavigate = event => {
      const { key, replace, preservePath } = event.detail || {}
      if (key) navigate(key, { replace, preservePath })
    }

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPop)
    window.addEventListener(ADMIN_NAVIGATE_EVENT, onNavigate)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPop)
      window.removeEventListener(ADMIN_NAVIGATE_EVENT, onNavigate)
    }
  }, [navigate, syncFromLocation])

  const value = useMemo(() => ({
    activeTab,
    activeLabel: adminTabLabel(activeTab),
    tabs: ADMIN_TABS,
    navigate,
  }), [activeTab, navigate])

  return <AdminUiContext.Provider value={value}>{children}</AdminUiContext.Provider>
}
