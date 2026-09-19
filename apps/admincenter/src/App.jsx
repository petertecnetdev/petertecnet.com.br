import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminModuleBoundary from './AdminModuleBoundary.jsx'
import { connectMissionControlRealtime } from './missionControlRealtime.js'

const NotificationsCenter = lazy(() => import('./NotificationsCenter.jsx'))
const AdminUsersCenter = lazy(() => import('./AdminUsersCenter.jsx'))
const AdminPayoutCenter = lazy(() => import('./AdminPayoutCenter.jsx'))
const AgentChatPanel = lazy(() => import('./AgentChatPanel.jsx'))
const AdminEstablishmentsPage = lazy(() => import('./AdminEstablishmentsPageV2.jsx'))
const AdminItemsManager = lazy(() => import('./AdminItemsManager.jsx'))

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const OWNER_EMAIL = 'petertecnet@gmail.com'

const navItems = [
  ['dashboard', 'Visão geral', 'home'],
  ['operations', 'Operações', 'pulse'],
  ['agents', 'Agentes', 'agents'],
  ['financial', 'Financeiro', 'finance'],
  ['applications', 'Aplicações', 'apps'],
  ['users', 'Usuários', 'users'],
  ['establishments', 'Estabelecimentos', 'building'],
  ['items', 'Itens', 'items'],
  ['notifications', 'Notificações', 'bell'],
  ['activity', 'Atividade', 'activity'],
]

const PAGE_CONFIG = {
  dashboard: { slug: 'visao-geral', label: 'Visão geral' },
  operations: { slug: 'operacoes', label: 'Operações' },
  agents: { slug: 'agentes', label: 'Agentes' },
  financial: { slug: 'financeiro', label: 'Financeiro' },
  applications: { slug: 'aplicacoes', label: 'Aplicações' },
  users: { slug: 'usuarios', label: 'Usuários' },
  establishments: { slug: 'estabelecimentos', label: 'Estabelecimentos' },
  items: { slug: 'itens', label: 'Itens' },
  notifications: { slug: 'notificacoes', label: 'Notificações' },
  activity: { slug: 'atividade', label: 'Atividade' },
}

const PAGE_FROM_SLUG = Object.fromEntries(Object.entries(PAGE_CONFIG).flatMap(([key, config]) => [[key, key], [config.slug, key]]))
const BACKGROUND_REFRESH_PAGES = new Set(['dashboard', 'operations', 'financial', 'applications', 'activity'])
const BACKGROUND_REFRESH_MS = 120000

function pageFromLocation() {
  const url = new URL(window.location.href)
  const token = String(url.searchParams.get('page') || '').trim().toLowerCase()
  return PAGE_FROM_SLUG[token] || 'dashboard'
}

function writePageHistory(page, mode = 'pushState') {
  const url = new URL(window.location.href)
  const config = PAGE_CONFIG[page] || PAGE_CONFIG.dashboard
  if (page === 'dashboard') url.searchParams.delete('page')
  else url.searchParams.set('page', config.slug)
  url.hash = ''
  window.history[mode]({ ...(window.history.state || {}), adminPage: page }, '', `${url.pathname}${url.search}`)
}

