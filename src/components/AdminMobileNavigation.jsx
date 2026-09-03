import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 760px)'

function currentSectionLabel() {
  const active = document.querySelector('.ecosystem-sidebar nav button.active, .la-admin aside nav button.active')
  return active?.textContent?.trim() || 'Admin Center'
}

export default function AdminMobileNavigation() {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('Admin Center')
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const onMediaChange = event => {
      setMobile(event.matches)
      if (!event.matches) setOpen(false)
    }

    media.addEventListener?.('change', onMediaChange)
    return () => media.removeEventListener?.('change', onMediaChange)
  }, [])

  useEffect(() => {
    const syncSection = () => setSection(currentSectionLabel())
    const onNavigation = event => {
      const button = event.target.closest('.ecosystem-sidebar nav button, .la-admin aside nav button')
      if (!button) return
      setSection(button.textContent?.trim() || 'Admin Center')
      setOpen(false)
    }
    const onPopState = () => window.requestAnimationFrame(syncSection)
    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    syncSection()
    document.addEventListener('click', onNavigation)
    window.addEventListener('popstate', onPopState)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('click', onNavigation)
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    const sidebar = document.querySelector('.ecosystem-sidebar, .la-admin aside')
    document.body.classList.toggle('admin-mobile-menu-open', mobile && open)

    if (sidebar && mobile) {
      sidebar.id = 'admin-mobile-drawer'
      sidebar.setAttribute('aria-hidden', open ? 'false' : 'true')
    } else if (sidebar) {
      sidebar.removeAttribute('aria-hidden')
    }

    return () => {
      document.body.classList.remove('admin-mobile-menu-open')
      sidebar?.removeAttribute('aria-hidden')
    }
  }, [mobile, open])

  if (!mobile) return null

  return (
    <>
      <header className="admin-mobile-topbar">
        <button
          className={`admin-mobile-menu-button${open ? ' is-open' : ''}`}
          type="button"
          aria-label={open ? 'Fechar menu administrativo' : 'Abrir menu administrativo'}
          aria-expanded={open}
          aria-controls="admin-mobile-drawer"
          onClick={() => setOpen(value => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <a className="admin-mobile-identity" href="/admin" aria-label="Ir para a home do Admin Center">
          <img src="/petertecnetlogo.png" alt="" />
          <span>
            <small>Admin Center</small>
            <strong>{section}</strong>
          </span>
        </a>

        <span className="admin-mobile-topbar-spacer" aria-hidden="true" />
      </header>

      <button
        className={`admin-mobile-backdrop${open ? ' is-open' : ''}`}
        type="button"
        aria-label="Fechar menu administrativo"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
    </>
  )
}
