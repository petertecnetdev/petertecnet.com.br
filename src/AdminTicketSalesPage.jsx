import { useEffect, useMemo, useState } from 'react'
import './AdminTicketSalesPage.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function formatDate(value) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data não informada' : dateTime.format(date)
}

function formatMoney(value) {
  return money.format(Number(value || 0))
}

function eventStatus(event) {
  if (event.is_cancelled) return { label: 'Cancelado', tone: 'danger' }
  const now = Date.now()
  const start = event.start_date ? new Date(event.start_date).getTime() : null
  const end = event.end_date ? new Date(event.end_date).getTime() : null
  if (start && now < start) return { label: 'Próximo', tone: 'future' }
  if (start && (!end || now <= end)) return { label: 'Acontecendo', tone: 'live' }
  if (end && now > end) return { label: 'Encerrado', tone: 'muted' }
  return { label: event.is_published ? 'Publicado' : 'Rascunho', tone: event.is_published ? 'success' : 'muted' }
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

function Metric({ label, value, helper }) {
  return <article className="ats-metric">
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
      <span>{event.checked_in_count || 0} check-ins</span>
    </div>
  </button>
}

function EmptyState({ title, children }) {
  return <div className="ats-empty"><span>◎</span><strong>{title}</strong><p>{children}</p></div>
}

export default function AdminTicketSalesPage() {
  const [establishments, setEstablishments] = useState([])
  const [establishmentId, setEstablishmentId] = useState('')
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [details, setDetails] = useState(null)
  const [query, setQuery] = useState('')
  const [loadingEstablishments, setLoadingEstablishments] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
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

  useEffect(() => {
    if (!establishmentId || !eventId) {
      setDetails(null)
      return undefined
    }

    let active = true
    setLoadingDetails(true)
    setError('')
    setDetails(null)
    request(`/admin/ecosystem/establishments/${encodeURIComponent(establishmentId)}/resources/events/${encodeURIComponent(eventId)}/tickets`)
      .then(payload => {
        if (!active) return
        setDetails(payload)
        const url = new URL(window.location.href)
        url.searchParams.set('establishment_id', establishmentId)
        url.searchParams.set('event_id', eventId)
        window.history.replaceState({}, '', `${url.pathname}${url.search}`)
      })
      .catch(err => {
        if (!active) return
        setError(err.message)
        setAuthError(['NO_SESSION', 'AUTH'].includes(err.code))
      })
      .finally(() => active && setLoadingDetails(false))

    return () => { active = false }
  }, [establishmentId, eventId])

  const filteredEstablishments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR')
    if (!needle) return establishments
    return establishments.filter(row => `${row.fantasy || ''} ${row.name || ''} ${row.city || ''} ${row.uf || ''}`.toLocaleLowerCase('pt-BR').includes(needle))
  }, [establishments, query])

  const selectedEstablishment = establishments.find(row => String(row.id) === establishmentId)
  const selectedEvent = events.find(row => String(row.id) === eventId)
  const summary = details?.summary || null

  return <main className="ats-page">
    <header className="ats-header">
      <a className="ats-brand" href="/" aria-label="Peter Tecnet"><img src="/petertecnetlogo.png" alt="" /><span><strong>Peter Tecnet</strong><small>Admin Center</small></span></a>
      <div className="ats-header__copy">
        <p>Eventos · Operação comercial</p>
        <h1>Ingressos por evento</h1>
        <span>Acompanhe vendas confirmadas, disponibilidade, receita, cortesias, estornos e check-ins por estabelecimento.</span>
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
        <div className="ats-section-title"><div><span>Eventos</span><h2>{loadingEvents ? 'Carregando…' : `${events.length} encontrado${events.length === 1 ? '' : 's'}`}</h2></div>{selectedEstablishment && <small>Estab. #{selectedEstablishment.id}</small>}</div>
        <div className="ats-event-list">
          {!loadingEvents && establishmentId && events.length === 0 && <EmptyState title="Nenhum evento neste estabelecimento">Quando os eventos forem vinculados a este estabelecimento, eles aparecerão aqui automaticamente.</EmptyState>}
          {events.map(event => <EventCard key={event.id} event={event} selected={String(event.id) === eventId} onSelect={row => setEventId(String(row.id))} />)}
        </div>
      </aside>

      <section className="ats-detail">
        {!eventId && !loadingEvents && <EmptyState title="Selecione um evento">Escolha um evento à esquerda para abrir a operação de ingressos.</EmptyState>}
        {loadingDetails && <div className="ats-loader"><i /><span>Consolidando vendas, estoque e check-ins…</span></div>}
        {!loadingDetails && selectedEvent && summary && <>
          <div className="ats-event-heading">
            <div><span>Evento #{selectedEvent.id}</span><h2>{selectedEvent.title}</h2><p>{formatDate(selectedEvent.start_date)} · {[selectedEvent.venue, selectedEvent.city, selectedEvent.uf].filter(Boolean).join(' · ')}</p></div>
            <span className={`ats-status ats-status--${eventStatus(selectedEvent).tone}`}>{eventStatus(selectedEvent).label}</span>
          </div>

          <div className="ats-metrics">
            <Metric label="Ingressos vendidos" value={summary.sold_count || 0} helper={`${summary.paid_orders_count || 0} pedido(s) pago(s)`} />
            <Metric label="Receita bruta" value={formatMoney(summary.gross_revenue)} helper="Somente itens de ingresso em pedidos pagos" />
            <Metric label="Disponíveis" value={summary.available_count || 0} helper={`Capacidade cadastrada: ${summary.capacity || 0}`} />
            <Metric label="Check-ins" value={summary.checked_in_count || 0} helper={`${summary.issued_count || 0} ingresso(s) válido(s) emitido(s)`} />
            <Metric label="Cortesias" value={summary.courtesy_count || 0} helper="Separadas das vendas pagas" />
            <Metric label="Estornos/cancelados" value={summary.reversed_count || 0} helper={`${summary.reserved_count || 0} em reserva temporária`} />
          </div>

          <section className="ats-panel">
            <div className="ats-panel__head"><div><span>Inventário</span><h3>Tipos de ingresso</h3></div><small>{summary.ticket_types_count || 0} tipo(s)</small></div>
            {details.tickets?.length ? <div className="ats-ticket-table"><div className="ats-ticket-row ats-ticket-row--head"><span>Ingresso</span><span>Preço</span><span>Vendidos</span><span>Cortesias</span><span>Disponíveis</span><span>Receita</span></div>{details.tickets.map(ticket => <div className="ats-ticket-row" key={ticket.id}><span><strong>{ticket.name}</strong><small>{ticket.ticket_type || ticket.type || `#${ticket.id}`} · capacidade {ticket.capacity}</small></span><span>{formatMoney(ticket.price)}</span><span><b>{ticket.sold_count}</b><small>{ticket.paid_orders_count} pedido(s)</small></span><span>{ticket.courtesy_count}</span><span>{ticket.available_count}<small>{ticket.reserved_count ? `${ticket.reserved_count} reservado(s)` : ''}</small></span><span><b>{formatMoney(ticket.gross_revenue)}</b><small>{ticket.checked_in_count} check-in(s)</small></span></div>)}</div> : <EmptyState title="Sem ingressos cadastrados">Este evento ainda não possui tipos de ingresso para acompanhar.</EmptyState>}
          </section>

          <section className="ats-panel">
            <div className="ats-panel__head"><div><span>Vendas confirmadas</span><h3>Ingressos pagos recentes</h3></div><small>Últimos 50</small></div>
            {details.recent_sales?.length ? <div className="ats-sales-list">{details.recent_sales.map(sale => <article key={sale.pass_id} className="ats-sale"><div className="ats-sale__person"><span>{(sale.holder_name || sale.holder_email || '?').slice(0, 1).toUpperCase()}</span><div><strong>{sale.holder_name || 'Titular não informado'}</strong><small>{sale.holder_email || 'E-mail não informado'}</small></div></div><div><strong>{sale.ticket_name}</strong><small>{sale.order_public_id ? `Pedido ${sale.order_public_id}` : `Ingresso #${sale.pass_id}`}</small></div><div><strong>{formatMoney(sale.unit_price)}</strong><small>{sale.payment_method || 'Pagamento confirmado'}</small></div><div><strong>{formatDate(sale.paid_at)}</strong><small>{sale.checked_in_at ? `Check-in ${formatDate(sale.checked_in_at)}` : 'Entrada ainda não utilizada'}</small></div></article>)}</div> : <EmptyState title="Nenhuma venda paga ainda">Assim que um pagamento gerar ingressos válidos, a venda aparecerá aqui.</EmptyState>}
          </section>
        </>}
      </section>
    </div>
  </main>
}
