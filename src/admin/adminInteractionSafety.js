const MOBILE_QUERY = '(max-width: 760px)'
const GUARD_VERSION = '2.0.0'

const ORPHAN_OVERLAYS = [
  ['.admin-command-overlay', '.admin-command-palette'],
  ['.admin-customize-overlay', '.admin-customize-panel'],
  ['.aco-backdrop', '.aco-workspace'],
  ['.pto-overlay', '.pto-modal'],
  ['.pt-install-help', '.pt-install-card'],
  ['.finance-modal', 'article'],
]

const CORE_INTERACTIVE_SELECTORS = [
  '#root',
  '.admin-persistent-shell',
  '.admin-persistent-main',
  '[data-admin-persistent-content]',
]

function setInert(element, value) {
  if (!element || element.inert === value) return false
  element.inert = value
  return true
}

function setAttribute(element, name, value) {
  if (!element || element.getAttribute(name) === value) return false
  element.setAttribute(name, value)
  return true
}

function removeAttribute(element, name) {
  if (!element?.hasAttribute(name)) return false
  element.removeAttribute(name)
  return true
}

function repairCoreContent() {
  let repaired = 0
  CORE_INTERACTIVE_SELECTORS.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      if (setInert(element, false)) repaired += 1
      if (element.getAttribute('aria-hidden') === 'true') {
        element.removeAttribute('aria-hidden')
        repaired += 1
      }
      if (element instanceof HTMLElement && element.style.pointerEvents === 'none') {
        element.style.removeProperty('pointer-events')
        repaired += 1
      }
    })
  })
  return repaired
}

function closeMobileNavigation({ drawer, backdrop, button }) {
  let repaired = 0
  if (document.body.classList.contains('admin-mobile-menu-open')) {
    document.body.classList.remove('admin-mobile-menu-open')
    repaired += 1
  }
  if (backdrop?.classList.contains('is-open')) {
    backdrop.classList.remove('is-open')
    repaired += 1
  }
  if (backdrop) {
    if (setAttribute(backdrop, 'aria-hidden', 'true')) repaired += 1
    if (backdrop.tabIndex !== -1) {
      backdrop.tabIndex = -1
      repaired += 1
    }
  }
  if (button && button.getAttribute('aria-expanded') !== 'false') {
    button.setAttribute('aria-expanded', 'false')
    repaired += 1
  }
  if (drawer) {
    if (setAttribute(drawer, 'aria-hidden', 'true')) repaired += 1
    if (setInert(drawer, true)) repaired += 1
  }
  return repaired
}

function repairMobileNavigation() {
  const mobile = window.matchMedia?.(MOBILE_QUERY)?.matches ?? window.innerWidth <= 760
  const drawer = document.querySelector('.admin-persistent-sidebar')
  const backdrop = document.querySelector('.admin-mobile-backdrop')
  const button = document.querySelector('.admin-mobile-menu-button')
  let repaired = 0

  if (!mobile) {
    if (document.body.classList.contains('admin-mobile-menu-open')) {
      document.body.classList.remove('admin-mobile-menu-open')
      repaired += 1
    }
    if (backdrop?.classList.contains('is-open')) {
      backdrop.classList.remove('is-open')
      repaired += 1
    }
    if (backdrop) {
      if (setAttribute(backdrop, 'aria-hidden', 'true')) repaired += 1
      if (backdrop.tabIndex !== -1) {
        backdrop.tabIndex = -1
        repaired += 1
      }
    }
    if (button && button.getAttribute('aria-expanded') !== 'false') {
      button.setAttribute('aria-expanded', 'false')
      repaired += 1
    }
    if (drawer) {
      if (setInert(drawer, false)) repaired += 1
      if (removeAttribute(drawer, 'aria-hidden')) repaired += 1
      if (removeAttribute(drawer, 'aria-modal')) repaired += 1
      if (removeAttribute(drawer, 'role')) repaired += 1
    }
    return repaired
  }

  const bodyOpen = document.body.classList.contains('admin-mobile-menu-open')
  const backdropOpen = Boolean(backdrop?.classList.contains('is-open'))
  const buttonOpen = button?.getAttribute('aria-expanded') === 'true'

  // The three independent states must agree. If React, a resize or BFCache
  // leaves only part of the drawer state behind, fail closed instead of
  // leaving an invisible layer over the Admin Center.
  if (bodyOpen !== backdropOpen || bodyOpen !== buttonOpen || !drawer) {
    return repaired + closeMobileNavigation({ drawer, backdrop, button })
  }

  if (bodyOpen) {
    if (drawer) {
      if (setInert(drawer, false)) repaired += 1
      if (setAttribute(drawer, 'aria-hidden', 'false')) repaired += 1
    }
  } else if (drawer) {
    if (setInert(drawer, true)) repaired += 1
    if (setAttribute(drawer, 'aria-hidden', 'true')) repaired += 1
  }

  return repaired
}

