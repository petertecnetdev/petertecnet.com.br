import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminApplicationsExperience.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const SLOT_ID = 'admin-applications-experience-slot'

const RUNTIME_MODE_PRESETS = {
  off: {
    mode: 'off',
    processing_enabled: false,
    scheduled_processing_enabled: false,
    market_scanner_enabled: false,
    ai_enabled: false,
    notifications_enabled: false,
    emails_enabled: false,
    reports_enabled: false,
    realtime_enabled: false,
  },
  on_demand: {
    mode: 'on_demand',
    processing_enabled: true,
    scheduled_processing_enabled: false,
    market_scanner_enabled: true,
    ai_enabled: true,
    notifications_enabled: false,
    emails_enabled: false,
    reports_enabled: false,
    realtime_enabled: false,
  },
  normal: {
    mode: 'normal',
    processing_enabled: true,
    scheduled_processing_enabled: true,
    market_scanner_enabled: true,
    ai_enabled: true,
    notifications_enabled: true,
    emails_enabled: true,
    reports_enabled: true,
    realtime_enabled: true,
    scan_interval_minutes: 5,
  },
  realtime: {
    mode: 'realtime',
    processing_enabled: true,
    scheduled_processing_enabled: true,
    market_scanner_enabled: true,
    ai_enabled: true,
    notifications_enabled: true,
    emails_enabled: true,
    reports_enabled: true,
    realtime_enabled: true,
    scan_interval_minutes: 1,
  },
}


const SORT_OPTIONS = [
  ['activity', 'Interações · 30 dias'],
  ['users', 'Número de usuários'],
  ['active', 'Usuários ativos · 30 dias'],
  ['adoption', 'Taxa de usuários ativos'],
  ['transactions', 'Transações'],
  ['gross', 'Receita bruta'],
  ['fees', 'Receita Peter Tecnet'],
  ['name', 'Nome da aplicação'],
]

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compact(value) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(numeric(value))
}

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(numeric(value))
}

