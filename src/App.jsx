import { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const OWNER_EMAIL = 'petertecnet@gmail.com'

const navItems = [
  ['dashboard', 'Visão geral', '⌂'],
  ['operations', 'Operações', '◈'],
  ['financial', 'Financeiro', '◒'],
  ['applications', 'Aplicações', '◇'],
  ['activity', 'Atividade', '↯'],
]

const groupLabels = {
  users: 'Usuários', applications: 'Aplicações', establishments: 'Estabelecimentos',
  items: 'Itens', events: 'Eventos', orders: 'Pedidos', payments: 'Pagamentos',
}

function tokenFrom(payload) {
  return payload?.token?.access_token || payload?.access_token || payload?.token || ''
}

function userFrom(payload) {
  return payload?.token?.user || payload?.user || null
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

function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 18000)
  return fetch(`${API}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async response => {
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (response.status === 401 && path !== '/auth/login') {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || Object.values(payload?.errors || {}).flat()?.[0] || 'Não foi possível concluir a operação.')
    }
    return payload
  }).catch(error => {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder.')
    throw error
  }).finally(() => window.clearTimeout(timeout))
}

function Login({ onAuthenticated }) {
  const [form, setForm] = useState({ email: OWNER_EMAIL, password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (form.email.trim().toLowerCase() !== OWNER_EMAIL) {
      setError('Este Admin Center é restrito ao administrador da Peter Tecnet.')
      return
    }
    setLoading(true)
    try {
      const payload = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.email.trim().toLowerCase(), password: form.password }),
      })
      const token = tokenFrom(payload)
      const user = userFrom(payload)
      if (!token) throw new Error('A API não retornou uma sessão válida.')
      if (String(user?.email || '').toLowerCase() !== OWNER_EMAIL) throw new Error('Usuário sem acesso ao Admin Center.')
      localStorage.setItem(TOKEN_KEY, token)
      onAuthenticated(user)
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY)
      setError(err.message)
    } finally {
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
        <p className="muted">Use suas credenciais administrativas.</p>
        <label>E-mail<input type="email" autoComplete="username" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required/></label>
        <label>Senha<input type="password" autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required autoFocus/></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Autenticando…' : 'Acessar dashboard'}<span>↗</span></button>
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [activity, setActivity] = useState(null)
  const [financial, setFinancial] = useState(null)
  const [command, setCommand] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const searchTimer = useRef(null)

  async function loadAll({ quiet = false } = {}) {
    if (quiet) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setLoadError('')
    const endpoints = [
      ['/admin/ecosystem/dashboard', setDashboard],
      ['/admin/ecosystem/activity', setActivity],
      ['/admin/ecosystem/financial/dashboard', setFinancial],
      ['/admin/ecosystem/command/overview', setCommand],
      ['/admin/applications', payload => setApplications(payload?.applications || payload?.data || (Array.isArray(payload) ? payload : []))],
    ]
    const settled = await Promise.allSettled(endpoints.map(([path]) => request(path)))
    let failures = 0
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') endpoints[index][1](result.value)
      else failures += 1
    })
    if (failures === endpoints.length) setLoadError('Não foi possível carregar a dashboard. Verifique a sessão e a API.')
    else if (failures) setLoadError(`${failures} fonte${failures > 1 ? 's' : ''} de dados não respondeu. O restante da dashboard continua disponível.`)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll() }, 0)
    return () => window.clearTimeout(timer)
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
  }, [query])

  function go(section) {
    setSidebarOpen(false)
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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

  return <div className="admin-shell">
    <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}/>
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <a className="brand" href="#dashboard" onClick={event => { event.preventDefault(); go('dashboard') }}>
        <span className="brand-logo"><img src="/petertecnetlogo.png" alt=""/></span>
        <span><b>Peter Tecnet</b><small>Admin Center</small></span>
      </a>
      <nav>
        <p>GESTÃO</p>
        {navItems.map(([id, label, icon]) => <button key={id} onClick={() => go(id)}><span>{icon}</span>{label}<i>↗</i></button>)}
      </nav>
      <div className="sidebar-status">
        <span className={`status-dot ${status}`}/><div><b>{operationalStatus}</b><small>Estado do ecossistema</small></div>
      </div>
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
          <button className="icon-button" onClick={() => loadAll({ quiet: true })} aria-label="Atualizar dados" title="Atualizar dados">{refreshing ? '◌' : '↻'}</button>
          <div className="launcher-wrap">
            <button className="ecosystem-button" onClick={() => setLauncherOpen(value => !value)}><span>◫</span><b>Navegar no ecossistema</b><i>⌄</i></button>
            {launcherOpen && <EcosystemLauncher applications={applications} onClose={() => setLauncherOpen(false)}/>} 
          </div>
        </div>
      </header>

      <div className="content">
        <section className="hero-section" id="dashboard">
          <div><p className="eyebrow">PETER TECNET / ECOSYSTEM INTELLIGENCE</p><h1>Dashboard administrativo</h1><p>Acompanhe operação, adoção e receita do ecossistema em tempo real.</p></div>
          <div className={`health-chip ${status}`}><span/><div><small>ECOSYSTEM HEALTH</small><b>{operationalStatus}</b></div></div>
        </section>

        {loadError && <div className="notice">{loadError}<button onClick={() => loadAll()}>Tentar novamente</button></div>}
        {loading ? <DashboardSkeleton/> : <>
          <section className="metrics-grid">
            <MetricCard label="Receita bruta" value={currency(totals.gross)} detail={`${compactNumber(approved.count)} pagamentos confirmados`} tone="accent"/>
            <MetricCard label="Receita Peter Tecnet" value={currency(totals.platform_fees)} detail="Taxas da plataforma no período" tone="success"/>
            <MetricCard label="Usuários ativos hoje" value={compactNumber(summary.active_users_today)} detail={`${compactNumber(summary.interactions_today)} interações hoje`}/>
            <MetricCard label="Interações · 30 dias" value={compactNumber(summary.interactions_30d)} detail={`${compactNumber(summary.active_users_30d)} usuários ativos`}/>
            <MetricCard label="Aplicações ativas" value={compactNumber(activeApps)} detail={`${compactNumber(summary.applications ?? appRows.length)} cadastradas`}/>
            <MetricCard label="Pagamentos em atenção" value={compactNumber(number(failed.count) + number(pending.count))} detail={`${compactNumber(failed.count)} falhas · ${compactNumber(pending.count)} pendentes`} tone={number(failed.count) ? 'danger' : 'warning'}/>
          </section>

          <section className="analytics-grid">
            <Panel title="Receita nos últimos 30 dias" subtitle="Volume bruto processado pelo ecossistema" className="chart-panel">
              <LineChart rows={financial?.timeline || []} valueKey="gross" formatter={currency}/>
              <div className="chart-summary"><span><i className="dot approved"/>Aprovado <b>{currency(approved.amount)}</b></span><span><i className="dot fees"/>Taxas Peter <b>{currency(totals.platform_fees)}</b></span><span><i className="dot net"/>Líquido vendedores <b>{currency(totals.seller_net)}</b></span></div>
            </Panel>
            <Panel title="Engajamento por aplicação" subtitle="Interações registradas nos últimos 30 dias">
              <Bars rows={appRows}/>
              {highestApp && <div className="insight"><span>↗</span><p><b>{highestApp.name}</b> concentra o maior volume recente de atividade.</p></div>}
            </Panel>
          </section>

          <section id="operations" className="section-anchor">
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

          <section id="financial" className="section-anchor">
            <SectionHeading kicker="FINANCEIRO" title="Performance de receita" text="Distribuição financeira por aplicação e status de pagamentos."/>
            <div className="financial-strip">
              <div><span>Transações</span><b>{compactNumber(totals.transactions)}</b></div><div><span>Gross</span><b>{currency(totals.gross)}</b></div><div><span>Taxas do provedor</span><b>{currency(totals.provider_fees)}</b></div><div><span>Seller net</span><b>{currency(totals.seller_net)}</b></div>
            </div>
            <Panel title="Receita por aplicação" subtitle="Ranking por volume bruto processado">
              <div className="table-wrap"><table><thead><tr><th>Aplicação</th><th>Transações</th><th>Volume bruto</th><th>Taxa Peter</th><th>Líquido</th></tr></thead><tbody>{financial?.applications?.length ? financial.applications.map(row => <tr key={row.app_slug || row.application_name}><td><b>{row.application_name || row.app_slug}</b></td><td>{compactNumber(row.transactions)}</td><td>{currency(row.gross)}</td><td>{currency(row.platform_fees)}</td><td>{currency(row.seller_net)}</td></tr>) : <tr><td colSpan="5"><Empty text="Ainda não há movimentação financeira consolidada por aplicação."/></td></tr>}</tbody></table></div>
            </Panel>
          </section>

          <section id="applications" className="section-anchor">
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

          <section id="activity" className="section-anchor">
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
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    async function validate() {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) { setChecking(false); return }
      try {
        const payload = await request('/auth/me')
        const current = payload?.user || payload
        if (String(current?.email || '').toLowerCase() !== OWNER_EMAIL) throw new Error('Acesso não autorizado.')
        setUser(current)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
      } finally { setChecking(false) }
    }
    validate()
    const expired = () => { setUser(null); setChecking(false) }
    window.addEventListener('admin-session-expired', expired)
    return () => window.removeEventListener('admin-session-expired', expired)
  }, [])

  function logout() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) request('/auth/logout', { method: 'POST' }).catch(() => {})
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  if (checking) return <div className="boot-screen"><img src="/petertecnetlogo.png" alt=""/><span/><p>Validando sessão administrativa…</p></div>
  return user ? <Dashboard user={user} onLogout={logout}/> : <Login onAuthenticated={setUser}/>
}
