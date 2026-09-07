import { useCallback, useEffect, useMemo, useState } from 'react'
import './AdminEstablishmentEvents.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event('admin-session-expired'))
  }
  if (!response.ok) {
    const validation = Object.values(payload?.errors || {}).flat()?.[0]
    throw new Error(validation || payload?.error || payload?.message || 'Não foi possível concluir a operação.')
  }
  return payload
}

const pad = value => String(value).padStart(2, '0')
const toDateInput = value => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const toDateTimeInput = value => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const formatDate = value => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Data não informada'
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const number = value => Number(value || 0).toLocaleString('pt-BR')

function suggestedDate(event) {
  const source = new Date(event?.start_date)
  const candidate = Number.isNaN(source.getTime()) ? new Date() : new Date(source)
  candidate.setDate(candidate.getDate() + 7)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return toDateInput(candidate < tomorrow ? tomorrow : candidate)
}

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const emptyTicketForm = { name: '', ticket_type: '', type: '', price: '', quantity: '', limit_date: '', description: '' }

export default function AdminEstablishmentEvents({ establishment, app, onSuccess, ticketsOnly = false }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [expandedEventId, setExpandedEventId] = useState(null)
  const [ticketDetails, setTicketDetails] = useState({})
  const [ticketLoading, setTicketLoading] = useState(null)
  const [ticketError, setTicketError] = useState('')
  const [ticketFormEvent, setTicketFormEvent] = useState(null)
  const [editingTicket, setEditingTicket] = useState(null)
  const [ticketForm, setTicketForm] = useState(emptyTicketForm)

  const appId = Number(app?.id)
  const establishmentId = Number(establishment?.id)
  const endpoint = useMemo(() => `/admin/ecosystem/establishments/${establishmentId}/resources/events?app_id=${appId}`, [establishmentId, appId])

  const load = useCallback(async () => {
    if (!establishmentId || !appId) return
    setLoading(true)
    setError('')
    try {
      const payload = await apiRequest(endpoint)
      setEvents(payload?.events || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint, establishmentId, appId])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => {
    const now = Date.now()
    return {
      total: events.length,
      upcoming: events.filter(event => !event.is_cancelled && new Date(event.start_date).getTime() >= now).length,
      drafts: events.filter(event => !event.is_cancelled && !event.is_published).length,
      published: events.filter(event => !event.is_cancelled && event.is_published).length,
    }
  }, [events])

  const visibleEvents = useMemo(() => {
    const now = Date.now()
    const term = normalize(query.trim())
    return events.filter(event => {
      const start = new Date(event.start_date).getTime()
      const matchesFilter = filter === 'all'
        || (filter === 'upcoming' && !event.is_cancelled && start >= now)
        || (filter === 'drafts' && !event.is_cancelled && !event.is_published)
        || (filter === 'published' && !event.is_cancelled && event.is_published)
        || (filter === 'cancelled' && event.is_cancelled)
      if (!matchesFilter) return false
      if (!term) return true
      return normalize([event.title, event.venue, event.city, event.uf, event.id].filter(Boolean).join(' ')).includes(term)
    })
  }, [events, filter, query])

  const openDuplicate = event => {
    setSelected(event)
    setDate(suggestedDate(event))
    setDialogError('')
  }

  const close = () => {
    if (saving) return
    setSelected(null)
    setDate('')
    setDialogError('')
  }

  const duplicate = async () => {
    if (!selected || !date) {
      setDialogError('Escolha a nova data do evento.')
      return
    }
    if (toDateInput(selected.start_date) === date) {
      setDialogError('Escolha uma data diferente da data original.')
      return
    }

    setSaving(true)
    setDialogError('')
    try {
      const payload = await apiRequest(`/admin/ecosystem/establishments/${establishmentId}/resources/events/${selected.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ app_id: appId, date }),
      })
      setSelected(null)
      setDate('')
      await load()
      setNotice(payload?.message || 'Evento duplicado como rascunho.')
      onSuccess?.(payload?.message || 'Evento duplicado como rascunho.')
    } catch (err) {
      setDialogError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const loadTickets = useCallback(async event => {
    setTicketLoading(event.id)
    setTicketError('')
    try {
      const payload = await apiRequest(`/admin/ecosystem/establishments/${establishmentId}/resources/events/${event.id}/tickets?app_id=${appId}`)
      setTicketDetails(current => ({ ...current, [event.id]: payload }))
      return payload
    } catch (err) {
      setTicketError(err.message)
      return null
    } finally {
      setTicketLoading(null)
    }
  }, [appId, establishmentId])

  const toggleTickets = async event => {
    const next = expandedEventId === event.id ? null : event.id
    setExpandedEventId(next)
    if (next && !ticketDetails[event.id]) await loadTickets(event)
  }

  const openTicketForm = (event, ticket = null) => {
    setTicketFormEvent(event)
    setEditingTicket(ticket)
    setTicketError('')
    setTicketForm(ticket ? {
      name: ticket.name || '',
      ticket_type: ticket.ticket_type || '',
      type: ticket.type || '',
      price: ticket.price ?? '',
      quantity: ticket.capacity ?? '',
      limit_date: toDateTimeInput(ticket.limit_date),
      description: ticket.description || '',
    } : emptyTicketForm)
  }

  const closeTicketForm = () => {
    if (saving) return
    setTicketFormEvent(null)
    setEditingTicket(null)
    setTicketForm(emptyTicketForm)
    setTicketError('')
  }

  const saveTicket = async event => {
    event.preventDefault()
    if (!ticketFormEvent) return
    setSaving(true)
    setTicketError('')
    try {
      const payload = {
        app_id: appId,
        name: ticketForm.name.trim(),
        ticket_type: ticketForm.ticket_type.trim(),
        type: ticketForm.type.trim() || null,
        price: Number(ticketForm.price),
        quantity: Number(ticketForm.quantity),
        limit_date: ticketForm.limit_date || null,
        description: ticketForm.description.trim() || null,
      }
      const basePath = `/admin/ecosystem/establishments/${establishmentId}/resources/events/${ticketFormEvent.id}/tickets`
      const result = await apiRequest(editingTicket ? `${basePath}/${editingTicket.id}` : basePath, {
        method: editingTicket ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setTicketDetails(current => ({ ...current, [ticketFormEvent.id]: result }))
      setNotice(result?.message || (editingTicket ? 'Lote atualizado.' : 'Lote criado.'))
      closeTicketForm()
      await load()
    } catch (err) {
      setTicketError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const goToCreate = () => document.getElementById('admin-event-create-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return <section className="aee-panel">
    <header className="aee-head">
      <div><span>{ticketsOnly ? 'INGRESSOS / VENDAS / CHECK-IN' : 'EVENTOS DO ESTABELECIMENTO'}</span><h4>{ticketsOnly ? 'Operação de ingressos da Cutinapp' : 'Programação da Cutinapp'}</h4><p>{ticketsOnly ? 'Abra um evento para gerenciar lotes reais, acompanhar vendas, reservas, cortesias, disponibilidade, receita e check-ins.' : 'Liste a agenda deste establishment, acompanhe a operação de ingressos e reutilize eventos sem refazer toda a programação.'}</p></div>
      <div className="aee-head-actions"><button type="button" className="aee-refresh" onClick={() => void load()} disabled={loading}>↻ Atualizar</button>{!ticketsOnly && <button type="button" className="aee-new" onClick={goToCreate}>＋ Novo evento</button>}</div>
    </header>

    {notice && <div className="aee-feedback success">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}

    {!loading && <div className="aee-stats" aria-label="Resumo dos eventos">
      <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><b>{stats.total}</b><span>Total</span></button>
      <button type="button" className={filter === 'upcoming' ? 'active' : ''} onClick={() => setFilter('upcoming')}><b>{stats.upcoming}</b><span>Próximos</span></button>
      <button type="button" className={filter === 'drafts' ? 'active' : ''} onClick={() => setFilter('drafts')}><b>{stats.drafts}</b><span>Rascunhos</span></button>
      <button type="button" className={filter === 'published' ? 'active' : ''} onClick={() => setFilter('published')}><b>{stats.published}</b><span>Publicados</span></button>
    </div>}

    {!loading && events.length > 0 && <div className="aee-toolbar">
      <label><span className="sr-only">Pesquisar eventos</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar por nome, local, cidade ou ID…" /></label>
      <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtrar eventos"><option value="all">Todos os eventos</option><option value="upcoming">Próximos</option><option value="drafts">Rascunhos</option><option value="published">Publicados</option><option value="cancelled">Cancelados</option></select>
    </div>}

    {error && <div className="aee-feedback error">{error}</div>}
    {ticketError && !ticketFormEvent && <div className="aee-feedback error">{ticketError}</div>}
    {loading && <div className="aee-empty">Carregando eventos…</div>}
    {!loading && !events.length && <div className="aee-empty"><b>Nenhum evento neste establishment.</b><span>Crie o primeiro evento para liberar a operação de ingressos.</span>{!ticketsOnly && <button type="button" onClick={goToCreate}>Criar primeiro evento</button>}</div>}
    {!loading && events.length > 0 && !visibleEvents.length && <div className="aee-empty"><b>Nenhum evento encontrado com esses filtros.</b><span>Limpe a pesquisa ou selecione outro status.</span></div>}

    {!loading && visibleEvents.length > 0 && <div className="aee-list">
      {visibleEvents.map(event => {
        const details = ticketDetails[event.id]
        const summary = details?.summary
        return <article className={`aee-event-shell ${expandedEventId === event.id ? 'expanded' : ''}`} key={event.id}>
          <div className="aee-event">
            <div className="aee-event-main">
              <div className="aee-event-title"><b>{event.title}</b><span className={event.is_cancelled ? 'cancelled' : event.is_published ? 'published' : 'draft'}>{event.is_cancelled ? 'Cancelado' : event.is_published ? 'Publicado' : 'Rascunho'}</span></div>
              <p>{formatDate(event.start_date)} · {event.venue || [event.city, event.uf].filter(Boolean).join(' / ') || 'Local não informado'}</p>
              <div className="aee-event-metrics"><span><b>{number(event.ticket_types_count ?? event.tickets_count)}</b> lotes</span><span><b>{number(event.tickets_sold_count)}</b> vendidos</span><span><b>{number(event.tickets_available_count)}</b> disponíveis</span><span><b>{money(event.gross_ticket_revenue)}</b> receita</span><span><b>{number(event.checked_in_count)}</b> check-ins</span></div>
              <small>{event.artists_count || 0} artista(s) · ID #{event.id}</small>
            </div>
            <div className="aee-event-actions"><button className="aee-tickets" type="button" onClick={() => void toggleTickets(event)}>{ticketLoading === event.id ? 'Carregando…' : expandedEventId === event.id ? 'Fechar ingressos' : 'Ingressos e vendas'}</button>{!ticketsOnly && <button className="aee-duplicate" type="button" onClick={() => openDuplicate(event)}>⧉ Duplicar</button>}</div>
          </div>

          {expandedEventId === event.id && <div className="aee-ticket-panel">
            {ticketLoading === event.id && <div className="aee-empty">Carregando lotes e vendas…</div>}
            {!ticketLoading && details && <>
              <div className="aee-ticket-summary">
                <div><span>Capacidade</span><b>{number(summary?.capacity)}</b></div><div><span>Vendidos</span><b>{number(summary?.sold_count)}</b></div><div><span>Disponíveis</span><b>{number(summary?.available_count)}</b></div><div><span>Reservados</span><b>{number(summary?.reserved_count)}</b></div><div><span>Cortesias</span><b>{number(summary?.courtesy_count)}</b></div><div><span>Check-ins</span><b>{number(summary?.checked_in_count)}</b></div><div><span>Pedidos pagos</span><b>{number(summary?.paid_orders_count)}</b></div><div><span>Receita bruta</span><b>{money(summary?.gross_revenue)}</b></div>
              </div>
              <div className="aee-ticket-head"><div><b>Lotes / ingressos</b><span>{details.tickets?.length || 0} tipo(s) neste evento</span></div><button type="button" onClick={() => openTicketForm(event)}>＋ Novo lote</button></div>
              {!details.tickets?.length && <div className="aee-empty"><b>Nenhum lote cadastrado.</b><span>Crie o primeiro ingresso real deste evento.</span></div>}
              {!!details.tickets?.length && <div className="aee-ticket-list">{details.tickets.map(ticket => <div className="aee-ticket-row" key={ticket.id}><div><b>{ticket.name}</b><small>{ticket.ticket_type || ticket.type || 'Ingresso'} · #{ticket.id}</small></div><div><span>Preço</span><b>{money(ticket.price)}</b></div><div><span>Capacidade</span><b>{number(ticket.capacity)}</b></div><div><span>Vendidos</span><b>{number(ticket.sold_count)}</b></div><div><span>Disponíveis</span><b>{number(ticket.available_count)}</b></div><div><span>Receita</span><b>{money(ticket.gross_revenue)}</b></div><button type="button" onClick={() => openTicketForm(event, ticket)}>Editar</button></div>)}</div>}
              <div className="aee-sales-head"><b>Vendas recentes</b><span>Últimos ingressos pagos deste evento</span></div>
              {!details.recent_sales?.length && <div className="aee-empty"><span>Ainda não há vendas pagas para exibir.</span></div>}
              {!!details.recent_sales?.length && <div className="aee-sales-list">{details.recent_sales.slice(0, 12).map(sale => <div key={sale.pass_id}><span><b>{sale.holder_name || sale.holder_email || 'Participante'}</b><small>{sale.ticket_name} · {sale.order_public_id || `Pass #${sale.pass_id}`}</small></span><span><b>{money(sale.unit_price)}</b><small>{sale.checked_in_at ? 'Check-in realizado' : 'Aguardando check-in'}</small></span></div>)}</div>}
            </>}
          </div>}
        </article>
      })}
    </div>}

    {ticketFormEvent && <div className="aee-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeTicketForm() }}>
      <form className="aee-dialog aee-ticket-dialog" role="dialog" aria-modal="true" onSubmit={saveTicket}>
        <header><div><span>{editingTicket ? 'EDITAR LOTE' : 'NOVO LOTE / INGRESSO'}</span><h3>{ticketFormEvent.title}</h3></div><button type="button" onClick={closeTicketForm} disabled={saving} aria-label="Fechar">×</button></header>
        <div className="aee-dialog-body aee-ticket-form">
          <label><span>Nome do lote *</span><input value={ticketForm.name} onChange={event => setTicketForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: 1º lote, Pista, VIP" required /></label>
          <label><span>Tipo / categoria *</span><input value={ticketForm.ticket_type} onChange={event => setTicketForm(current => ({ ...current, ticket_type: event.target.value }))} placeholder="Ex.: Inteira, Meia, Cortesia" required /></label>
          <label><span>Classificação interna</span><input value={ticketForm.type} onChange={event => setTicketForm(current => ({ ...current, type: event.target.value }))} placeholder="Opcional" /></label>
          <label><span>Preço (R$) *</span><input type="number" min="0" step="0.01" value={ticketForm.price} onChange={event => setTicketForm(current => ({ ...current, price: event.target.value }))} required /></label>
          <label><span>Capacidade *</span><input type="number" min="0" step="1" value={ticketForm.quantity} onChange={event => setTicketForm(current => ({ ...current, quantity: event.target.value }))} required /></label>
          <label><span>Limite de retirada/venda</span><input type="datetime-local" value={ticketForm.limit_date} onChange={event => setTicketForm(current => ({ ...current, limit_date: event.target.value }))} /></label>
          <label className="wide"><span>Descrição</span><textarea rows="4" value={ticketForm.description} onChange={event => setTicketForm(current => ({ ...current, description: event.target.value }))} /></label>
          {ticketError && <div className="aee-feedback error wide">{ticketError}</div>}
        </div>
        <footer><button type="button" className="secondary" onClick={closeTicketForm} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando…' : editingTicket ? 'Salvar lote' : 'Criar lote'}</button></footer>
      </form>
    </div>}

    {selected && <div className="aee-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <div className="aee-dialog" role="dialog" aria-modal="true" aria-labelledby="aee-dialog-title">
        <header><div><span>DUPLICAR EVENTO</span><h3 id="aee-dialog-title">{selected.title}</h3></div><button type="button" onClick={close} disabled={saving} aria-label="Fechar">×</button></header>
        <div className="aee-dialog-body">
          <p>A nova cópia será criada como <b>rascunho</b>, preservando duração, capa, local, line-up e lotes. Horários e prazos serão deslocados para a nova data.</p>
          <div className="aee-warning"><b>Não serão copiados:</b> vendas, passes, participantes, check-ins, avaliações ou interações.</div>
          <label><span>Nova data *</span><input type="date" min={toDateInput(new Date())} value={date} onChange={event => { setDate(event.target.value); setDialogError('') }} disabled={saving} /></label>
          {dialogError && <div className="aee-feedback error">{dialogError}</div>}
        </div>
        <footer><button type="button" className="secondary" onClick={close} disabled={saving}>Cancelar</button><button type="button" className="primary" onClick={duplicate} disabled={saving || !date}>{saving ? 'Duplicando…' : 'Criar cópia como rascunho'}</button></footer>
      </div>
    </div>}
  </section>
}
