import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './ImportantEventsCenter.css'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
}

function typeLabel(type) {
  const labels = {
    'ticket.purchase.completed': 'Venda de ingresso',
  }
  return labels[type] || type || 'Evento importante'
}

function severityLabel(value) {
  const labels = { success: 'Sucesso', info: 'Informação', warning: 'Atenção', attention: 'Atenção', critical: 'Crítico' }
  return labels[value] || value || 'Informação'
}

function GlobeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.7 5.5 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.5-3.7-9S9.6 5.5 12 3Z"/></svg>
}

function openImportantEventsWorkspace() {
  const navButton = document.querySelector('[data-important-events-nav], [data-admin-page-target="important-events"]')
  if (navButton instanceof HTMLButtonElement) {
    navButton.click()
    return
  }

  const target = document.getElementById('important-events')
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ImportantEventsBell({ request }) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [countPayload, feedPayload] = await Promise.all([
        request('/admin/ecosystem/important-events/unread-count'),
        request('/admin/ecosystem/important-events?per_page=6'),
      ])
      setUnread(Number(countPayload?.unread || 0))
      setEvents(feedPayload?.events?.data || [])
    } catch {
      // The dashboard remains usable even if this secondary signal is unavailable.
    }
  }, [request])

  useEffect(() => {
    void load()
    const timer = window.setInterval(load, 30000)
    const onFocus = () => void load()
    const onUpdated = () => void load()
    window.addEventListener('focus', onFocus)
    window.addEventListener('admin:important-events-updated', onUpdated)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('admin:important-events-updated', onUpdated)
    }
  }, [load])

  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  async function openEvent(event) {
    if (!event.is_read && event.id) {
      try {
        await request(`/admin/ecosystem/important-events/${event.id}/read`, { method: 'PATCH' })
        setUnread(value => Math.max(0, value - 1))
        setEvents(rows => rows.map(row => Number(row.id) === Number(event.id) ? { ...row, is_read: true } : row))
        window.dispatchEvent(new Event('admin:important-events-updated'))
      } catch {
        // Navigation should still work even if read-state update fails.
      }
    }
    setOpen(false)
    openImportantEventsWorkspace()
  }

  async function markAll() {
    setLoading(true)
    try {
      await request('/admin/ecosystem/important-events/read-all', { method: 'PATCH' })
      setUnread(0)
      setEvents(rows => rows.map(row => ({ ...row, is_read: true })))
      window.dispatchEvent(new Event('admin:important-events-updated'))
    } finally {
      setLoading(false)
    }
  }

  return <div className="important-bell" ref={wrapRef}>
    <button className={`important-bell-button${open ? ' active' : ''}`} type="button" onClick={() => setOpen(value => !value)} aria-label={`Eventos importantes${unread ? `, ${unread} não lidos` : ''}`} title="Eventos importantes">
      <GlobeIcon/>{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="important-bell-popover">
      <header><div><small>ECOSSISTEMA</small><b>Eventos importantes</b></div>{unread > 0 && <button type="button" onClick={markAll} disabled={loading}>Marcar lidos</button>}</header>
      <div className="important-bell-list">
        {events.length ? events.map(event => <button type="button" key={event.id} className={event.is_read ? 'read' : 'unread'} onClick={() => openEvent(event)}>
          <i className={`important-event-dot severity-${event.severity || 'info'}`}/>
          <span><b>{event.title}</b><small>{event.application?.name || event.metadata?.app_slug || 'Peter Tecnet'} · {formatDate(event.occurred_at)}</small></span>
        </button>) : <div className="important-bell-empty">Nenhum evento importante registrado.</div>}
      </div>
      <button className="important-bell-footer" type="button" onClick={() => openEvent({ is_read: true })}>Ver central completa →</button>
    </div>}
  </div>
}

