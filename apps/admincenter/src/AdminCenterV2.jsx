import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminModuleBoundary from './AdminModuleBoundary.jsx'
import { adminRequest as request } from './adminApi.js'
import { loadGoogleIdentity } from './services/googleIdentity.js'
import AdminEcosystemResourceCenter from './AdminEcosystemResourceCenter.jsx'
import './AdminCenterV2.css'

const AdminUsersCenter = lazy(() => import('./AdminUsersCenter.jsx'))
const AdminEstablishmentsPage = lazy(() => import('./AdminEstablishmentsPageV2.jsx'))
const AdminItemsManager = lazy(() => import('./AdminItemsManager.jsx'))
const AdminApplicationsCenter = lazy(() => import('./AdminApplicationsCenter.jsx'))
const NotificationsCenter = lazy(() => import('./NotificationsCenter.jsx'))
const AgentChatPanel = lazy(() => import('./AgentChatPanel.jsx'))
const AdminPayoutCenter = lazy(() => import('./AdminPayoutCenter.jsx'))

const TOKEN_KEY = 'petertecnet_admin_token'
const OWNER_EMAIL = 'petertecnet@gmail.com'

const NAV_GROUPS = Object.freeze([
  {
    label: 'NÚCLEO',
    items: [
      ['users', 'Usuários', 'users'],
      ['profiles', 'Perfis e permissões', 'shield'],
      ['applications', 'Aplicações', 'apps'],
      ['establishments', 'Estabelecimentos', 'building'],
    ],
  },
  {
    label: 'OPERAÇÃO',
    items: [
      ['items', 'Itens', 'box'],
      ['events', 'Eventos', 'calendar'],
      ['orders', 'Pedidos', 'orders'],
      ['payments', 'Pagamentos', 'finance'],
      ['payouts', 'Repasses', 'wallet'],
    ],
  },
  {
    label: 'CONTROLE',
    items: [
      ['files', 'Arquivos', 'files'],
      ['audit', 'Auditoria', 'audit'],
      ['notifications', 'Notificações', 'bell'],
      ['agents', 'Agentes', 'agents'],
      ['activity', 'Atividade', 'activity'],
      ['operations', 'Operações', 'pulse'],
    ],
  },
])

const PAGE_CONFIG = Object.freeze({
  users: { slug: 'usuarios', label: 'Usuários', description: 'Pessoas, acessos e vínculos em todo o ecossistema.' },
  profiles: { slug: 'perfis', label: 'Perfis e permissões', description: 'Papéis administrativos e permissões compartilhadas.' },
  applications: { slug: 'aplicacoes', label: 'Aplicações', description: 'Aplicações conectadas à API central e seu estado operacional.' },
  establishments: { slug: 'estabelecimentos', label: 'Estabelecimentos', description: 'Empresas, produções e organizações vinculadas aos usuários.' },
  items: { slug: 'itens', label: 'Itens', description: 'Produtos, serviços, ingressos e itens vinculados aos estabelecimentos.' },
  events: { slug: 'eventos', label: 'Eventos', description: 'Eventos de todas as aplicações com contexto de origem.' },
  orders: { slug: 'pedidos', label: 'Pedidos', description: 'Pedidos de todas as aplicações e seus clientes.' },
  payments: { slug: 'pagamentos', label: 'Pagamentos', description: 'Transações financeiras consolidadas por aplicação.' },
  payouts: { slug: 'repasses', label: 'Repasses', description: 'Repasses pendentes, concluídos e com falha.' },
  files: { slug: 'arquivos', label: 'Arquivos', description: 'Inventário de arquivos e mídias do ecossistema.' },
  audit: { slug: 'auditoria', label: 'Auditoria', description: 'Histórico de alterações administrativas.' },
  notifications: { slug: 'notificacoes', label: 'Notificações', description: 'Comunicações e campanhas do ecossistema.' },
  agents: { slug: 'agentes', label: 'Agentes', description: 'Central de comunicação e acompanhamento dos agentes.' },
  activity: { slug: 'atividade', label: 'Atividade', description: 'Telemetria recente de usuários e aplicações.' },
  operations: { slug: 'operacoes', label: 'Operações', description: 'Saúde, incidentes e sinais críticos do ecossistema.' },
})

const PAGE_BY_SLUG = Object.fromEntries(Object.entries(PAGE_CONFIG).flatMap(([key, page]) => [[key, key], [page.slug, key]]))
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(group => group.items)

