import { useCallback, useEffect, useRef, useState } from 'react'
import NotificationsCenter from './NotificationsCenter'
import AdminUsersCenter from './AdminUsersCenter.jsx'
import AdminEstablishmentsPage from './AdminEstablishmentsPageV2.jsx'
import AdminItemsManager from './AdminItemsManager.jsx'
import AdminCutinappCenter from './AdminCutinappCenter.jsx'
import AdminModuleBoundary from './AdminModuleBoundary.jsx'
import ExecutiveOverview from './ExecutiveOverview.jsx'
import { useAdminAuth } from './adminAuth.js'
import { useAdminData } from './adminData.js'
import { ADMIN_RELEASE_LABEL } from './adminVersion.js'

const navItems = [
  ['dashboard', 'Visão geral', '⌂', 'visao-geral'],
  ['operations', 'Operações', '◈', 'operacoes'],
  ['financial', 'Financeiro', '◒', 'financeiro'],
  ['applications', 'Aplicações', '◇', 'aplicacoes'],
  ['cutinapp', 'Cutinapp', '◉', 'cutinapp'],
  ['users', 'Usuários', '◎', 'usuarios'],
  ['establishments', 'Estabelecimentos', '▰', 'estabelecimentos'],
  ['items', 'Itens', '▣', 'itens'],
  ['support', 'Suporte', '◌', 'suporte'],
  ['telemetry', 'Telemetria', '◉', 'telemetria'],
  ['notifications', 'Notificações', '✦', 'notificacoes'],
  ['activity', 'Atividade', '↯', 'atividade'],
]

const PAGE_BY_SLUG = Object.fromEntries(navItems.map(([id, , , slug]) => [slug, id]))
const SLUG_BY_PAGE = Object.fromEntries(navItems.map(([id, , , slug]) => [id, slug]))

function pageFromLocation() {
  const token = new URL(window.location.href).searchParams.get('page') || ''
  return PAGE_BY_SLUG[token] || 'dashboard'
}

function writePage(page, mode = 'pushState') {
  const url = new URL(window.location.href)
  if (page === 'dashboard') url.searchParams.delete('page')
  else url.searchParams.set('page', SLUG_BY_PAGE[page] || page)
  url.hash = ''
  window.history[mode]({ ...(window.history.state || {}), adminPage: page }, '', `${url.pathname}${url.search}`)
}

const groupLabels = {
  users: 'Usuários', applications: 'Aplicações', establishments: 'Estabelecimentos',
  items: 'Itens', events: 'Eventos', orders: 'Pedidos', payments: 'Pagamentos',
}

let googleIdentityPromise

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (googleIdentityPromise) return googleIdentityPromise
  googleIdentityPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const identity = window.google?.accounts?.id
      if (identity) resolve(identity)
      else reject(new Error('O Google Identity não ficou disponível.'))
    }
    const existing = document.querySelector('script[data-admin-google-identity]')
    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o login com Google.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.adminGoogleIdentity = 'true'
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => reject(new Error('Não foi possível carregar o login com Google.')), { once: true })
    document.head.appendChild(script)
  })
  return googleIdentityPromise
}

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compactNumber(value) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(number(value))
}

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(number(value))
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function SessionUnavailable({ message, onRetry, onLogout }) {
  return <main className="boot-screen admin-session-unavailable">
    <img src="/petertecnetlogo.png" alt=""/>
    <h2>Não foi possível validar sua sessão agora.</h2>
    <p>{message || 'A API administrativa está temporariamente indisponível.'}</p>
    <div><button type="button" className="primary-button" onClick={onRetry}>Tentar novamente ↻</button><button type="button" className="admin-session-secondary" onClick={onLogout}>Sair desta sessão</button></div>
  </main>
}

