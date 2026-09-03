export const ADMIN_BEFORE_NAVIGATE_EVENT = 'peter-admin:before-navigate'
export const ADMIN_NAVIGATE_EVENT = 'peter-admin:navigate'
export const ADMIN_NAVIGATION_CHANGED_EVENT = 'peter-admin:navigation-changed'

export function requestAdminNavigation(key, options = {}) {
  window.dispatchEvent(new CustomEvent(ADMIN_NAVIGATE_EVENT, { detail: { key, ...options } }))
}
