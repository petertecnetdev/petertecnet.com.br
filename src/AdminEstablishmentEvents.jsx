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
const formatDate = value => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Data não informada'

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

export default function AdminEstablishmentEvents({ establishment, app, onSuccess }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')

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
      onSuccess?.(payload?.message || 'Evento duplicado como rascunho.')
    } catch (err) {
      setDialogError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const goToCreate = () => document.getElementById('admin-event-create-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return <section className="aee-panel">
    <header className="aee-head">
      <div><span>EVENTOS DO ESTABELECIMENTO</span><h4>Programação da Cutinapp</h4><p>Gerencie a agenda deste establishment e reutilize eventos existentes sem refazer toda a programação.</p></div>
      <div className="aee-head-actions"><button type="button" className="aee-refresh" onClick={() => void load()} disabled={loading}>↻ Atualizar</button><button type="button" className="aee-new" onClick={goToCreate}>＋ Novo evento</button></div>
    </header>

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
    {loading && <div className="aee-empty">Carregando eventos…</div>}
    {!loading && !events.length && <div className="aee-empty"><b>Nenhum evento neste establishment.</b><span>Crie o primeiro evento pelo formulário abaixo.</span><button type="button" onClick={goToCreate}>Criar primeiro evento</button></div>}
    {!loading && events.length > 0 && !visibleEvents.length && <div className="aee-empty"><b>Nenhum evento encontrado com esses filtros.</b><span>Limpe a pesquisa ou selecione outro status.</span></div>}

    {!loading && visibleEvents.length > 0 && <div className="aee-list">
      {visibleEvents.map(event => <article className="aee-event" key={event.id}>
        <div className="aee-event-main">
          <div className="aee-event-title"><b>{event.title}</b><span className={event.is_cancelled ? 'cancelled' : event.is_published ? 'published' : 'draft'}>{event.is_cancelled ? 'Cancelado' : event.is_published ? 'Publicado' : 'Rascunho'}</span></div>
          <p>{formatDate(event.start_date)} · {event.venue || [event.city, event.uf].filter(Boolean).join(' / ') || 'Local não informado'}</p>
          <small>{event.tickets_count || 0} lote(s) · {event.artists_count || 0} artista(s) · ID #{event.id}</small>
        </div>
        <button className="aee-duplicate" type="button" onClick={() => openDuplicate(event)}>⧉ Duplicar evento</button>
      </article>)}
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
