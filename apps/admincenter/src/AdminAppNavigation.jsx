import { useEffect } from 'react'

const PAGE_DEFINITIONS = [
  { key: 'dashboard', slug: 'visao-geral', label: 'Visão geral', selector: '#dashboard', aliases: ['dashboard', 'visao geral', 'visão geral'] },
  { key: 'operations', slug: 'operacoes', label: 'Operações', selector: '#operations', aliases: ['operations', 'operacoes', 'operações'] },
  { key: 'financial', slug: 'financeiro', label: 'Financeiro', selector: '#financial', aliases: ['financial', 'financeiro'] },
  { key: 'applications', slug: 'aplicacoes', label: 'Aplicações', selector: '#applications', aliases: ['applications', 'aplicacoes', 'aplicações'] },
  { key: 'users', slug: 'usuarios', label: 'Usuários', selector: '#users', aliases: ['users', 'usuarios', 'usuários'] },
  { key: 'establishments', slug: 'estabelecimentos', label: 'Estabelecimentos', selector: '#establishments-admin-integration', aliases: ['establishments', 'estabelecimentos'] },
  { key: 'items', slug: 'itens', label: 'Itens', selector: '#items-admin-integration', aliases: ['items', 'itens'] },
  { key: 'notifications', slug: 'notificacoes', label: 'Notificações', selector: '#notifications', aliases: ['notifications', 'notificacoes', 'notificações'] },
  { key: 'activity', slug: 'atividade', label: 'Atividade', selector: '#activity', aliases: ['activity', 'atividade'] },
]

const PAGE_KEYS = new Set(PAGE_DEFINITIONS.map(page => page.key))

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pageDefinition(key) {
  return PAGE_DEFINITIONS.find(page => page.key === key) || PAGE_DEFINITIONS[0]
}

function keyFromToken(value) {
  const normalized = normalize(value)
  if (!normalized) return null
  const compact = normalized.replace(/ /g, '-')
  if (PAGE_KEYS.has(compact)) return compact

  const match = PAGE_DEFINITIONS.find(page =>
    normalize(page.slug) === normalized || page.aliases.some(alias => normalize(alias) === normalized),
  )
  return match?.key || null
}

function pageFromLocation() {
  const url = new URL(window.location.href)
  return keyFromToken(url.searchParams.get('page')) || keyFromToken(url.hash.replace(/^#/, '')) || 'dashboard'
}

function pageFromButton(button) {
  if (!(button instanceof HTMLElement)) return null
  if (button.dataset.establishmentsAdminNav) return 'establishments'
  if (button.dataset.itemsAdminNav) return 'items'
  if (button.dataset.adminPageTarget && PAGE_KEYS.has(button.dataset.adminPageTarget)) return button.dataset.adminPageTarget

  const text = normalize(button.textContent)
  const match = PAGE_DEFINITIONS.find(page => page.aliases.some(alias => text.includes(normalize(alias))))
  return match?.key || null
}

function writeHistory(page, mode) {
  const url = new URL(window.location.href)
  if (page === 'dashboard') url.searchParams.delete('page')
  else url.searchParams.set('page', pageDefinition(page).slug)
  url.hash = ''

  const state = { ...(window.history.state || {}), adminPage: page }
  window.history[mode](state, '', `${url.pathname}${url.search}${url.hash}`)
}

function closeMobileSidebar(shell) {
  const backdrop = shell.querySelector('.sidebar-backdrop.visible')
  if (backdrop instanceof HTMLElement) {
    backdrop.click()
    return
  }

  shell.querySelector('.sidebar')?.classList.remove('open')
  shell.querySelector('.sidebar-backdrop')?.classList.remove('visible')
}

function markPageSurfaces(shell) {
  PAGE_DEFINITIONS.forEach(page => {
    const node = shell.querySelector(page.selector)
    if (node instanceof HTMLElement) node.dataset.adminPageKey = page.key
  })

  shell.querySelectorAll('.content > .metrics-grid, .content > .analytics-grid, .content > .skeleton-wrap').forEach(node => {
    if (node instanceof HTMLElement) node.dataset.adminPageKey = 'dashboard'
  })
}

function decorateNavigation(shell, activePage) {
  shell.querySelectorAll('.sidebar nav button').forEach(button => {
    const page = pageFromButton(button)
    if (!page) return

    button.type = 'button'
    button.dataset.adminPageTarget = page
    const active = page === activePage
    button.classList.toggle('active', active)
    if (active) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
}

function updateSurfaceAccessibility(shell, activePage) {
  shell.querySelectorAll('[data-admin-page-key]').forEach(node => {
    if (!(node instanceof HTMLElement)) return
    const active = node.dataset.adminPageKey === activePage
    node.setAttribute('aria-hidden', active ? 'false' : 'true')
    if ('inert' in node) node.inert = !active
  })
}

function applyPage(page, { historyMode = null, focus = false, scroll = false } = {}) {
  const shell = document.querySelector('.admin-shell')
  if (!(shell instanceof HTMLElement)) return false

  const resolved = PAGE_KEYS.has(page) ? page : 'dashboard'
  markPageSurfaces(shell)
  shell.dataset.adminPage = resolved
  decorateNavigation(shell, resolved)
  updateSurfaceAccessibility(shell, resolved)

  const current = pageDefinition(resolved)
  document.title = `${current.label} · Admin Center · Peter Tecnet`

  if (historyMode) writeHistory(resolved, historyMode)
  closeMobileSidebar(shell)

  window.requestAnimationFrame(() => {
    if (scroll) window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    if (focus) {
      const target = shell.querySelector(`[data-admin-page-key="${resolved}"] h1, [data-admin-page-key="${resolved}"] h2, [data-admin-page-key="${resolved}"] h3`)
      if (target instanceof HTMLElement) {
        target.tabIndex = -1
        target.focus({ preventScroll: true })
      }
    }
  })

  window.dispatchEvent(new CustomEvent('admin-page-change', { detail: { page: resolved } }))
  return true
}

export default function AdminAppNavigation() {
  useEffect(() => {
    let currentPage = pageFromLocation()
    let mutationFrame = 0

    const sync = ({ historyMode = null, focus = false, scroll = false } = {}) => {
      const applied = applyPage(currentPage, { historyMode, focus, scroll })
      if (!applied) return false
      return true
    }

    const handleClick = event => {
      const target = event.target
      if (!(target instanceof Element)) return

      const brand = target.closest('.sidebar > .brand')
      if (brand) {
        event.preventDefault()
        event.stopImmediatePropagation()
        currentPage = 'dashboard'
        sync({ historyMode: 'pushState', focus: true, scroll: true })
        return
      }

      const button = target.closest('.sidebar nav button')
      if (!(button instanceof HTMLButtonElement)) return
      const page = pageFromButton(button)
      if (!page) return

      event.preventDefault()
      event.stopImmediatePropagation()
      currentPage = page
      sync({ historyMode: 'pushState', focus: true, scroll: true })
    }

    const handlePopState = () => {
      currentPage = pageFromLocation()
      sync({ focus: true })
    }

    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(mutationFrame)
      mutationFrame = window.requestAnimationFrame(() => sync())
    })

    document.addEventListener('click', handleClick, true)
    window.addEventListener('popstate', handlePopState)
    observer.observe(document.body, { childList: true, subtree: true })

    if (!sync()) {
      window.requestAnimationFrame(() => sync())
    } else {
      writeHistory(currentPage, 'replaceState')
    }

    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('popstate', handlePopState)
      observer.disconnect()
      window.cancelAnimationFrame(mutationFrame)
    }
  }, [])

  return null
}
