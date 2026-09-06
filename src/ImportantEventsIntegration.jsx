import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ImportantEventsCenter, { ImportantEventsBell } from './ImportantEventsCenter.jsx'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: options.cache || 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event('admin-session-expired'))
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || Object.values(payload?.errors || {}).flat()?.[0] || 'Não foi possível concluir a operação.')
  }
  return payload
}

export default function ImportantEventsIntegration() {
  const [sectionHost, setSectionHost] = useState(null)
  const [bellHost, setBellHost] = useState(null)
  const [applications, setApplications] = useState([])

  useEffect(() => {
    let navButton = null
    let section = null
    let bell = null
    let observer = null

    const mount = () => {
      const sidebarNav = document.querySelector('.sidebar nav')
      const notificationsSection = document.getElementById('notifications')
      const topActions = document.querySelector('.top-actions')
      if (!sidebarNav || !notificationsSection || !topActions) return false

      section = document.getElementById('important-events')
      if (!section) {
        section = document.createElement('section')
        section.id = 'important-events'
        section.className = 'section-anchor important-events-integration'
        notificationsSection.parentNode?.insertBefore(section, notificationsSection)
      }

      navButton = sidebarNav.querySelector('[data-important-events-nav]')
      if (!navButton) {
        navButton = document.createElement('button')
        navButton.type = 'button'
        navButton.dataset.importantEventsNav = 'true'
        navButton.dataset.adminPageTarget = 'important-events'
        navButton.innerHTML = '<span>◉</span>Eventos importantes<i>↗</i>'
        const before = Array.from(sidebarNav.querySelectorAll('button')).find(button => button.textContent?.includes('Notificações'))
        sidebarNav.insertBefore(navButton, before || null)
      }

      bell = document.getElementById('important-events-bell-slot')
      if (!bell) {
        bell = document.createElement('div')
        bell.id = 'important-events-bell-slot'
        bell.className = 'important-events-bell-slot'
        const launcher = topActions.querySelector('.launcher-wrap')
        topActions.insertBefore(bell, launcher || null)
      }

      setSectionHost(section)
      setBellHost(bell)
      return true
    }

    if (!mount()) {
      observer = new MutationObserver(() => {
        if (mount()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    request('/admin/applications')
      .then(payload => setApplications(payload?.applications || payload?.data || (Array.isArray(payload) ? payload : [])))
      .catch(() => setApplications([]))

    return () => {
      observer?.disconnect()
      navButton?.remove()
      section?.remove()
      bell?.remove()
      setSectionHost(null)
      setBellHost(null)
    }
  }, [])

  return <>
    {bellHost ? createPortal(<ImportantEventsBell request={request}/>, bellHost) : null}
    {sectionHost ? createPortal(<ImportantEventsCenter request={request} applications={applications}/>, sectionHost) : null}
  </>
}
