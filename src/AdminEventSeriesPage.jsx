import { useEffect, useMemo, useState } from 'react'
import './AdminEventSeriesPage.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'
const WEEKDAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

function dateInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return dateInput(date)
}

function formatDate(value) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sem data' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function validationMessage(data) {
  const errors = data?.errors
  if (!errors || typeof errors !== 'object') return ''
  return Object.values(errors).flat().find(value => typeof value === 'string' && value.trim()) || ''
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    const error = new Error('Sessão administrativa não encontrada neste navegador.')
    error.code = 'NO_SESSION'
    throw error
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 403) {
      const error = new Error(response.status === 401 ? 'Sua sessão administrativa expirou.' : 'Sua conta não possui acesso a esta operação.')
      error.code = 'AUTH'
      throw error
    }
    if (!response.ok) throw new Error(validationMessage(data) || data?.message || data?.error || 'Não foi possível concluir a operação.')
    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function linkedApplications(establishment) {
  if (!establishment) return []
  const values = [establishment.app, ...(Array.isArray(establishment.applications) ? establishment.applications : [])].filter(Boolean)
  const seen = new Set()
  return values.filter(app => {
    const key = String(app.id || '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function AdminEventSeriesPage() {
  const tomorrow = useMemo(() => addDays(new Date(), 1), [])
  const [establishments, setEstablishments] = useState([])
  const [establishmentId, setEstablishmentId] = useState('')
  const [appId, setAppId] = useState('')
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [mode, setMode] = useState('dates')
  const [candidateDate, setCandidateDate] = useState(tomorrow)
  const [dates, setDates] = useState([])
  const [weekdays, setWeekdays] = useState([])
  const [rangeStart, setRangeStart] = useState(tomorrow)
  const [rangeEnd, setRangeEnd] = useState(addDays(new Date(), 56))
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    document.title = 'Agenda de eventos | Admin Center Peter Tecnet'
    let active = true
    request('/admin/ecosystem/establishments')
      .then(payload => {
        if (!active) return
        const rows = Array.isArray(payload?.establishments) ? payload.establishments : []
        setEstablishments(rows)
        const params = new URLSearchParams(window.location.search)
        const preferred = params.get('establishment_id') || ''
        const selected = rows.some(row => String(row.id) === preferred) ? preferred : rows[0]?.id ? String(rows[0].id) : ''
        setEstablishmentId(selected)
      })
      .catch(err => {
        if (!active) return
        setError(err.message)
        setAuthError(['NO_SESSION', 'AUTH'].includes(err.code))
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const selectedEstablishment = establishments.find(row => String(row.id) === establishmentId) || null
  const applications = useMemo(() => linkedApplications(selectedEstablishment), [selectedEstablishment])

  useEffect(() => {
    if (!selectedEstablishment) {
      setAppId('')
      return
    }
    const currentIsValid = applications.some(app => String(app.id) === appId)
    if (currentIsValid) return
    const preferred = String(selectedEstablishment.app_id || applications[0]?.id || '')
    setAppId(preferred)
  }, [selectedEstablishment, applications, appId])

  useEffect(() => {
    if (!establishmentId || !appId) {
      setEvents([])
      setEventId('')
      return undefined
    }

    let active = true
    setLoadingEvents(true)
    setError('')
    setSuccess('')
    request(`/admin/ecosystem/establishments/${encodeURIComponent(establishmentId)}/resources/events?app_id=${encodeURIComponent(appId)}`)
      .then(payload => {
        if (!active) return
        const rows = Array.isArray(payload?.events) ? payload.events : []
        setEvents(rows)
        const params = new URLSearchParams(window.location.search)
        const preferred = params.get('event_id') || ''
        const selected = rows.some(row => String(row.id) === preferred) ? preferred : rows[0]?.id ? String(rows[0].id) : ''
        setEventId(selected)
      })
      .catch(err => {
        if (!active) return
        setEvents([])
        setEventId('')
        setError(err.message)
        setAuthError(['NO_SESSION', 'AUTH'].includes(err.code))
      })
      .finally(() => active && setLoadingEvents(false))
    return () => { active = false }
  }, [establishmentId, appId])

  const selectedEvent = events.find(row => String(row.id) === eventId) || null

  useEffect(() => {
    if (!selectedEvent) return
    const source = new Date(selectedEvent.start_date)
    if (!Number.isNaN(source.getTime())) {
      setWeekdays([source.getDay()])
      const suggested = new Date(source)
      suggested.setDate(suggested.getDate() + 7)
      setCandidateDate(suggested > new Date() ? dateInput(suggested) : tomorrow)
    }
    setDates([])
    setError('')
    setSuccess('')

    const url = new URL(window.location.href)
    url.searchParams.set('establishment_id', establishmentId)
    url.searchParams.set('app_id', appId)
    url.searchParams.set('event_id', String(selectedEvent.id))
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }, [selectedEvent?.id])

  const filteredEstablishments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR')
    if (!needle) return establishments
    return establishments.filter(row => `${row.fantasy || ''} ${row.name || ''} ${row.city || ''} ${row.uf || ''}`.toLocaleLowerCase('pt-BR').includes(needle))
  }, [establishments, query])

  const addDate = () => {
    if (!candidateDate) return
    const sourceDate = dateInput(selectedEvent?.start_date)
    if (candidateDate === sourceDate) {
      setError('Essa é a data da edição original. Escolha outra data.')
      return
    }
    setDates(current => [...new Set([...current, candidateDate])].sort())
    setError('')
  }

  const toggleWeekday = value => {
    setWeekdays(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
    setError('')
  }

  const submit = async event => {
    event.preventDefault()
    if (!selectedEvent || !establishmentId || !appId) return
    if (mode === 'dates' && dates.length === 0) return setError('Adicione ao menos uma data específica.')
    if (mode === 'weekly' && weekdays.length === 0) return setError('Selecione ao menos um dia da semana.')
    if (mode === 'weekly' && (!rangeStart || !rangeEnd)) return setError('Informe o início e o fim da agenda semanal.')

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = mode === 'dates'
        ? { app_id: Number(appId), mode: 'dates', dates }
        : { app_id: Number(appId), mode: 'weekly', weekdays, range_start: rangeStart, range_end: rangeEnd }
      const result = await request(`/admin/ecosystem/establishments/${encodeURIComponent(establishmentId)}/resources/events/${encodeURIComponent(selectedEvent.id)}/series`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccess(`${result?.message || 'Agenda criada.'}${result?.existing_count ? ` ${result.existing_count} ocorrência(s) já existiam e não foram duplicadas.` : ''}`)
      setDates([])
      const refreshed = await request(`/admin/ecosystem/establishments/${encodeURIComponent(establishmentId)}/resources/events?app_id=${encodeURIComponent(appId)}`)
      setEvents(Array.isArray(refreshed?.events) ? refreshed.events : [])
    } catch (err) {
      setError(err.message)
      setAuthError(['NO_SESSION', 'AUTH'].includes(err.code))
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="aes-page">
    <header className="aes-header">
      <a className="aes-brand" href="/" aria-label="Peter Tecnet"><img src="/petertecnetlogo.png" alt="" /><span><strong>Peter Tecnet</strong><small>Admin Center</small></span></a>
      <div><p>Eventos · Operação recorrente</p><h1>Criar agenda a partir de um evento</h1><span>Reaproveite um evento existente para criar várias edições em datas específicas ou em dias fixos da semana.</span></div>
      <div className="aes-header__actions"><a href="/admin/events/tickets">Ingressos</a><a href="/">Ecossistema ↗</a></div>
    </header>

    {error && <div className="aes-notice aes-notice--error" role="alert"><strong>{authError ? 'Acesso administrativo necessário' : 'Revise a operação'}</strong><span>{error}</span></div>}
    {success && <div className="aes-notice aes-notice--success" role="status"><strong>Agenda criada</strong><span>{success}</span></div>}

    <section className="aes-context">
      <label><span>Pesquisar estabelecimento</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, cidade ou estado" /></label>
      <label><span>Estabelecimento</span><select value={establishmentId} onChange={event => setEstablishmentId(event.target.value)} disabled={loading || !filteredEstablishments.length}><option value="">Selecione…</option>{filteredEstablishments.map(row => <option key={row.id} value={row.id}>{row.fantasy || row.name} · {[row.city, row.uf].filter(Boolean).join('/') || `#${row.id}`}</option>)}</select></label>
      <label><span>Aplicação</span><select value={appId} onChange={event => setAppId(event.target.value)} disabled={!applications.length}><option value="">Selecione…</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name || app.slug || `Aplicação #${app.id}`}</option>)}</select></label>
    </section>

    <div className="aes-workspace">
      <aside className="aes-events">
        <div className="aes-section-title"><span>Evento modelo</span><h2>{loadingEvents ? 'Carregando…' : `${events.length} evento${events.length === 1 ? '' : 's'}`}</h2></div>
        <div className="aes-event-list">
          {!loadingEvents && !events.length && <div className="aes-empty">Nenhum evento encontrado neste estabelecimento/aplicação.</div>}
          {events.map(row => <button type="button" key={row.id} className={String(row.id) === eventId ? 'is-selected' : ''} onClick={() => setEventId(String(row.id))}><span>{row.is_published ? 'Publicado' : 'Rascunho'} · #{row.id}</span><strong>{row.title}</strong><small>{formatDate(row.start_date)}</small><small>{[row.venue, row.city, row.uf].filter(Boolean).join(' · ') || 'Local não informado'}</small></button>)}
        </div>
      </aside>

      <section className="aes-builder">
        {!selectedEvent ? <div className="aes-empty aes-empty--large">Selecione um evento à esquerda para montar a série.</div> : <form onSubmit={submit}>
          <div className="aes-template"><span>Modelo selecionado</span><h2>{selectedEvent.title}</h2><p>{formatDate(selectedEvent.start_date)} · {[selectedEvent.venue, selectedEvent.city, selectedEvent.uf].filter(Boolean).join(' · ')}</p><small>Capa, horários, local, lineup e lotes são reaproveitados. As novas edições nascem em rascunho, sem vendas, participantes, passes ou check-ins.</small></div>

          <div className="aes-mode" role="group" aria-label="Modo da agenda"><button type="button" className={mode === 'dates' ? 'is-active' : ''} onClick={() => setMode('dates')}>Datas específicas</button><button type="button" className={mode === 'weekly' ? 'is-active' : ''} onClick={() => setMode('weekly')}>Agenda semanal</button></div>

          {mode === 'dates' ? <section className="aes-form-section"><div className="aes-section-title"><span>Datas</span><h3>Escolha quantas edições precisar</h3></div><div className="aes-date-add"><input type="date" min={tomorrow} value={candidateDate} onChange={event => setCandidateDate(event.target.value)} /><button type="button" onClick={addDate}>Adicionar</button></div><div className="aes-date-chips">{dates.map(value => <button type="button" key={value} onClick={() => setDates(current => current.filter(item => item !== value))}>{new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')} <b>×</b></button>)}{dates.length === 0 && <small>Adicione uma ou mais datas. A criação só acontece ao confirmar abaixo.</small>}</div></section> : <section className="aes-form-section"><div className="aes-section-title"><span>Recorrência semanal</span><h3>Marque os dias fixos</h3></div><div className="aes-weekdays">{WEEKDAYS.map(day => <button type="button" key={day.value} className={weekdays.includes(day.value) ? 'is-active' : ''} onClick={() => toggleWeekday(day.value)}>{day.label}</button>)}</div><div className="aes-range"><label><span>De</span><input type="date" min={tomorrow} value={rangeStart} onChange={event => setRangeStart(event.target.value)} /></label><label><span>Até</span><input type="date" min={rangeStart || tomorrow} value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} /></label></div><small>Exemplo: marque quinta e sábado para gerar todas as quintas e sábados dentro do período.</small></section>}

          <div className="aes-safety"><strong>Criação segura em lote</strong><span>Máximo de 120 ocorrências por operação, somente datas futuras e sem duplicar uma edição igual já existente.</span></div>
          <button className="aes-submit" type="submit" disabled={submitting}>{submitting ? 'Criando agenda…' : mode === 'dates' ? `Criar ${dates.length || 'várias'} edição(ões)` : 'Criar agenda semanal'}</button>
        </form>}
      </section>
    </div>
  </main>
}
