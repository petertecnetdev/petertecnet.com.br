import { useEffect } from 'react'

const PAGE_ALIASES = {
  operations: ['operacoes', 'operations', 'saude', 'alerta'],
  financial: ['financeiro', 'financial', 'pagamento', 'pagamentos', 'pendencia', 'pendencias', 'receita'],
  applications: ['aplicacoes', 'applications', 'aplicacao'],
  users: ['usuarios', 'users', 'usuario'],
  notifications: ['notificacoes', 'notifications', 'notificacao'],
  activity: ['atividade', 'activity', 'movimentos'],
}

const PAGE_SLUGS = {
  operations: 'operacoes',
  financial: 'financeiro',
  applications: 'aplicacoes',
  users: 'usuarios',
  notifications: 'notificacoes',
  activity: 'atividade',
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pageForButton(button) {
  const scope = button.closest('.aoi-priority, .aoi-quick-action, .aoi-context-panel') || button
  const text = normalize(scope.textContent)
  return Object.entries(PAGE_ALIASES).find(([, aliases]) => aliases.some(alias => text.includes(alias)))?.[0] || null
}

function sidebarButtonFor(page) {
  const aliases = PAGE_ALIASES[page] || []
  return [...document.querySelectorAll('.sidebar nav button')].find(button => {
    if (button.dataset.adminPageTarget === page) return true
    const text = normalize(button.textContent)
    return aliases.some(alias => text.includes(alias))
  })
}

function fallbackNavigate(page) {
  const slug = PAGE_SLUGS[page]
  if (!slug) return
  const url = new URL(window.location.href)
  url.searchParams.set('page', slug)
  url.hash = ''
  window.history.pushState({ ...(window.history.state || {}), adminPage: page }, '', `${url.pathname}${url.search}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function AdminOverviewNavigationBridge() {
  useEffect(() => {
    let frame = 0

    const syncSlot = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const slot = document.getElementById('admin-overview-intelligence-slot')
        if (slot instanceof HTMLElement) slot.dataset.adminPageKey = 'dashboard'
      })
    }

    const handleClick = event => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('.aoi-shell button')
      if (!(button instanceof HTMLButtonElement)) return
      if (button.closest('.aoi-sync')) return

      const page = pageForButton(button)
      if (!page) return
      event.preventDefault()
      event.stopPropagation()

      const sidebarButton = sidebarButtonFor(page)
      if (sidebarButton instanceof HTMLButtonElement) sidebarButton.click()
      else fallbackNavigate(page)
    }

    syncSlot()
    const observer = new MutationObserver(syncSlot)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', handleClick)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
