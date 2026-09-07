import { useCallback, useEffect, useMemo, useState } from 'react'
import './AdminCutinappCenter.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const APP_SLUG = 'cutinapp'

const MODULE_COPY = {
  dashboard: ['Dashboard Cutinapp', 'Visão executiva de receita, operação, risco e crescimento.'],
  events: ['Eventos', 'Agenda completa, publicação, lotes, vendas e desempenho por evento.'],
  tickets: ['Ingressos e lotes', 'Capacidade, vendidos, disponíveis, cortesias, reservas e receita.'],
  sales: ['Vendas e pedidos', 'Pedidos pagos, pendentes, cancelados, descontos e ticket médio.'],
  finance: ['Financeiro', 'GMV, receita Peter Tecnet, take rate, gateway, líquido e reversões.'],
  checkins: ['Check-in e participantes', 'Passes emitidos, entradas realizadas, cortesias e reversões.'],
  productions: ['Produções', 'Establishments da Cutinapp, situação, local e operação.'],
  users: ['Usuários', 'Pessoas vinculadas à aplicação, papel e estado de acesso.'],
  promoters: ['Promoters', 'Atribuição, comissão, eventos vendidos e valor de comissão.'],
  campaigns: ['Cupons e campanhas', 'Campanhas, audiência, entrega e impacto operacional.'],
  promotions: ['Promoções interativas', 'Ações de engajamento, campanhas e sinais sociais do evento.'],
  catalog: ['Catálogo e adicionais', 'Produtos, itens, adicionais e estoque separado dos ingressos reais.'],
  social: ['Conteúdo social', 'Feed, comunidade, compartilhamentos e sinais de interação.'],
  moderation: ['Moderação e denúncias', 'Fila de denúncias, estado da análise e usuários envolvidos.'],
  notifications: ['Notificações', 'Histórico de alertas e mensagens enviadas pela Cutinapp.'],
  communications: ['Comunicação', 'Campanhas para usuários e participantes com rastreio de entrega.'],
  event_analytics: ['Analytics do evento', 'Ranking por receita, ingressos, check-ins e disponibilidade.'],
  app_analytics: ['Analytics da aplicação', 'Atividade diária, usuários ativos e funil de conversão.'],
  rankings: ['Ranking e inteligência', 'Eventos e produções de melhor desempenho econômico.'],
  boosts: ['Destaques e impulsionamento', 'Eventos destacados e oportunidades de exposição.'],
  schedule: ['Agenda e recorrência', 'Programações recorrentes e ocorrências planejadas.'],
  map: ['Mapa operacional', 'Eventos e produções georreferenciados para operação por cidade.'],
  audit: ['Auditoria', 'Ações administrativas rastreáveis por entidade e usuário.'],
  health: ['Saúde operacional', 'Issues, erros, pagamentos problemáticos e alertas acionáveis.'],
  support: ['Suporte', 'Chamados vinculados à Cutinapp e tempo de resolução.'],
  search: ['Busca global Cutinapp', 'Pesquisa unificada em eventos, produções, usuários, itens e pedidos.'],
  quick_actions: ['Ações rápidas', 'Atalhos para os módulos globais de administração relacionados.'],
  financial_security: ['Segurança financeira', 'Falhas, estornos, chargebacks e passes revertidos.'],
  permissions: ['Permissões administrativas', 'Papéis e estado dos acessos vinculados à aplicação.'],
  exports: ['Exportações', 'Relatórios financeiros e dados operacionais para conferência.'],
}

const GROUPS = [
  ['Operação', ['dashboard', 'events', 'tickets', 'sales', 'checkins', 'productions', 'users', 'catalog']],
  ['Receita', ['finance', 'promoters', 'campaigns', 'promotions', 'rankings', 'boosts', 'event_analytics', 'app_analytics']],
  ['Relacionamento', ['social', 'moderation', 'notifications', 'communications', 'support']],
  ['Controle', ['schedule', 'map', 'audit', 'health', 'search', 'quick_actions', 'financial_security', 'permissions', 'exports']],
]