function AdminIcon({ name }) {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    agents: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.5-4 2.7-6 5.5-6s5 2 5.5 6M14 15c3.2-.8 5.7 1.2 6.5 4"/>',
    finance: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.7-4 2.8-6 6-6s5.3 2 6 6M16 5.5a3 3 0 0 1 0 5.8M17 14c2.5.3 4 2.1 4 5"/>',
    building: '<path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M18 13h1"/>',
    items: '<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    activity: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: paths[name] || paths.home }} />
}

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
      const requestError = new Error(payload?.error || payload?.message || Object.values(payload?.errors || {}).flat()?.[0] || 'Não foi possível concluir a operação.')
      requestError.status = response.status
      requestError.retryAfter = Number(response.headers.get('Retry-After') || payload?.retry_after || 0)
      throw requestError
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

  const completeAuthentication = useCallback((payload) => {
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
        if (!providers?.google?.enabled || !clientId) {
          if (active) setGoogleStatus('unavailable')
          return
        }

        const identity = await loadGoogleIdentity()
        if (!active || !googleButtonRef.current) return

        identity.initialize({
          client_id: clientId,
          cancel_on_tap_outside: false,
          callback: async ({ credential }) => {
            if (!credential || googleBusyRef.current || submittingRef.current) return
            googleBusyRef.current = true
            setLoading(true)
            setError('')
            try {
              const payload = await request('/auth/google', {
                method: 'POST',
                body: JSON.stringify({ token_id: credential }),
              })
              if (!active) return
              completeAuthentication(payload)
            } catch (err) {
              localStorage.removeItem(TOKEN_KEY)
              if (active) setError(err?.message || 'Não foi possível entrar com o Google.')
            } finally {
              googleBusyRef.current = false
              if (active) setLoading(false)
            }
          },
        })

        googleButtonRef.current.replaceChildren()
        const buttonWidth = Math.max(220, Math.min(346, Math.floor(googleButtonRef.current.getBoundingClientRect().width || 346)))
        identity.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: buttonWidth,
          locale: 'pt-BR',
        })
        if (active) setGoogleStatus('ready')
      } catch {
        if (active) setGoogleStatus('unavailable')
      }
    }

    void bootGoogle()
    return () => { active = false }
  }, [completeAuthentication])

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current || loading || retryAfter > 0) return
    setError('')
    if (form.email.trim().toLowerCase() !== OWNER_EMAIL) {
      setError('Este Admin Center é restrito ao administrador da Peter Tecnet.')
      return
    }
    submittingRef.current = true
    setLoading(true)
    try {
      const payload = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.email.trim().toLowerCase(), password: form.password }),
      })
      completeAuthentication(payload)
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY)
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
        <p className="muted">Entre com a conta Google da Peter Tecnet ou use sua senha administrativa.</p>
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
  const [activePage, setActivePage] = useState(pageFromLocation)
  const [realtimeState, setRealtimeState] = useState('connecting')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [lastRefreshAt, setLastRefreshAt] = useState(null)
  const searchTimer = useRef(null)
  const searchSequenceRef = useRef(0)
  const refreshTimerRef = useRef(null)
  const refreshInFlightRef = useRef(false)
  const refreshSequenceRef = useRef(0)
  const activePageRef = useRef(activePage)
  const sidebarRef = useRef(null)
  const menuButtonRef = useRef(null)
  const sidebarWasOpenRef = useRef(false)

  useEffect(() => { activePageRef.current = activePage }, [activePage])

  const loadAll = useCallback(async ({ quiet = false, indicate = false, force = false } = {}) => {
    if (!force && refreshInFlightRef.current) return
    if (!force && quiet && document.visibilityState !== 'visible') return

    const sequence = ++refreshSequenceRef.current
    refreshInFlightRef.current = true
    if (!quiet) setLoading(true)
    if (indicate) setRefreshing(true)

    const endpoints = [
      ['/admin/ecosystem/dashboard', 'dashboard'],
      ['/admin/ecosystem/activity', 'activity'],
      ['/admin/ecosystem/financial/dashboard', 'financial'],
      ['/admin/ecosystem/command/overview', 'command'],
      ['/admin/applications', 'applications'],
    ]

    try {
      const settled = await Promise.allSettled(endpoints.map(([path]) => request(path)))
      if (sequence !== refreshSequenceRef.current) return

      let failures = 0
      settled.forEach((result, index) => {
        const key = endpoints[index][1]
        if (result.status !== 'fulfilled') { failures += 1; return }
        if (key === 'dashboard') setDashboard(result.value)
        if (key === 'activity') setActivity(result.value)
        if (key === 'financial') setFinancial(result.value)
        if (key === 'command') setCommand(result.value)
        if (key === 'applications') {
          const payload = result.value
          setApplications(payload?.applications || payload?.data || (Array.isArray(payload) ? payload : []))
        }
      })

      if (failures === endpoints.length) setLoadError('Não foi possível atualizar as fontes administrativas. Os dados anteriores foram preservados.')
      else if (failures) setLoadError(`${failures} fonte${failures > 1 ? 's' : ''} não respondeu. Os dados disponíveis foram preservados.`)
      else setLoadError('')
      setLastRefreshAt(new Date())
    } finally {
      if (sequence === refreshSequenceRef.current) {
        setLoading(false)
        setRefreshing(false)
        refreshInFlightRef.current = false
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    let socketState = 'connecting'

    const queueRefresh = () => {
      if (document.visibilityState !== 'visible') return
      if (!BACKGROUND_REFRESH_PAGES.has(activePageRef.current)) return
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(() => {
        void loadAll({ quiet: true })
      }, 1600)
    }

    const disconnect = connectMissionControlRealtime({
      token: () => localStorage.getItem(TOKEN_KEY),
      events: ['ecosystem.updated'],
      onUpdate: (payload, eventName) => {
        const modules = Array.isArray(payload?.modules) ? payload.modules : []
        const affectsDashboard = modules.length === 0 || modules.some(module =>
          ['dashboard', 'activity', 'audit', 'applications', 'operations', 'financial'].includes(module)
        )
        if (eventName !== 'ecosystem.updated' || affectsDashboard) queueRefresh()
      },
      onState: state => {
        socketState = state
        setRealtimeState(state)
      },
    })

    const fallback = window.setInterval(() => {
      if (socketState !== 'connected') queueRefresh()
    }, BACKGROUND_REFRESH_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && socketState !== 'connected') queueRefresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
      window.clearInterval(fallback)
      document.removeEventListener('visibilitychange', onVisibility)
      disconnect?.()
    }
  }, [loadAll])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      if (BACKGROUND_REFRESH_PAGES.has(activePageRef.current)) void loadAll({ quiet: true })
    }
    const onOffline = () => {
      setOnline(false)
      setRealtimeState('offline')
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadAll])

  useEffect(() => {
    if (sidebarOpen) {
      sidebarWasOpenRef.current = true
      const frame = window.requestAnimationFrame(() => {
        sidebarRef.current?.querySelector('button.active')?.focus()
      })
      return () => window.cancelAnimationFrame(frame)
    }
    if (sidebarWasOpenRef.current) {
      sidebarWasOpenRef.current = false
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
    return undefined
  }, [sidebarOpen])

  useEffect(() => {
    const handlePopState = () => setActivePage(pageFromLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const config = PAGE_CONFIG[activePage] || PAGE_CONFIG.dashboard
    document.title = `${config.label} · Admin Center · Peter Tecnet`
    window.dispatchEvent(new CustomEvent('admin-page-change', { detail: { page: activePage } }))
  }, [activePage])

  useEffect(() => {
    if (!sidebarOpen || !window.matchMedia('(max-width: 980px)').matches) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [sidebarOpen])

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
    if (trimmed.length < 2) {
      searchSequenceRef.current += 1
      return undefined
    }

    const sequence = ++searchSequenceRef.current
    searchTimer.current = window.setTimeout(async () => {
      try {
        const payload = await request(`/admin/ecosystem/command/search?q=${encodeURIComponent(trimmed)}`)
        if (sequence === searchSequenceRef.current) setSearchResult(payload)
      } catch (error) {
        if (sequence === searchSequenceRef.current) setSearchResult({ error: error.message, groups: {}, total: 0 })
      } finally {
        if (sequence === searchSequenceRef.current) setSearching(false)
      }
    }, 320)

    return () => window.clearTimeout(searchTimer.current)
  }, [query])

  function handleSidebarKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setSidebarOpen(false)
      return
    }
    if (event.key !== 'Tab' || !sidebarOpen) return
    const focusable = [...(sidebarRef.current?.querySelectorAll('a[href], button:not([disabled])') || [])]
      .filter(node => node.tabIndex !== -1)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function go(section, { replace = false } = {}) {
    const next = PAGE_CONFIG[section] ? section : 'dashboard'
    setActivePage(next)
    writePageHistory(next, replace ? 'replaceState' : 'pushState')
    if (window.matchMedia('(max-width: 980px)').matches) setSidebarOpen(false)
    setLauncherOpen(false)
    setSearchResult(null)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
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

  const highestApp = useMemo(() => [...appRows].sort((a, b) => number(b.activity_count_30d) - number(a.activity_count_30d))[0], [appRows])

  return <div className="admin-shell" data-admin-page={activePage}>
    <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} aria-hidden="true"/>
    <aside ref={sidebarRef} id="admin-navigation" className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navegação administrativa" aria-hidden={!sidebarOpen} onKeyDown={handleSidebarKeyDown}>
      <a className="brand" href="?page=visao-geral" tabIndex={sidebarOpen ? 0 : -1} onClick={event => { event.preventDefault(); go('dashboard') }}>
        <span className="brand-logo"><img src="/petertecnetlogo.png" alt=""/></span>
        <span><b>Peter Tecnet</b><small>Admin Center</small></span>
      </a>
      <nav>
        <p>GESTÃO</p>
        {navItems.map(([id, label, icon]) => <button key={id} type="button" className={activePage === id ? 'active' : ''} data-admin-page-target={id} aria-current={activePage === id ? 'page' : undefined} tabIndex={sidebarOpen ? 0 : -1} onClick={() => go(id)}><span><AdminIcon name={icon}/></span><b>{label}</b><i>→</i></button>)}
      </nav>
      <div className="sidebar-status">
        <span className={`status-dot ${status}`}/><div><b>{operationalStatus}</b><small>Estado do ecossistema</small></div>
      </div>
      <div className="sidebar-user">
        <div className="avatar">{fullName(user).slice(0, 2).toUpperCase()}</div>
        <div><b>{fullName(user)}</b><small>{user?.email}</small></div>
        <button onClick={onLogout} aria-label="Sair" tabIndex={sidebarOpen ? 0 : -1}>↪</button>
      </div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <button ref={menuButtonRef} className="hamburger" onClick={() => setSidebarOpen(value => !value)} aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={sidebarOpen} aria-controls="admin-navigation"><span/><span/><span/></button>
        <div className="top-search">
          <span>⌕</span><input value={query} onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              const first = event.currentTarget.closest('.top-search')?.querySelector('.search-popover button:not(.search-popover-head button)')
              if (first) { event.preventDefault(); first.focus() }
            }
          }} onChange={event => {
            const value = event.target.value
            setQuery(value)
            if (value.trim().length < 2) {
              setSearchResult(null)
              setSearching(false)
            } else {
              setSearching(true)
            }
          }} placeholder="Pesquisar em todo o ecossistema…" aria-label="Pesquisar no ecossistema"/><kbd>Ctrl K</kbd>
          {(searchResult || searching) && <SearchPopover query={query} result={searchResult} searching={searching} onClose={() => { setQuery(''); setSearchResult(null) }} onPageNavigate={page => { go(page); setQuery(''); setSearchResult(null) }} onNavigate={group => {
            const destination = ({ users: 'users', applications: 'applications', establishments: 'establishments', items: 'items', events: 'establishments', orders: 'financial', payments: 'financial' })[group]
            if (destination) go(destination)
            setQuery('')
            setSearchResult(null)
          }}/>} 
        </div>
        <div className="top-actions">
          <span className={`sync-status sync-${realtimeState}`} title={realtimeState === 'connected' ? 'Atualização em tempo real conectada' : 'Atualização em tempo real indisponível; o painel usa sincronização de segurança'}><i/><b>{realtimeState === 'connected' ? 'Ao vivo' : 'Sincronização'}</b>{lastRefreshAt && <small>Atualizado {lastRefreshAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>}</span>
          <button className="icon-button" onClick={() => loadAll({ quiet: true, indicate: true, force: true })} aria-label="Atualizar dados" title="Atualizar dados">{refreshing ? '◌' : '↻'}</button>
          <div className="launcher-wrap">
            <button className="ecosystem-button" onClick={() => setLauncherOpen(value => !value)}><span>◫</span><b>Navegar no ecossistema</b><i>⌄</i></button>
            {launcherOpen && <EcosystemLauncher applications={applications} onClose={() => setLauncherOpen(false)}/>} 
          </div>
        </div>
      </header>

      {!online && <div className="admin-offline-banner" role="status"><span>Sem conexão</span><p>Os dados já carregados continuam disponíveis. A sincronização será retomada automaticamente quando a internet voltar.</p></div>}
      <div className="content">
        <section className="hero-section" id="dashboard" data-admin-page-key="dashboard">
          <div><p className="eyebrow">PETER TECNET / ECOSYSTEM INTELLIGENCE</p><h1>Dashboard administrativo</h1><p>Acompanhe operação, adoção e receita do ecossistema em tempo real.</p></div>
          <div className={`health-chip ${status}`}><span/><div><small>ECOSYSTEM HEALTH</small><b>{operationalStatus}</b></div></div>
        </section>

        {loadError && <div className="notice" data-admin-page-key="dashboard">{loadError}<button onClick={() => loadAll()}>Tentar novamente</button></div>}
        {loading ? <DashboardSkeleton/> : <>
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
        </>}

          <section id="operations" className="section-anchor" data-admin-page-key="operations" hidden={activePage !== 'operations'} aria-hidden={activePage !== 'operations'}>
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

          <section id="financial" className="section-anchor" data-admin-page-key="financial" hidden={activePage !== 'financial'} aria-hidden={activePage !== 'financial'}>
            <SectionHeading kicker="FINANCEIRO" title="Performance de receita" text="Distribuição financeira por aplicação e status de pagamentos."/>
            <div className="financial-strip">
              <div><span>Transações</span><b>{compactNumber(totals.transactions)}</b></div><div><span>Volume bruto</span><b>{currency(totals.gross)}</b></div><div><span>Taxas do provedor</span><b>{currency(totals.provider_fees)}</b></div><div><span>Líquido ao vendedor</span><b>{currency(totals.seller_net)}</b></div>
            </div>
            <Panel title="Receita por aplicação" subtitle="Ranking por volume bruto processado">
              <div className="table-wrap"><table><thead><tr><th>Aplicação</th><th>Transações</th><th>Volume bruto</th><th>Taxa Peter</th><th>Líquido</th></tr></thead><tbody>{financial?.applications?.length ? financial.applications.map(row => <tr key={row.app_slug || row.application_name}><td><b>{row.application_name || row.app_slug}</b></td><td>{compactNumber(row.transactions)}</td><td>{currency(row.gross)}</td><td>{currency(row.platform_fees)}</td><td>{currency(row.seller_net)}</td></tr>) : <tr><td colSpan="5"><Empty text="Ainda não há movimentação financeira consolidada por aplicação."/></td></tr>}</tbody></table></div>
            </Panel>
            {activePage === 'financial' && <AdminModuleBoundary name="Financeiro"><Suspense fallback={<ModuleSkeleton title="Carregando repasses…" />}><AdminPayoutCenter request={request}/></Suspense></AdminModuleBoundary>}
          </section>

          <section id="applications" className="section-anchor" data-admin-page-key="applications" hidden={activePage !== 'applications'} aria-hidden={activePage !== 'applications'}>
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

          <section id="users" className="section-anchor" data-admin-page-key="users" hidden={activePage !== 'users'} aria-hidden={activePage !== 'users'}>
            <SectionHeading kicker="USUÁRIOS" title="Gestão central de usuários" text="Pesquise, filtre e administre cadastros, perfis, acessos e atividade de todo o ecossistema."/>
            {activePage === 'users' && <AdminModuleBoundary name="Usuários"><Suspense fallback={<ModuleSkeleton title="Carregando usuários…" />}><AdminUsersCenter apiRequest={request} applications={applications}/></Suspense></AdminModuleBoundary>}
          </section>

          <section id="establishments-admin-integration" className="section-anchor admin-native-module" data-admin-page-key="establishments" hidden={activePage !== 'establishments'} aria-hidden={activePage !== 'establishments'}>
            {activePage === 'establishments' && <AdminModuleBoundary name="Estabelecimentos"><Suspense fallback={<ModuleSkeleton title="Carregando estabelecimentos…" />}>
              <AdminEstablishmentsPage />
            </Suspense></AdminModuleBoundary>}
          </section>

          <section id="items-admin-integration" className="section-anchor admin-native-module" data-admin-page-key="items" hidden={activePage !== 'items'} aria-hidden={activePage !== 'items'}>
            {activePage === 'items' && <AdminModuleBoundary name="Itens"><Suspense fallback={<ModuleSkeleton title="Carregando itens…" />}>
              <AdminItemsManager applications={applications} />
            </Suspense></AdminModuleBoundary>}
          </section>

          <section id="agents" className="section-anchor" data-admin-page-key="agents" hidden={activePage !== 'agents'} aria-hidden={activePage !== 'agents'}>
            <SectionHeading kicker="AGENTES" title="Central de comunicação" text="Envie ordens e acompanhe respostas dos agentes pelo histórico compartilhado do GitHub."/>
            {activePage === 'agents' && <AdminModuleBoundary name="Agentes"><Suspense fallback={<ModuleSkeleton title="Carregando central de agentes…" />}><AgentChatPanel request={request}/></Suspense></AdminModuleBoundary>}
          </section>

          <section id="notifications" className="section-anchor" data-admin-page-key="notifications" hidden={activePage !== 'notifications'} aria-hidden={activePage !== 'notifications'}>
            {activePage === 'notifications' && <AdminModuleBoundary name="Notificações"><Suspense fallback={<ModuleSkeleton title="Carregando notificações…" />}><NotificationsCenter request={request} applications={applications}/></Suspense></AdminModuleBoundary>}
          </section>

          <section id="activity" className="section-anchor" data-admin-page-key="activity" hidden={activePage !== 'activity'} aria-hidden={activePage !== 'activity'}>
            <SectionHeading kicker="ATIVIDADE" title="Linha do tempo recente" text="Últimas ações registradas pela telemetria do ecossistema."/>
            <Panel title="Atividade recente" subtitle={`${compactNumber(activity?.summary?.total ?? summary.interactions_30d)} interações no recorte atual`}>
              <div className="timeline">
                {activityRows.length ? activityRows.slice(0, 16).map((row, index) => <div className="timeline-row" key={row.id || `${row.created_at}-${index}`}><span className="timeline-dot"/><div><b>{row.name || row.interaction_type || row.type || 'Interação'}</b><small>{row.user_email || row.email || row.application_name || row.app_name || 'Ecossistema Peter Tecnet'}</small></div><time>{dateTime(row.created_at || row.occurred_at)}</time></div>) : <Empty text="Nenhuma interação recente retornada pela API."/>}
              </div>
            </Panel>
          </section>
      </div>
    </main>
  </div>
}