function Login({ login, loginWithGoogle, getIdentityProviders, initialError = '' }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [retryAfter, setRetryAfter] = useState(0)
  const [googleStatus, setGoogleStatus] = useState('loading')
  const submittingRef = useRef(false)
  const googleBusyRef = useRef(false)
  const googleButtonRef = useRef(null)

  useEffect(() => {
    if (retryAfter <= 0) return undefined
    const timer = window.setTimeout(() => {
      setRetryAfter(current => {
        if (current <= 1) {
          setError(message => message.startsWith('Muitas tentativas') ? '' : message)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [retryAfter])

  const bootGoogle = useCallback(async () => {
    const providers = await getIdentityProviders()
    const clientId = String(providers?.google?.client_id || '').trim()
    if (!providers?.google?.enabled || !clientId) return false
    const identity = await loadGoogleIdentity()
    if (!googleButtonRef.current) return false
    identity.initialize({
      client_id: clientId,
      cancel_on_tap_outside: false,
      callback: async ({ credential }) => {
        if (!credential || googleBusyRef.current || submittingRef.current) return
        googleBusyRef.current = true
        setLoading(true)
        setError('')
        try {
          await loginWithGoogle(credential)
        } catch (err) {
          setError(err?.message || 'Não foi possível entrar com o Google.')
        } finally {
          googleBusyRef.current = false
          setLoading(false)
        }
      },
    })
    googleButtonRef.current.replaceChildren()
    const buttonWidth = Math.max(220, Math.min(346, Math.floor(googleButtonRef.current.getBoundingClientRect().width || 346)))
    identity.renderButton(googleButtonRef.current, {
      theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular',
      logo_alignment: 'left', width: buttonWidth, locale: 'pt-BR',
    })
    return true
  }, [getIdentityProviders, loginWithGoogle])

  useEffect(() => {
    let active = true
    bootGoogle().then(ready => { if (active) setGoogleStatus(ready ? 'ready' : 'unavailable') })
      .catch(() => { if (active) setGoogleStatus('unavailable') })
    return () => { active = false }
  }, [bootGoogle])

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current || loading || retryAfter > 0) return
    setError('')
    submittingRef.current = true
    setLoading(true)
    try {
      await login({ email: form.email, password: form.password })
    } catch (err) {
      if (err?.status === 429) {
        const seconds = Math.max(1, Number(err.retryAfter) || 60)
        setRetryAfter(seconds)
        setError('Muitas tentativas de acesso. Aguarde antes de tentar novamente.')
      } else {
        setError(err.message)
      }
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return <main className="login-screen">
    <div className="login-aura aura-one"/><div className="login-aura aura-two"/>
    <section className="login-copy">
      <a className="brand brand-large" href="https://petertecnet.com.br/" target="_blank" rel="noreferrer">
        <span className="brand-logo"><img src="/petertecnetlogo.png" alt=""/></span>
        <span><b>Peter Tecnet</b><small>Admin Center</small></span>
      </a>
      <div>
        <p className="eyebrow">ECOSYSTEM CONTROL / PRIVATE</p>
        <h1>Gestão do ecossistema em uma única visão.</h1>
        <p>Operações, receita, usuários, aplicações e sinais críticos conectados à API central da Peter Tecnet.</p>
      </div>
      <small className="login-security">Sessão autenticada pela API Peter Tecnet · acesso administrativo restrito</small>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark"><img src="/petertecnetlogo.png" alt="Peter Tecnet"/></div>
        <p className="eyebrow">ADMIN CENTER</p>
        <h2>Entrar</h2>
        <p className="muted">Entre com sua conta Google autorizada ou use sua senha administrativa.</p>
        {googleStatus !== 'unavailable' && <div className={`admin-google-login status-${googleStatus}`}>
          <div ref={googleButtonRef}/>
          {googleStatus === 'loading' && <small>Carregando acesso seguro com Google…</small>}
        </div>}
        {googleStatus === 'ready' && <div className="login-divider"><span>ou use sua senha</span></div>}
        <label>E-mail<input type="email" autoComplete="username" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required/></label>
        <label>Senha<input type="password" autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required autoFocus/></label>
        {error && <div className="form-error" role="alert">{error}{retryAfter > 0 ? ` Tente novamente em ${retryAfter}s.` : ''}</div>}
        <button className="primary-button" disabled={loading || retryAfter > 0}>{loading ? 'Autenticando…' : retryAfter > 0 ? `Aguarde ${retryAfter}s` : 'Acessar dashboard'}<span>↗</span></button>
      </form>
    </section>
  </main>
}

function MetricCard({ label, value, detail, trend, tone = 'neutral' }) {
  return <article className={`metric-card tone-${tone}`}>
    <div className="metric-head"><span>{label}</span>{trend && <small>{trend}</small>}</div>
    <strong>{value}</strong>
    <p>{detail}</p>
  </article>
}

function LineChart({ rows = [], valueKey = 'gross', labelKey = 'day', formatter = compactNumber }) {
  const values = rows.map(row => number(row?.[valueKey]))
  const max = Math.max(...values, 1)
  const points = rows.map((row, index) => {
    const x = rows.length <= 1 ? 50 : (index / (rows.length - 1)) * 100
    const y = 92 - (number(row?.[valueKey]) / max) * 78
    return `${x},${y}`
  }).join(' ')
  return <div className="line-chart">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="25" x2="100" y2="25"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="75" x2="100" y2="75"/>
      {points && <><polyline className="chart-area" points={`0,100 ${points} 100,100`}/><polyline className="chart-line" points={points}/></>}
    </svg>
    <div className="chart-labels">
      {rows.length ? <><span>{String(rows[0]?.[labelKey] || '').slice(5)}</span><b>{formatter(max)}</b><span>{String(rows.at(-1)?.[labelKey] || '').slice(5)}</span></> : <span>Sem dados no período</span>}
    </div>
  </div>
}

function Bars({ rows = [] }) {
  const normalized = rows.slice(0, 7).map(row => ({
    label: row.name || row.application_name || row.app_slug || 'Aplicação',
    value: number(row.activity_count_30d ?? row.users_count ?? row.gross ?? row.transactions),
  }))
  const max = Math.max(...normalized.map(row => row.value), 1)
  return <div className="bars">
    {normalized.length ? normalized.map(row => <div className="bar-row" key={row.label}>
      <div><span>{row.label}</span><b>{compactNumber(row.value)}</b></div>
      <i><span style={{ width: `${Math.max((row.value / max) * 100, row.value ? 5 : 0)}%` }}/></i>
    </div>) : <Empty text="Sem dados de engajamento ainda."/>}
  </div>
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return <article className={`panel ${className}`}>
    <header><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</header>
    {children}
  </article>
}

function Empty({ text = 'Nenhum dado disponível.' }) {
  return <div className="empty-state">{text}</div>
}

function statusTone(status) {
  const value = String(status || '').toLowerCase()
  if (['critical', 'down', 'failed', 'error', 'unhealthy'].some(key => value.includes(key))) return 'danger'
  if (['warning', 'degraded', 'pending', 'attention'].some(key => value.includes(key))) return 'warning'
  return 'success'
}

function Dashboard({ user, onLogout }) {
  const { request } = useAdminAuth()
  const { data, errors, loading, refreshing, refresh, retry } = useAdminData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [activePage, setActivePage] = useState(() => pageFromLocation())
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const searchTimer = useRef(null)

  useEffect(() => {
    const handlePopState = () => setActivePage(pageFromLocation())
    window.addEventListener('popstate', handlePopState)
    writePage(pageFromLocation(), 'replaceState')
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    function shortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); document.querySelector('.top-search input')?.focus()
      }
      if (event.key === 'Escape') { setSearchResult(null); setLauncherOpen(false); setSidebarOpen(false) }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  useEffect(() => {
    window.clearTimeout(searchTimer.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) return undefined
    searchTimer.current = window.setTimeout(async () => {
      try { setSearchResult(await request(`/admin/ecosystem/command/search?q=${encodeURIComponent(trimmed)}`)) }
      catch (error) { setSearchResult({ error: error.message, groups: {}, total: 0 }) }
      finally { setSearching(false) }
    }, 280)
    return () => window.clearTimeout(searchTimer.current)
  }, [query, request])

  function go(section) {
    const page = SLUG_BY_PAGE[section] ? section : 'dashboard'
    setSidebarOpen(false)
    setLauncherOpen(false)
    setActivePage(page)
    writePage(page)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  const dashboard = data.dashboard
  const activity = data.activity
  const financial = data.financial
  const command = data.command
  const applications = data.applications || []
  const summary = dashboard?.summary || {}
  const financialSummary = financial?.summary || {}
  const totals = financialSummary?.totals || {}
  const approved = financialSummary?.approved || {}
  const failed = financialSummary?.failed || {}
  const pending = financialSummary?.pending || {}
  const appRows = dashboard?.applications || applications || []
  const activityRows = activity?.activity || dashboard?.recent_activity || []
  const issueRows = command?.issues?.data || command?.issues || []
  const financialAlerts = financial?.alerts || []
  const operationalStatus = command?.overall_status || command?.status || command?.health?.status || (issueRows.some(issue => statusTone(issue.severity) === 'danger') ? 'Atenção' : 'Operacional')
  const status = statusTone(operationalStatus)
  const activeApps = summary.active_applications ?? appRows.filter(app => app.is_active !== false).length

  const highestApp = [...appRows].sort((a, b) => number(b.activity_count_30d) - number(a.activity_count_30d))[0]

  return <div className="admin-shell" data-admin-page={activePage}>
    <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}/>
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <a className="brand" href="/" onClick={event => { event.preventDefault(); go('dashboard') }}>
        <span className="brand-logo"><img src="/petertecnetlogo.png" alt=""/></span>
        <span><b>Peter Tecnet</b><small>Admin Center</small></span>
      </a>
      <nav>
        <p>GESTÃO</p>
        {navItems.map(([id, label, icon]) => <button key={id} className={activePage === id ? 'active' : ''} aria-current={activePage === id ? 'page' : undefined} onClick={() => go(id)}><span>{icon}</span>{label}<i>↗</i></button>)}
      </nav>
      <div className="sidebar-status">
        <span className={`status-dot ${status}`}/><div><b>{operationalStatus}</b><small>Estado do ecossistema</small></div>
      </div>
      <span className="admin-release-tag">{ADMIN_RELEASE_LABEL}</span>
      <div className="sidebar-user">
        <div className="avatar">{fullName(user).slice(0, 2).toUpperCase()}</div>
        <div><b>{fullName(user)}</b><small>{user?.email}</small></div>
        <button onClick={onLogout} aria-label="Sair">↪</button>
      </div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(value => !value)} aria-label="Abrir menu" aria-expanded={sidebarOpen}><span/><span/><span/></button>
        <div className="top-search">
          <span>⌕</span><input value={query} onChange={event => {
            const value = event.target.value
            setQuery(value)
            if (value.trim().length < 2) {
              setSearchResult(null)
              setSearching(false)
            } else {
              setSearching(true)
            }
          }} placeholder="Pesquisar em todo o ecossistema…" aria-label="Pesquisar no ecossistema"/><kbd>Ctrl K</kbd>
          {(searchResult || searching) && <SearchPopover result={searchResult} searching={searching} onClose={() => { setQuery(''); setSearchResult(null) }}/>} 
        </div>
        <div className="top-actions">
          <button className="icon-button" onClick={() => refresh({ quiet: true })} aria-label="Atualizar dados" title="Atualizar dados">{refreshing ? '◌' : '↻'}</button>
          <div className="launcher-wrap">
            <button className="ecosystem-button" onClick={() => setLauncherOpen(value => !value)}><span>◫</span><b>Navegar no ecossistema</b><i>⌄</i></button>
            {launcherOpen && <EcosystemLauncher applications={applications} onClose={() => setLauncherOpen(false)}/>} 
          </div>
        </div>
      </header>

      <div className="content">
        <section className="hero-section" id="dashboard" data-admin-page-key="dashboard">
          <div><p className="eyebrow">PETER TECNET / ECOSYSTEM INTELLIGENCE</p><h1>Dashboard administrativo</h1><p>Acompanhe operação, adoção e receita do ecossistema em tempo real.</p></div>
          <div className={`health-chip ${status}`}><span/><div><small>ECOSYSTEM HEALTH</small><b>{operationalStatus}</b></div></div>
        </section>

        <div data-admin-page-key="dashboard"><AdminModuleBoundary name="Visão executiva"><ExecutiveOverview onNavigate={go}/></AdminModuleBoundary></div>
        {Object.keys(errors).length > 0 && <div className="notice" data-admin-page-key="dashboard">Algumas fontes estão indisponíveis. O restante do painel continua funcionando.<button onClick={() => refresh()}>Tentar novamente</button></div>}
        {loading ? <div data-admin-page-key="dashboard"><DashboardSkeleton/></div> : <>
          <section className="metrics-grid" data-admin-page-key="dashboard">
            <MetricCard label="Receita bruta" value={currency(totals.gross)} detail={`${compactNumber(approved.count)} pagamentos confirmados`} tone="accent"/>
            <MetricCard label="Receita Peter Tecnet" value={currency(totals.platform_fees)} detail="Taxas da plataforma no período" tone="success"/>
            <MetricCard label="Usuários ativos hoje" value={compactNumber(summary.active_users_today)} detail={`${compactNumber(summary.interactions_today)} interações hoje`}/>
            <MetricCard label="Interações · 30 dias" value={compactNumber(summary.interactions_30d)} detail={`${compactNumber(summary.active_users_30d)} usuários ativos`}/>
            <MetricCard label="Aplicações ativas" value={compactNumber(activeApps)} detail={`${compactNumber(summary.applications ?? appRows.length)} cadastradas`}/>
            <MetricCard label="Pagamentos em atenção" value={compactNumber(number(failed.count) + number(pending.count))} detail={`${compactNumber(failed.count)} falhas · ${compactNumber(pending.count)} pendentes`} tone={number(failed.count) ? 'danger' : 'warning'}/>
          </section>

          <section className="analytics-grid" data-admin-page-key="dashboard">
            <Panel title="Receita nos últimos 30 dias" subtitle="Volume bruto processado pelo ecossistema" className="chart-panel">
              <LineChart rows={financial?.timeline || []} valueKey="gross" formatter={currency}/>
              <div className="chart-summary"><span><i className="dot approved"/>Aprovado <b>{currency(approved.amount)}</b></span><span><i className="dot fees"/>Taxas Peter <b>{currency(totals.platform_fees)}</b></span><span><i className="dot net"/>Líquido vendedores <b>{currency(totals.seller_net)}</b></span></div>
            </Panel>
            <Panel title="Engajamento por aplicação" subtitle="Interações registradas nos últimos 30 dias">
              <Bars rows={appRows}/>
              {highestApp && <div className="insight"><span>↗</span><p><b>{highestApp.name}</b> concentra o maior volume recente de atividade.</p></div>}
            </Panel>
          </section>

          <section id="operations" className="section-anchor" data-admin-page-key="operations">
            <SectionHeading kicker="OPERAÇÕES" title="Saúde e sinais críticos" text="Alertas financeiros e operacionais que merecem atenção imediata."/>
            <div className="operations-grid">
              <Panel title="Alertas ativos" subtitle={`${issueRows.length + financialAlerts.length} sinais encontrados`}>
                <div className="alerts-list">
                  {[...issueRows.slice(0, 5), ...financialAlerts.slice(0, 4)].length ? [...issueRows.slice(0, 5), ...financialAlerts.slice(0, 4)].map((item, index) => <div className="alert-row" key={item.id || item.public_id || `${item.title}-${index}`}>
                    <span className={`severity ${statusTone(item.severity || item.status)}`}/><div><b>{item.title || item.name || item.message || 'Sinal operacional'}</b><small>{item.message || item.description || item.status || item.severity}</small></div>
                  </div>) : <Empty text="Nenhum alerta crítico no momento."/>}
                </div>
              </Panel>
              <Panel title="Pulso do ecossistema" subtitle="Indicadores de adoção e operação">
                <div className="pulse-grid">
                  <div><span>Novos usuários · 30d</span><b>{compactNumber(summary.new_users_30d)}</b></div>
                  <div><span>Inativos · 30d</span><b>{compactNumber(summary.inactive_users_30d)}</b></div>
                  <div><span>Estabelecimentos</span><b>{compactNumber(summary.establishments)}</b></div>
                  <div><span>Vínculos de acesso</span><b>{compactNumber(summary.access_links)}</b></div>
                </div>
              </Panel>
            </div>
          </section>

          <section id="financial" className="section-anchor" data-admin-page-key="financial">
            <SectionHeading kicker="FINANCEIRO" title="Performance de receita" text="Distribuição financeira por aplicação e status de pagamentos."/>
            <div className="financial-strip">
              <div><span>Transações</span><b>{compactNumber(totals.transactions)}</b></div><div><span>Gross</span><b>{currency(totals.gross)}</b></div><div><span>Taxas do provedor</span><b>{currency(totals.provider_fees)}</b></div><div><span>Seller net</span><b>{currency(totals.seller_net)}</b></div>
            </div>
            <Panel title="Receita por aplicação" subtitle="Ranking por volume bruto processado">
              <div className="table-wrap"><table><thead><tr><th>Aplicação</th><th>Transações</th><th>Volume bruto</th><th>Taxa Peter</th><th>Líquido</th></tr></thead><tbody>{financial?.applications?.length ? financial.applications.map(row => <tr key={row.app_slug || row.application_name}><td><b>{row.application_name || row.app_slug}</b></td><td>{compactNumber(row.transactions)}</td><td>{currency(row.gross)}</td><td>{currency(row.platform_fees)}</td><td>{currency(row.seller_net)}</td></tr>) : <tr><td colSpan="5"><Empty text="Ainda não há movimentação financeira consolidada por aplicação."/></td></tr>}</tbody></table></div>
            </Panel>
          </section>

          <section id="applications" className="section-anchor" data-admin-page-key="applications">
            <SectionHeading kicker="APLICAÇÕES" title="Ecossistema em produção" text="Adoção e atividade por produto conectado à API central."/>
            <div className="apps-grid">
              {appRows.length ? appRows.map(app => <article className="app-card" key={app.id || app.slug}>
                <div className="app-card-head"><div className="app-icon">{app.logo ? <img src={app.logo} alt="" onError={event => { event.currentTarget.style.display = 'none' }}/> : <span>{String(app.name || 'P').slice(0, 1)}</span>}</div><span className={app.is_active === false ? 'app-state offline' : 'app-state'}>{app.is_active === false ? 'Inativa' : 'Ativa'}</span></div>
                <h3>{app.name}</h3><p>{app.description || app.slug || 'Aplicação Peter Tecnet'}</p>
                <div className="app-stats"><span><small>Usuários</small><b>{compactNumber(app.users_count)}</b></span><span><small>Ativos 30d</small><b>{compactNumber(app.active_users_30d)}</b></span><span><small>Interações</small><b>{compactNumber(app.activity_count_30d)}</b></span></div>
                {app.url && <a href={app.url} target="_blank" rel="noreferrer">Abrir aplicação ↗</a>}
              </article>) : <Empty text="Nenhuma aplicação disponível na leitura atual."/>}
            </div>
          </section>

          <section id="cutinapp-admin-integration" className="section-anchor cutinapp-admin-integration" data-admin-page-key="cutinapp">
            <AdminModuleBoundary name="Cutinapp"><AdminCutinappCenter /></AdminModuleBoundary>
          </section>

          <section id="users" className="section-anchor" data-admin-page-key="users">
            <SectionHeading kicker="USUÁRIOS" title="Gestão central de usuários" text="Pesquise, filtre e administre cadastros, perfis, acessos e atividade de todo o ecossistema."/>
            <AdminModuleBoundary name="Usuários"><AdminUsersCenter apiRequest={request} applications={applications}/></AdminModuleBoundary>
          </section>

          <section id="establishments-admin-integration" className="section-anchor establishments-admin-integration" data-admin-page-key="establishments">
            <AdminModuleBoundary name="Estabelecimentos"><AdminEstablishmentsPage /></AdminModuleBoundary>
          </section>

          <section id="items-admin-integration" className="section-anchor admin-items-section" data-admin-page-key="items">
            <AdminModuleBoundary name="Itens"><AdminItemsManager /></AdminModuleBoundary>
          </section>

          <section id="support" className="section-anchor" data-admin-page-key="support">
            <SectionHeading kicker="SUPORTE" title="Saúde do atendimento" text="Chamados ativos e prioridades de suporte de todo o ecossistema."/>
            <SourceState source="support" error={errors.support} onRetry={() => retry('support')}>
              <div className="pulse-grid">
                <div><span>Ativos</span><b>{compactNumber(data.support?.active)}</b></div>
                <div><span>Urgentes</span><b>{compactNumber(data.support?.urgent)}</b></div>
                <div><span>Sem responsável</span><b>{compactNumber(data.support?.unassigned)}</b></div>
                <div><span>Resolvidos hoje</span><b>{compactNumber(data.support?.resolved_today)}</b></div>
              </div>
              <a className="admin-inline-link" href="/support">Abrir central completa de suporte ↗</a>
            </SourceState>
          </section>

          <section id="telemetry" className="section-anchor" data-admin-page-key="telemetry">
            <SectionHeading kicker="TELEMETRIA" title="Saúde técnica das aplicações" text="Cobertura, erros, sessões e versão da telemetria frontend por aplicação."/>
            <SourceState source="telemetry" error={errors.telemetry} onRetry={() => retry('telemetry')}>
              <div className="financial-strip">
                <div><span>Saudáveis</span><b>{compactNumber(data.telemetry?.summary?.healthy)}</b></div>
                <div><span>Atenção</span><b>{compactNumber(data.telemetry?.summary?.warning)}</b></div>
                <div><span>Down</span><b>{compactNumber(data.telemetry?.summary?.down)}</b></div>
                <div><span>Sessões · 15min</span><b>{compactNumber(data.telemetry?.summary?.active_sessions_15m)}</b></div>
              </div>
              <div className="apps-grid">{(data.telemetry?.applications || []).map(app => <article className="app-card" key={app.id || app.slug}><div className="app-card-head"><div className="app-icon">{app.logo ? <img src={app.logo} alt=""/> : <span>{String(app.name || 'P')[0]}</span>}</div><span className={app.status === 'healthy' ? 'app-state' : 'app-state offline'}>{app.status}</span></div><h3>{app.name}</h3><p>{compactNumber(app.events_24h)} eventos · {compactNumber(app.errors_24h)} erros em 24h</p><div className="app-stats"><span><small>Sessões 15m</small><b>{compactNumber(app.active_sessions_15m)}</b></span><span><small>Schema</small><b>{app.latest_schema || '—'}</b></span><span><small>SDK</small><b>{app.latest_version || '—'}</b></span></div></article>)}</div>
            </SourceState>
          </section>

          <section id="notifications" className="section-anchor" data-admin-page-key="notifications">
            <AdminModuleBoundary name="Notificações"><NotificationsCenter request={request} applications={applications}/></AdminModuleBoundary>
          </section>

          <section id="activity" className="section-anchor" data-admin-page-key="activity">
            <SectionHeading kicker="ATIVIDADE" title="Linha do tempo recente" text="Últimas ações registradas pela telemetria do ecossistema."/>
            <Panel title="Atividade recente" subtitle={`${compactNumber(activity?.summary?.total ?? summary.interactions_30d)} interações no recorte atual`}>
              <div className="timeline">
                {activityRows.length ? activityRows.slice(0, 16).map((row, index) => <div className="timeline-row" key={row.id || `${row.created_at}-${index}`}><span className="timeline-dot"/><div><b>{row.name || row.interaction_type || row.type || 'Interação'}</b><small>{row.user_email || row.email || row.application_name || row.app_name || 'Ecossistema Peter Tecnet'}</small></div><time>{dateTime(row.created_at || row.occurred_at)}</time></div>) : <Empty text="Nenhuma interação recente retornada pela API."/>}
              </div>
            </Panel>
          </section>
        </>}
      </div>
    </main>
  </div>
}

function SectionHeading({ kicker, title, text }) {
  return <div className="section-heading"><div><p className="eyebrow">{kicker}</p><h2>{title}</h2></div><p>{text}</p></div>
}

function SourceState({ error, onRetry, children }) {
  if (!error) return children
  return <div className="admin-module-error" role="status"><div><small>FONTE INDISPONÍVEL</small><h3>Não foi possível atualizar este módulo.</h3><p>{error}</p></div><button type="button" onClick={onRetry}>Tentar novamente ↻</button></div>
}

function SearchPopover({ result, searching, onClose }) {
  const groups = result?.groups || {}
  return <div className="search-popover">
    <div className="search-popover-head"><span>{searching ? 'Pesquisando…' : `${result?.total || 0} resultado(s)`}</span><button onClick={onClose}>×</button></div>
    {result?.error && <div className="search-error">{result.error}</div>}
    {!searching && !result?.error && !result?.total && <Empty text="Nenhum resultado encontrado."/>}
    <div className="search-groups">
      {Object.entries(groups).map(([group, rows]) => <section key={group}><h4>{groupLabels[group] || group}<span>{rows.length}</span></h4>{rows.map((row, index) => <div className="search-result" key={row.id || index}><div><b>{row.name || row.title || row.first_name || row.email || row.public_id || row.reference || `#${row.id}`}</b><small>{row.email || row.slug || row.status || row.category || row.application_name || row.url || `ID ${row.id}`}</small></div><span>#{row.id}</span></div>)}</section>)}
    </div>
  </div>
}

function EcosystemLauncher({ applications, onClose }) {
  return <div className="launcher-popover">
    <div className="launcher-head"><div><p className="eyebrow">ECOSYSTEM</p><b>Navegar nas aplicações</b></div><button onClick={onClose}>×</button></div>
    <div className="launcher-grid">
      <a href="https://petertecnet.com.br/" target="_blank" rel="noreferrer"><span className="launcher-logo"><img src="/petertecnetlogo.png" alt=""/></span><div><b>Peter Tecnet</b><small>Site institucional</small></div><i>↗</i></a>
      {applications.filter(app => app.is_active !== false && app.url).map(app => <a key={app.id || app.slug} href={app.url} target="_blank" rel="noreferrer"><span className="launcher-logo">{app.logo ? <img src={app.logo} alt=""/> : String(app.name || 'P')[0]}</span><div><b>{app.name}</b><small>{app.slug || 'Aplicação'}</small></div><i>↗</i></a>)}
    </div>
  </div>
}

function DashboardSkeleton() {
  return <div className="skeleton-wrap"><div className="metrics-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton metric-card" key={index}/>)}</div><div className="analytics-grid"><div className="skeleton panel tall"/><div className="skeleton panel tall"/></div></div>
}

export default function App() {
  const { status, user, error, login, loginWithGoogle, getIdentityProviders, logout, validate } = useAdminAuth()
  if (status === 'checking') return <div className="boot-screen"><img src="/petertecnetlogo.png" alt=""/><span/><p>Validando sessão administrativa…</p></div>
  if (status === 'unavailable') return <SessionUnavailable message={error} onRetry={() => validate()} onLogout={logout}/>
  return status === 'authenticated' && user
    ? <Dashboard user={user} onLogout={logout}/>
    : <Login login={login} loginWithGoogle={loginWithGoogle} getIdentityProviders={getIdentityProviders} initialError={error}/>
}