function percent(value) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(numeric(value))}%`
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR')
}

function applicationKey(row) {
  return normalize(row?.slug || row?.app_slug || row?.application_slug || row?.name || row?.application_name || row?.id)
}

function matchesApplication(row, application) {
  if (!row || !application) return false
  const appId = String(application.id ?? '')
  const appSlug = normalize(application.slug || application.app_slug)
  const appName = normalize(application.name || application.application_name)
  const rowId = String(row.application_id ?? row.app_id ?? '')
  const rowSlug = normalize(row.application_slug || row.app_slug || row.slug)
  const rowName = normalize(row.application_name || row.app_name || row.name)
  return Boolean(
    (appId && rowId && appId === rowId) ||
    (appSlug && rowSlug && appSlug === rowSlug) ||
    (appName && rowName && appName === rowName)
  )
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) throw new Error('Sessão administrativa indisponível.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 18000)
  try {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
    if (options.body) headers['Content-Type'] = 'application/json'
    const response = await fetch(`${API}${path}`, {
      signal: controller.signal,
      method: options.method || 'GET',
      headers,
      body: options.body,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || payload?.error || 'Não foi possível consultar os dados da aplicação.')
    return payload
  } finally {
    window.clearTimeout(timeout)
  }
}

function routeSlug() {
  const match = window.location.pathname.match(/^\/applications\/([^/]+)\/?$/i)
  return match ? decodeURIComponent(match[1]) : ''
}

function situation(application) {
  if (!application || application.is_active === false) return { label: 'Inativa', tone: 'danger', detail: 'Aplicação marcada como inativa no ecossistema.' }
  const users = numeric(application.users_count)
  const active = numeric(application.active_users_30d)
  const interactions = numeric(application.activity_count_30d)
  if (!users && !interactions) return { label: 'Sem adoção', tone: 'warning', detail: 'Ainda não há usuários ou atividade relevante registrada no recorte atual.' }
  if (active > 0 && interactions > 0) return { label: 'Em uso', tone: 'success', detail: 'Há usuários ativos e interações registradas nos últimos 30 dias.' }
  if (users > 0 && interactions === 0) return { label: 'Baixa atividade', tone: 'warning', detail: 'Existem usuários cadastrados, mas nenhuma interação foi registrada nos últimos 30 dias.' }
  return { label: 'Operacional', tone: 'success', detail: 'Aplicação ativa e conectada à visão central do ecossistema.' }
}

function mergeApplications(applications, dashboard, financial) {
  const merged = new Map()
  const add = row => {
    if (!row) return
    const key = applicationKey(row)
    if (!key) return
    merged.set(key, { ...(merged.get(key) || {}), ...row })
  }
  ;(applications || []).forEach(add)
  ;(dashboard?.applications || []).forEach(add)

  const financialRows = financial?.applications || []
  return [...merged.values()].map(app => {
    const financialRow = financialRows.find(row => matchesApplication(row, app)) || {}
    const users = numeric(app.users_count)
    const active = numeric(app.active_users_30d)
    return {
      ...app,
      _financial: financialRow,
      _adoption: users > 0 ? (active / users) * 100 : 0,
      _interactionsPerActive: active > 0 ? numeric(app.activity_count_30d) / active : 0,
    }
  })
}

function sortValue(application, sort) {
  if (sort === 'users') return numeric(application.users_count)
  if (sort === 'active') return numeric(application.active_users_30d)
  if (sort === 'adoption') return numeric(application._adoption)
  if (sort === 'transactions') return numeric(application._financial?.transactions)
  if (sort === 'gross') return numeric(application._financial?.gross)
  if (sort === 'fees') return numeric(application._financial?.platform_fees)
  if (sort === 'name') return normalize(application.name || application.slug)
  return numeric(application.activity_count_30d)
}

function Toolbar({ rows, total, search, setSearch, status, setStatus, sort, setSort, direction, setDirection }) {
  return <div className="applications-experience-toolbar" aria-label="Filtros das aplicações">
    <div className="applications-toolbar-summary">
      <span className="applications-toolbar-icon">◇</span>
      <div><b>{rows.length} de {total} aplicações</b><small>Organize o ecossistema pelos indicadores que importam agora.</small></div>
    </div>
    <label className="applications-toolbar-search">
      <span>⌕</span>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtrar por nome ou descrição" aria-label="Filtrar aplicações"/>
    </label>
    <label className="applications-toolbar-field">
      <span>Status</span>
      <select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">Todas</option>
        <option value="active">Ativas</option>
        <option value="inactive">Inativas</option>
      </select>
    </label>
    <label className="applications-toolbar-field applications-sort-field">
      <span>Ordenar por</span>
      <select value={sort} onChange={event => setSort(event.target.value)}>
        {SORT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
    <button className="applications-direction-button" type="button" onClick={() => setDirection(value => value === 'desc' ? 'asc' : 'desc')} title="Inverter ordem">
      <span>{direction === 'desc' ? '↓' : '↑'}</span>
      <b>{direction === 'desc' ? 'Maior primeiro' : 'Menor primeiro'}</b>
    </button>
  </div>
}

function DetailMetric({ label, value, detail }) {
  return <article className="application-detail-metric"><span>{label}</span><b>{value}</b>{detail && <small>{detail}</small>}</article>
}

function Progress({ label, value, display }) {
  const bounded = Math.max(0, Math.min(100, numeric(value)))
  return <div className="application-progress-row">
    <div><span>{label}</span><b>{display ?? percent(bounded)}</b></div>
    <i><span style={{ width: `${bounded}%` }}/></i>
  </div>
}

function RuntimeToggle({ label, detail, checked, disabled, onChange }) {
  return <label className={`runtime-toggle ${disabled ? 'disabled' : ''}`}>
    <span><b>{label}</b><small>{detail}</small></span>
    <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={event => onChange(event.target.checked)}/>
    <i aria-hidden="true"/>
  </label>
}

function RuntimeControlPanel({ application }) {
  const [runtime, setRuntime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const marketCapable = useMemo(() => {
    if (normalize(application?.slug) === 'kryvion') return true
    return (Array.isArray(application?.capabilities) ? application.capabilities : [])
      .some(capability => normalize(typeof capability === 'string' ? capability : capability?.key || capability?.name) === 'market_data')
  }, [application])

  const loadRuntime = useCallback(async () => {
    if (!application?.id) return
    setLoading(true)
    setError('')
    try {
      const payload = await request(`/admin/ecosystem/applications/${application.id}/runtime`)
      setRuntime(payload?.runtime || null)
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar o controle operacional.')
    } finally {
      setLoading(false)
    }
  }, [application?.id])

  useEffect(() => {
    void loadRuntime()
  }, [loadRuntime])

  const saveRuntime = useCallback(async nextRuntime => {
    if (!application?.id || !nextRuntime) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = await request(`/admin/ecosystem/applications/${application.id}/runtime`, {
        method: 'PUT',
        body: JSON.stringify({
          mode: nextRuntime.mode,
          processing_enabled: Boolean(nextRuntime.processing_enabled),
          scheduled_processing_enabled: Boolean(nextRuntime.scheduled_processing_enabled),
          market_scanner_enabled: Boolean(nextRuntime.market_scanner_enabled),
          ai_enabled: Boolean(nextRuntime.ai_enabled),
          notifications_enabled: Boolean(nextRuntime.notifications_enabled),
          emails_enabled: Boolean(nextRuntime.emails_enabled),
          reports_enabled: Boolean(nextRuntime.reports_enabled),
          realtime_enabled: Boolean(nextRuntime.realtime_enabled),
          scan_interval_minutes: Number(nextRuntime.scan_interval_minutes || 5),
          idle_timeout_minutes: Number(nextRuntime.idle_timeout_minutes || 15),
          reason: nextRuntime.reason || null,
        }),
      })
      setRuntime(payload?.runtime || nextRuntime)
      setMessage(payload?.message || 'Controle operacional atualizado.')
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar o controle operacional.')
    } finally {
      setSaving(false)
    }
  }, [application?.id])

  const applyMode = mode => {
    const next = { ...(runtime || {}), ...(RUNTIME_MODE_PRESETS[mode] || RUNTIME_MODE_PRESETS.normal), mode }
    if (mode === 'off' && !next.reason) next.reason = 'Suspenso temporariamente pelo Admin Center para reduzir consumo de infraestrutura.'
    setRuntime(next)
    setMessage('')
  }

  const updateField = (field, value) => {
    setRuntime(current => ({ ...(current || {}), [field]: value }))
    setMessage('')
  }

  const suspendNow = () => {
    const next = {
      ...(runtime || {}),
      ...RUNTIME_MODE_PRESETS.off,
      reason: runtime?.reason || 'Suspenso temporariamente pelo Admin Center para reduzir consumo de infraestrutura.',
    }
    setRuntime(next)
    void saveRuntime(next)
  }

  if (loading) {
    return <section className="application-detail-panel runtime-control-panel">
      <header><div><p>CONTROLE OPERACIONAL</p><h2>Carregando estado da aplicação</h2></div><span>API CENTRAL</span></header>
      <div className="runtime-loading"><span className="detail-loader"/><p>Consultando processamento, automações e realtime.</p></div>
    </section>
  }

  if (!runtime) {
    return <section className="application-detail-panel runtime-control-panel">
      <header><div><p>CONTROLE OPERACIONAL</p><h2>Estado indisponível</h2></div><span>ATENÇÃO</span></header>
      <div className="runtime-feedback error">{error || 'Não foi possível consultar o estado operacional.'}</div>
      <button className="runtime-secondary-button" type="button" onClick={() => void loadRuntime()}>Tentar novamente</button>
    </section>
  }

  const suspended = runtime.mode === 'off' || !runtime.processing_enabled

  return <section className={`application-detail-panel runtime-control-panel ${suspended ? 'suspended' : ''}`}>
    <header>
      <div>
        <p>CONTROLE OPERACIONAL</p>
        <h2>Processamento e consumo de infraestrutura</h2>
      </div>
      <span className={`runtime-mode-badge ${runtime.mode}`}>{runtime.mode === 'off' ? 'OFF' : runtime.mode === 'on_demand' ? 'SOB DEMANDA' : runtime.mode === 'realtime' ? 'TEMPO REAL' : 'NORMAL'}</span>
    </header>

    <div className="runtime-control-head">
      <div>
        <b>{suspended ? 'Processamento pesado suspenso' : 'Processamento habilitado'}</b>
        <p>{suspended
          ? 'Site, login e dados permanecem disponíveis; scanners, jobs e envios controlados por este painel ficam bloqueados.'
          : 'A aplicação pode executar os recursos habilitados abaixo conforme o modo operacional selecionado.'}</p>
      </div>
      <button className="runtime-danger-button" type="button" disabled={saving || suspended} onClick={suspendNow}>
        {saving ? 'Salvando…' : 'Suspender agora'}
      </button>
    </div>

    <div className="runtime-mode-grid">
      <label>
        <span>Modo operacional</span>
        <select value={runtime.mode || 'normal'} disabled={saving} onChange={event => applyMode(event.target.value)}>
          <option value="off">Desligado</option>
          <option value="on_demand">Sob demanda</option>
          <option value="normal">Normal</option>
          <option value="realtime">Tempo real</option>
        </select>
      </label>
      <label>
        <span>Intervalo de varredura</span>
        <select value={String(runtime.scan_interval_minutes || 5)} disabled={saving || suspended} onChange={event => updateField('scan_interval_minutes', Number(event.target.value))}>
          <option value="1">1 minuto</option>
          <option value="5">5 minutos</option>
          <option value="15">15 minutos</option>
          <option value="60">1 hora</option>
        </select>
      </label>
      <label>
        <span>Idle automático</span>
        <select value={String(runtime.idle_timeout_minutes || 15)} disabled={saving || suspended} onChange={event => updateField('idle_timeout_minutes', Number(event.target.value))}>
          <option value="5">5 minutos</option>
          <option value="15">15 minutos</option>
          <option value="30">30 minutos</option>
          <option value="60">1 hora</option>
        </select>
      </label>
    </div>

    <div className="runtime-toggle-grid">
      <RuntimeToggle label="Processamento" detail="Chave mestre para trabalhos pesados." checked={runtime.processing_enabled} disabled={saving || runtime.mode === 'off'} onChange={value => updateField('processing_enabled', value)}/>
      <RuntimeToggle label="Jobs agendados" detail="Permite tarefas automáticas recorrentes." checked={runtime.scheduled_processing_enabled} disabled={saving || suspended} onChange={value => updateField('scheduled_processing_enabled', value)}/>
      {marketCapable && <RuntimeToggle label="Scanner de mercado" detail="Consultas e varreduras de ativos." checked={runtime.market_scanner_enabled} disabled={saving || suspended} onChange={value => updateField('market_scanner_enabled', value)}/>}
      {marketCapable && <RuntimeToggle label="Análises de IA" detail="Processamento inteligente da aplicação." checked={runtime.ai_enabled} disabled={saving || suspended} onChange={value => updateField('ai_enabled', value)}/>}
      <RuntimeToggle label="Notificações" detail="Alertas automáticos para usuários." checked={runtime.notifications_enabled} disabled={saving || suspended} onChange={value => updateField('notifications_enabled', value)}/>
      <RuntimeToggle label="E-mails" detail="Envios automáticos e relatórios por e-mail." checked={runtime.emails_enabled} disabled={saving || suspended} onChange={value => updateField('emails_enabled', value)}/>
      <RuntimeToggle label="Relatórios" detail="Geração e distribuição recorrente." checked={runtime.reports_enabled} disabled={saving || suspended} onChange={value => updateField('reports_enabled', value)}/>
      <RuntimeToggle label="Realtime" detail="Atualizações em tempo real específicas da aplicação." checked={runtime.realtime_enabled} disabled={saving || suspended} onChange={value => updateField('realtime_enabled', value)}/>
    </div>

    <label className="runtime-reason-field">
      <span>Motivo / observação operacional</span>
      <textarea value={runtime.reason || ''} disabled={saving} maxLength={500} onChange={event => updateField('reason', event.target.value)} placeholder="Ex.: suspenso temporariamente por ausência de usuários ativos."/>
    </label>

    <div className="runtime-control-footer">
      <div>
        {runtime.updated_at && <small>Última alteração: {dateTime(runtime.updated_at)}</small>}
        {error && <span className="runtime-feedback error">{error}</span>}
        {message && <span className="runtime-feedback success">{message}</span>}
      </div>
      <button className="runtime-save-button" type="button" disabled={saving} onClick={() => void saveRuntime(runtime)}>
        {saving ? 'Salvando…' : 'Salvar controle operacional'}
      </button>
    </div>
  </section>
}

function ApplicationDetailPage({ application, activityRows, alertRows, onBack }) {
  if (!application) return <div className="application-detail-overlay"><main className="application-detail-page application-detail-loading"><button onClick={onBack}>← Voltar</button><div><span className="detail-loader"/><h1>Carregando aplicação…</h1><p>Consultando a telemetria central do ecossistema.</p></div></main></div>

  const currentSituation = situation(application)
  const appActivity = activityRows.filter(row => matchesApplication(row, application)).sort((a, b) => new Date(b.created_at || b.occurred_at || 0) - new Date(a.created_at || a.occurred_at || 0))
  const appAlerts = alertRows.filter(row => matchesApplication(row, application))
  const users = numeric(application.users_count)
  const active = numeric(application.active_users_30d)
  const interactions = numeric(application.activity_count_30d)
  const financial = application._financial || {}
  const adoption = numeric(application._adoption)
  const lastActivity = appActivity[0]?.created_at || appActivity[0]?.occurred_at
  const interactionScore = Math.min(100, active > 0 ? (interactions / active) * 10 : 0)

  return <div className="application-detail-overlay">
    <main className="application-detail-page">
      <header className="application-detail-topbar">
        <button className="application-detail-back" onClick={onBack}>← <span>Aplicações</span></button>
        <div className="application-detail-actions">
          <span className={`application-detail-status ${currentSituation.tone}`}><i/>{currentSituation.label}</span>
          {application.url && <a href={application.url} target="_blank" rel="noreferrer">Abrir aplicação ↗</a>}
        </div>
      </header>

      <section className="application-detail-hero">
        <div className="application-detail-identity">
          <div className="application-detail-logo">{application.logo ? <img src={application.logo} alt=""/> : <span>{String(application.name || 'P').slice(0, 1)}</span>}</div>
          <div><p>APLICAÇÃO / {application.slug || application.app_slug || `#${application.id}`}</p><h1>{application.name || application.application_name || 'Aplicação Peter Tecnet'}</h1><span>{application.description || 'Produto conectado ao ecossistema Peter Tecnet.'}</span></div>
        </div>
        <aside className={`application-situation-card ${currentSituation.tone}`}><small>SITUAÇÃO ATUAL</small><b>{currentSituation.label}</b><p>{currentSituation.detail}</p><div><span>Última atividade</span><strong>{dateTime(lastActivity)}</strong></div></aside>
      </section>

      <section className="application-detail-metrics">
        <DetailMetric label="Usuários" value={compact(users)} detail="cadastros vinculados"/>
        <DetailMetric label="Ativos · 30d" value={compact(active)} detail={`${percent(adoption)} da base`}/>
        <DetailMetric label="Interações · 30d" value={compact(interactions)} detail={`${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(application._interactionsPerActive || 0)} por ativo`}/>
        <DetailMetric label="Transações" value={compact(financial.transactions)} detail="recorte financeiro atual"/>
        <DetailMetric label="Receita bruta" value={currency(financial.gross)} detail="volume processado"/>
        <DetailMetric label="Receita Peter" value={currency(financial.platform_fees)} detail="taxas da plataforma"/>
      </section>

      <RuntimeControlPanel application={application}/>

      <section className="application-detail-grid">
        <article className="application-detail-panel">
          <header><div><p>ADOÇÃO E USO</p><h2>Como a aplicação está sendo usada</h2></div><span>30 DIAS</span></header>
          <div className="application-progress-list">
            <Progress label="Usuários ativos sobre a base" value={adoption}/>
            <Progress label="Intensidade de interação" value={interactionScore} display={`${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(application._interactionsPerActive || 0)} interações/ativo`}/>
          </div>
          <div className="application-usage-breakdown">
            <div><span>Base sem atividade recente</span><b>{compact(Math.max(users - active, 0))}</b></div>
            <div><span>Usuários ativos</span><b>{compact(active)}</b></div>
            <div><span>Interações por usuário cadastrado</span><b>{users ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(interactions / users) : '0'}</b></div>
            <div><span>Estado cadastral</span><b>{application.is_active === false ? 'Inativa' : 'Ativa'}</b></div>
          </div>
        </article>

        <article className="application-detail-panel">
          <header><div><p>FINANCEIRO</p><h2>Movimentação da aplicação</h2></div><span>API CENTRAL</span></header>
          <div className="application-financial-list">
            <div><span>Volume bruto</span><b>{currency(financial.gross)}</b></div>
            <div><span>Taxas Peter Tecnet</span><b>{currency(financial.platform_fees)}</b></div>
            <div><span>Taxas do provedor</span><b>{currency(financial.provider_fees)}</b></div>
            <div><span>Líquido para vendedores</span><b>{currency(financial.seller_net)}</b></div>
          </div>
          {!numeric(financial.transactions) && <p className="application-detail-note">Ainda não há movimentação financeira consolidada para esta aplicação no recorte atual.</p>}
        </article>
      </section>

      <section className="application-detail-grid application-detail-lower-grid">
        <article className="application-detail-panel application-activity-panel">
          <header><div><p>TELEMETRIA</p><h2>Atividade recente</h2></div><span>{appActivity.length} registros</span></header>
          <div className="application-detail-timeline">
            {appActivity.length ? appActivity.slice(0, 20).map((row, index) => <div className="application-detail-timeline-row" key={row.id || `${row.created_at}-${index}`}>
              <i/><div><b>{row.name || row.interaction_type || row.type || 'Interação'}</b><span>{row.user_email || row.email || row.user_name || 'Usuário não identificado'}</span></div><time>{dateTime(row.created_at || row.occurred_at)}</time>
            </div>) : <div className="application-detail-empty">Nenhuma atividade recente específica desta aplicação foi retornada pela telemetria.</div>}
          </div>
        </article>

        <article className="application-detail-panel">
          <header><div><p>SAÚDE</p><h2>Sinais e alertas</h2></div><span>{appAlerts.length}</span></header>
          <div className="application-alerts-list">
            {appAlerts.length ? appAlerts.slice(0, 10).map((row, index) => <div className="application-alert-item" key={row.id || index}><i className={normalize(row.severity || row.status)}/><div><b>{row.title || row.name || row.message || 'Sinal operacional'}</b><span>{row.message || row.description || row.status || row.severity}</span></div></div>) : <div className="application-detail-empty">Nenhum alerta específico desta aplicação foi identificado no painel central.</div>}
          </div>
        </article>
      </section>

      <section className="application-detail-panel application-metadata-panel">
        <header><div><p>IDENTIFICAÇÃO</p><h2>Dados técnicos e cadastrais</h2></div></header>
        <div className="application-metadata-grid">
          <div><span>ID</span><b>{application.id ?? '—'}</b></div>
          <div><span>Slug</span><b>{application.slug || application.app_slug || '—'}</b></div>
          <div><span>Versão</span><b>{application.version || '—'}</b></div>
          <div><span>Atualização cadastral</span><b>{dateTime(application.updated_at)}</b></div>
          <div className="wide"><span>URL</span><b>{application.url || '—'}</b></div>
        </div>
      </section>
    </main>
  </div>
}