function repairHiddenFixedBlockers() {
  let repaired = 0
  document.querySelectorAll('[aria-hidden="true"]').forEach(element => {
    if (!(element instanceof HTMLElement)) return
    const style = window.getComputedStyle(element)
    if (style.position !== 'fixed' || style.pointerEvents === 'none') return
    const rect = element.getBoundingClientRect()
    const coversViewport = rect.width >= window.innerWidth * 0.72 && rect.height >= window.innerHeight * 0.45
    if (!coversViewport) return
    element.style.setProperty('pointer-events', 'none', 'important')
    element.dataset.adminAutoUnblocked = 'aria-hidden-fixed-layer'
    repaired += 1
  })
  return repaired
}

function repairOrphanOverlays() {
  let repaired = 0
  ORPHAN_OVERLAYS.forEach(([overlaySelector, contentSelector]) => {
    document.querySelectorAll(overlaySelector).forEach(overlay => {
      if (overlay.querySelector(contentSelector)) return
      overlay.remove()
      repaired += 1
    })
  })
  return repaired
}

function repairInlineGlobalLocks() {
  const intentionalModal = document.querySelector([
    '.admin-command-overlay .admin-command-palette',
    '.admin-customize-overlay .admin-customize-panel',
    '.aco-backdrop .aco-workspace',
    '.pto-overlay .pto-modal',
    '.pt-install-help .pt-install-card',
    '.finance-modal article',
    'dialog[open]',
  ].join(','))
  if (intentionalModal) return 0

  let repaired = 0
  ;[document.documentElement, document.body].forEach(element => {
    if (element.style.pointerEvents === 'none') {
      element.style.removeProperty('pointer-events')
      repaired += 1
    }
  })

  if (document.body.classList.contains('modal-open') && !document.querySelector('.modal.show')) {
    document.body.classList.remove('modal-open')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('padding-right')
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove())
    repaired += 1
  }

  return repaired
}

function markProcessingAsNonBlocking() {
  let repaired = 0
  document.querySelectorAll('.peter-processing').forEach(element => {
    if (element.getAttribute('data-admin-nonblocking') !== 'true') {
      element.setAttribute('data-admin-nonblocking', 'true')
      repaired += 1
    }
  })
  return repaired
}

export function repairAdminInteractionState() {
  if (!window.location.pathname.startsWith('/admin')) return { repaired: 0, version: GUARD_VERSION }

  document.body.classList.add('admin-interaction-guard-active')

  const repaired = repairCoreContent()
    + repairMobileNavigation()
    + repairHiddenFixedBlockers()
    + repairOrphanOverlays()
    + repairInlineGlobalLocks()
    + markProcessingAsNonBlocking()

  if (repaired > 0) {
    window.dispatchEvent(new CustomEvent('petertecnet:admin-interaction-repaired', {
      detail: { repaired, version: GUARD_VERSION, path: window.location.pathname },
    }))
  }

  return { repaired, version: GUARD_VERSION }
}

export const ADMIN_INTERACTION_GUARD_VERSION = GUARD_VERSION
