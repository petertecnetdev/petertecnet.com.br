import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ADMIN_TABS, adminTabFromLocation, normalizeAdminPath } from './admin/AdminNavigationConfig.js'
import { ADMIN_NAVIGATION_CHANGED_EVENT } from './admin/AdminUiEvents.js'
import { useAdminUi } from './admin/useAdminUi.js'
import './AdminHomeBridge.css'

const API = 'https://api.petertecnet.com.br/api'
const LAST_PATH_KEY = 'petertecnet_admin_last_path_v1'
const getToken = () => localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token')

async function api(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || 'Não foi possível carregar a Home administrativa.')
  return data
}

function EcosystemSwitcher({ target, applications }) {
  if (!target) return null
  const rows = applications.filter(app => app?.url && app?.is_active !== false)
  return createPortal(
    <label className="admin-ecosystem-switcher">
      <span>ECOSSISTEMA</span>
      <select value="" aria-label="Navegar para outra plataforma Peter Tecnet" onChange={event => { if (event.target.value) window.location.href = event.target.value }}>
        <option value="">Abrir plataforma…</option>
        <option value="https://petertecnet.com.br/">Peter Tecnet · Site</option>
        {rows.map(app => <option key={app.id} value={app.url}>{app.name}</option>)}
      </select>
    </label>,
    target,
  )
}

