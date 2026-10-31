import { useEffect, useRef, useState } from 'react'
import { handlePublicNavigationKeyDown, publicNavigationMenuLabel } from './publicSiteNavigation.js'

const navigationItems = [
  { id: 'home', href: '/', label: 'Início' },
  { id: 'platforms', href: '/#plataformas', label: 'Plataformas' },
  { id: 'catalog', href: '/#catalogo', label: 'Catálogo' },
  { id: 'blog', href: '/blog', label: 'Conteúdo' },
  { id: 'companies', href: '/#empresa', label: 'Para empresas' },
  { id: 'contact', href: '/#contato', label: 'Contato' },
  { id: 'quote', href: '/#contato', label: 'Solicitar orçamento', className: 'mkt-nav-cta' },
]

export default function PublicSiteHeader({ active = '' }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)
  const navigationId = 'public-site-navigation'
  const currentPath = window.location.pathname
  const currentActive = active || (currentPath.startsWith('/blog') ? 'blog' : currentPath === '/' ? 'home' : '')
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = event => handlePublicNavigationKeyDown(event, {
      close: () => setOpen(false),
      focusTrigger: () => buttonRef.current?.focus(),
    })

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return <header className="mkt-header">
    <a className="mkt-brand" href="/" onClick={close} aria-label="Peter Tecnet — início">
      <span className="mkt-brand-mark"><img src="/logopetertecnet.png" alt="" /></span>
      <span><strong>Peter Tecnet</strong><small>Soluções em tecnologia</small></span>
    </a>

    <button
      ref={buttonRef}
      className={open ? 'mkt-menu is-open' : 'mkt-menu'}
      type="button"
      aria-label={publicNavigationMenuLabel(open)}
      aria-expanded={open}
      aria-controls={navigationId}
      onClick={() => setOpen(value => !value)}
    >
      <i aria-hidden="true" />
      <i aria-hidden="true" />
    </button>

    <nav id={navigationId} className={open ? 'mkt-nav is-open' : 'mkt-nav'} aria-label="Navegação principal">
      {navigationItems.map(item => (
        <a
          key={item.id}
          href={item.href}
          className={item.className}
          aria-current={currentActive === item.id ? 'page' : undefined}
          onClick={close}
        >
          {item.label}
          {item.id === 'quote' && <span aria-hidden="true">↗</span>}
        </a>
      ))}
    </nav>
  </header>
}