export default function ImportantEventsCenter({ request, applications = [] }) {
  const [events, setEvents] = useState([])
  const [summary, setSummary] = useState({})
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ search: '', app_id: '', severity: '', unread: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const activeApplications = useMemo(() => [...applications].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))), [applications])

  const load = useCallback(async (targetPage = page, nextFilters = filters) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(targetPage), per_page: '30' })
      if (nextFilters.search.trim()) params.set('search', nextFilters.search.trim())
      if (nextFilters.app_id) params.set('app_id', nextFilters.app_id)
      if (nextFilters.severity) params.set('severity', nextFilters.severity)
      if (nextFilters.unread) params.set('unread', '1')
      const payload = await request(`/admin/ecosystem/important-events?${params.toString()}`)
      setEvents(payload?.events?.data || [])
      setPagination(payload?.events || null)
      setSummary(payload?.summary || {})
      setPage(Number(payload?.events?.current_page || targetPage))
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar os eventos importantes.')
    } finally {
      setLoading(false)
    }
  }, [filters, page, request])

  useEffect(() => { void load(1, filters) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onUpdated = () => void load(page, filters)
    window.addEventListener('admin:important-events-updated', onUpdated)
    return () => window.removeEventListener('admin:important-events-updated', onUpdated)
  }, [filters, load, page])

  function changeFilter(field, value) {
    setFilters(current => ({ ...current, [field]: value }))
  }

  async function applyFilters(event) {
    event?.preventDefault()
    setPage(1)
    await load(1, filters)
  }

  async function markRead(event) {
    if (event.is_read) return
    try {
      await request(`/admin/ecosystem/important-events/${event.id}/read`, { method: 'PATCH' })
      setEvents(rows => rows.map(row => Number(row.id) === Number(event.id) ? { ...row, is_read: true } : row))
      setSummary(current => ({ ...current, unread: Math.max(0, Number(current.unread || 0) - 1) }))
      window.dispatchEvent(new Event('admin:important-events-updated'))
    } catch (err) {
      setError(err?.message || 'Não foi possível marcar como lido.')
    }
  }

  async function markAllRead() {
    try {
      await request('/admin/ecosystem/important-events/read-all', { method: 'PATCH' })
      setEvents(rows => rows.map(row => ({ ...row, is_read: true })))
      setSummary(current => ({ ...current, unread: 0 }))
      window.dispatchEvent(new Event('admin:important-events-updated'))
    } catch (err) {
      setError(err?.message || 'Não foi possível marcar todos como lidos.')
    }
  }

  return <div className="important-events-center">
    <div className="important-events-heading">
      <div><p className="eyebrow">ECOSSISTEMA / TEMPO REAL</p><h2>Eventos importantes</h2><p>Vendas, pagamentos e acontecimentos relevantes de cada aplicação em uma linha do tempo operacional.</p></div>
      <div className="important-events-heading-actions"><button type="button" onClick={() => load(page, filters)} disabled={loading}>↻ Atualizar</button>{Number(summary.unread || 0) > 0 && <button type="button" onClick={markAllRead}>Marcar tudo como lido</button>}</div>
    </div>

    <div className="important-events-metrics">
      <div><span>Total</span><b>{Number(summary.total || 0)}</b><small>ocorrências no filtro</small></div>
      <div><span>Não lidos</span><b>{Number(summary.unread || 0)}</b><small>pedem sua atenção</small></div>
      <div><span>Vendas / sucesso</span><b>{Number(summary.success || 0)}</b><small>eventos positivos</small></div>
      <div><span>Críticos</span><b>{Number(summary.critical || 0)}</b><small>sinais prioritários</small></div>
    </div>

    <form className="important-events-filters" onSubmit={applyFilters}>
      <input value={filters.search} onChange={event => changeFilter('search', event.target.value)} placeholder="Buscar evento, pedido ou mensagem"/>
      <select value={filters.app_id} onChange={event => changeFilter('app_id', event.target.value)}><option value="">Todas as aplicações</option>{activeApplications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select>
      <select value={filters.severity} onChange={event => changeFilter('severity', event.target.value)}><option value="">Todas as severidades</option><option value="success">Sucesso</option><option value="info">Informação</option><option value="warning">Atenção</option><option value="critical">Crítico</option></select>
      <label><input type="checkbox" checked={filters.unread} onChange={event => changeFilter('unread', event.target.checked)}/> Somente não lidos</label>
      <button type="submit">Aplicar filtros</button>
    </form>

    {error && <div className="important-events-error" role="alert">{error}</div>}
    <div className="important-events-list">
      {loading && !events.length ? <div className="important-events-empty">Carregando acontecimentos…</div> : events.length ? events.map(event => {
        const meta = event.metadata || {}
        const ticketPurchase = event.type === 'ticket.purchase.completed'
        return <article key={event.id} className={`important-event-card${event.is_read ? ' is-read' : ' is-unread'}`} onClick={() => markRead(event)}>
          <div className="important-event-rail"><span className={`important-event-dot severity-${event.severity || 'info'}`}/><i/></div>
          <div className="important-event-body">
            <header><div><span className="important-event-app">{event.application?.name || meta.app_slug || 'Peter Tecnet'}</span><span className={`important-event-severity severity-${event.severity || 'info'}`}>{severityLabel(event.severity)}</span>{!event.is_read && <span className="important-event-new">NOVO</span>}</div><time>{formatDate(event.occurred_at)}</time></header>
            <h3>{event.title}</h3><p>{event.message}</p>
            {ticketPurchase && <div className="important-event-sale-grid">
              <div><span>Evento</span><b>{meta.event_title || `#${meta.event_id}`}</b></div>
              <div><span>Produção</span><b>{meta.production_name || `#${meta.production_id || '—'}`}</b></div>
              <div><span>Ingressos</span><b>{Number(meta.ticket_count || 0)}</b></div>
              <div><span>Total</span><b>{money(meta.total)}</b></div>
              <div><span>Receita Peter</span><b>{money(meta.platform_fee)}</b></div>
              <div><span>Líquido produção</span><b>{money(meta.producer_net)}</b></div>
            </div>}
            <footer><span>{typeLabel(event.type)}</span>{meta.buyer_name && <span>Comprador: {meta.buyer_name}</span>}{meta.order_public_id && <span>Pedido #{String(meta.order_public_id).slice(0, 8).toUpperCase()}</span>}{meta.producer_email_status && <span>E-mail produtor: {meta.producer_email_status === 'delivered' ? 'enviado' : meta.producer_email_status === 'failed' ? 'falhou' : meta.producer_email_status}</span>}</footer>
          </div>
        </article>
      }) : <div className="important-events-empty">Nenhum evento importante corresponde aos filtros atuais.</div>}
    </div>

    {pagination && Number(pagination.last_page || 1) > 1 && <div className="important-events-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1, filters)}>← Anterior</button><span>Página {page} de {pagination.last_page}</span><button type="button" disabled={page >= Number(pagination.last_page) || loading} onClick={() => load(page + 1, filters)}>Próxima →</button></div>}
  </div>
}
