import { useCallback, useEffect, useMemo, useState } from 'react'
import { ADMIN_TABS, ADMIN_TAB_BY_KEY, adminTabFromLocation, adminTabLabel, adminTabPath, normalizeAdminPath } from './AdminNavigationConfig.js'
import { ADMIN_NAVIGATE_EVENT, ADMIN_NAVIGATION_CHANGED_EVENT } from './AdminUiEvents.js'
import { AdminUiContext } from './AdminUiState.js'

const CORE_ADMIN_TAB_KEYS = [
  'command',
  'dashboard',
  'activity',
  'financial',
  'applications',
  'branding',
  'users',
  'profiles',
  'establishments',
  'items',
  'site',
  'audit',
]

const CORE_ADMIN_TABS = CORE_ADMIN_TAB_KEYS.map(key => ADMIN_TAB_BY_KEY[key]).filter(Boolean)
const STANDALONE_ADMIN_TABS = new Set(['branding', 'content', 'discovery'])
const AUXILIARY_NAV_SELECTOR = '.admin-home-nav-button, [data-pto-onboarding], [data-admin-aux-nav]'
const MANAGED_ROUTE_SELECTOR = '[data-admin-managed-route]'

function clearNavigationMetadata(button) {
  delete button.dataset.adminTab
  delete button.dataset.icon
  delete button.dataset.group
  delete button.dataset.groupStart
}

function ensureManagedNavigationButtons(nav) {
  if (!nav) return

  const branding = ADMIN_TAB_BY_KEY.branding
  if (!branding || nav.querySelector(`${MANAGED_ROUTE_SELECTOR}[data-admin-managed-route="branding"]`)) return

  const nativeButtons = [...nav.querySelectorAll('button')].filter(button => (
    !button.matches(AUXILIARY_NAV_SELECTOR) && !button.matches(MANAGED_ROUTE_SELECTOR)
  ))
  const applicationsIndex = CORE_ADMIN_TAB_KEYS.indexOf('applications')
  const applicationsButton = nativeButtons[applicationsIndex]
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = branding.label
  button.dataset.adminManagedRoute = branding.key
  button.className = 'admin-branding-nav-button'

  if (applicationsButton?.parentNode === nav) applicationsButton.insertAdjacentElement('afterend', button)
  else nav.appendChild(button)
}

function annotateNavigation() {
  const nav = document.querySelector('.ecosystem-sidebar nav')
  if (!nav) return null

  ensureManagedNavigationButtons(nav)

  const allButtons = [...nav.querySelectorAll('button')]
  allButtons.filter(button => button.matches(AUXILIARY_NAV_SELECTOR)).forEach(clearNavigationMetadata)

  const buttons = allButtons.filter(button => !button.matches(AUXILIARY_NAV_SELECTOR))
  let previousGroup = ''

  buttons.forEach((button, index) => {
    const item = CORE_ADMIN_TABS[index]
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

export default function AdminUiProvider({ children }) {
  const [activeTab, setActiveTab] = useState(() => adminTabFromLocation())

  const syncFromLocation = useCallback(() => {
    const key = adminTabFromLocation()
    setActiveTab(key)
    return key
  }, [])

  const navigate = useCallback((key, { replace = false, preservePath = false } = {}) => {
    const item = ADMIN_TAB_BY_KEY[key] || ADMIN_TABS[0]

    if (STANDALONE_ADMIN_TABS.has(item.key)) {
      const nextPath = adminTabPath(item.key)
      if (normalizeAdminPath(window.location.pathname) !== normalizeAdminPath(nextPath)) {
        if (replace) window.location.replace(nextPath)
        else window.location.assign(nextPath)
      }
      return item.key
    }

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
    window.dispatchEvent(new CustomEvent(ADMIN_NAVIGATION_CHANGED_EVENT, { detail: { key: item.key, label: item.label } }))
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

      if (STANDALONE_ADMIN_TABS.has(key)) {
        event.preventDefault()
        const nextPath = adminTabPath(key)
        if (normalizeAdminPath(window.location.pathname) !== normalizeAdminPath(nextPath)) window.location.assign(nextPath)
        return
      }

      setActiveTab(key)
      window.dispatchEvent(new CustomEvent(ADMIN_NAVIGATION_CHANGED_EVENT, { detail: { key, label: adminTabLabel(key) } }))
    }
    const onPop = () => syncFromLocation()
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