export default function AdminApplicationsExperience() {
  const [slot, setSlot] = useState(null)
  const [applications, setApplications] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [activity, setActivity] = useState(null)
  const [financial, setFinancial] = useState(null)
  const [command, setCommand] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('activity')
  const [direction, setDirection] = useState('desc')
  const [selectedSlug, setSelectedSlug] = useState(routeSlug)

  const load = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    const endpoints = [
      ['/admin/applications', setApplications, payload => payload?.applications || payload?.data || (Array.isArray(payload) ? payload : [])],
      ['/admin/ecosystem/dashboard', setDashboard],
      ['/admin/ecosystem/activity', setActivity],
      ['/admin/ecosystem/financial/dashboard', setFinancial],
      ['/admin/ecosystem/command/overview', setCommand],
    ]
    const settled = await Promise.allSettled(endpoints.map(([path]) => request(path)))
    settled.forEach((result, index) => {
      if (result.status !== 'fulfilled') return
      const [, setter, transform] = endpoints[index]
      setter(transform ? transform(result.value) : result.value)
    })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 600)
    const interval = window.setInterval(() => void load(), 30000)
    return () => { window.clearTimeout(timer); window.clearInterval(interval) }
  }, [load])

  useEffect(() => {
    const updateRoute = () => setSelectedSlug(routeSlug())
    window.addEventListener('popstate', updateRoute)
    return () => window.removeEventListener('popstate', updateRoute)
  }, [])

  const rows = useMemo(() => mergeApplications(applications, dashboard, financial), [applications, dashboard, financial])

  const visibleRows = useMemo(() => {
    const needle = normalize(search)
    const filtered = rows.filter(app => {
      if (status === 'active' && app.is_active === false) return false
      if (status === 'inactive' && app.is_active !== false) return false
      if (!needle) return true
      return [app.name, app.slug, app.description].some(value => normalize(value).includes(needle))
    })
    return filtered.sort((a, b) => {
      const av = sortValue(a, sort)
      const bv = sortValue(b, sort)
      let comparison = 0
      if (typeof av === 'string' || typeof bv === 'string') comparison = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      else comparison = numeric(av) - numeric(bv)
      if (comparison === 0) comparison = normalize(a.name).localeCompare(normalize(b.name), 'pt-BR')
      return direction === 'desc' ? -comparison : comparison
    })
  }, [rows, search, status, sort, direction])

  useEffect(() => {
    function ensureSlot() {
      const section = document.getElementById('applications')
      const grid = section?.querySelector('.apps-grid')
      if (!section || !grid) { if (slot) setSlot(null); return }
      let node = section.querySelector(`#${SLOT_ID}`)
      if (!node) {
        node = document.createElement('div')
        node.id = SLOT_ID
        section.insertBefore(node, grid)
      }
      if (node !== slot) setSlot(node)
    }
    ensureSlot()
    const observer = new MutationObserver(ensureSlot)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [slot])

  useEffect(() => {
    const orderByName = new Map(visibleRows.map((app, index) => [normalize(app.name || app.application_name), index]))
    const visibleNames = new Set(orderByName.keys())
    document.querySelectorAll('#applications .app-card').forEach(card => {
      const name = normalize(card.querySelector('h3')?.textContent)
      card.hidden = !visibleNames.has(name)
      card.style.order = String(orderByName.get(name) ?? 9999)
      card.classList.add('application-card-interactive')
      card.tabIndex = 0
      card.setAttribute('role', 'button')
      card.setAttribute('aria-label', `Ver detalhes de ${card.querySelector('h3')?.textContent || 'aplicação'}`)
    })
  }, [visibleRows, slot])

  const openApplication = useCallback(app => {
    const slug = app.slug || app.app_slug || applicationKey(app)
    if (!slug) return
    window.history.pushState({}, '', `/applications/${encodeURIComponent(slug)}`)
    setSelectedSlug(String(slug))
  }, [])

  useEffect(() => {
    const click = event => {
      const card = event.target.closest('#applications .app-card')
      if (!card || event.target.closest('a, button, input, select, textarea')) return
      const name = normalize(card.querySelector('h3')?.textContent)
      const app = rows.find(row => normalize(row.name || row.application_name) === name)
      if (app) openApplication(app)
    }
    const keydown = event => {
      if (!['Enter', ' '].includes(event.key)) return
      const card = event.target.closest('#applications .app-card')
      if (!card || event.target !== card) return
      event.preventDefault()
      const name = normalize(card.querySelector('h3')?.textContent)
      const app = rows.find(row => normalize(row.name || row.application_name) === name)
      if (app) openApplication(app)
    }
    document.addEventListener('click', click)
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', keydown) }
  }, [rows, openApplication])

  const selected = useMemo(() => rows.find(app => [app.slug, app.app_slug, applicationKey(app)].some(value => normalize(value) === normalize(selectedSlug))), [rows, selectedSlug])
  const activityRows = activity?.activity || dashboard?.recent_activity || []
  const alertRows = [...(command?.issues?.data || command?.issues || []), ...(financial?.alerts || [])]

  useEffect(() => {
    if (!selectedSlug) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [selectedSlug])

  const back = useCallback(() => {
    window.history.pushState({}, '', '/#applications')
    setSelectedSlug('')
    window.setTimeout(() => document.getElementById('applications')?.scrollIntoView({ block: 'start' }), 50)
  }, [])

  return <>
    {slot && createPortal(<Toolbar rows={visibleRows} total={rows.length} search={search} setSearch={setSearch} status={status} setStatus={setStatus} sort={sort} setSort={setSort} direction={direction} setDirection={setDirection}/>, slot)}
    {selectedSlug && <ApplicationDetailPage application={selected} activityRows={activityRows} alertRows={alertRows} onBack={back}/>} 
  </>
}
