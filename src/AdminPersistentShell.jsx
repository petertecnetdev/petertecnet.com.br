import { useEffect } from 'react'
import { ADMIN_TABS } from './admin/AdminNavigationConfig.js'
import './AdminPersistentShell.css'

const EXTRA_TABS = [
  { key: 'visibility', label: 'Visibilidade e publicação', icon: '◐', path: '/admin/visibility', group: 'Negócio' },
  { key: 'ecosystem-launcher', label: 'Navegação do ecossistema', icon: '⌘', path: '/admin/ecosystem-launcher', group: 'Ecossistema' },
  { key: 'laora', label: 'Laora Safety Center', icon: '◉', path: '/admin/laora', group: 'Produtos' },
]

const GROUP_ORDER = ['Operação', 'Negócio', 'Ecossistema', 'Governança', 'Configurações', 'Produtos']
const NAV_ITEMS = [...ADMIN_TABS, ...EXTRA_TABS]

function goTo(path) {
  const current = String(window.location.pathname || '/').replace(/\/+$/, '') || '/'
  const next = String(path || '/').replace(/\/+$/, '') || '/'
  if (current === next) return
  window.location.assign(path)
}

export default function AdminPersistentShell({ activeKey, children }) {
  const current = NAV_ITEMS.find(item => item.key === activeKey)

  useEffect(() => {
    if (current?.label) document.title = `${current.label} · Admin Center · Peter Tecnet`
  }, [current?.label])

  const grouped = GROUP_ORDER.map(group => ({
    group,
    items: NAV_ITEMS.filter(item => item.group === group),
  })).filter(section => section.items.length)

  return (
    <main className="ecosystem-shell admin-persistent-shell">
      <aside className="ecosystem-sidebar admin-persistent-sidebar">
        <a className="admin-brand ecosystem-brand" href="/admin/mission-control" aria-label="Ir para a home do Admin Center">
          <img src="/petertecnetlogo.png" alt="" />
          <span><b>Peter Tecnet</b><small>Admin Center</small></span>
        </a>

        <nav aria-label="Seções do Admin Center">
          {grouped.map(section => (
            <div className="admin-persistent-nav-group" key={section.group}>
              <span className="admin-persistent-nav-label">{section.group}</span>
              {section.items.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={activeKey === item.key ? 'active' : ''}
                  aria-current={activeKey === item.key ? 'page' : undefined}
                  aria-label={item.label}
                  data-admin-aux-nav="persistent"
                  data-admin-managed-route={item.key === 'branding' ? 'branding' : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <span className="admin-persistent-nav-icon" aria-hidden="true">{item.icon || '•'}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <a href="https://petertecnet.com.br/" target="_blank" rel="noreferrer">Site Peter Tecnet ↗</a>
          <button type="button" onClick={() => {
            localStorage.removeItem('token')
            localStorage.removeItem('petertecnet_admin_token')
            window.location.assign('/login')
          }}>Sair</button>
        </div>
      </aside>

      <section className="ecosystem-main admin-persistent-main" data-admin-persistent-content>
        {children}
      </section>
    </main>
  )
}
