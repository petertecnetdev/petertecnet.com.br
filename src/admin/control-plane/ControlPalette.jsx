import { useEffect, useMemo, useRef, useState } from 'react'
import { controlApi, NAVIGATION, navigateAdmin, normalizeEntityType } from './api.js'

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const groupToTab = group => {
  const value = normalize(group)
  if (value.includes('user') || value.includes('usuario')) return 'users'
  if (value.includes('establishment') || value.includes('estabelecimento')) return 'establishments'
  if (value.includes('application') || value.includes('aplicacao')) return 'applications'
  if (value.includes('item')) return 'items'
  if (value.includes('payment') || value.includes('order') || value.includes('pagamento') || value.includes('pedido')) return 'financial'
  if (value.includes('audit')) return 'audit'
  if (value.includes('interaction')) return 'activity'
  return 'command'
}

export default function ControlPalette({ open, onClose, onOpenEntity, history = [], favorites = [], onHistory, onFavorites }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)

  const navigation = useMemo(() => NAVIGATION.filter(([, label]) => !query || normalize(label).includes(normalize(query))), [query])
  const searchEntries = useMemo(() => Object.entries(results?.groups || {}).flatMap(([group, rows]) => (rows || []).slice(0, 7).map(row => ({ kind: 'entity', group, row }))), [results])
  const entries = useMemo(() => [...navigation.map(item => ({ kind: 'nav', item })), ...searchEntries], [navigation, searchEntries])

  useEffect(() => {
    if (!open) return
    setSelected(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults(null); setLoading(false); return }
    let active = true
    setLoading(true)
    const id = window.setTimeout(async () => {
      try {
        const data = await controlApi(`/admin/ecosystem/command/search?q=${encodeURIComponent(query.trim())}`)
        if (active) { setResults(data); setSelected(0) }
      } catch {
        if (active) setResults({ groups: {} })
      } finally { if (active) setLoading(false) }
    }, 220)
    return () => { active = false; window.clearTimeout(id) }
  }, [open, query])

  if (!open) return null

  function remember(entry) {
    const fingerprint = entry.kind === 'nav' ? `nav:${entry.item[0]}` : `entity:${entry.group}:${entry.row?.id}`
    const label = entry.kind === 'nav' ? entry.item[1] : entry.row?.name || entry.row?.title || entry.row?.email || `${entry.group} #${entry.row?.id}`
    onHistory?.([{ fingerprint, label, entry }, ...history.filter(item => item.fingerprint !== fingerprint)].slice(0, 8))
  }

  function activate(entry) {
    if (!entry) return
    remember(entry)
    if (entry.kind === 'nav') navigateAdmin(entry.item[0])
    else {
      const type = normalizeEntityType(entry.group)
      if (type && entry.row?.id != null) onOpenEntity?.(type, entry.row.id)
      else navigateAdmin(groupToTab(entry.group))
    }
    onClose()
  }

  function toggleFavorite(entry, event) {
    event.preventDefault()
    event.stopPropagation()
    const fingerprint = entry.kind === 'nav' ? `nav:${entry.item[0]}` : `entity:${entry.group}:${entry.row?.id}`
    const exists = favorites.some(item => item.fingerprint === fingerprint)
    const label = entry.kind === 'nav' ? entry.item[1] : entry.row?.name || entry.row?.title || entry.row?.email || fingerprint
    onFavorites?.(exists ? favorites.filter(item => item.fingerprint !== fingerprint) : [...favorites, { fingerprint, label, entry }].slice(-12))
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(value => Math.min(Math.max(entries.length - 1, 0), value + 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(value => Math.max(0, value - 1)) }
    if (event.key === 'Enter') { event.preventDefault(); activate(entries[selected]) }
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
  }

  const favoriteFingerprints = new Set(favorites.map(item => item.fingerprint))

  return <div className="cp-overlay" role="dialog" aria-modal="true" aria-label="Central de comandos" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="cp-palette">
      <header><span>⌕</span><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="Navegar, localizar entidade ou executar comando…" /><kbd>ESC</kbd></header>
      <div className="cp-palette-body">
        {!query && !!favorites.length && <section><h4>Favoritos</h4>{favorites.slice(0, 6).map(item => <button type="button" key={item.fingerprint} onClick={() => activate(item.entry)}><span className="cp-entry-icon">★</span><span><b>{item.label}</b><small>Acesso favorito</small></span><span/><em>↵</em></button>)}</section>}
        {!query && !!history.length && <section><h4>Recentes</h4>{history.slice(0, 5).map(item => <button type="button" key={item.fingerprint} onClick={() => activate(item.entry)}><span className="cp-entry-icon">↺</span><span><b>{item.label}</b><small>Aberto recentemente</small></span><span/><em>↵</em></button>)}</section>}
        <section><h4>Navegação</h4>{navigation.map((item, index) => {
          const entry = { kind: 'nav', item }
          const fingerprint = `nav:${item[0]}`
          return <button type="button" className={selected === index ? 'selected' : ''} key={item[0]} onMouseEnter={() => setSelected(index)} onClick={() => activate(entry)}><span className="cp-entry-icon">{favoriteFingerprints.has(fingerprint) ? '★' : '◇'}</span><span><b>{item[1]}</b><small>{item[2]}</small></span><span role="button" className="cp-star" onClick={event => toggleFavorite(entry, event)} aria-label="Alternar favorito">☆</span><em>↵</em></button>
        })}</section>
        {query.trim().length >= 2 && <section><h4>Busca global {loading && <small>consultando…</small>}</h4>{!loading && !searchEntries.length && <p className="cp-empty">Nenhuma entidade encontrada.</p>}{searchEntries.map((entry, resultIndex) => {
          const index = navigation.length + resultIndex
          const row = entry.row
          const title = row.name || row.title || row.email || row.public_id || row.provider_payment_id || `#${row.id ?? resultIndex + 1}`
          const meta = Object.entries(row).filter(([key, value]) => !['name', 'title'].includes(key) && value != null).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
          const fingerprint = `entity:${entry.group}:${row.id}`
          return <button type="button" className={selected === index ? 'selected' : ''} key={fingerprint} onMouseEnter={() => setSelected(index)} onClick={() => activate(entry)}><span className="cp-entry-icon">{favoriteFingerprints.has(fingerprint) ? '★' : '⌁'}</span><span><b>{title}</b><small>{entry.group} · {meta}</small></span><span role="button" className="cp-star" onClick={event => toggleFavorite(entry, event)} aria-label="Alternar favorito">☆</span><em>→</em></button>
        })}</section>}
      </div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></footer>
    </section>
  </div>
}
