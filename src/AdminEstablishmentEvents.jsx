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
const toLocalInput = value => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const toDateInput = value => toLocalInput(value).slice(0, 10)
const formatDate = value => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Data não informada'

function suggestedStart(event) {
  const source = new Date(event?.start_date)
  const candidate = Number.isNaN(source.getTime()) ? new Date() : new Date(source)
  candidate.setDate(candidate.getDate() + 7)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setSeconds(0, 0)
  if (candidate <= tomorrow) {
    candidate.setTime(tomorrow.getTime())
    if (!Number.isNaN(source.getTime())) candidate.setHours(source.getHours(), source.getMinutes(), 0, 0)
  }
  return candidate
}

function duplicateForm(event) {
  const sourceStart = new Date(event.start_date)
  const sourceEnd = new Date(event.end_date)
  const start = suggestedStart(event)
  const duration = !Number.isNaN(sourceStart.getTime()) && !Number.isNaN(sourceEnd.getTime())
    ? Math.max(sourceEnd.getTime() - sourceStart.getTime(), 60 * 60 * 1000)
    : 2 * 60 * 60 * 1000
  const end = new Date(start.getTime() + duration)

  return {
    title: event.title || '',
    description: event.description || '',
    category: event.category || '',
    event_format: event.event_format || 'in_person',
    start_date: toLocalInput(start),
    end_date: toLocalInput(end),
    venue: event.venue || '',
    address: event.address || '',
    google_maps_url: event.google_maps_url || '',
    city: event.city || '',
    uf: String(event.uf || '').toUpperCase().slice(0, 2),
    online_platform: event.online_platform || '',
    online_url: event.online_url || '',
    max_attendees: event.max_attendees ?? '',
    contact_email: event.contact_email || '',
    contact_phone: event.contact_phone || '',
    is_private: Boolean(event.is_private),
    requires_approval: Boolean(event.requires_approval),
    approval_message: event.approval_message || '',
  }
}

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function EditorField({ label, children, wide = false }) {
  return <label className={`aee-editor-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>
}

export default function AdminEstablishmentEvents({ establishment, app, onSuccess }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editorError, setEditorError] = useState('')

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
    setForm(duplicateForm(event))
    setEditorError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeDuplicate = () => {
    if (saving) return
    setSelected(null)
    setForm(null)
    setEditorError('')
  }

  const patch = values => {
    setForm(current => ({ ...current, ...values }))
    setEditorError('')
  }

  const changeStart = value => {
    setForm(current => {
      const oldStart = new Date(current.start_date)
      const oldEnd = new Date(current.end_date)
      const newStart = new Date(value)
      const duration = !Number.isNaN(oldStart.getTime()) && !Number.isNaN(oldEnd.getTime())
        ? Math.max(oldEnd.getTime() - oldStart.getTime(), 60 * 60 * 1000)
        : 2 * 60 * 60 * 1000
      return {
        ...current,
        start_date: value,
        end_date: Number.isNaN(newStart.getTime()) ? current.end_date : toLocalInput(new Date(newStart.getTime() + duration)),
      }
    })
    setEditorError('')
  }

  const duplicate = async event => {
    event.preventDefault()
    if (!selected || !form) return

    const start = new Date(form.start_date)
    const end = new Date(form.end_date)
    const date = toDateInput(form.start_date)
    const physical = ['in_person', 'hybrid'].includes(form.event_format)
    const online = ['online', 'hybrid'].includes(form.event_format)

    if (form.title.trim().length < 2 || !form.description.trim()) {
      setEditorError('Informe o nome e a descrição da cópia.')
      return
    }
    if (!date || date === toDateInput(selected.start_date)) {
      setEditorError('Escolha uma data diferente da data do evento original.')
      return
    }
    if (Number.isNaN(start.getTime()) || start <= new Date()) {
      setEditorError('O início da cópia precisa ficar no futuro.')
      return
    }
    if (Number.isNaN(end.getTime()) || end <= start) {
      setEditorError('O término da cópia precisa ser posterior ao início.')
      return
    }
    if (physical && (!form.address.trim() || !form.city.trim() || form.uf.trim().length !== 2)) {
      setEditorError('Eventos presenciais precisam de endereço, cidade e UF.')
      return
    }
    if (online && !form.online_url.trim()) {
      setEditorError('Informe a URL de acesso para eventos online ou híbridos.')
      return
    }

    setSaving(true)
    setEditorError('')
    try {
      const payload = await apiRequest(`/admin/ecosystem/establishments/${establishmentId}/resources/events/${selected.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({
          app_id: appId,
          date,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category.trim() || null,
          event_format: form.event_format,
          start_date: form.start_date,
          end_date: form.end_date,
          venue: form.venue.trim() || null,
          address: form.address.trim() || null,
          google_maps_url: form.google_maps_url.trim() || null,
          city: form.city.trim() || null,
          uf: form.uf.trim().toUpperCase() || null,
          online_platform: form.online_platform.trim() || null,
          online_url: form.online_url.trim() || null,
          max_attendees: form.max_attendees === '' ? null : Number(form.max_attendees),
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          is_private: Boolean(form.is_private),
          requires_approval: Boolean(form.requires_approval),
          approval_message: form.requires_approval ? (form.approval_message.trim() || null) : null,
        }),
      })
      setSelected(null)
      setForm(null)
      await load()
      onSuccess?.(payload?.message || 'Evento duplicado como rascunho com os dados revisados.')
    } catch (err) {
      setEditorError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const goToCreate = () => document.getElementById('admin-event-create-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (selected && form) {
    const physical = ['in_person', 'hybrid'].includes(form.event_format)
    const online = ['online', 'hybrid'].includes(form.event_format)

    return <section className="aee-panel aee-duplicate-page">
      <header className="aee-duplicate-head">
        <button type="button" className="aee-back" onClick={closeDuplicate} disabled={saving}>← Voltar aos eventos</button>
        <div><span>DUPLICAR EVENTO / REVISÃO</span><h3>{selected.title}</h3><p>Edite os dados antes de criar a cópia. Nenhum novo evento será criado até a confirmação no final desta página.</p></div>
        <div className="aee-draft-badge">NOVO RASCUNHO</div>
      </header>

      <div className="aee-copy-note"><b>Será copiado:</b> capa, lotes de ingresso e line-up. Os horários do line-up e os prazos dos lotes serão deslocados pelo novo horário escolhido. <b>Não será copiado:</b> vendas, passes, participantes, check-ins, avaliações ou interações.</div>
      {editorError && <div className="aee-feedback error" role="alert">{editorError}</div>}

      <form className="aee-editor" onSubmit={duplicate}>
        <section className="aee-editor-card">
          <header><span>01</span><div><h4>Informações da cópia</h4><p>Nome, programação, formato e capacidade continuam totalmente editáveis.</p></div></header>
          <div className="aee-editor-grid">
            <EditorField label="Nome do evento *"><input value={form.title} onChange={e => patch({ title: e.target.value })} required /></EditorField>
            <EditorField label="Categoria"><input value={form.category} onChange={e => patch({ category: e.target.value })} /></EditorField>
            <EditorField label="Formato"><select value={form.event_format} onChange={e => patch({ event_format: e.target.value })}><option value="in_person">Presencial</option><option value="online">Online</option><option value="hybrid">Híbrido</option></select></EditorField>
            <EditorField label="Capacidade"><input type="number" min="0" value={form.max_attendees} onChange={e => patch({ max_attendees: e.target.value })} /></EditorField>
            <EditorField label="Início *"><input type="datetime-local" value={form.start_date} onChange={e => changeStart(e.target.value)} required /></EditorField>
            <EditorField label="Fim *"><input type="datetime-local" value={form.end_date} onChange={e => patch({ end_date: e.target.value })} required /></EditorField>
            <EditorField label="Descrição *" wide><textarea rows="7" value={form.description} onChange={e => patch({ description: e.target.value })} required /></EditorField>
          </div>
        </section>

        <section className="aee-editor-card">
          <header><span>02</span><div><h4>Local e acesso</h4><p>Revise o estabelecimento, endereço e dados de acesso online antes de duplicar.</p></div></header>
          <div className="aee-editor-grid">
            {physical && <>
              <EditorField label="Local"><input value={form.venue} onChange={e => patch({ venue: e.target.value })} /></EditorField>
              <EditorField label="Endereço *"><input value={form.address} onChange={e => patch({ address: e.target.value })} required /></EditorField>
              <EditorField label="Google Maps" wide><input type="url" value={form.google_maps_url} onChange={e => patch({ google_maps_url: e.target.value })} placeholder="https://" /></EditorField>
              <EditorField label="Cidade *"><input value={form.city} onChange={e => patch({ city: e.target.value })} required /></EditorField>
              <EditorField label="UF *"><input maxLength="2" value={form.uf} onChange={e => patch({ uf: e.target.value.toUpperCase().slice(0, 2) })} required /></EditorField>
            </>}
            {online && <>
              <EditorField label="Plataforma online"><input value={form.online_platform} onChange={e => patch({ online_platform: e.target.value })} /></EditorField>
              <EditorField label="URL online *"><input type="url" value={form.online_url} onChange={e => patch({ online_url: e.target.value })} placeholder="https://" required /></EditorField>
            </>}
            <EditorField label="E-mail de contato"><input type="email" value={form.contact_email} onChange={e => patch({ contact_email: e.target.value })} /></EditorField>
            <EditorField label="Telefone"><input value={form.contact_phone} onChange={e => patch({ contact_phone: e.target.value })} /></EditorField>
          </div>
        </section>

        <section className="aee-editor-card">
          <header><span>03</span><div><h4>Privacidade e aprovação</h4><p>A cópia sempre nasce como rascunho, mas estas regras podem ser revisadas agora.</p></div></header>
          <div className="aee-editor-switches">
            <label className={form.is_private ? 'selected' : ''}><input type="checkbox" checked={form.is_private} onChange={e => patch({ is_private: e.target.checked })} /><span><b>Evento privado</b><small>{form.is_private ? 'Ativo' : 'Inativo'}</small></span></label>
            <label className={form.requires_approval ? 'selected' : ''}><input type="checkbox" checked={form.requires_approval} onChange={e => patch({ requires_approval: e.target.checked })} /><span><b>Exigir aprovação</b><small>{form.requires_approval ? 'Ativo' : 'Inativo'}</small></span></label>
          </div>
          {form.requires_approval && <div className="aee-editor-grid aee-approval"><EditorField label="Mensagem de aprovação" wide><textarea rows="4" value={form.approval_message} onChange={e => patch({ approval_message: e.target.value })} /></EditorField></div>}
        </section>

        <div className="aee-editor-actions">
          <button type="button" className="secondary" onClick={closeDuplicate} disabled={saving}>Cancelar</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? 'Criando cópia…' : 'Criar cópia com estes dados'}</button>
        </div>
      </form>
    </section>
  }

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
  </section>
}