function SectionHeading({ kicker, title, text }) {
  return <div className="section-heading"><div><p className="eyebrow">{kicker}</p><h2>{title}</h2></div><p>{text}</p></div>
}

function SearchPopover({ query, result, searching, onClose, onNavigate, onPageNavigate }) {
  const groups = result?.groups || {}
  const term = String(query || '').trim().toLowerCase()
  const pageMatches = term.length >= 2
    ? navItems.filter(([id, label]) => id.includes(term) || label.toLowerCase().includes(term)).slice(0, 6)
    : []

  function keyboardNavigation(event) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll('button')].filter(button => !button.disabled && !button.classList.contains('search-close'))
    const index = buttons.indexOf(document.activeElement)
    if (index < 0) return
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    buttons[(index + direction + buttons.length) % buttons.length]?.focus()
  }

  return <div className="search-popover" onKeyDown={keyboardNavigation}>
    <div className="search-popover-head"><span>{searching ? 'Pesquisando…' : `${result?.total || 0} resultado(s)`}</span><button className="search-close" onClick={onClose} aria-label="Fechar busca">×</button></div>
    {pageMatches.length > 0 && <section className="search-commands"><h4>Ir para</h4>{pageMatches.map(([id, label, icon]) => <button key={id} type="button" onClick={() => onPageNavigate?.(id)}><span><AdminIcon name={icon}/></span><b>{label}</b><i>→</i></button>)}</section>}
    {result?.error && <div className="search-error">{result.error}</div>}
    {!searching && !result?.error && !result?.total && <Empty text="Nenhum resultado encontrado."/>}
    <div className="search-groups">
      {Object.entries(groups).map(([group, rows]) => <section key={group}><h4>{groupLabels[group] || group}<span>{rows.length}</span></h4>{rows.map((row, index) => <button type="button" className="search-result" key={row.id || index} onClick={() => onNavigate?.(group)}><div><b>{row.name || row.title || row.first_name || row.email || row.public_id || row.reference || `#${row.id}`}</b><small>{row.email || row.slug || row.status || row.category || row.application_name || row.url || `ID ${row.id}`}</small></div><span>#{row.id}</span></button>)}</section>)}
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

function ModuleSkeleton({ title = 'Carregando módulo…' }) {
  return <div className="admin-module-skeleton" role="status" aria-live="polite"><span/><div><b>{title}</b><small>Preparando a área administrativa sem interromper o restante do painel.</small></div></div>
}

function DashboardSkeleton() {
  return <div className="skeleton-wrap" data-admin-page-key="dashboard"><div className="metrics-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton metric-card" key={index}/>)}</div><div className="analytics-grid"><div className="skeleton panel tall"/><div className="skeleton panel tall"/></div></div>
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
    const storage = event => {
      if (event.key !== TOKEN_KEY) return
      if (!event.newValue) { setUser(null); setChecking(false); return }
      setChecking(true)
      validate()
    }
    window.addEventListener('admin-session-expired', expired)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener('admin-session-expired', expired)
      window.removeEventListener('storage', storage)
    }
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