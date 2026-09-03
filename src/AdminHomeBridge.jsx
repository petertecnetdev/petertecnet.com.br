import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminHomeBridge.css'

const API = 'https://api.petertecnet.com.br/api'
const LAST_PATH_KEY = 'petertecnet_admin_last_path_v1'

const NAV = {
  command: { label: 'Mission Control', path: '/admin/mission-control' },
  dashboard: { label: 'Visão geral', path: '/admin/overview' },
  activity: { label: 'Atividade', path: '/admin/activity' },
  financial: { label: 'Financeiro', path: '/admin/financial' },
  applications: { label: 'Aplicações', path: '/admin/applications' },
  users: { label: 'Usuários', path: '/admin/users' },
  profiles: { label: 'Perfis e permissões', path: '/admin/profiles' },
  establishments: { label: 'Estabelecimentos', path: '/admin/establishments' },
  items: { label: 'Itens', path: '/admin/items' },
  site: { label: 'Site institucional', path: '/admin/site' },
  audit: { label: 'Auditoria', path: '/admin/audit' },
}

const normalizePath = path => (path || '/').replace(/\/+$/, '') || '/'
const getToken = () => localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token')

async function api(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || 'Não foi possível carregar a Home administrativa.')
  return data
}

function HomeNavButton({ target, active, onHome }) {
  if (!target) return null
  return createPortal(
    <button type="button" className={`admin-home-nav-button ${active ? 'active' : ''}`} onClick={onHome} aria-current={active ? 'page' : undefined}>
      <span className="admin-home-nav-icon">⌂</span> Início
    </button>,
    target,
  )
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
  const initialPath = useRef(normalizePath(window.location.pathname))
  const userNavigated = useRef(false)
  const [home, setHome] = useState(initialPath.current === '/admin')
  const [mainTarget, setMainTarget] = useState(null)
  const [navTarget, setNavTarget] = useState(null)
  const [actionsTarget, setActionsTarget] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(initialPath.current === '/admin')
  const [error, setError] = useState('')
  const [lastPath, setLastPath] = useState(() => localStorage.getItem(LAST_PATH_KEY) || '')

  const activeApplicationUrls = useMemo(() => new Set(applications.map(app => app?.url).filter(Boolean)), [applications])

  function syncTargets() {
    setMainTarget(current => current?.isConnected ? current : document.querySelector('.ecosystem-main'))
    setNavTarget(current => current?.isConnected ? current : document.querySelector('.ecosystem-sidebar nav'))
    setActionsTarget(current => current?.isConnected ? current : document.querySelector('.ecosystem-top .top-actions'))
  }

  function goHome({ replace = false } = {}) {
    const method = replace ? 'replaceState' : 'pushState'
    if (normalizePath(window.location.pathname) !== '/admin') window.history[method]({ adminHome: true }, '', '/admin')
    setHome(true)
  }

  function navigate(destination) {
    if (typeof destination === 'string' && destination.startsWith('/admin/')) {
      const item = Object.entries(NAV).find(([, value]) => value.path === destination || (destination === '/admin/dashboard' && value.path === '/admin/overview'))
      if (item) return navigate(item[0])
      window.history.pushState({}, '', destination)
      setHome(false)
      return
    }
    const item = NAV[destination]
    if (!item) return
    const button = document.querySelector(`.ecosystem-sidebar nav button[data-admin-tab="${destination}"]`) || [...document.querySelectorAll('.ecosystem-sidebar nav button')].find(candidate => candidate.textContent.trim().includes(item.label))
    if (button) button.click()
    else {
      window.history.pushState({ adminTab: destination }, '', item.path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    setHome(false)
  }

  useEffect(() => {
    syncTargets()
    const observer = new MutationObserver(syncTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const originalPush = window.history.pushState
    const originalReplace = window.history.replaceState
    const emit = () => window.dispatchEvent(new Event('petertecnet:admin-route'))
    const pushWrapper = function (...args) { originalPush.apply(window.history, args); emit() }
    const replaceWrapper = function (...args) { originalReplace.apply(window.history, args); emit() }
    window.history.pushState = pushWrapper
    window.history.replaceState = replaceWrapper

    const syncRoute = () => {
      const path = normalizePath(window.location.pathname)
      const nextHome = path === '/admin'
      setHome(nextHome)
      if (!nextHome && path.startsWith('/admin/')) {
        localStorage.setItem(LAST_PATH_KEY, path)
        setLastPath(path)
      }
    }
    const onPop = () => {
      const wasHome = normalizePath(window.location.pathname) === '/admin'
      syncRoute()
      if (wasHome) window.setTimeout(() => { if (!userNavigated.current) goHome({ replace: true }) }, 70)
    }
    window.addEventListener('petertecnet:admin-route', syncRoute)
    window.addEventListener('popstate', onPop)

    const initialWasHome = initialPath.current === '/admin'
    const keepHome = window.setTimeout(() => {
      if (initialWasHome && !userNavigated.current) goHome({ replace: true })
    }, 90)

    return () => {
      window.clearTimeout(keepHome)
      window.removeEventListener('petertecnet:admin-route', syncRoute)
      window.removeEventListener('popstate', onPop)
      if (window.history.pushState === pushWrapper) window.history.pushState = originalPush
      if (window.history.replaceState === replaceWrapper) window.history.replaceState = originalReplace
    }
  }, [])

  useEffect(() => {
    const onCapture = event => {
      const brand = event.target.closest?.('.ecosystem-brand')
      if (brand) {
        event.preventDefault()
        event.stopPropagation()
        userNavigated.current = false
        goHome()
        return
      }
      const navButton = event.target.closest?.('.ecosystem-sidebar nav button:not(.admin-home-nav-button)')
      if (navButton) userNavigated.current = true
    }
    document.addEventListener('click', onCapture, true)
    return () => document.removeEventListener('click', onCapture, true)
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

  useEffect(() => {
    if (!home) userNavigated.current = false
  }, [home])

  return <>
    <HomeNavButton target={navTarget} active={home} onHome={() => { userNavigated.current = false; goHome() }} />
    <EcosystemSwitcher target={actionsTarget} applications={applications.filter(app => !activeApplicationUrls.has('https://petertecnet.com.br/'))} />
    {home && <HomeContent target={mainTarget} dashboard={dashboard} applications={applications} loading={loading} error={error} lastPath={lastPath} onNavigate={navigate} />}
  </>
}
