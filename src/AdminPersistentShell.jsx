import { useEffect } from 'react'
import { ADMIN_GROUP_ORDER, ADMIN_TABS, adminTabFromLocation } from './admin/AdminNavigationConfig.js'
import { useAdminUi } from './admin/useAdminUi.js'
import './AdminPersistentShell.css'

export default function AdminPersistentShell({ activeKey, children }) {
  const { navigate } = useAdminUi()
  const resolvedActiveKey = activeKey || adminTabFromLocation()
  const current = ADMIN_TABS.find(item => item.key === resolvedActiveKey)

  useEffect(() => {
    if (current?.label) document.title = `${current.label} · Admin Center · Peter Tecnet`
  }, [current?.label])

  useEffect(() => {
    const nav = document.querySelector('.admin-persistent-sidebar nav')
    const active = nav?.querySelector(`[data-admin-route="${resolvedActiveKey}"]`)
    if (!nav || !active || nav.scrollHeight <= nav.clientHeight) return

    const top = active.offsetTop
    const bottom = top + active.offsetHeight
    if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTo({ top: Math.max(0, top - nav.clientHeight / 3), behavior: 'smooth' })
    }
  }, [resolvedActiveKey])

  const grouped = ADMIN_GROUP_ORDER.map(group => ({
    group,
    items: ADMIN_TABS.filter(item => item.group === group),
  })).filter(section => section.items.length)

  const go = (event, key) => {
    event?.preventDefault?.()
    navigate(key)
  }

  return (
    <main className="ecosystem-shell admin-persistent-shell" data-admin-canonical-shell="true">
      <aside className="ecosystem-sidebar admin-persistent-sidebar">
        <a className="admin-brand ecosystem-brand" href="/admin" aria-label="Ir para a home do Admin Center" onClick={event => go(event, 'home')}>
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
                  className={resolvedActiveKey === item.key ? 'active' : ''}
                  aria-current={resolvedActiveKey === item.key ? 'page' : undefined}
                  aria-label={item.label}
                  data-admin-aux-nav="persistent"
                  data-admin-route={item.key}
                  onClick={event => go(event, item.key)}
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

      <section className="ecosystem-main admin-persistent-main" data-admin-persistent-content data-admin-active-route={resolvedActiveKey}>
        {children}
      </section>
    </main>
  )
}