function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 22000)
  return fetch(`${API}${path}`, {
    ...options,
    signal: controller.signal,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async response => {
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }
    if (!response.ok) throw new Error(payload?.error || payload?.message || Object.values(payload?.errors || {}).flat()?.[0] || 'Não foi possível carregar a Cutinapp.')
    return payload
  }).finally(() => window.clearTimeout(timeout))
}

const n = value => Number(value || 0).toLocaleString('pt-BR')
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const percent = value => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const nameOf = row => [row?.first_name, row?.last_name].filter(Boolean).join(' ') || row?.user_name || row?.email || `#${row?.id || '—'}`

function goAdminPage(page) {
  const url = new URL(window.location.href)
  if (page === 'dashboard') url.searchParams.delete('page')
  else url.searchParams.set('page', page)
  window.history.pushState({ ...(window.history.state || {}), adminPage: page }, '', `${url.pathname}${url.search}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function Badge({ children, tone = '' }) { return <span className={`cac-badge ${tone}`}>{children}</span> }
function Empty({ children = 'Nenhum registro neste módulo.' }) { return <div className="cac-empty">{children}</div> }
function Metric({ label, value, detail, tone = '' }) { return <article className={`cac-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }

function DataTable({ columns, rows, empty = 'Nenhum registro encontrado.' }) {
  if (!rows?.length) return <Empty>{empty}</Empty>
  return <div className="cac-table-wrap"><table className="cac-table"><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.public_id || `${index}-${columns[0]?.key}`}>{columns.map(col => <td key={col.key} data-label={col.label}>{col.render ? col.render(row) : String(row[col.key] ?? '—')}</td>)}</tr>)}</tbody></table></div>
}

