import { useCallback, useEffect, useMemo, useState } from 'react'
import './AdminTicketSalesPage.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'
const LIVE_REFRESH_MS = 15000

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

function formatDate(value) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data não informada' : dateTime.format(date)
}

function formatShortDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : shortDate.format(date)
}

function formatMoney(value) {
  return money.format(Number(value || 0))
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function eventStatus(event) {
  if (event.is_cancelled) return { key: 'cancelled', label: 'Cancelado', tone: 'danger' }
  const now = Date.now()
  const start = event.start_date ? new Date(event.start_date).getTime() : null
  const end = event.end_date ? new Date(event.end_date).getTime() : null
  if (start && now < start) return { key: 'future', label: 'Próximo', tone: 'future' }
  if (start && (!end || now <= end)) return { key: 'live', label: 'Acontecendo', tone: 'live' }
  if (end && now > end) return { key: 'ended', label: 'Encerrado', tone: 'muted' }
  return { key: event.is_published ? 'published' : 'draft', label: event.is_published ? 'Publicado' : 'Rascunho', tone: event.is_published ? 'success' : 'muted' }
}

async function request(path) {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    const error = new Error('Sessão administrativa não encontrada neste navegador.')
    error.code = 'NO_SESSION'
    throw error
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${API}${path}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 403) {
      const error = new Error(response.status === 401 ? 'Sua sessão administrativa expirou.' : 'Sua conta não possui acesso ao Admin Center.')
      error.code = 'AUTH'
      throw error
    }
    if (!response.ok) throw new Error(data?.message || data?.error || 'Não foi possível carregar os dados.')
    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder. Tente atualizar a página.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function Metric({ label, value, helper, tone = '' }) {
  return <article className={`ats-metric${tone ? ` ats-metric--${tone}` : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {helper && <small>{helper}</small>}
  </article>
}

function EventCard({ event, selected, onSelect }) {
  const status = eventStatus(event)
  const capacity = Number(event.ticket_capacity || 0)
  const issued = Number(event.tickets_issued_count || 0)
  const sold = Number(event.tickets_sold_count || 0)
  const percentage = capacity > 0 ? Math.min(100, Math.round((issued / capacity) * 100)) : 0

  return <button type="button" className={`ats-event-card${selected ? ' is-selected' : ''}`} onClick={() => onSelect(event)}>
    <div className="ats-event-card__top">
      <span className={`ats-status ats-status--${status.tone}`}>{status.label}</span>
      <small>#{event.id}</small>
    </div>
    <strong>{event.title}</strong>
    <span>{formatDate(event.start_date)}</span>
    <div className="ats-event-card__numbers">
      <span><b>{sold}</b> vendidos</span>
      <span><b>{event.tickets_available_count || 0}</b> disponíveis</span>
    </div>
    <div className="ats-progress" aria-label={`${percentage}% da capacidade emitida`}><i style={{ width: `${percentage}%` }} /></div>
    <div className="ats-event-card__footer">
      <span>{formatMoney(event.gross_ticket_revenue)}</span>
      <span>{formatPercent(event.occupancy_rate)} ocupação</span>
      <span>{event.checked_in_count || 0} check-ins</span>
    </div>
  </button>
}

function EmptyState({ title, children }) {
  return <div className="ats-empty"><span>◎</span><strong>{title}</strong><p>{children}</p></div>
}

function FunnelStep({ label, value, total, helper }) {
  const progress = total > 0 ? Math.max(0, Math.min(100, (Number(value || 0) / total) * 100)) : 0
  return <article className="ats-funnel-step">
    <div><span>{label}</span><strong>{Number(value || 0).toLocaleString('pt-BR')}</strong></div>
    <div className="ats-funnel-bar"><i style={{ width: `${progress}%` }} /></div>
    <small>{helper}</small>
  </article>
}

function downloadCsv(rows, event) {
  const headers = ['Titular', 'E-mail', 'Ingresso', 'Pedido', 'Valor', 'Pagamento', 'Pago em', 'Check-in']
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`
  const lines = [headers.map(escape).join(';'), ...rows.map(sale => [
    sale.holder_name,
    sale.holder_email,
    sale.ticket_name,
    sale.order_public_id,
    Number(sale.unit_price || 0).toFixed(2).replace('.', ','),
    sale.payment_method,
    sale.paid_at,
    sale.checked_in_at || '',
  ].map(escape).join(';'))]

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ingressos-${event?.slug || event?.id || 'evento'}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function AdminTicketSalesPage() {
  const [establishments, setEstablishments] = useState([])
  const [establishmentId, setEstablishmentId] = useState('')
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [details, setDetails] = useState(null)
  const [query, setQuery] = useState('')
  const [eventQuery, setEventQuery] = useState('')
  const [eventStatusFilter, setEventStatusFilter] = useState('all')
  const [saleQuery, setSaleQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [checkinFilter, setCheckinFilter] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [loadingEstablishments, setLoadingEstablishments] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    document.title = 'Ingressos por evento | Admin Center Peter Tecnet'
    let active = true
    const params = new URLSearchParams(window.location.search)
    const preferredEstablishment = params.get('establishment_id') || ''

    request('/admin/ecosystem/establishments')
      .then(payload => {
        if (!active) return
        const rows = Array.isArray(payload?.establishments) ? payload.establishments : []
        setEstablishments(rows)
        const validPreferred = rows.some(row => String(row.id) === preferredEstablishment)
        setEstablishmentId(validPreferred ? preferredEstablishment : rows[0]?.id ? String(rows[0].id) : '')
      })
      .catch(err => {
        if (!active) return
        setError(err.message)
        setAuthError(['NO_SESSION', 'AUTH'].includes(err.code))
      })
      .finally(() => active && setLoadingEstablishments(false))

    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!establishmentId) {
      setEvents([])
      setEventId('')
      setDetails(null)
      return undefined
    }

    let active = true
    setLoadingEvents(true)
    setError('')
    setEvents([])
    setEventId('')
    setDetails(null)

    request(`/admin/ecosystem/establishments/${encodeURIComponent(establishmentId)}/resources/events`)
      .then(payload => {
        if (!active) return
        const rows = Array.isArray(payload?.events) ? payload.events : []
        setEvents(rows)
        const params = new URLSearchParams(window.location.search)
        const preferredEvent = params.get('event_id') || ''
        const validPreferred = rows.some(row => String(row.id) === preferredEvent)
        setEventId(validPreferred ? preferredEvent : rows[0]?.id ? String(rows[0].id) : '')
      })
      .catch(err => {
        if (!active) return
        setError(err.message)
        setAuthError(['NO_SESSION', 'AUTH'].includes(err.code))
      })
      .finally(() => active && setLoadingEvents(false))

    return () => { active = false }
  }, [establishmentId])

  const loadDetails = useCallback(async ({ silent = false } = {}) => {
    if (!establishmentId || !eventId) return
    if (silent) setRefreshing(true)
    else {
      setLoadingDetails(true)
      setDetails(null)
    }
    setError('')

    try {
      const payload = await request(`/admin/ecosystem/establishments/${encodeURIComponent(establishmentId)}/resources/events/${encodeURIComponent(eventId)}/tickets`)
      setDetails(payload)
      setLastUpdatedAt(new Date())
      setAuthError(false)
      const url = new URL(window.location.href)
      url.searchParams.set('establishment_id', establishmentId)
      url.searchParams.set('event_id', eventId)
      window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    } catch (err) {
      setError(err.message)
      setAuthError(['NO_SESSION', 'AUTH'].includes(err.code))
    } finally {
      if (silent) setRefreshing(false)
      else setLoadingDetails(false)
    }
  }, [establishmentId, eventId])

  useEffect(() => {
    if (!establishmentId || !eventId) {
      setDetails(null)
      return undefined
    }
    loadDetails()
    return undefined
  }, [establishmentId, eventId, loadDetails])

  useEffect(() => {
    if (!autoRefresh || !establishmentId || !eventId) return undefined
    const timer = window.setInterval(() => loadDetails({ silent: true }), LIVE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [autoRefresh, establishmentId, eventId, loadDetails])

  const filteredEstablishments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR')
    if (!needle) return establishments
    return establishments.filter(row => `${row.fantasy || ''} ${row.name || ''} ${row.city || ''} ${row.uf || ''}`.toLocaleLowerCase('pt-BR').includes(needle))
  }, [establishments, query])

  const filteredEvents = useMemo(() => {
    const needle = eventQuery.trim().toLocaleLowerCase('pt-BR')
    return events.filter(row => {
      const matchesText = !needle || `${row.title || ''} ${row.venue || ''} ${row.city || ''} ${row.uf || ''}`.toLocaleLowerCase('pt-BR').includes(needle)
      const matchesStatus = eventStatusFilter === 'all' || eventStatus(row).key === eventStatusFilter
      return matchesText && matchesStatus
    })
  }, [events, eventQuery, eventStatusFilter])

  const selectedEstablishment = establishments.find(row => String(row.id) === establishmentId)
  const selectedEvent = events.find(row => String(row.id) === eventId)
  const summary = details?.summary || null
  const financial = details?.financial || null
  const funnel = details?.funnel || null

  const paymentOptions = useMemo(() => {
    const fromAnalytics = (details?.payment_methods || []).map(row => row.payment_method).filter(Boolean)
    const fromSales = (details?.recent_sales || []).map(row => row.payment_method).filter(Boolean)
    return [...new Set([...fromAnalytics, ...fromSales])]
  }, [details])

  const filteredSales = useMemo(() => {
    const needle = saleQuery.trim().toLocaleLowerCase('pt-BR')
    return (details?.recent_sales || []).filter(sale => {
      const haystack = `${sale.holder_name || ''} ${sale.holder_email || ''} ${sale.ticket_name || ''} ${sale.order_public_id || ''} ${sale.pass_id || ''}`.toLocaleLowerCase('pt-BR')
      const matchesText = !needle || haystack.includes(needle)
      const matchesPayment = paymentFilter === 'all' || (sale.payment_method || 'Não informado') === paymentFilter
      const matchesCheckin = checkinFilter === 'all' || (checkinFilter === 'checked' ? Boolean(sale.checked_in_at) : !sale.checked_in_at)
      return matchesText && matchesPayment && matchesCheckin
    })
  }, [details, saleQuery, paymentFilter, checkinFilter])

  const alerts = useMemo(() => {
    if (!summary || !selectedEvent) return []
    const rows = []
    const occupancy = Number(summary.occupancy_rate || 0)
    const conversion = Number(funnel?.payment_conversion_rate || 0)
    const start = selectedEvent.start_date ? new Date(selectedEvent.start_date).getTime() : null
    const hoursUntil = start ? (start - Date.now()) / 3600000 : null

    if (occupancy >= 90 && Number(summary.available_count || 0) > 0) rows.push({ tone: 'success', title: 'Evento perto de esgotar', text: `${formatPercent(occupancy)} da capacidade já foi emitida.` })
    if (Number(summary.available_count || 0) === 0 && Number(summary.capacity || 0) > 0) rows.push({ tone: 'success', title: 'Capacidade esgotada', text: 'Não há ingressos disponíveis neste momento.' })
    if (hoursUntil !== null && hoursUntil > 0 && hoursUntil <= 48 && occupancy < 50) rows.push({ tone: 'warning', title: 'Atenção à ocupação', text: `Faltam menos de 48 horas e a ocupação está em ${formatPercent(occupancy)}.` })
    if (Number(funnel?.checkout_orders_count || 0) >= 5 && conversion < 60) rows.push({ tone: 'warning', title: 'Conversão de pagamento baixa', text: `${formatPercent(conversion)} dos checkouts com ingresso chegaram a pagamento aprovado.` })
    if (Number(summary.reserved_count || 0) > 0) rows.push({ tone: 'info', title: 'Reservas temporárias ativas', text: `${summary.reserved_count} ingresso(s) estão temporariamente bloqueados em checkout.` })
    return rows
  }, [summary, funnel, selectedEvent])

  const timeline = details?.sales_timeline || []
  const timelineMax = Math.max(1, ...timeline.map(row => Number(row.sold_count || 0)))
  const checkinPending = Math.max(0, Number(summary?.issued_count || 0) - Number(summary?.checked_in_count || 0))

  return <main className="ats-page">
    <header className="ats-header">
      <a className="ats-brand" href="/" aria-label="Peter Tecnet"><img src="/petertecnetlogo.png" alt="" /><span><strong>Peter Tecnet</strong><small>Admin Center</small></span></a>
      <div className="ats-header__copy">
        <p>Eventos · Operação comercial</p>
        <h1>Ingressos por evento</h1>
        <span>Vendas, financeiro, conversão, lotes e check-in em uma visão operacional por estabelecimento.</span>
      </div>
      <a className="ats-header__back" href="/">Voltar ao ecossistema ↗</a>
    </header>

    {error && <div className="ats-notice" role="alert"><strong>{authError ? 'Acesso administrativo necessário' : 'Não foi possível carregar os dados'}</strong><span>{error}</span>{authError && <small>Abra o Peter Account, autentique-se com uma conta administradora e volte para esta página.</small>}</div>}

    <section className="ats-toolbar" aria-label="Selecionar estabelecimento">
      <label className="ats-search"><span>Pesquisar estabelecimento</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, cidade ou estado" /></label>
      <label className="ats-select"><span>Estabelecimento</span><select value={establishmentId} onChange={event => setEstablishmentId(event.target.value)} disabled={loadingEstablishments || filteredEstablishments.length === 0}><option value="">Selecione…</option>{filteredEstablishments.map(row => <option key={row.id} value={row.id}>{row.fantasy || row.name} · {[row.city, row.uf].filter(Boolean).join('/') || `#${row.id}`}</option>)}</select></label>
      <div className="ats-context"><span>Contexto atual</span><strong>{selectedEstablishment ? selectedEstablishment.fantasy || selectedEstablishment.name : 'Nenhum estabelecimento'}</strong><small>{selectedEstablishment ? [selectedEstablishment.city, selectedEstablishment.uf].filter(Boolean).join(' · ') : 'Selecione para carregar os eventos'}</small></div>
    </section>

    <div className="ats-layout">
      <aside className="ats-events">
        <div className="ats-section-title"><div><span>Eventos</span><h2>{loadingEvents ? 'Carregando…' : `${filteredEvents.length} de ${events.length}`}</h2></div>{selectedEstablishment && <small>Estab. #{selectedEstablishment.id}</small>}</div>
        <div className="ats-event-filters">
          <input type="search" value={eventQuery} onChange={event => setEventQuery(event.target.value)} placeholder="Buscar evento ou local" aria-label="Buscar evento" />
          <select value={eventStatusFilter} onChange={event => setEventStatusFilter(event.target.value)} aria-label="Filtrar eventos por status">
            <option value="all">Todos os status</option>
            <option value="future">Próximos</option>
            <option value="live">Acontecendo</option>
            <option value="ended">Encerrados</option>
            <option value="published">Publicados</option>
            <option value="draft">Rascunhos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
        <div className="ats-event-list">
          {!loadingEvents && establishmentId && events.length === 0 && <EmptyState title="Nenhum evento neste estabelecimento">Quando os eventos forem vinculados a este estabelecimento, eles aparecerão aqui automaticamente.</EmptyState>}
          {!loadingEvents && events.length > 0 && filteredEvents.length === 0 && <EmptyState title="Nenhum evento com esses filtros">Ajuste a busca ou o status para localizar outro evento.</EmptyState>}
          {filteredEvents.map(event => <EventCard key={event.id} event={event} selected={String(event.id) === eventId} onSelect={row => setEventId(String(row.id))} />)}
        </div>
      </aside>

      <section className="ats-detail">
        {!eventId && !loadingEvents && <EmptyState title="Selecione um evento">Escolha um evento à esquerda para abrir a operação de ingressos.</EmptyState>}
        {loadingDetails && <div className="ats-loader"><i /><span>Consolidando vendas, estoque, financeiro e check-ins…</span></div>}
        {!loadingDetails && selectedEvent && summary && <>
          <div className="ats-event-heading">
            <div><span>Evento #{selectedEvent.id}</span><h2>{selectedEvent.title}</h2><p>{formatDate(selectedEvent.start_date)} · {[selectedEvent.venue, selectedEvent.city, selectedEvent.uf].filter(Boolean).join(' · ')}</p></div>
            <div className="ats-event-heading__actions">
              <span className={`ats-status ats-status--${eventStatus(selectedEvent).tone}`}>{eventStatus(selectedEvent).label}</span>
              <button type="button" className="ats-action" onClick={() => loadDetails({ silent: true })} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Atualizar agora'}</button>
            </div>
          </div>

          <div className="ats-live-strip">
            <div><span className={`ats-live-dot${autoRefresh ? ' is-live' : ''}`} /><strong>{autoRefresh ? 'Atualização automática ativa' : 'Atualização automática pausada'}</strong><small>{lastUpdatedAt ? `Última leitura ${dateTime.format(lastUpdatedAt)}` : 'Aguardando primeira leitura'}</small></div>
            <button type="button" onClick={() => setAutoRefresh(value => !value)}>{autoRefresh ? 'Pausar atualização' : 'Ativar atualização'}</button>
          </div>

          <div className="ats-metrics">
            <Metric label="Ingressos vendidos" value={summary.sold_count || 0} helper={`${summary.paid_orders_count || 0} pedido(s) pago(s) · ${summary.last_24h_sold_count || 0} nas últimas 24h`} tone="primary" />
            <Metric label="Receita bruta" value={formatMoney(summary.gross_revenue)} helper={`${formatMoney(summary.last_24h_revenue)} nas últimas 24h`} />
            <Metric label="Líquido do produtor" value={formatMoney(summary.producer_net_revenue)} helper="Líquido registrado nos pedidos pagos do evento" tone="success" />
            <Metric label="Ocupação" value={formatPercent(summary.occupancy_rate)} helper={`${summary.issued_count || 0} emitidos de ${summary.capacity || 0} lugares`} />
            <Metric label="Disponíveis" value={summary.available_count || 0} helper={`${summary.reserved_count || 0} em reserva temporária`} />
            <Metric label="Ticket médio" value={formatMoney(summary.average_ticket_value)} helper="Receita de ingressos ÷ ingressos pagos" />
            <Metric label="Check-ins" value={summary.checked_in_count || 0} helper={`${formatPercent(summary.attendance_rate)} dos ingressos válidos emitidos`} />
            <Metric label="Cortesias" value={summary.courtesy_count || 0} helper="Separadas das vendas pagas" />
            <Metric label="Estornos/cancelados" value={summary.reversed_count || 0} helper="Passes revertidos não entram nos vendidos" />
          </div>

          {alerts.length > 0 && <section className="ats-alert-grid" aria-label="Alertas do evento">{alerts.map(alert => <article key={alert.title} className={`ats-alert ats-alert--${alert.tone}`}><strong>{alert.title}</strong><span>{alert.text}</span></article>)}</section>}

          <div className="ats-dashboard-grid">
            <section className="ats-panel ats-panel--chart">
              <div className="ats-panel__head"><div><span>Ritmo comercial</span><h3>Vendas nos últimos dias</h3></div><small>{summary.last_7d_sold_count || 0} vendidos em 7 dias</small></div>
              {timeline.length ? <div className="ats-chart" role="img" aria-label="Vendas de ingresso por dia">{timeline.map(row => <div className="ats-chart__column" key={row.date} title={`${row.sold_count} ingresso(s) · ${formatMoney(row.gross_revenue)}`}><span>{row.sold_count}</span><div><i style={{ height: `${Math.max(8, (Number(row.sold_count || 0) / timelineMax) * 100)}%` }} /></div><small>{formatShortDate(row.date)}</small></div>)}</div> : <EmptyState title="Sem histórico de vendas">O gráfico aparecerá quando houver pagamentos confirmados.</EmptyState>}
            </section>

            <section className="ats-panel ats-panel--funnel">
              <div className="ats-panel__head"><div><span>Conversão</span><h3>Funil a partir do checkout</h3></div><small>{formatPercent(funnel?.payment_conversion_rate)} conversão de pagamento</small></div>
              <div className="ats-funnel">
                <FunnelStep label="Checkouts" value={funnel?.checkout_orders_count} total={Math.max(1, Number(funnel?.checkout_orders_count || 0))} helper="Pedidos com item de ingresso" />
                <FunnelStep label="Pagamentos aprovados" value={funnel?.paid_orders_count} total={Math.max(1, Number(funnel?.checkout_orders_count || 0))} helper={`${formatPercent(funnel?.payment_conversion_rate)} dos checkouts`} />
                <FunnelStep label="Ingressos vendidos" value={funnel?.tickets_sold_count} total={Math.max(1, Number(summary.capacity || 0))} helper="Passes pagos e válidos" />
                <FunnelStep label="Entradas realizadas" value={funnel?.checked_in_count} total={Math.max(1, Number(funnel?.tickets_issued_count || 0))} helper={`${formatPercent(funnel?.attendance_rate)} dos emitidos`} />
              </div>
            </section>
          </div>

          <section className="ats-panel">
            <div className="ats-panel__head"><div><span>Financeiro</span><h3>Resultado dos pedidos pagos</h3></div><small>Valores registrados no checkout</small></div>
            <div className="ats-financial-grid">
              <div><span>Receita de ingressos</span><strong>{formatMoney(financial?.ticket_gross_revenue)}</strong><small>Somente itens de ingresso</small></div>
              <div><span>Subtotal dos pedidos</span><strong>{formatMoney(financial?.order_subtotal)}</strong><small>Pode incluir adicionais do mesmo pedido</small></div>
              <div><span>Taxa da plataforma</span><strong>{formatMoney(financial?.platform_fee)}</strong><small>Somatório registrado</small></div>
              <div><span>Taxa do processador</span><strong>{formatMoney(financial?.processor_fee)}</strong><small>Somatório registrado</small></div>
              <div><span>Descontos</span><strong>{formatMoney(financial?.discount_amount)}</strong><small>Cupons/descontos aplicados</small></div>
              <div className="is-net"><span>Líquido do produtor</span><strong>{formatMoney(financial?.producer_net)}</strong><small>Resultado líquido registrado</small></div>
            </div>
          </section>

          <div className="ats-dashboard-grid ats-dashboard-grid--operations">
            <section className="ats-panel">
              <div className="ats-panel__head"><div><span>Dia do evento</span><h3>Operação de check-in</h3></div><small>Atualiza a cada 15 segundos</small></div>
              <div className="ats-checkin-grid">
                <div><span>Entraram</span><strong>{summary.checked_in_count || 0}</strong></div>
                <div><span>Aguardando entrada</span><strong>{checkinPending}</strong></div>
                <div><span>Taxa de presença</span><strong>{formatPercent(summary.attendance_rate)}</strong></div>
                <div><span>Capacidade livre</span><strong>{summary.available_count || 0}</strong></div>
              </div>
            </section>

            <section className="ats-panel">
              <div className="ats-panel__head"><div><span>Pagamento</span><h3>Meios utilizados</h3></div><small>{details.payment_methods?.length || 0} método(s)</small></div>
              {details.payment_methods?.length ? <div className="ats-payment-list">{details.payment_methods.map(method => <div key={method.payment_method}><span><strong>{method.payment_method}</strong><small>{method.paid_orders_count} pedido(s)</small></span><b>{method.sold_count} ingresso(s)</b><em>{formatMoney(method.gross_revenue)}</em></div>)}</div> : <EmptyState title="Sem pagamentos ainda">Os meios de pagamento aparecerão após as primeiras vendas.</EmptyState>}
            </section>
          </div>

          <section className="ats-panel">
            <div className="ats-panel__head"><div><span>Inventário</span><h3>Tipos de ingresso</h3></div><small>{summary.ticket_types_count || 0} tipo(s)</small></div>
            {details.tickets?.length ? <div className="ats-ticket-table"><div className="ats-ticket-row ats-ticket-row--head"><span>Ingresso</span><span>Preço</span><span>Vendidos</span><span>Ocupação</span><span>Cortesias</span><span>Disponíveis</span><span>Receita</span></div>{details.tickets.map(ticket => <div className="ats-ticket-row" key={ticket.id}><span><strong>{ticket.name}</strong><small>{ticket.ticket_type || ticket.type || `#${ticket.id}`} · capacidade {ticket.capacity}</small></span><span>{formatMoney(ticket.price)}</span><span><b>{ticket.sold_count}</b><small>{ticket.paid_orders_count} pedido(s)</small></span><span><b>{formatPercent(ticket.occupancy_rate)}</b><small>{ticket.issued_count} emitido(s)</small></span><span>{ticket.courtesy_count}</span><span>{ticket.available_count}<small>{ticket.reserved_count ? `${ticket.reserved_count} reservado(s)` : ''}</small></span><span><b>{formatMoney(ticket.gross_revenue)}</b><small>{ticket.checked_in_count} check-in(s)</small></span></div>)}</div> : <EmptyState title="Sem ingressos cadastrados">Este evento ainda não possui tipos de ingresso para acompanhar.</EmptyState>}
          </section>

          <section className="ats-panel">
            <div className="ats-panel__head ats-panel__head--sales"><div><span>Vendas confirmadas</span><h3>Ingressos pagos recentes</h3></div><div className="ats-panel-actions"><small>{filteredSales.length} de {details.recent_sales?.length || 0}</small><button type="button" className="ats-action" onClick={() => downloadCsv(filteredSales, selectedEvent)} disabled={!filteredSales.length}>Exportar CSV</button></div></div>
            <div className="ats-sale-filters">
              <input type="search" value={saleQuery} onChange={event => setSaleQuery(event.target.value)} placeholder="Titular, e-mail, pedido ou ingresso" aria-label="Buscar venda" />
              <select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)} aria-label="Filtrar meio de pagamento"><option value="all">Todos os pagamentos</option>{paymentOptions.map(value => <option value={value} key={value}>{value}</option>)}</select>
              <select value={checkinFilter} onChange={event => setCheckinFilter(event.target.value)} aria-label="Filtrar check-in"><option value="all">Todos os check-ins</option><option value="checked">Já entrou</option><option value="pending">Ainda não entrou</option></select>
            </div>
            {filteredSales.length ? <div className="ats-sales-list">{filteredSales.map(sale => <article key={sale.pass_id} className="ats-sale"><div className="ats-sale__person"><span>{(sale.holder_name || sale.holder_email || '?').slice(0, 1).toUpperCase()}</span><div><strong>{sale.holder_name || 'Titular não informado'}</strong><small>{sale.holder_email || 'E-mail não informado'}</small></div></div><div><strong>{sale.ticket_name}</strong><small>{sale.order_public_id ? `Pedido ${sale.order_public_id}` : `Ingresso #${sale.pass_id}`}</small></div><div><strong>{formatMoney(sale.unit_price)}</strong><small>{sale.payment_method || 'Pagamento confirmado'}</small></div><div><strong>{formatDate(sale.paid_at)}</strong><small>{sale.checked_in_at ? `Check-in ${formatDate(sale.checked_in_at)}` : 'Entrada ainda não utilizada'}</small></div></article>)}</div> : <EmptyState title={details.recent_sales?.length ? 'Nenhuma venda com esses filtros' : 'Nenhuma venda paga ainda'}>{details.recent_sales?.length ? 'Altere os filtros para localizar outro ingresso.' : 'Assim que um pagamento gerar ingressos válidos, a venda aparecerá aqui.'}</EmptyState>}
          </section>
        </>}
      </section>
    </div>
  </main>
}
