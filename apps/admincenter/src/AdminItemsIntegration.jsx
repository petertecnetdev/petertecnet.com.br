import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AdminItemsManager from './AdminItemsManager.jsx'

export default function AdminItemsIntegration() {
  const [host, setHost] = useState(null)

  useEffect(() => {
    let navButton = null
    let sectionHost = null
    let observer = null

    const mount = () => {
      const sidebarNav = document.querySelector('.sidebar nav')
      const notificationsSection = document.getElementById('notifications')
      const activitySection = document.getElementById('activity')
      const anchor = notificationsSection || activitySection
      if (!sidebarNav || !anchor) return false

      sectionHost = document.getElementById('items-admin-integration')
      if (!sectionHost) {
        sectionHost = document.createElement('section')
        sectionHost.id = 'items-admin-integration'
        sectionHost.className = 'section-anchor admin-items-section'
        anchor.parentNode?.insertBefore(sectionHost, anchor)
      }

      navButton = sidebarNav.querySelector('[data-items-admin-nav]')
      if (!navButton) {
        navButton = document.createElement('button')
        navButton.type = 'button'
        navButton.dataset.itemsAdminNav = 'true'
        navButton.innerHTML = '<span>▣</span>Itens<i>↗</i>'
        navButton.addEventListener('click', () => {
          document.querySelector('.sidebar')?.classList.remove('open')
          document.querySelector('.sidebar-backdrop')?.classList.remove('visible')
          sectionHost?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        const before = Array.from(sidebarNav.querySelectorAll('button')).find(button =>
          button.textContent?.includes('Notificações') || button.textContent?.includes('Atividade'))
        sidebarNav.insertBefore(navButton, before || null)
      }

      setHost(sectionHost)
      return true
    }

    if (!mount()) {
      observer = new MutationObserver(() => {
        if (mount()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      observer?.disconnect()
      navButton?.remove()
      sectionHost?.remove()
      setHost(null)
    }
  }, [])

  return host ? createPortal(<AdminItemsManager />, host) : null
}