export default function AdminCutinappCenter() {
  const [payload, setPayload] = useState(null)
  const [application, setApplication] = useState(null)
  const [active, setActive] = useState('dashboard')
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [moduleSearch, setModuleSearch] = useState('')
  const [search, setSearch] = useState('')
  const [ticketDetails, setTicketDetails] = useState(null)
  const [ticketLoading, setTicketLoading] = useState(false)

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      let app = application
      if (!app?.id) {
        const appsPayload = await request('/admin/applications')
        const apps = appsPayload?.applications || appsPayload?.data || (Array.isArray(appsPayload) ? appsPayload : [])
        app = apps.find(candidate => normalize(`${candidate.slug} ${candidate.name}`).includes(APP_SLUG))
        if (!app) throw new Error('A aplicação Cutinapp não foi localizada no registro de aplicações.')
        setApplication(app)
      }
      const data = await request(`/admin/ecosystem/applications/${app.id}/operations?days=${days}`)
      setPayload(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [application, days])

  useEffect(() => { void load() }, [load])

  const moduleMeta = useMemo(() => Object.fromEntries((payload?.modules || []).map(row => [row.key, row])), [payload?.modules])
  const visibleGroups = useMemo(() => {
    const term = normalize(moduleSearch.trim())
    return GROUPS.map(([group, keys]) => [group, keys.filter(key => !term || normalize(`${MODULE_COPY[key]?.[0]} ${MODULE_COPY[key]?.[1]}`).includes(term))]).filter(([, keys]) => keys.length)
  }, [moduleSearch])

  const summary = payload?.summary || {}
  const finance = payload?.finance || {}
  const analytics = payload?.analytics || {}
  const rankings = payload?.rankings || {}

  async function loadTicketDetails(event) {
    if (!application?.id || !event?.production_id || !event?.id) return
    setTicketLoading(true)
    setTicketDetails({ event, data: null, error: '' })
    try {
      const data = await request(`/admin/ecosystem/establishments/${event.production_id}/resources/events/${event.id}/tickets?app_id=${application.id}`)
      setTicketDetails({ event, data, error: '' })
    } catch (err) {
      setTicketDetails({ event, data: null, error: err.message })
    } finally {
      setTicketLoading(false)
    }
  }

  async function downloadExport(format) {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const response = await fetch(`${API}/admin/ecosystem/financial/reports/${format}?app_slug=${APP_SLUG}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!response.ok) throw new Error('Não foi possível gerar a exportação.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cutinapp-financeiro.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) { setError(err.message) }
  }

  if (loading && !payload) return <section className="cac-shell"><div className="cac-loading"><span>◉</span><b>Carregando Cutinapp Admin…</b><small>Consolidando eventos, receita, ingressos e operação.</small></div></section>

  return <section className="cac-shell">
    <header className="cac-hero">
      <div className="cac-brand">
        <span className="cac-logo">{payload?.application?.logo ? <img src={payload.application.logo} alt="" /> : 'C'}</span>
        <div><p>CUTINAPP / ADMIN CONTROL PLANE</p><h1>Gestão completa da Cutinapp</h1><span>30 módulos operacionais conectados à API central da Peter Tecnet.</span></div>
      </div>
      <div className="cac-hero-actions">
        <label>Período<select value={days} onChange={event => setDays(Number(event.target.value))}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">365 dias</option></select></label>
        <button type="button" onClick={() => void load({ quiet: true })} disabled={refreshing}>{refreshing ? 'Atualizando…' : '↻ Atualizar'}</button>
        {payload?.application?.url && <a href={payload.application.url} target="_blank" rel="noreferrer">Abrir Cutinapp ↗</a>}
      </div>
    </header>

    {error && <div className="cac-feedback error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>×</button></div>}

    <div className="cac-kpis">
      <Metric label="GMV" value={money(summary.gmv)} detail={`${n(finance.paid_orders)} pedidos pagos`} tone="accent" />
      <Metric label="Receita Peter Tecnet" value={money(summary.platform_revenue)} detail={`Take rate ${percent(summary.take_rate)}`} tone="success" />
      <Metric label="Ingressos vendidos" value={n(summary.tickets_sold)} detail={`${n(summary.tickets_available)} disponíveis`} />
      <Metric label="Eventos" value={n(summary.events_total)} detail={`${n(summary.events_upcoming)} próximos · ${n(summary.events_live)} ao vivo`} />
      <Metric label="Check-ins" value={n(summary.checkins)} detail={`${n(summary.passes_active)} passes ativos`} />
      <Metric label="Usuários" value={n(summary.users_total)} detail={`${n(analytics.active_users)} ativos no período`} />
    </div>

    <div className="cac-layout">
      <aside className="cac-nav">
        <div className="cac-nav-search"><span>⌕</span><input value={moduleSearch} onChange={event => setModuleSearch(event.target.value)} placeholder="Buscar módulo…" /></div>
        {visibleGroups.map(([group, keys]) => <div className="cac-nav-group" key={group}><p>{group}</p>{keys.map(key => <button type="button" key={key} className={active === key ? 'active' : ''} onClick={() => { setActive(key); setTicketDetails(null) }}><span>{MODULE_COPY[key]?.[0]}</span><i>{moduleMeta[key]?.count ? n(moduleMeta[key].count) : '→'}</i></button>)}</div>)}
      </aside>

      <main className="cac-main">
        <header className="cac-module-head"><div><p>{active.replaceAll('_', ' ').toUpperCase()}</p><h2>{MODULE_COPY[active]?.[0] || active}</h2><span>{MODULE_COPY[active]?.[1]}</span></div><Badge tone={payload?.application?.operational_status === 'operational' ? 'success' : 'warning'}>{payload?.application?.operational_status || 'operacional'}</Badge></header>
        {renderModule({ active, payload, summary, finance, analytics, rankings, search, setSearch, loadTicketDetails, ticketDetails, ticketLoading, downloadExport })}
      </main>
    </div>
  </section>
}

function renderModule({ active, payload, summary, finance, analytics, rankings, search, setSearch, loadTicketDetails, ticketDetails, ticketLoading, downloadExport }) {
  const events = payload?.events || []
  const productions = payload?.productions || []
  const users = payload?.users || []
  const items = payload?.items || []
  const orders = payload?.orders || []
  const payments = payload?.payments || []
  const passes = payload?.passes || []
  const promoters = payload?.promoters || []
  const campaigns = payload?.campaigns || []
  const moderation = payload?.moderation || []
  const notifications = payload?.notifications || []
  const support = payload?.support || []
  const schedules = payload?.schedules || []
  const issues = payload?.issues || []
  const audit = payload?.audit || []
  const alerts = payload?.alerts || []

  if (active === 'dashboard') return <>
    <section className="cac-alerts"><h3>Prioridades agora</h3>{alerts.length ? alerts.map((alert, index) => <article key={`${alert.title}-${index}`} className={`cac-alert ${alert.severity || ''}`}><span>!</span><div><b>{alert.title}</b><small>{alert.message}</small></div></article>) : <Empty>Nenhum alerta crítico retornado agora.</Empty>}</section>
    <div className="cac-dual"><section className="cac-card"><h3>Eventos que mais faturam</h3><Ranking rows={rankings.events || []} valueKey="revenue" formatter={money} /></section><section className="cac-card"><h3>Funil Cutinapp</h3><Funnel data={analytics.funnel || {}} /></section></div>
  </>

  if (active === 'events' || active === 'tickets' || active === 'event_analytics' || active === 'boosts') {
    let rows = events
    if (active === 'boosts') rows = rows.filter(row => row.is_featured)
    return <><DataTable rows={rows} columns={[
      { key: 'title', label: 'Evento', render: row => <div><b>{row.title}</b><small className="cac-sub">#{row.id} · {dateTime(row.start_date)}</small></div> },
      { key: 'tickets_sold_count', label: 'Vendidos', render: row => n(row.tickets_sold_count) },
      { key: 'tickets_available_count', label: 'Disponíveis', render: row => n(row.tickets_available_count) },
      { key: 'gross_ticket_revenue', label: 'Receita', render: row => money(row.gross_ticket_revenue) },
      { key: 'checked_in_count', label: 'Check-ins', render: row => n(row.checked_in_count) },
      { key: 'status', label: 'Estado', render: row => <Badge tone={row.is_cancelled ? 'danger' : row.is_published ? 'success' : 'warning'}>{row.is_cancelled ? 'Cancelado' : row.is_published ? 'Publicado' : 'Rascunho'}</Badge> },
      { key: 'actions', label: 'Ação', render: row => <button className="cac-inline-action" type="button" onClick={() => void loadTicketDetails(row)}>{ticketLoading && ticketDetails?.event?.id === row.id ? 'Carregando…' : 'Ingressos e vendas'}</button> },
    ]} />{ticketDetails && <TicketDrawer details={ticketDetails} />}</>
  }

  if (active === 'sales') return <DataTable rows={orders} columns={[
    { key: 'public_id', label: 'Pedido', render: row => <><b>{row.public_id || `#${row.id}`}</b><small className="cac-sub">Evento #{row.event_id || '—'}</small></> },
    { key: 'status', label: 'Status', render: row => <Badge tone={row.status === 'paid' ? 'success' : row.status === 'cancelled' ? 'danger' : 'warning'}>{row.status}</Badge> },
    { key: 'total', label: 'Total', render: row => money(row.total) },
    { key: 'discount_amount', label: 'Desconto', render: row => money(row.discount_amount) },
    { key: 'payment_method', label: 'Pagamento' },
    { key: 'created_at', label: 'Criado em', render: row => dateTime(row.created_at) },
  ]} />

  if (active === 'finance') return <><div className="cac-mini-kpis"><Metric label="Gross pagamentos" value={money(finance.gross_payments)} detail="Confirmados" /><Metric label="Taxa Peter" value={money(finance.platform_revenue)} detail={percent(finance.take_rate)} /><Metric label="Gateway" value={money(finance.provider_fees)} detail="Custo financeiro" /><Metric label="Contribuição" value={money(finance.contribution_after_provider_fee)} detail="Taxa Peter - gateway" /></div><DataTable rows={payments} columns={[
    { key: 'public_id', label: 'Pagamento', render: row => row.public_id || `#${row.id}` }, { key: 'status', label: 'Status', render: row => <Badge tone={['approved', 'paid'].includes(row.status) ? 'success' : ['failed', 'rejected'].includes(row.status) ? 'danger' : 'warning'}>{row.status}</Badge> },
    { key: 'gross_amount', label: 'Bruto', render: row => money(row.gross_amount) }, { key: 'platform_fee', label: 'Peter', render: row => money(row.platform_fee) }, { key: 'provider_fee', label: 'Gateway', render: row => money(row.provider_fee) }, { key: 'seller_net', label: 'Produtor', render: row => money(row.seller_net) },
  ]} /></>

  if (active === 'checkins') return <DataTable rows={passes} columns={[
    { key: 'holder_name', label: 'Participante', render: row => <><b>{row.holder_name || row.user_email || 'Participante'}</b><small className="cac-sub">{row.holder_email || ''}</small></> },
    { key: 'event_title', label: 'Evento' }, { key: 'ticket_name', label: 'Ingresso' }, { key: 'status', label: 'Status', render: row => <Badge tone={['cancelled', 'refunded', 'charged_back'].includes(row.status) ? 'danger' : 'success'}>{row.status || 'ativo'}</Badge> }, { key: 'checked_in_at', label: 'Check-in', render: row => row.checked_in_at ? dateTime(row.checked_in_at) : 'Ainda não entrou' },
  ]} />

  if (active === 'productions') return <><div className="cac-toolbar"><button type="button" onClick={() => goAdminPage('estabelecimentos')}>Abrir gestão de establishments ↗</button></div><DataTable rows={productions} columns={[
    { key: 'fantasy', label: 'Produção', render: row => <><b>{row.fantasy || row.name}</b><small className="cac-sub">#{row.id}</small></> }, { key: 'city', label: 'Local', render: row => [row.city, row.uf].filter(Boolean).join(' / ') || '—' }, { key: 'is_published', label: 'Publicação', render: row => <Badge tone={row.is_published ? 'success' : 'warning'}>{row.is_published ? 'Publicado' : 'Oculto'}</Badge> }, { key: 'is_approved', label: 'Aprovação', render: row => row.is_approved ? 'Aprovado' : 'Pendente' },
  ]} /></>

  if (active === 'users' || active === 'permissions') return <><div className="cac-toolbar"><button type="button" onClick={() => goAdminPage('usuarios')}>Abrir gestão completa de usuários ↗</button></div><DataTable rows={users} columns={[
    { key: 'email', label: 'Usuário', render: row => <><b>{nameOf(row)}</b><small className="cac-sub">{row.email}</small></> }, { key: 'role', label: 'Papel', render: row => row.role || 'user' }, { key: 'status', label: 'Acesso', render: row => <Badge tone={row.status === 'active' ? 'success' : 'warning'}>{row.status || '—'}</Badge> }, { key: 'joined_at', label: 'Vínculo', render: row => dateTime(row.joined_at) },
  ]} /></>

  if (active === 'promoters') return <DataTable rows={promoters} empty="Ainda não há promoter com comissão vinculada a eventos da Cutinapp." columns={[
    { key: 'agent_user_id', label: 'Promoter', render: row => <><b>{nameOf(row)}</b><small className="cac-sub">{row.email}</small></> }, { key: 'event_title', label: 'Evento' }, { key: 'percentage', label: 'Comissão', render: row => percent(row.percentage) }, { key: 'gross_sales', label: 'Vendas atribuídas', render: row => money(row.gross_sales) }, { key: 'commission_amount', label: 'Comissão estimada', render: row => money(row.commission_amount) },
  ]} />

  if (active === 'campaigns' || active === 'communications') return <><div className="cac-toolbar"><button type="button" onClick={() => goAdminPage('notificacoes')}>Criar comunicação / campanha ↗</button></div><DataTable rows={campaigns} columns={[
    { key: 'title', label: 'Campanha', render: row => <><b>{row.title}</b><small className="cac-sub">{row.audience_type}</small></> }, { key: 'status', label: 'Status', render: row => <Badge tone={row.status === 'completed' ? 'success' : 'warning'}>{row.status}</Badge> }, { key: 'recipients_count', label: 'Destinatários', render: row => n(row.recipients_count) }, { key: 'delivered_count', label: 'Entregues', render: row => n(row.delivered_count) }, { key: 'failed_count', label: 'Falhas', render: row => n(row.failed_count) },
  ]} /></>

  if (active === 'promotions' || active === 'social') return <><div className="cac-mini-kpis"><Metric label="Ações sociais" value={n(analytics.social_actions)} detail="Feed/comunidade/likes" /><Metric label="Compartilhamentos" value={n(analytics.share_actions)} detail="No período" /><Metric label="Avaliações" value={n(analytics.ratings?.count)} detail={`Média ${analytics.ratings?.average || 0}`} /><Metric label="Conversão" value={percent(analytics.funnel?.view_to_paid_conversion)} detail="View → compra" /></div><DataTable rows={analytics.interactions_by_type || []} columns={[{ key: 'interaction_type', label: 'Interação' }, { key: 'total', label: 'Volume', render: row => n(row.total) }]} /></>

  if (active === 'catalog') return <><div className="cac-toolbar"><button type="button" onClick={() => goAdminPage('itens')}>Abrir catálogo global ↗</button></div><DataTable rows={items} columns={[
    { key: 'name', label: 'Item', render: row => <><b>{row.name}</b><small className="cac-sub">#{row.id} · {row.type}</small></> }, { key: 'price', label: 'Preço', render: row => money(row.price) }, { key: 'stock', label: 'Estoque', render: row => row.stock ?? '—' }, { key: 'status', label: 'Status', render: row => <Badge tone={row.status === false ? 'warning' : 'success'}>{row.status === false ? 'Arquivado' : 'Ativo'}</Badge> }, { key: 'entity_id', label: 'Establishment', render: row => row.entity_name === 'establishment' ? `#${row.entity_id}` : '—' },
  ]} /></>

  if (active === 'moderation') return <DataTable rows={moderation} columns={[
    { key: 'reason', label: 'Motivo', render: row => <><b>{row.reason}</b><small className="cac-sub">{row.details || ''}</small></> }, { key: 'reporter_email', label: 'Denunciante' }, { key: 'reported_email', label: 'Denunciado' }, { key: 'status', label: 'Estado', render: row => <Badge tone={row.status === 'open' ? 'warning' : 'success'}>{row.status}</Badge> }, { key: 'created_at', label: 'Criada em', render: row => dateTime(row.created_at) },
  ]} />

  if (active === 'notifications') return <><div className="cac-toolbar"><button type="button" onClick={() => goAdminPage('notificacoes')}>Abrir Central de Notificações ↗</button></div><DataTable rows={notifications} columns={[
    { key: 'title', label: 'Notificação', render: row => <><b>{row.title}</b><small className="cac-sub">{row.message}</small></> }, { key: 'type', label: 'Tipo' }, { key: 'user_id', label: 'Usuário', render: row => row.user_id ? `#${row.user_id}` : 'Audiência' }, { key: 'read_at', label: 'Leitura', render: row => row.read_at ? dateTime(row.read_at) : 'Não lida' },
  ]} /></>

  if (active === 'app_analytics') return <><Funnel data={analytics.funnel || {}} /><DataTable rows={analytics.interactions_by_day || []} columns={[{ key: 'day', label: 'Dia' }, { key: 'total', label: 'Interações', render: row => n(row.total) }, { key: 'users', label: 'Usuários', render: row => n(row.users) }]} /></>

  if (active === 'rankings') return <div className="cac-dual"><section className="cac-card"><h3>Eventos</h3><Ranking rows={rankings.events || []} valueKey="revenue" formatter={money} /></section><section className="cac-card"><h3>Produções</h3><Ranking rows={rankings.productions || []} valueKey="gmv" formatter={money} /></section></div>

  if (active === 'schedule') return <DataTable rows={schedules} columns={[
    { key: 'title', label: 'Agenda', render: row => <><b>{row.title}</b><small className="cac-sub">Produção #{row.production_id}</small></> }, { key: 'day_of_week', label: 'Dia' }, { key: 'start_time', label: 'Início' }, { key: 'end_time', label: 'Fim' }, { key: 'is_active', label: 'Estado', render: row => <Badge tone={row.is_active ? 'success' : 'warning'}>{row.is_active ? 'Ativa' : 'Pausada'}</Badge> },
  ]} />

  if (active === 'map') return <DataTable rows={payload?.map || []} empty="Nenhum evento ou produção possui coordenadas cadastradas." columns={[
    { key: 'name', label: 'Local' }, { key: 'type', label: 'Tipo' }, { key: 'city', label: 'Cidade', render: row => [row.city, row.uf].filter(Boolean).join(' / ') || '—' }, { key: 'lat', label: 'Latitude' }, { key: 'lng', label: 'Longitude' },
  ]} />

  if (active === 'audit') return <DataTable rows={audit} columns={[
    { key: 'action', label: 'Ação' }, { key: 'entity_type', label: 'Entidade' }, { key: 'entity_id', label: 'ID' }, { key: 'user_id', label: 'Admin', render: row => row.user_id ? `#${row.user_id}` : 'Sistema' }, { key: 'created_at', label: 'Quando', render: row => dateTime(row.created_at) },
  ]} />

  if (active === 'health') return <><section className="cac-alerts">{alerts.map((alert, index) => <article key={`${alert.title}-${index}`} className={`cac-alert ${alert.severity || ''}`}><span>!</span><div><b>{alert.title}</b><small>{alert.message}</small></div></article>)}</section><DataTable rows={issues} columns={[
    { key: 'title', label: 'Issue', render: row => <><b>{row.title}</b><small className="cac-sub">{row.latest_message || row.description || ''}</small></> }, { key: 'severity', label: 'Severidade', render: row => <Badge tone={row.severity === 'critical' ? 'danger' : 'warning'}>{row.severity}</Badge> }, { key: 'occurrence_count', label: 'Ocorrências', render: row => n(row.occurrence_count) }, { key: 'latest_route', label: 'Rota' }, { key: 'last_seen_at', label: 'Último sinal', render: row => dateTime(row.last_seen_at) },
  ]} /></>

  if (active === 'support') return <DataTable rows={support} columns={[
    { key: 'public_id', label: 'Chamado' }, { key: 'subject', label: 'Assunto', render: row => <><b>{row.subject}</b><small className="cac-sub">{row.requester_email}</small></> }, { key: 'priority', label: 'Prioridade' }, { key: 'status', label: 'Estado', render: row => <Badge tone={['resolved', 'closed'].includes(row.status) ? 'success' : 'warning'}>{row.status}</Badge> }, { key: 'last_message_at', label: 'Última mensagem', render: row => dateTime(row.last_message_at || row.updated_at) },
  ]} />

  if (active === 'search') {
    const term = normalize(search.trim())
    const combined = [
      ...events.map(row => ({ type: 'Evento', id: row.id, title: row.title, detail: row.slug || row.category })),
      ...productions.map(row => ({ type: 'Produção', id: row.id, title: row.fantasy || row.name, detail: [row.city, row.uf].filter(Boolean).join(' / ') })),
      ...users.map(row => ({ type: 'Usuário', id: row.id, title: nameOf(row), detail: row.email })),
      ...items.map(row => ({ type: 'Item', id: row.id, title: row.name, detail: row.category || row.type })),
      ...orders.map(row => ({ type: 'Pedido', id: row.id, title: row.public_id || `Pedido #${row.id}`, detail: row.status })),
    ]
    const matches = term ? combined.filter(row => normalize(`${row.type} ${row.id} ${row.title} ${row.detail}`).includes(term)).slice(0, 100) : []
    return <><div className="cac-big-search"><span>⌕</span><input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Evento, produção, usuário, e-mail, pedido, item ou ID…" /></div>{term && <DataTable rows={matches} columns={[{ key: 'type', label: 'Tipo' }, { key: 'title', label: 'Resultado', render: row => <><b>{row.title}</b><small className="cac-sub">#{row.id}</small></> }, { key: 'detail', label: 'Detalhe' }]} />}</>
  }

  if (active === 'quick_actions') return <div className="cac-action-grid"><button type="button" onClick={() => goAdminPage('estabelecimentos')}><b>Establishments</b><span>Criar, editar e gerenciar eventos por produção.</span></button><button type="button" onClick={() => goAdminPage('usuarios')}><b>Usuários</b><span>Conta, acesso, comunicação e atividade.</span></button><button type="button" onClick={() => goAdminPage('itens')}><b>Itens</b><span>Produtos e catálogo comercial.</span></button><button type="button" onClick={() => goAdminPage('financeiro')}><b>Financeiro</b><span>Transações, pedidos e conciliação.</span></button><button type="button" onClick={() => goAdminPage('notificacoes')}><b>Notificações</b><span>Campanhas e alertas para públicos.</span></button><button type="button" onClick={() => goAdminPage('atividade')}><b>Atividade</b><span>Telemetria e trilha operacional.</span></button></div>

  if (active === 'financial_security') {
    const badPayments = payments.filter(row => ['failed', 'rejected', 'cancelled', 'expired', 'refunded', 'charged_back', 'chargeback'].includes(row.status))
    const badPasses = passes.filter(row => ['cancelled', 'refunded', 'charged_back'].includes(row.status))
    return <><div className="cac-mini-kpis"><Metric label="Pagamentos problemáticos" value={n(badPayments.length)} detail="Falha/reversão" /><Metric label="Passes revertidos" value={n(badPasses.length)} detail="Sem autorização de entrada" /><Metric label="Gateway" value={money(finance.provider_fees)} detail="Custo processado" /><Metric label="Contribuição" value={money(finance.contribution_after_provider_fee)} detail="Após gateway" /></div><DataTable rows={badPayments} columns={[{ key: 'public_id', label: 'Pagamento' }, { key: 'status', label: 'Status', render: row => <Badge tone="danger">{row.status}</Badge> }, { key: 'gross_amount', label: 'Valor', render: row => money(row.gross_amount) }, { key: 'provider', label: 'Provedor' }]} /></>
  }

  if (active === 'exports') return <div className="cac-export-grid"><button type="button" onClick={() => void downloadExport('csv')}><b>Financeiro CSV</b><span>Transações da Cutinapp para planilha.</span></button><button type="button" onClick={() => void downloadExport('pdf')}><b>Financeiro PDF</b><span>Relatório formatado para conferência.</span></button><button type="button" onClick={() => goAdminPage('estabelecimentos')}><b>Participantes e eventos</b><span>Abra um evento para consultar e exportar sua operação.</span></button></div>

  return <Empty>Módulo disponível no control plane, sem registros para exibir neste momento.</Empty>
}

function Ranking({ rows, valueKey, formatter }) {
  if (!rows?.length) return <Empty />
  const max = Math.max(...rows.map(row => Number(row[valueKey] || 0)), 1)
  return <div className="cac-ranking">{rows.slice(0, 10).map((row, index) => <article key={row.id || index}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{row.title || row.name || `#${row.id}`}</b><i><em style={{ width: `${Math.max(4, (Number(row[valueKey] || 0) / max) * 100)}%` }} /></i></div><strong>{formatter(row[valueKey])}</strong></article>)}</div>
}

function Funnel({ data }) {
  const rows = [['Visualizações', data.event_views], ['Checkout', data.checkout_starts], ['Pedidos pagos', data.paid_orders], ['Check-ins', data.checkins]]
  const max = Math.max(...rows.map(([, value]) => Number(value || 0)), 1)
  return <div className="cac-funnel">{rows.map(([label, value]) => <div key={label}><span>{label}<b>{n(value)}</b></span><i><em style={{ width: `${Math.max(Number(value || 0) ? 4 : 0, (Number(value || 0) / max) * 100)}%` }} /></i></div>)}</div>
}

function TicketDrawer({ details }) {
  const data = details.data
  return <section className="cac-ticket-drawer"><header><div><p>EVENTO #{details.event.id}</p><h3>{details.event.title}</h3></div></header>{details.error && <div className="cac-feedback error">{details.error}</div>}{!data && !details.error && <div className="cac-loading-inline">Carregando ingressos e vendas…</div>}{data && <><div className="cac-mini-kpis"><Metric label="Capacidade" value={n(data.summary?.capacity)} detail="Todos os lotes" /><Metric label="Vendidos" value={n(data.summary?.sold_count)} detail={`${n(data.summary?.available_count)} disponíveis`} /><Metric label="Check-ins" value={n(data.summary?.checked_in_count)} detail={`${n(data.summary?.courtesy_count)} cortesias`} /><Metric label="Receita" value={money(data.summary?.gross_revenue)} detail={`${n(data.summary?.paid_orders_count)} pedidos pagos`} /></div><DataTable rows={data.tickets || []} columns={[{ key: 'name', label: 'Lote' }, { key: 'price', label: 'Preço', render: row => money(row.price) }, { key: 'capacity', label: 'Capacidade', render: row => n(row.capacity) }, { key: 'sold_count', label: 'Vendidos', render: row => n(row.sold_count) }, { key: 'available_count', label: 'Disponíveis', render: row => n(row.available_count) }, { key: 'gross_revenue', label: 'Receita', render: row => money(row.gross_revenue) }]} /></>}</section>
}