function HomeContent({ target, dashboard, applications, loading, error, lastPath, onNavigate }) {
  if (!target) return null
  const summary = dashboard?.summary || {}
  const recentUsers = dashboard?.recent_users || []
  const recentActivity = dashboard?.recent_activity || []
  const operationalApps = applications.filter(app => app?.is_active !== false)
  const metrics = [
    ['Usuários', summary.users, `${summary.active_users_30d || 0} ativos em 30 dias`, 'users'],
    ['Estabelecimentos', summary.establishments, `${summary.approved_establishments || 0} aprovados`, 'establishments'],
    ['Aplicações', summary.applications ?? operationalApps.length, `${summary.active_applications ?? operationalApps.length} ativas`, 'applications'],
    ['Interações 30d', summary.interactions_30d, 'Atividade registrada', 'activity'],
  ]

  return createPortal(
    <section className="admin-home-bridge-root">
      <nav className="admin-home-own-breadcrumb" aria-label="Localização"><strong>Admin Center</strong><span>/</span><b>Início</b></nav>

      <section className="admin-home-hero">
        <div>
          <span>HOME ADMINISTRATIVA</span>
          <h2>Visão executiva do ecossistema</h2>
          <p>Acompanhe negócio, cadastros e atividade em um ponto de entrada simples. O Mission Control continua dedicado a infraestrutura, segurança, filas e incidentes.</p>
        </div>
        <div className="admin-home-hero-actions">
          <button type="button" className="primary" onClick={() => onNavigate('command')}>Abrir Mission Control</button>
          {lastPath && lastPath !== '/admin' && <button type="button" onClick={() => onNavigate(lastPath)}>Continuar de onde parei</button>}
        </div>
      </section>

      {error && <div className="admin-home-alert">{error}</div>}
      {loading && <div className="admin-home-loading">Sincronizando indicadores administrativos…</div>}

      <div className="admin-home-metrics">
        {metrics.map(([label, value, sub, destination]) => <button type="button" key={label} onClick={() => onNavigate(destination)}><span>{label}</span><strong>{value ?? '—'}</strong><small>{sub}</small><i>→</i></button>)}
      </div>

      <section className="admin-home-quick">
        <header><div><span>ATALHOS</span><h3>Ações frequentes</h3></div><small>Menos passos para as rotinas do dia a dia.</small></header>
        <div>
          <button type="button" onClick={() => onNavigate('users')}><i>＋</i><span><b>Novo usuário</b><small>Cadastrar e gerenciar acessos</small></span></button>
          <button type="button" onClick={() => onNavigate('establishments')}><i>⌂</i><span><b>Estabelecimentos</b><small>Dados, logo, capa e publicação</small></span></button>
          <button type="button" onClick={() => onNavigate('items')}><i>▣</i><span><b>Itens</b><small>Produtos e serviços do ecossistema</small></span></button>
          <button type="button" onClick={() => onNavigate('financial')}><i>¤</i><span><b>Financeiro</b><small>Pedidos, pagamentos e indicadores</small></span></button>
        </div>
      </section>

      <div className="admin-home-columns">
        <section className="admin-home-panel">
          <header><div><span>USUÁRIOS RECENTES</span><b>Novos cadastros</b></div><button type="button" onClick={() => onNavigate('users')}>Ver todos</button></header>
          <div className="admin-home-list">
            {recentUsers.slice(0, 6).map(user => <article key={user.id}><div><b>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.user_name || 'Usuário'}</b><span>{user.email}</span></div><small>#{user.id}</small></article>)}
            {!recentUsers.length && <p>Nenhum cadastro recente disponível.</p>}
          </div>
        </section>

        <section className="admin-home-panel">
          <header><div><span>ATIVIDADE RECENTE</span><b>Movimento do ecossistema</b></div><button type="button" onClick={() => onNavigate('activity')}>Abrir atividade</button></header>
          <div className="admin-home-list">
            {recentActivity.slice(0, 6).map((row, index) => <article key={row.id || index}><div><b>{String(row.type || row.interaction_type || 'atividade').replaceAll('_', ' ')}</b><span>{row.application?.name || row.user?.email || row.name || 'Ecossistema'}</span></div><small>{row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}</small></article>)}
            {!recentActivity.length && <p>Nenhuma atividade recente disponível.</p>}
          </div>
        </section>
      </div>

      <section className="admin-home-apps">
        <header><div><span>ECOSSISTEMA</span><h3>Plataformas Peter Tecnet</h3></div><button type="button" onClick={() => onNavigate('applications')}>Gerenciar aplicações</button></header>
        <div>
          {operationalApps.slice(0, 10).map(app => <a key={app.id} href={app.url} target="_blank" rel="noreferrer"><img src={app.logo || '/petertecnetlogo.png'} alt=""/><span><b>{app.name}</b><small>Abrir plataforma ↗</small></span></a>)}
          {!operationalApps.length && <p>Nenhuma aplicação ativa disponível.</p>}
        </div>
      </section>
    </section>,
    target,
  )
}

export default function AdminHomeBridge() {
  const { navigate: navigateTab } = useAdminUi()
  const [home, setHome] = useState(() => normalizeAdminPath(window.location.pathname) === '/admin')
  const [mainTarget, setMainTarget] = useState(null)
  const [actionsTarget, setActionsTarget] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(() => normalizeAdminPath(window.location.pathname) === '/admin')
  const [error, setError] = useState('')
  const [lastPath, setLastPath] = useState(() => localStorage.getItem(LAST_PATH_KEY) || '')

  const activeApplicationUrls = useMemo(() => new Set(applications.map(app => app?.url).filter(Boolean)), [applications])

  function syncTargets() {
    const legacyMain = document.querySelector('.admin-persistent-main > .ecosystem-shell > .ecosystem-main')
    setMainTarget(current => current?.isConnected ? current : legacyMain)
    setActionsTarget(current => current?.isConnected ? current : legacyMain?.querySelector('.ecosystem-top .top-actions') || null)
  }

  function rememberPath(path) {
    const normalized = normalizeAdminPath(path)
    if (!normalized.startsWith('/admin/') || normalized === '/admin/') return
    localStorage.setItem(LAST_PATH_KEY, normalized)
    setLastPath(normalized)
  }

  function goHome({ replace = false } = {}) {
    navigateTab('home', { replace })
    setHome(true)
  }

  function navigate(destination) {
    if (typeof destination === 'string' && destination.startsWith('/admin/')) {
      const normalized = normalizeAdminPath(destination)
      const exactBaseTab = ADMIN_TABS.find(item => normalizeAdminPath(item.path) === normalized)
      if (exactBaseTab) {
        navigateTab(exactBaseTab.key)
      } else {
        const key = adminTabFromLocation(normalized)
        window.history.pushState({ adminTab: key }, '', normalized)
        navigateTab(key, { preservePath: true })
      }
      rememberPath(normalized)
      setHome(false)
      return
    }
    if (!ADMIN_TABS.some(item => item.key === destination)) return
    navigateTab(destination)
    rememberPath(ADMIN_TABS.find(item => item.key === destination)?.path || '')
    setHome(destination === 'home')
  }

  useEffect(() => {
    syncTargets()
    const observer = new MutationObserver(syncTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      const path = normalizeAdminPath(window.location.pathname)
      const nextHome = path === '/admin'
      setHome(nextHome)
      if (!nextHome) rememberPath(path)
    }
    window.addEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.allSettled([api('/admin/ecosystem/dashboard'), api('/admin/applications')]).then(([dashboardResult, appsResult]) => {
      if (!active) return
      if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value)
      else setError(dashboardResult.reason?.message || 'Não foi possível carregar os indicadores.')
      if (appsResult.status === 'fulfilled') setApplications(appsResult.value?.applications || appsResult.value?.data || [])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!mainTarget) return
    mainTarget.classList.toggle('admin-home-mode', home)
    document.body.classList.toggle('admin-home-active', home)
    const title = mainTarget.querySelector('.ecosystem-top h1')
    const kicker = mainTarget.querySelector('.ecosystem-top .admin-kicker')
    if (home) {
      if (title && !title.dataset.homePrevious) title.dataset.homePrevious = title.textContent
      if (kicker && !kicker.dataset.homePrevious) kicker.dataset.homePrevious = kicker.textContent
      if (title) title.textContent = 'Início'
      if (kicker) kicker.textContent = 'Peter Tecnet Admin Center'
    } else {
      if (title?.dataset.homePrevious) { title.textContent = title.dataset.homePrevious; delete title.dataset.homePrevious }
      if (kicker?.dataset.homePrevious) { kicker.textContent = kicker.dataset.homePrevious; delete kicker.dataset.homePrevious }
    }
    return () => {
      mainTarget.classList.remove('admin-home-mode')
      document.body.classList.remove('admin-home-active')
    }
  }, [home, mainTarget])

  return <>
    <EcosystemSwitcher target={actionsTarget} applications={applications.filter(app => !activeApplicationUrls.has('https://petertecnet.com.br/'))} />
    {home && <HomeContent target={mainTarget} dashboard={dashboard} applications={applications} loading={loading} error={error} lastPath={lastPath} onNavigate={navigate} />}
  </>
}
