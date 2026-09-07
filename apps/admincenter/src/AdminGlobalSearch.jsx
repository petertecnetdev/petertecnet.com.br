import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminGlobalSearch.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

const GROUPS = [
  ['users', 'Usuários'],
  ['applications', 'Aplicações'],
  ['establishments', 'Estabelecimentos'],
  ['items', 'Itens'],
  ['events', 'Eventos'],
  ['orders', 'Pedidos'],
  ['payments', 'Pagamentos'],
]

const SECTION_BY_GROUP = {
  applications: 'applications',
  establishments: 'operations',
  items: 'operations',
  events: 'activity',
  orders: 'operations',
  payments: 'financial',
}

function searchRequest(query, signal) {
  const token = localStorage.getItem(TOKEN_KEY)
  return fetch(`${API}/admin/ecosystem/command/search?q=${encodeURIComponent(query)}`, {
    signal,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(async response => {
    const payload = await response.json().catch(() => ({}))
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }
    if (!response.ok) throw new Error(payload?.error || payload?.message || 'Não foi possível realizar a pesquisa.')
    return payload
  })
}

function resultTitle(row) {
  return row?.name || row?.title || [row?.first_name, row?.last_name].filter(Boolean).join(' ') || row?.user_name || row?.email || row?.reference || row?.public_id || `Registro #${row?.id ?? '—'}`
}

function resultSubtitle(row) {
  return row?.email || row?.description || row?.slug || row?.category || row?.type || row?.application_name || row?.status || row?.reference || `ID ${row?.id ?? '—'}`
}

function resultMeta(row) {
  return [
    row?.application?.name || row?.app_name || row?.application_name,
    row?.city && row?.uf ? `${row.city}/${row.uf}` : row?.city || row?.uf,
    row?.status,
    row?.public_id ? `Public ID ${row.public_id}` : null,
  ].filter(Boolean).slice(0, 3)
}

function safeResultUrl(value) {
  if (!value) return null
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url : null
  } catch {
    return null
  }
}

function resultDestination(group, row) {
  if (group === 'users') {
    const rawId = row?.id ?? row?.user_id
    const userId = Number(rawId)
    if (Number.isInteger(userId) && userId > 0) return { type: 'user', userId }
  }

  const directUrl = safeResultUrl(row?.admin_url || row?.detail_url || row?.url || row?.reference_url)
  if (directUrl) return { type: 'url', url: directUrl }

  const section = SECTION_BY_GROUP[group]
  return section ? { type: 'section', section } : null
}

function resultActionLabel(group, destination) {
  if (group === 'users') return 'Ver detalhes →'
  if (destination?.type === 'url') return 'Abrir detalhe →'
  return 'Ir ao módulo →'
}

