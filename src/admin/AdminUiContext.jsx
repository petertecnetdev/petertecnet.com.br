import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ADMIN_TABS, ADMIN_TAB_BY_KEY, adminTabFromLocation, adminTabLabel, adminTabPath, normalizeAdminPath } from './AdminNavigationConfig.js'

const AdminUiContext = createContext(null)
const NAVIGATE_EVENT = 'peter-admin:navigate'
const NAVIGATION_CHANGED_EVENT = 'peter-admin:navigation-changed'

function annotateNavigation() {
  const nav = document.querySelector('.ecosystem-sidebar nav')
  if (!nav) return null

  const buttons = [...nav.querySelectorAll('button')]
  let previousGroup = ''
  buttons.forEach((button, index) => {
    const item = ADMIN_TABS[index]
    if (!item) return
    button.dataset.adminTab = item.key
    button.dataset.icon = item.icon
    button.dataset.group = item.group
    button.setAttribute('aria-label', item.label)
    if (item.group !== previousGroup) button.dataset.groupStart = item.group
    else delete button.dataset.groupStart
    previousGroup = item.group
  })
  nav.id ||= 'admin-navigation'
  nav.setAttribute('aria-label', 'Seções do Admin Center')
  return nav
}

function clickTabButton(key) {
  annotateNavigation()
  const button = document.querySelector(`.ecosystem-sidebar nav button[data-admin-tab="${key}"]`)
  if (button && !button.classList.contains('active')) button.click()
  return Boolean(button)
}

export function requestAdminNavigation(key, options = {}) {
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { key, ...options } }))
}

export function AdminUiProvider({ children }) {
  const [activeTab, setActiveTab] = useState(() => adminTabFromLocation())

  const syncFromLocation = useCallback(() => {
    const key = adminTabFromLocation()
    setActiveTab(key)
    return key
  }, [])

  const navigate = useCallback((key, { replace = false, preservePath = false } = {}) => {
    const item = ADMIN_TAB_BY_KEY[key] || ADMIN_TABS[0]
    clickTabButton(item.key)

    if (!preservePath) {
      const nextPath = adminTabPath(item.key)
      if (normalizeAdminPath(window.location.pathname) !== normalizeAdminPath(nextPath)) {
        const method = replace ? 'replaceState' : 'pushState'
        window.history[method]({ adminTab: item.key }, '', nextPath)
      }
    }

    setActiveTab(item.key)
    document.title = `${item.label} · Admin Center · Peter Tecnet`
    window.dispatchEvent(new CustomEvent(NAVIGATION_CHANGED_EVENT, { detail: { key: item.key, label: item.label } }))
    return item.key
  }, [])

  useEffect(() => {
    annotateNavigation()
    const observer = new MutationObserver(() => annotateNavigation())
    observer.observe(document.body, { childList: true, subtree: true })

    const onClick = event => {
      const button = event.target.closest?.('.ecosystem-sidebar nav button[data-admin-tab]')
      if (!button) return
      const key = button.dataset.adminTab
      if (!ADMIN_TAB_BY_KEY[key]) return
      setActiveTab(key)
      window.dispatchEvent(new CustomEvent(NAVIGATION_CHANGED_EVENT, { detail: { key, label: adminTabLabel(key) } }))
    }
    const onPop = () => syncFromLocation()
    const onNavigate = event => {
      const { key, replace, preservePath } = event.detail || {}
      if (key) navigate(key, { replace, preservePath })
    }

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPop)
    window.addEventListener(NAVIGATE_EVENT, onNavigate)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPop)
      window.removeEventListener(NAVIGATE_EVENT, onNavigate)
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

export function useAdminUi() {
  return useContext(AdminUiContext) || {
    activeTab: adminTabFromLocation(),
    activeLabel: adminTabLabel(adminTabFromLocation()),
    tabs: ADMIN_TABS,
    navigate: requestAdminNavigation,
  }
}