function pageFromLocation() {
  const url = new URL(window.location.href)
  const token = String(url.searchParams.get('page') || '').trim().toLowerCase()
  return PAGE_BY_SLUG[token] || 'users'
}

function writePage(page) {
  const url = new URL(window.location.href)
  if (page === 'users') url.searchParams.delete('page')
  else url.searchParams.set('page', PAGE_CONFIG[page]?.slug || PAGE_CONFIG.users.slug)
  url.hash = ''
  window.history.pushState({ ...(window.history.state || {}), adminPage: page }, '', `${url.pathname}${url.search}`)
}

function tokenFrom(payload) {
  return payload?.token?.access_token || payload?.access_token || payload?.token || ''
}

function userFrom(payload) {
  return payload?.token?.user || payload?.user || null
}

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Administrador'
}

function compactNumber(value) {
  const number = Number(value)
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number.isFinite(number) ? number : 0)
}

function currency(value) {
  const number = Number(value)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(number) ? number : 0)
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function AdminIcon({ name }) {
  const paths = {
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.7-4 2.8-6 6-6s5.3 2 6 6M16 5.5a3 3 0 0 1 0 5.8M17 14c2.5.3 4 2.1 4 5"/>',
    shield: '<path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    building: '<path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M18 13h1"/>',
    box: '<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    orders: '<path d="M5 4h14v17l-3-2-4 2-4-2-3 2zM8 9h8M8 13h8"/>',
    finance: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    wallet: '<path d="M4 6h14a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12M15 12h5"/>',
    files: '<path d="M5 3h9l5 5v13H5zM14 3v6h6"/>',
    audit: '<path d="M9 4h6M8 2h8v4H8zM6 5H4v16h16V5h-2M8 11h8M8 15h5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    agents: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.5-4 2.7-6 5.5-6s5 2 5.5 6M14 15c3.2-.8 5.7 1.2 6.5 4"/>',
    activity: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: paths[name] || paths.pulse }}/>
}

function Login({ onAuthenticated }) {
  const [form, setForm] = useState({ email: OWNER_EMAIL, password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleStatus, setGoogleStatus] = useState('loading')
  const googleButtonRef = useRef(null)
  const busyRef = useRef(false)

  const complete = useCallback(payload => {
    const token = tokenFrom(payload)
    const user = userFrom(payload)
    if (!token) throw new Error('A API não retornou uma sessão válida.')
    if (String(user?.email || '').toLowerCase() !== OWNER_EMAIL) throw new Error('Usuário sem acesso ao Admin Center.')
    localStorage.setItem(TOKEN_KEY, token)
    onAuthenticated(user)
  }, [onAuthenticated])

  useEffect(() => {
    let active = true
    async function bootGoogle() {
      try {
        const providers = await request('/account/identity/providers')
        const clientId = String(providers?.google?.client_id || '').trim()
        if (!providers?.google?.enabled || !clientId) { if (active) setGoogleStatus('unavailable'); return }
        const identity = await loadGoogleIdentity()
        if (!active || !googleButtonRef.current) return
        identity.initialize({
          client_id: clientId,
          cancel_on_tap_outside: false,
          callback: async ({ credential }) => {
            if (!credential || busyRef.current) return
            busyRef.current = true
            setLoading(true)
            setError('')
            try {
              const payload = await request('/auth/google', { method: 'POST', body: JSON.stringify({ token_id: credential }) })
              if (active) complete(payload)
            } catch (err) {
              localStorage.removeItem(TOKEN_KEY)
              if (active) setError(err?.message || 'Não foi possível entrar com o Google.')
            } finally {
              busyRef.current = false
              if (active) setLoading(false)
            }
          },
        })
        googleButtonRef.current.replaceChildren()
        identity.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'left', width: 340, locale: 'pt-BR' })
        if (active) setGoogleStatus('ready')
      } catch {
        if (active) setGoogleStatus('unavailable')
      }
    }
    void bootGoogle()
    return () => { active = false }
  }, [complete])

  async function submit(event) {
    event.preventDefault()
    if (loading || busyRef.current) return
    setLoading(true)
    setError('')
    try {
      const payload = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username: form.email.trim().toLowerCase(), password: form.password }) })
      complete(payload)
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY)
      setError(err?.message || 'Não foi possível autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="login-screen">
    <div className="login-aura aura-one"/><div className="login-aura aura-two"/>
    <section className="login-copy">
      <a className="brand brand-large" href="https://petertecnet.com.br/" target="_blank" rel="noreferrer"><span className="brand-logo"><img src="/petertecnet-brand.svg" alt=""/></span><span><b>Peter Tecnet</b><small>Admin Center</small></span></a>
      <div><p className="eyebrow">ECOSYSTEM CONTROL / PRIVATE</p><h1>Gestão do ecossistema em uma única visão.</h1><p>Usuários, aplicações, estabelecimentos, recursos e operação conectados à API central.</p></div>
      <small className="login-security">Sessão autenticada pela API Peter Tecnet · acesso administrativo restrito</small>
    </section>
    <section className="login-panel"><form className="login-card" onSubmit={submit}>
      <div className="login-mark"><img src="/petertecnet-brand.svg" alt="Peter Tecnet"/></div><p className="eyebrow">ADMIN CENTER</p><h2>Entrar</h2>
      <p className="muted">Entre com a conta Google da Peter Tecnet ou use sua senha administrativa.</p>
      {googleStatus !== 'unavailable' && <div className={`admin-google-login status-${googleStatus}`}><div ref={googleButtonRef}/>{googleStatus === 'loading' && <small>Carregando acesso seguro com Google…</small>}</div>}
      {googleStatus === 'ready' && <div className="login-divider"><span>ou use sua senha</span></div>}
      <label>E-mail<input type="email" autoComplete="username" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required/></label>
      <label>Senha<input type="password" autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required/></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-button" disabled={loading}>{loading ? 'Autenticando…' : 'Acessar Admin Center'}<span>↗</span></button>
    </form></section>
  </main>
}