function navigateToResult(destination, onClose) {
  if (!destination) return

  if (destination.type === 'user') {
    const url = new URL(window.location.href)
    url.searchParams.set('user', String(destination.userId))
    url.hash = 'users'
    window.location.assign(url.href)
    return
  }

  if (destination.type === 'url') {
    if (destination.url.origin === window.location.origin) {
      window.location.assign(destination.url.href)
    } else {
      const opened = window.open(destination.url.href, '_blank', 'noopener,noreferrer')
      if (opened) opened.opener = null
      onClose()
    }
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.delete('user')
  url.hash = destination.section
  window.history.pushState({ adminSection: destination.section }, '', `${url.pathname}${url.search}${url.hash}`)
  onClose()
  window.setTimeout(() => document.getElementById(destination.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
}

function AdminSearchPage({ onClose }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeGroup, setActiveGroup] = useState('all')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const value = query.trim()
    setError('')
    if (value.length < 2) {
      setResult(null)
      setLoading(false)
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try { setResult(await searchRequest(value, controller.signal)) }
      catch (requestError) { if (requestError?.name !== 'AbortError') setError(requestError.message) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 260)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

  const groups = result?.groups || {}
  const groupCounts = useMemo(() => Object.fromEntries(GROUPS.map(([key]) => [key, Array.isArray(groups[key]) ? groups[key].length : 0])), [groups])
  const total = Number(result?.total ?? Object.values(groupCounts).reduce((sum, count) => sum + count, 0))
  const visibleGroups = activeGroup === 'all' ? GROUPS : GROUPS.filter(([key]) => key === activeGroup)

  return <section className="admin-global-search-page" aria-label="Pesquisa global do Admin Center">
    <div className="global-search-page-head">
      <button className="global-search-back" type="button" onClick={onClose} aria-label="Voltar para o Admin Center">←</button>
      <div><p className="eyebrow">PESQUISA GLOBAL</p><h1>Pesquisar no ecossistema</h1><p>Encontre usuários, aplicações, estabelecimentos, itens, eventos, pedidos e pagamentos em um único lugar.</p></div>
    </div>
    <div className="global-search-input-wrap"><SearchIcon /><input ref={inputRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Digite nome, e-mail, ID, slug, item, estabelecimento, pedido..." aria-label="Pesquisar em todo o ecossistema" autoComplete="off"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa">×</button>}</div>
    <div className="global-search-filters" role="tablist" aria-label="Filtrar resultados por tipo">
      <button type="button" className={activeGroup === 'all' ? 'active' : ''} onClick={() => setActiveGroup('all')}>Tudo <span>{result ? total : '—'}</span></button>
      {GROUPS.map(([key, label]) => <button type="button" key={key} className={activeGroup === key ? 'active' : ''} onClick={() => setActiveGroup(key)}>{label} <span>{result ? groupCounts[key] : '—'}</span></button>)}
    </div>
    <div className="global-search-body">
      {!query.trim() && <div className="global-search-intro"><div className="global-search-intro-icon"><SearchIcon /></div><h2>O que você precisa encontrar?</h2><p>A pesquisa consulta a API administrativa central e agrupa os resultados por entidade.</p><kbd>Ctrl K</kbd><small>abre esta página de qualquer lugar do Admin Center</small></div>}
      {query.trim().length === 1 && <div className="global-search-status">Digite pelo menos 2 caracteres para pesquisar.</div>}
      {loading && <div className="global-search-status"><span className="global-search-spinner"/>Pesquisando em todo o ecossistema…</div>}
      {error && <div className="global-search-error" role="alert">{error}</div>}
      {!loading && !error && result && total === 0 && <div className="global-search-status">Nenhum resultado encontrado para “{query.trim()}”.</div>}
      {!loading && !error && result && total > 0 && <div className="global-search-results">
        <div className="global-search-summary"><b>{total}</b><span>resultado{total === 1 ? '' : 's'} encontrado{total === 1 ? '' : 's'}</span></div>
        {visibleGroups.map(([key, label]) => {
          const rows = Array.isArray(groups[key]) ? groups[key] : []
          if (!rows.length) return activeGroup === key ? <div className="global-search-status" key={key}>Nenhum resultado em {label.toLowerCase()}.</div> : null
          return <section className="global-search-group" key={key}><header><div><span>{label}</span><b>{rows.length}</b></div></header><div className="global-search-grid">{rows.map((row, index) => {
            const meta = resultMeta(row)
            const destination = resultDestination(key, row)
            const openResult = () => navigateToResult(destination, onClose)
            return <article
              className={`global-search-card${destination ? ' is-actionable' : ''}`}
              key={`${key}-${row?.id ?? row?.public_id ?? index}`}
              role={destination ? 'link' : undefined}
              tabIndex={destination ? 0 : undefined}
              onClick={destination ? openResult : undefined}
              onKeyDown={destination ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openResult()
                }
              } : undefined}
              aria-label={destination ? `${resultActionLabel(key, destination)}: ${resultTitle(row)}` : undefined}
            ><div className="global-search-card-main"><span className="global-search-kind">{label}</span><h3>{resultTitle(row)}</h3><p>{resultSubtitle(row)}</p>{meta.length > 0 && <div className="global-search-meta">{meta.map(value => <span key={value}>{value}</span>)}</div>}</div><div className="global-search-card-side"><small>{row?.id != null ? `#${row.id}` : row?.public_id || ''}</small>{destination && <span className="global-search-card-open">{resultActionLabel(key, destination)}</span>}</div></article>
          })}</div></section>
        })}
      </div>}
    </div>
  </section>
}

export default function AdminGlobalSearch() {
  const [topActions, setTopActions] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const syncTargets = () => { setTopActions(document.querySelector('.top-actions')); setWorkspace(document.querySelector('.workspace')) }
    syncTargets()
    const observer = new MutationObserver(syncTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => { if (!topActions || !workspace) setOpen(false) }, [topActions, workspace])

  useEffect(() => {
    const handleShortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && document.querySelector('.top-actions')) {
        event.preventDefault(); event.stopImmediatePropagation(); setOpen(true)
      }
      if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false) }
    }
    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [open])

  useEffect(() => {
    const handleNavigation = event => { if (event.target.closest('.sidebar nav button, .sidebar > .brand')) setOpen(false) }
    document.addEventListener('click', handleNavigation, true)
    return () => document.removeEventListener('click', handleNavigation, true)
  }, [])

  useEffect(() => { document.body.classList.toggle('admin-global-search-open', open); return () => document.body.classList.remove('admin-global-search-open') }, [open])

  return <>
    {topActions && createPortal(<button className={`admin-search-nav-button ${open ? 'active' : ''}`} type="button" onClick={() => setOpen(value => !value)} aria-label="Abrir pesquisa global" title="Pesquisar no ecossistema (Ctrl+K)"><SearchIcon /></button>, topActions)}
    {workspace && open && createPortal(<AdminSearchPage onClose={() => setOpen(false)} />, workspace)}
  </>
}
