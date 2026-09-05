import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AdminEstablishmentsPage from './AdminEstablishmentsPage.jsx'

export default function AdminEstablishmentsPageIntegration() {
  const [host, setHost] = useState(null)

  useEffect(() => {
    let navButton = null
    let sectionHost = null
    let observer = null

    const mount = () => {
      const sidebarNav = document.querySelector('.sidebar nav')
      const activitySection = document.getElementById('activity')
      if (!sidebarNav || !activitySection) return false

      sectionHost = document.getElementById('establishments-admin-integration')
      if (!sectionHost) {
        sectionHost = document.createElement('section')
        sectionHost.id = 'establishments-admin-integration'
        sectionHost.className = 'section-anchor arp-resource-host'
        activitySection.parentNode?.insertBefore(sectionHost, activitySection)
      }

      navButton = sidebarNav.querySelector('[data-establishments-admin-nav]')
      if (!navButton) {
        navButton = document.createElement('button')
        navButton.type = 'button'
        navButton.dataset.establishmentsAdminNav = 'true'
        navButton.innerHTML = '<span>▰</span>Estabelecimentos<i>↗</i>'
        navButton.addEventListener('click', () => {
          document.querySelector('.sidebar')?.classList.remove('open')
          document.querySelector('.sidebar-backdrop')?.classList.remove('visible')
          sectionHost?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        const activityButton = Array.from(sidebarNav.querySelectorAll('button')).find(button => button.textContent?.includes('Atividade'))
        sidebarNav.insertBefore(navButton, activityButton || null)
      }

      setHost(sectionHost)
      return true
    }

    if (!mount()) {
      observer = new MutationObserver(() => { if (mount()) observer?.disconnect() })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      observer?.disconnect()
      navButton?.remove()
      sectionHost?.remove()
      setHost(null)
    }
  }, [])

  return host ? createPortal(<AdminEstablishmentsPage />, host) : null
}
