import { useEffect, useRef, useState } from 'react'
import { useAdminUi } from '../admin/AdminUiContext.jsx'
import './AdminMobileNavigation.css'

const MOBILE_QUERY = '(max-width: 760px)'
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function laoraSectionLabel() {
  const active = document.querySelector('.la-admin aside nav button.active')
  return active?.textContent?.trim() || 'Admin Center'
}

function findDrawer() {
  return document.querySelector('.ecosystem-sidebar, .la-admin aside')
}

export default function AdminMobileNavigation() {
  const { activeLabel, navigate } = useAdminUi()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(activeLabel || 'Admin Center')
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  const menuButtonRef = useRef(null)
  const wasOpenRef = useRef(false)

  useEffect(() => setSection(activeLabel || 'Admin Center'), [activeLabel])

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
    const onNavigation = event => {
      const button = event.target.closest?.('.ecosystem-sidebar nav button, .la-admin aside nav button')
      if (!button) return
      if (button.closest('.la-admin')) setSection(button.textContent?.trim() || 'Admin Center')
      setOpen(false)
    }
    const onPopState = () => {
      if (document.querySelector('.la-admin')) window.requestAnimationFrame(() => setSection(laoraSectionLabel()))
      setOpen(false)
    }

    document.addEventListener('click', onNavigation)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onNavigation)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    const drawer = findDrawer()
    const wasOpen = wasOpenRef.current

    if (wasOpen && !open) menuButtonRef.current?.focus({ preventScroll: true })
    wasOpenRef.current = open
    document.body.classList.toggle('admin-mobile-menu-open', mobile && open)

    if (!drawer) return () => document.body.classList.remove('admin-mobile-menu-open')

    if (mobile) {
      drawer.id = 'admin-mobile-drawer'
      drawer.setAttribute('role', 'dialog')
      drawer.setAttribute('aria-modal', 'true')
      drawer.setAttribute('aria-label', 'Navegação do Admin Center')
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true')
      drawer.inert = !open
    } else {
      drawer.inert = false
      drawer.removeAttribute('aria-hidden')
      drawer.removeAttribute('aria-modal')
      drawer.removeAttribute('role')
    }

    if (!mobile || !open) {
      return () => {
        document.body.classList.remove('admin-mobile-menu-open')
        drawer.inert = false
      }
    }

    const focusables = () => [...drawer.querySelectorAll(FOCUSABLE)].filter(element => !element.hidden && element.getClientRects().length > 0)
    const focusId = window.requestAnimationFrame(() => focusables()[0]?.focus({ preventScroll: true }))
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusId)
      window.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('admin-mobile-menu-open')
      drawer.inert = false
    }
  }, [mobile, open])

  if (!mobile) return null

  const isLaora = Boolean(document.querySelector('.la-admin'))
  const goHome = event => {
    if (isLaora) return
    event.preventDefault()
    navigate('command')
    setOpen(false)
  }

  return (
    <>
      <header className="admin-mobile-topbar">
        <button
          ref={menuButtonRef}
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

        <a className="admin-mobile-identity" href="/admin" aria-label="Ir para a home do Admin Center" onClick={goHome}>
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
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
    </>
  )
}