function ModuleSkeleton({ title }) {
  return <div className="admin-module-skeleton" role="status" aria-live="polite"><span/><div><b>{title}</b><small>Preparando a área administrativa.</small></div></div>
}

function Overview({ dashboard, financial, command, onNavigate }) {
  const summary = dashboard?.summary || {}
  const totals = financial?.summary?.totals || {}
  const issues = command?.issues?.data || command?.issues || []
  return <div className="acv-overview">
    <div className="acv-metrics">
      <button onClick={() => onNavigate('users')}><span>Usuários</span><strong>{compactNumber(summary.users)}</strong><small>{compactNumber(summary.active_users_30d)} ativos em 30 dias</small></button>
      <button onClick={() => onNavigate('applications')}><span>Aplicações</span><strong>{compactNumber(summary.applications)}</strong><small>{compactNumber(summary.active_applications)} ativas</small></button>
      <button onClick={() => onNavigate('establishments')}><span>Estabelecimentos</span><strong>{compactNumber(summary.establishments)}</strong><small>{compactNumber(summary.published_establishments)} publicados</small></button>
      <button onClick={() => onNavigate('payments')}><span>Volume processado</span><strong>{currency(totals.gross)}</strong><small>{compactNumber(totals.transactions)} transações</small></button>
    </div>
    <section className="acv-panel"><header><div><span>OPERAÇÃO</span><h3>Sinais que exigem atenção</h3></div><strong>{issues.length}</strong></header>
      <div className="acv-simple-list">{issues.length ? issues.slice(0, 12).map((issue, index) => <article key={issue.id || issue.public_id || index}><div><strong>{issue.title || issue.name || 'Sinal operacional'}</strong><small>{issue.message || issue.description || issue.status || issue.severity || 'Sem detalhes adicionais'}</small></div><span>{issue.severity || issue.status || 'info'}</span></article>) : <p>Nenhum sinal crítico retornado pela API.</p>}</div>
    </section>
  </div>
}

function ActivityPage({ activity }) {
  const rows = activity?.activity || []
  return <section className="acv-panel"><header><div><span>TELEMETRIA</span><h3>Atividade recente</h3></div><strong>{compactNumber(activity?.summary?.total || rows.length)}</strong></header>
    <div className="acv-simple-list">{rows.length ? rows.slice(0, 100).map((row, index) => <article key={row.id || index}><div><strong>{row.name || row.type || row.interaction_type || 'Interação'}</strong><small>{row.user?.email || row.user_email || row.application?.name || row.application_name || row.route || 'Ecossistema Peter Tecnet'}</small></div><span>{dateTime(row.created_at)}</span></article>) : <p>Nenhuma atividade retornada.</p>}</div>
  </section>
}

function Dashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState(pageFromLocation)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 981px)').matches)
  const [menuSearch, setMenuSearch] = useState('')
  const [applications, setApplications] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [financial, setFinancial] = useState(null)
  const [activity, setActivity] = useState(null)
  const [command, setCommand] = useState(null)
  const [loadingContext, setLoadingContext] = useState(true)
  const [contextError, setContextError] = useState('')
  const sidebarRef = useRef(null)

  const loadContext = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoadingContext(true)
    const endpoints = [
      ['/admin/applications', 'applications'],
      ['/admin/ecosystem/dashboard', 'dashboard'],
      ['/admin/ecosystem/financial/dashboard', 'financial'],
      ['/admin/ecosystem/activity?per_page=100', 'activity'],
      ['/admin/ecosystem/command/overview', 'command'],
    ]
    const settled = await Promise.allSettled(endpoints.map(([path]) => request(path)))
    let failures = 0
    settled.forEach((result, index) => {
      if (result.status !== 'fulfilled') { failures += 1; return }
      const key = endpoints[index][1]
      if (key === 'applications') setApplications(result.value?.applications || result.value?.data || (Array.isArray(result.value) ? result.value : []))
      if (key === 'dashboard') setDashboard(result.value)
      if (key === 'financial') setFinancial(result.value)
      if (key === 'activity') setActivity(result.value)
      if (key === 'command') setCommand(result.value)
    })
    setContextError(failures === endpoints.length ? 'Não foi possível carregar o contexto administrativo.' : failures ? `${failures} fonte(s) do contexto não responderam; os módulos disponíveis continuam utilizáveis.` : '')
    setLoadingContext(false)
  }, [])

  useEffect(() => { void loadContext() }, [loadContext])
  useEffect(() => {
    const onPop = () => setActivePage(pageFromLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    document.title = `${PAGE_CONFIG[activePage]?.label || 'Admin Center'} · Admin Center · Peter Tecnet`
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activePage])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 981px)')
    const sync = event => setSidebarOpen(event?.matches ?? media.matches)
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])
  useEffect(() => {
    if (!sidebarOpen || !window.matchMedia('(max-width: 980px)').matches) return undefined
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [sidebarOpen])

  function go(page) {
    if (!PAGE_CONFIG[page]) return
    setActivePage(page)
    writePage(page)
    if (window.matchMedia('(max-width: 980px)').matches) setSidebarOpen(false)
  }

  const visibleGroups = useMemo(() => {
    const needle = menuSearch.trim().toLocaleLowerCase('pt-BR')
    if (!needle) return NAV_GROUPS
    return NAV_GROUPS.map(group => ({ ...group, items: group.items.filter(([, label]) => label.toLocaleLowerCase('pt-BR').includes(needle)) })).filter(group => group.items.length)
  }, [menuSearch])

  const page = PAGE_CONFIG[activePage] || PAGE_CONFIG.users
  const reloadApplications = useCallback(async () => {
    const payload = await request('/admin/applications')
    const rows = payload?.applications || payload?.data || (Array.isArray(payload) ? payload : [])
    setApplications(rows)
    return rows
  }, [])

  return <div className="admin-shell acv-shell" data-admin-page={activePage} data-sidebar-open={sidebarOpen ? 'true' : 'false'}>
    <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} aria-hidden="true"/>
    <aside ref={sidebarRef} id="admin-navigation" className={`sidebar acv-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navegação administrativa">
      <a className="brand" href="?" onClick={event => { event.preventDefault(); go('users') }}><span className="brand-logo"><img src="/petertecnet-brand.svg" alt=""/></span><span><b>Peter Tecnet</b><small>Admin Center</small></span></a>
      <label className="acv-menu-search"><span>⌕</span><input value={menuSearch} onChange={event => setMenuSearch(event.target.value)} placeholder="Localizar menu" aria-label="Localizar menu"/></label>
      <nav>
        {visibleGroups.map(group => <div className="acv-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([id, label, icon]) => <button key={id} type="button" className={activePage === id ? 'active' : ''} aria-current={activePage === id ? 'page' : undefined} onClick={() => go(id)}><span><AdminIcon name={icon}/></span><b>{label}</b><i>→</i></button>)}</div>)}
      </nav>
      <div className="sidebar-user"><div className="avatar">{fullName(user).slice(0, 2).toUpperCase()}</div><div><b>{fullName(user)}</b><small>{user?.email}</small></div><button onClick={onLogout} aria-label="Sair">↪</button></div>
    </aside>

    <main className="workspace acv-workspace">
      <header className="topbar acv-topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(value => !value)} aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={sidebarOpen} aria-controls="admin-navigation"><span/><span/><span/></button>
        <div className="acv-page-title"><span>ADMIN CENTER / {page.label.toUpperCase()}</span><strong>{page.label}</strong><small>{page.description}</small></div>
        <button className="acv-refresh" type="button" onClick={() => loadContext()} disabled={loadingContext}>{loadingContext ? 'Atualizando…' : 'Atualizar'}</button>
      </header>

      <div className="content acv-content">
        {contextError && <div className="notice">{contextError}<button onClick={() => loadContext()}>Tentar novamente</button></div>}

        {activePage === 'users' && <AdminModuleBoundary name="Usuários"><Suspense fallback={<ModuleSkeleton title="Carregando usuários…"/>}><AdminUsersCenter apiRequest={request} applications={applications}/></Suspense></AdminModuleBoundary>}
        {activePage === 'profiles' && <AdminEcosystemResourceCenter resource="profiles" apiRequest={request} applications={applications}/>} 
        {activePage === 'applications' && <AdminModuleBoundary name="Aplicações"><Suspense fallback={<ModuleSkeleton title="Carregando aplicações…"/>}><AdminApplicationsCenter applications={applications} dashboard={dashboard} financial={financial} activity={activity} command={command} request={request} onReload={reloadApplications}/></Suspense></AdminModuleBoundary>}
        {activePage === 'establishments' && <AdminModuleBoundary name="Estabelecimentos"><Suspense fallback={<ModuleSkeleton title="Carregando estabelecimentos…"/>}><AdminEstablishmentsPage/></Suspense></AdminModuleBoundary>}
        {activePage === 'items' && <AdminModuleBoundary name="Itens"><Suspense fallback={<ModuleSkeleton title="Carregando itens…"/>}><AdminItemsManager applications={applications}/></Suspense></AdminModuleBoundary>}
        {activePage === 'events' && <AdminEcosystemResourceCenter resource="events" apiRequest={request} applications={applications}/>} 
        {activePage === 'orders' && <AdminEcosystemResourceCenter resource="orders" apiRequest={request} applications={applications}/>} 
        {activePage === 'payments' && <AdminEcosystemResourceCenter resource="payments" apiRequest={request} applications={applications}/>} 
        {activePage === 'payouts' && <AdminModuleBoundary name="Repasses"><Suspense fallback={<ModuleSkeleton title="Carregando repasses…"/>}><AdminPayoutCenter request={request}/></Suspense></AdminModuleBoundary>}
        {activePage === 'files' && <AdminEcosystemResourceCenter resource="files" apiRequest={request} applications={applications}/>} 
        {activePage === 'audit' && <AdminEcosystemResourceCenter resource="audit" apiRequest={request} applications={applications}/>} 
        {activePage === 'notifications' && <AdminModuleBoundary name="Notificações"><Suspense fallback={<ModuleSkeleton title="Carregando notificações…"/>}><NotificationsCenter request={request} applications={applications}/></Suspense></AdminModuleBoundary>}
        {activePage === 'agents' && <AdminModuleBoundary name="Agentes"><Suspense fallback={<ModuleSkeleton title="Carregando agentes…"/>}><AgentChatPanel request={request}/></Suspense></AdminModuleBoundary>}
        {activePage === 'activity' && <ActivityPage activity={activity}/>} 
        {activePage === 'operations' && <Overview dashboard={dashboard} financial={financial} command={command} onNavigate={go}/>} 
      </div>
    </main>
  </div>
}

export default function AdminCenterV2() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    let active = true
    async function validate() {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) { if (active) setChecking(false); return }
      try {
        const payload = await request('/auth/me')
        const current = payload?.user || payload
        if (String(current?.email || '').toLowerCase() !== OWNER_EMAIL) throw new Error('Acesso não autorizado.')
        if (active) setUser(current)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        if (active) setUser(null)
      } finally {
        if (active) setChecking(false)
      }
    }
    void validate()
    const expired = () => { setUser(null); setChecking(false) }
    window.addEventListener('admin-session-expired', expired)
    return () => { active = false; window.removeEventListener('admin-session-expired', expired) }
  }, [])

  async function logout() {
    try { await request('/auth/logout', { method: 'POST' }) } catch {}
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  if (checking) return <div className="boot-screen"><img src="/petertecnet-brand.svg" alt=""/><span/><p>Validando sessão administrativa…</p></div>
  return user ? <Dashboard user={user} onLogout={logout}/> : <Login onAuthenticated={setUser}/>
}
