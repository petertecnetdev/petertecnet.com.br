import { useEffect, useRef } from 'react'
import { requestAdminNavigation } from './admin/AdminUiContext.jsx'
import './AdminDeepLinkBridge.css'

const API = 'https://api.petertecnet.com.br/api'
const normalizePath = path => (path || '/').replace(/\/+$/, '') || '/'
const token = () => localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token')

async function waitFor(getter, timeout = 7000) {
  const start = Date.now()
  return new Promise(resolve => {
    const tick = () => {
      const value = getter()
      if (value || Date.now() - start >= timeout) return resolve(value || null)
      window.setTimeout(tick, 90)
    }
    tick()
  })
}

async function activateTab(key) {
  requestAdminNavigation(key, { preservePath: true })
  return waitFor(() => document.querySelector(`nav[data-admin-legacy-navigation="true"] button[data-admin-tab="${key}"].active`))
}

function replacePath(path) {
  if (normalizePath(window.location.pathname) !== normalizePath(path)) window.history.replaceState({ adminDeepLink: true }, '', path)
}

async function fetchUser(id) {
  const response = await fetch(`${API}/admin/ecosystem/users/${id}`, {
    headers: { Accept: 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
  })
  if (!response.ok) return null
  return response.json().catch(() => null)
}

function rowById(id) {
  return [...document.querySelectorAll('.ecosystem-main table tbody tr')].find(row => normalizePath(window.location.pathname).startsWith('/admin/establishments') ? row.textContent.includes(`#${id}`) : row.querySelector('td:first-child')?.textContent.trim() === `#${id}`)
}

export default function AdminDeepLinkBridge() {
  const initialPath = useRef(normalizePath(window.location.pathname))
  const recovering = useRef(false)

  async function recoverUser(id, deepPath) {
    recovering.current = true
    const payload = await fetchUser(id)
    await activateTab('users')
    const email = payload?.user?.email
    const card = await waitFor(() => email ? [...document.querySelectorAll('.ecosystem-main .user-card')].find(item => item.textContent.includes(email)) : null)
    const details = card && [...card.querySelectorAll('button')].find(button => /detalhes/i.test(button.textContent))
    details?.click()
    if (details) await waitFor(() => document.querySelector('.ecosystem-main .user-hero'))
    replacePath(deepPath)
    recovering.current = false
  }

  async function recoverEstablishment(id, deepPath) {
    recovering.current = true
    await activateTab('establishments')
    const row = await waitFor(() => rowById(id))
    const edit = row && [...row.querySelectorAll('button')].find(button => /editar dados/i.test(button.textContent))
    edit?.click()
    if (edit) await waitFor(() => [...document.querySelectorAll('.ecosystem-main h2,.ecosystem-main h3,.ecosystem-main header b')].find(item => item.textContent.includes(`Editar estabelecimento #${id}`)))
    replacePath(deepPath)
    recovering.current = false
  }

  async function recoverItem(id, deepPath) {
    recovering.current = true
    await activateTab('items')
    const row = await waitFor(() => rowById(id))
    document.querySelectorAll('.admin-deeplink-focus').forEach(item => item.classList.remove('admin-deeplink-focus'))
    if (row) {
      row.classList.add('admin-deeplink-focus')
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    replacePath(deepPath)
    recovering.current = false
  }

  async function recoverMission(section, deepPath) {
    recovering.current = true
    await activateTab('command')
    const sectionIndex = { incidents: 1, security: 2, queues: 3, search: 4 }[section]
    if (Number.isInteger(sectionIndex)) {
      const button = await waitFor(() => document.querySelectorAll('.cc-toolbar nav button')[sectionIndex])
      button?.click()
    }
    replacePath(deepPath)
    recovering.current = false
  }

  function recover(path = normalizePath(window.location.pathname)) {
    if (recovering.current) return
    let match = path.match(/^\/admin\/users\/(\d+)$/)
    if (match) { recoverUser(Number(match[1]), path); return }
    match = path.match(/^\/admin\/establishments\/(\d+)$/)
    if (match) { recoverEstablishment(Number(match[1]), path); return }
    match = path.match(/^\/admin\/items\/(\d+)$/)
    if (match) { recoverItem(Number(match[1]), path); return }
    match = path.match(/^\/admin\/mission-control\/(incidents|security|queues|search)$/)
    if (match) recoverMission(match[1], path)
  }

  useEffect(() => {
    const initial = initialPath.current
    if (/^\/admin\/(users|establishments|items)\/\d+$/.test(initial) || /^\/admin\/mission-control\/(incidents|security|queues|search)$/.test(initial)) {
      window.setTimeout(() => recover(initial), 130)
    }

    const onPop = () => {
      const path = normalizePath(window.location.pathname)
      if (/^\/admin\/(users|establishments|items)\/\d+$/.test(path) || /^\/admin\/mission-control\/(incidents|security|queues|search)$/.test(path)) {
        window.setTimeout(() => recover(path), 90)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const onClick = event => {
      if (recovering.current) return

      const toolbar = event.target.closest?.('.cc-toolbar nav button')
      if (toolbar) {
        const buttons = [...toolbar.parentElement.querySelectorAll('button')]
        const index = buttons.indexOf(toolbar)
        const section = ['', 'incidents', 'security', 'queues', 'search'][index]
        if (section !== undefined) window.setTimeout(() => replacePath(section ? `/admin/mission-control/${section}` : '/admin/mission-control'), 20)
        return
      }

      const establishmentEdit = event.target.closest?.('button')
      if (establishmentEdit && /editar dados/i.test(establishmentEdit.textContent) && normalizePath(window.location.pathname).startsWith('/admin/establishments')) {
        const row = establishmentEdit.closest('tr')
        const id = Number(row?.textContent.match(/#(\d+)/)?.[1])
        if (id) window.setTimeout(() => replacePath(`/admin/establishments/${id}`), 20)
        return
      }

      if (normalizePath(window.location.pathname).startsWith('/admin/items')) {
        const cell = event.target.closest?.('td')
        const row = cell?.closest('tr')
        if (cell && row && cell.cellIndex === 1) {
          const id = Number(row.querySelector('td:first-child')?.textContent.match(/(\d+)/)?.[1])
          if (id) {
            document.querySelectorAll('.admin-deeplink-focus').forEach(item => item.classList.remove('admin-deeplink-focus'))
            row.classList.add('admin-deeplink-focus')
            window.history.pushState({ itemId: id }, '', `/admin/items/${id}`)
          }
        }
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    const syncDetailRoutes = () => {
      if (recovering.current) return
      const userKicker = document.querySelector('.ecosystem-main .user-hero .admin-kicker')?.textContent || ''
      const userId = Number(userKicker.match(/Usuário\s*#(\d+)/i)?.[1])
      if (userId && normalizePath(window.location.pathname) === '/admin/users') replacePath(`/admin/users/${userId}`)

      const establishmentHeading = [...document.querySelectorAll('.ecosystem-main h2,.ecosystem-main h3,.ecosystem-main header b')].find(item => /Editar estabelecimento\s*#\d+/i.test(item.textContent))
      const establishmentId = Number(establishmentHeading?.textContent.match(/#(\d+)/)?.[1])
      if (establishmentId && normalizePath(window.location.pathname) === '/admin/establishments') replacePath(`/admin/establishments/${establishmentId}`)

      const path = normalizePath(window.location.pathname)
      if (/^\/admin\/establishments\/\d+$/.test(path) && !establishmentHeading && document.querySelector('.ecosystem-sidebar nav button[data-admin-tab="establishments"].active')) replacePath('/admin/establishments')
      if (/^\/admin\/users\/\d+$/.test(path) && !userId && document.querySelector('.ecosystem-sidebar nav button[data-admin-tab="users"].active')) replacePath('/admin/users')
    }
    syncDetailRoutes()
    const observer = new MutationObserver(syncDetailRoutes)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
