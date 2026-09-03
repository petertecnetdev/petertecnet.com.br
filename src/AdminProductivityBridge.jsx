import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ADMIN_TABS, ADMIN_TAB_BY_KEY } from './admin/AdminNavigationConfig.js'
import { useAdminUi } from './admin/AdminUiContext.jsx'

const API = 'https://api.petertecnet.com.br/api'
const PREFS_KEY = 'petertecnet_admin_dashboard_preferences_v1'
const NAV_ITEMS = ADMIN_TABS

const SEARCH_DESTINATIONS = {
  users: 'users', user: 'users', usuarios: 'users',
  establishments: 'establishments', establishment: 'establishments', estabelecimentos: 'establishments',
  applications: 'applications', application: 'applications', aplicacoes: 'applications',
  items: 'items', item: 'items', itens: 'items',
  payments: 'financial', payment: 'financial', pagamentos: 'financial',
  orders: 'financial', order: 'financial', pedidos: 'financial',
  audit: 'audit', activity: 'activity', interactions: 'activity',
}

const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const getToken = () => localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token')
const itemFor = key => ADMIN_TAB_BY_KEY[key] || ADMIN_TABS[0]

async function api(path) {
  const token = getToken()
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || 'Não foi possível consultar o ecossistema.')
  return data
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function exportTable(table, filename = 'admin-export.csv') {
  if (!table) return false
  const rows = [...table.querySelectorAll('tr')]
    .filter(row => row.style.display !== 'none')
    .map(row => [...row.children].filter(cell => cell.style.display !== 'none').map(cell => cell.innerText.trim()))
  if (!rows.length) return false
  downloadCsv(filename, rows)
  return true
}

function HealthBadge({ target, health }) {
  if (!target) return null
  return createPortal(
    <span className={`admin-health-badge ${health.tone}`} title={health.detail} aria-label={`Estado do ecossistema: ${health.label}`}>
      <i />
      <span>{health.label}</span>
      {Number.isFinite(health.score) && <b>{health.score}</b>}
    </span>,
    target,
  )
}

function Breadcrumbs({ target, activeTab, heading }) {
  if (!target) return null
  const item = itemFor(activeTab)
  const detail = normalizeText(heading).includes('detalhes') ? 'Detalhes' : null
  return createPortal(
    <nav className="admin-breadcrumbs" aria-label="Navegação estrutural">
      <button type="button" data-bridge-nav="command">Admin Center</button>
      <span>/</span>
      <button type="button" data-bridge-nav={activeTab}>{item.group}</button>
      <span>/</span>
      <strong>{item.label}</strong>
      {detail && <><span>/</span><strong>{detail}</strong></>}
    </nav>,
    target,
  )
}

function ContextActions({ target, activeTab, onPalette, onCustomize }) {
  if (!target) return null

  function scrollToForm() {
    const panel = document.querySelector('.ecosystem-main .admin-panel form')
    panel?.closest('.admin-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => panel?.querySelector('input,select,textarea')?.focus(), 350)
  }

  function scrollToFilters() {
    const form = document.querySelector('.ecosystem-main .filter-grid')
    form?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => form?.querySelector('input,select')?.focus(), 350)
  }

  const formAction = {
    users: 'Novo usuário',
    applications: 'Nova aplicação',
    establishments: 'Novo estabelecimento',
  }[activeTab]

  const table = document.querySelector('.ecosystem-main .table-wrap table, .ecosystem-main .cc-table-wrap table, .ecosystem-main .finance-table-wrap table')

  return createPortal(
    <>
      {activeTab === 'dashboard' && <button type="button" className="admin-context-button" onClick={onCustomize}>Personalizar</button>}
      {activeTab === 'activity' && <button type="button" className="admin-context-button" onClick={scrollToFilters}>Filtros</button>}
      {formAction && <button type="button" className="admin-context-button primary-lite" onClick={scrollToForm}>{formAction}</button>}
      {table && <button type="button" className="admin-context-button" onClick={() => exportTable(table, `petertecnet-${activeTab}.csv`)}>Exportar CSV</button>}
      <button type="button" className="admin-command-trigger" onClick={onPalette} aria-label="Abrir busca e comandos"><span>⌕</span> Buscar <kbd>Ctrl K</kbd></button>
    </>,
    target,
  )
}

function CommandPalette({ open, query, setQuery, results, loading, onClose, onNavigate }) {
  const inputRef = useRef(null)
  const normalized = normalizeText(query)
  const commands = NAV_ITEMS.filter(item => !normalized || normalizeText(`${item.label} ${item.group}`).includes(normalized))
  const groups = Object.entries(results?.groups || {}).filter(([, rows]) => Array.isArray(rows) && rows.length)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(id)
  }, [open])

  if (!open) return null

  function destinationFor(group) {
    const normalizedGroup = normalizeText(group).replace(/\s+/g, '_')
    return SEARCH_DESTINATIONS[normalizedGroup] || Object.entries(SEARCH_DESTINATIONS).find(([key]) => normalizedGroup.includes(key))?.[1] || 'command'
  }

  return <div className="admin-command-overlay" role="dialog" aria-modal="true" aria-label="Busca e comandos" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="admin-command-palette">
      <header>
        <span className="admin-command-search-icon">⌕</span>
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Ir para seção ou buscar qualquer entidade do ecossistema..." />
        <kbd>Esc</kbd>
      </header>
      <div className="admin-command-results">
        <div className="admin-command-section-title">Navegação</div>
        {commands.map(item => <button type="button" key={item.key} onClick={() => { onNavigate(item.key); onClose() }}>
          <i>{item.icon}</i><span><b>{item.label}</b><small>{item.group} · {item.path}</small></span><em>↵</em>
        </button>)}
        {query.trim().length >= 2 && <>
          <div className="admin-command-section-title">Busca global {loading && <small>consultando…</small>}</div>
          {!loading && !groups.length && <div className="admin-command-empty">Nenhum resultado operacional encontrado.</div>}
          {groups.map(([group, rows]) => <div className="admin-command-group" key={group}>
            <h4>{group}</h4>
            {rows.slice(0, 8).map((row, index) => {
              const title = row.name || row.title || row.email || row.public_id || row.provider_payment_id || `#${row.id ?? index + 1}`
              const meta = Object.entries(row).filter(([key, value]) => !['name', 'title'].includes(key) && value != null).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
              return <button type="button" key={`${group}-${row.id ?? index}`} onClick={() => { onNavigate(destinationFor(group)); onClose() }}>
                <i>⌁</i><span><b>{title}</b><small>{meta}</small></span><em>→</em>
              </button>
            })}
          </div>)}
        </>}
      </div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></footer>
    </section>
  </div>
}

function DashboardCustomizer({ open, prefs, setPrefs, labels, onClose }) {
  if (!open) return null
  const ordered = prefs.order?.length ? prefs.order : labels
  const hidden = new Set(prefs.hidden || [])

  function move(label, direction) {
    const next = [...ordered]
    const index = next.indexOf(label)
    const target = index + direction
    if (index < 0 || target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setPrefs({ ...prefs, order: next })
  }

  function toggle(label) {
    const next = new Set(hidden)
    next.has(label) ? next.delete(label) : next.add(label)
    setPrefs({ ...prefs, hidden: [...next] })
  }

  return <div className="admin-customize-overlay" role="dialog" aria-modal="true" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="admin-customize-panel">
      <header><div><p>WORKSPACE</p><h3>Personalizar visão geral</h3><span>Escolha os indicadores visíveis e a ordem do seu painel.</span></div><button type="button" onClick={onClose}>×</button></header>
      <div className="admin-customize-list">
        {ordered.map(label => <article key={label} className={hidden.has(label) ? 'hidden-card' : ''}>
          <label><input type="checkbox" checked={!hidden.has(label)} onChange={() => toggle(label)} /><span><b>{label}</b><small>{hidden.has(label) ? 'Oculto' : 'Visível no dashboard'}</small></span></label>
          <div><button type="button" onClick={() => move(label, -1)} aria-label={`Mover ${label} para cima`}>↑</button><button type="button" onClick={() => move(label, 1)} aria-label={`Mover ${label} para baixo`}>↓</button></div>
        </article>)}
      </div>
      <footer><button type="button" onClick={() => setPrefs({ order: labels, hidden: [] })}>Restaurar padrão</button><button type="button" className="primary" onClick={onClose}>Concluir</button></footer>
    </section>
  </div>
}

function TableToolbar({ table, activeTab, index }) {
  const [query, setQuery] = useState('')
  const [compact, setCompact] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const headers = [...table.querySelectorAll('thead th')].map((header, column) => ({ column, label: header.innerText.trim() || `Coluna ${column + 1}` }))
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set())

  useEffect(() => {
    const rows = [...table.querySelectorAll('tbody tr')]
    const needle = normalizeText(query)
    rows.forEach(row => { row.style.display = !needle || normalizeText(row.innerText).includes(needle) ? '' : 'none' })
  }, [query, table])

  useEffect(() => {
    table.classList.toggle('admin-table-compact', compact)
    return () => table.classList.remove('admin-table-compact')
  }, [compact, table])

  useEffect(() => {
    const allRows = [...table.querySelectorAll('tr')]
    allRows.forEach(row => [...row.children].forEach((cell, column) => { cell.style.display = hiddenColumns.has(column) ? 'none' : '' }))
  }, [hiddenColumns, table])

  useEffect(() => {
    const cleanups = headers.map(({ column }) => {
      const header = table.querySelectorAll('thead th')[column]
      if (!header) return () => {}
      header.classList.add('admin-sortable-column')
      header.tabIndex = 0
      const sort = () => {
        const body = table.tBodies[0]
        if (!body) return
        const direction = header.dataset.sortDirection === 'asc' ? 'desc' : 'asc'
        table.querySelectorAll('thead th').forEach(item => delete item.dataset.sortDirection)
        header.dataset.sortDirection = direction
        const rows = [...body.rows]
        rows.sort((a, b) => {
          const av = a.cells[column]?.innerText.trim() || ''
          const bv = b.cells[column]?.innerText.trim() || ''
          const an = Number(av.replace(/[^\d,.-]/g, '').replace(',', '.'))
          const bn = Number(bv.replace(/[^\d,.-]/g, '').replace(',', '.'))
          const result = Number.isFinite(an) && Number.isFinite(bn) && av.match(/\d/) && bv.match(/\d/) ? an - bn : av.localeCompare(bv, 'pt-BR', { numeric: true })
          return direction === 'asc' ? result : -result
        })
        rows.forEach(row => body.appendChild(row))
      }
      const onKey = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); sort() } }
      header.addEventListener('click', sort)
      header.addEventListener('keydown', onKey)
      return () => { header.removeEventListener('click', sort); header.removeEventListener('keydown', onKey); header.classList.remove('admin-sortable-column'); header.removeAttribute('tabindex'); delete header.dataset.sortDirection }
    })
    return () => cleanups.forEach(cleanup => cleanup())
  }, [table])

  function toggleColumn(column) {
    const next = new Set(hiddenColumns)
    next.has(column) ? next.delete(column) : next.add(column)
    setHiddenColumns(next)
  }

  return <div className="admin-table-toolbar">
    <div className="admin-table-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filtrar linhas desta tabela..." /></div>
    <div className="admin-table-toolbar-actions">
      <button type="button" onClick={() => setCompact(value => !value)}>{compact ? 'Confortável' : 'Compacta'}</button>
      {!!headers.length && <div className="admin-columns-control"><button type="button" onClick={() => setColumnsOpen(value => !value)}>Colunas</button>{columnsOpen && <div>{headers.map(header => <label key={header.column}><input type="checkbox" checked={!hiddenColumns.has(header.column)} onChange={() => toggleColumn(header.column)} /><span>{header.label}</span></label>)}</div>}</div>}
      <button type="button" onClick={() => exportTable(table, `petertecnet-${activeTab}-${index + 1}.csv`)}>CSV</button>
    </div>
  </div>
}

function TableEnhancers({ activeTab }) {
  const [tables, setTables] = useState([])

  useEffect(() => {
    let scheduled = 0
    const scan = () => {
      window.clearTimeout(scheduled)
      scheduled = window.setTimeout(() => {
        const next = [...document.querySelectorAll('.ecosystem-main .table-wrap table, .ecosystem-main .cc-table-wrap table, .ecosystem-main .finance-table-wrap table')]
        setTables(current => current.length === next.length && current.every((table, index) => table === next[index]) ? current : next)
      }, 30)
    }
    scan()
    const observer = new MutationObserver(scan)
    const root = document.querySelector('.ecosystem-main')
    if (root) observer.observe(root, { childList: true, subtree: true })
    return () => { observer.disconnect(); window.clearTimeout(scheduled) }
  }, [activeTab])

  return <>{tables.map((table, index) => {
    const host = table.closest('.table-wrap, .cc-table-wrap, .finance-table-wrap')
    return host ? createPortal(<TableToolbar key={`${activeTab}-${index}`} table={table} activeTab={activeTab} index={index} />, host) : null
  })}</>
}

export default function AdminProductivityBridge() {
  const { activeTab, navigate } = useAdminUi()
  const [heading, setHeading] = useState('')
  const [brandTarget, setBrandTarget] = useState(null)
  const [headingTarget, setHeadingTarget] = useState(null)
  const [actionsTarget, setActionsTarget] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [metricLabels, setMetricLabels] = useState([])
  const [health, setHealth] = useState({ label: 'Verificando', tone: 'checking', score: null, detail: 'Consultando telemetria operacional.' })
  const [prefs, setPrefsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || { order: [], hidden: [] } } catch { return { order: [], hidden: [] } }
  })

  function setPrefs(next) {
    setPrefsState(next)
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  }

  useEffect(() => {
    let attempts = 0
    let retryId = 0
    const syncTargets = () => {
      attempts += 1
      const brand = document.querySelector('.ecosystem-brand')
      const titleContainer = document.querySelector('.ecosystem-top > div:first-child')
      const actions = document.querySelector('.ecosystem-top .top-actions')
      const title = document.querySelector('.ecosystem-top h1')
      if (brand) setBrandTarget(current => current?.isConnected ? current : brand)
      if (titleContainer) setHeadingTarget(current => current?.isConnected ? current : titleContainer)
      if (actions) setActionsTarget(current => current?.isConnected ? current : actions)
      if (title) {
        const value = title.textContent.trim()
        setHeading(current => current === value ? current : value)
      }
      if ((!brand || !titleContainer || !actions) && attempts < 20) retryId = window.setTimeout(syncTargets, 80)
    }
    syncTargets()

    const observer = new MutationObserver(syncTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); window.clearTimeout(retryId) }
  }, [])

  useEffect(() => {
    const onClick = event => {
      const command = event.target.closest('[data-bridge-nav]')
      if (command) navigate(command.dataset.bridgeNav)
    }
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true) }
      if (event.key === 'Escape') { setPaletteOpen(false); setCustomizeOpen(false) }
    }
    document.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey) }
  }, [navigate])

  useEffect(() => {
    let active = true
    async function refreshHealth() {
      try {
        const overview = await api('/admin/ecosystem/command/overview')
        if (!active) return
        const score = Number(overview?.score)
        const down = Number(overview?.summary?.down || 0)
        const degraded = Number(overview?.summary?.degraded || 0)
        if (down > 0 || score < 70) setHealth({ label: 'Crítico', tone: 'critical', score: Number.isFinite(score) ? score : null, detail: `${down} aplicação(ões) fora · ${degraded} degradada(s).` })
        else if (degraded > 0 || score < 90) setHealth({ label: 'Atenção', tone: 'warning', score: Number.isFinite(score) ? score : null, detail: `${degraded} aplicação(ões) degradada(s).` })
        else setHealth({ label: 'Operacional', tone: 'healthy', score: Number.isFinite(score) ? score : null, detail: 'Telemetria do ecossistema dentro dos parâmetros operacionais.' })
      } catch (error) {
        if (active) setHealth({ label: 'Indisponível', tone: 'critical', score: null, detail: error.message })
      }
    }
    refreshHealth()
    const id = window.setInterval(refreshHealth, 30000)
    return () => { active = false; window.clearInterval(id) }
  }, [])

  useEffect(() => {
    if (!paletteOpen || paletteQuery.trim().length < 2) { setSearchResults(null); setSearchLoading(false); return }
    let active = true
    setSearchLoading(true)
    const id = window.setTimeout(async () => {
      try {
        const result = await api(`/admin/ecosystem/command/search?q=${encodeURIComponent(paletteQuery.trim())}`)
        if (active) setSearchResults(result)
      } catch {
        if (active) setSearchResults({ groups: {} })
      } finally { if (active) setSearchLoading(false) }
    }, 260)
    return () => { active = false; window.clearTimeout(id) }
  }, [paletteOpen, paletteQuery])

  useEffect(() => {
    if (activeTab !== 'dashboard') return
    const apply = () => {
      const grid = document.querySelector('.ecosystem-main .metric-grid')
      if (!grid) return
      const cards = [...grid.querySelectorAll(':scope > .metric-card')]
      const labels = cards.map(card => card.querySelector('span')?.textContent.trim()).filter(Boolean)
      if (labels.length) setMetricLabels(current => current.join('|') === labels.join('|') ? current : labels)
      const order = prefs.order?.length ? prefs.order : labels
      const hidden = new Set(prefs.hidden || [])
      cards.forEach(card => {
        const label = card.querySelector('span')?.textContent.trim()
        const index = order.indexOf(label)
        card.style.order = String(index >= 0 ? index : order.length)
        card.style.display = hidden.has(label) ? 'none' : ''
      })
    }
    apply()
    const id = window.setTimeout(apply, 180)
    return () => window.clearTimeout(id)
  }, [activeTab, prefs])

  return <>
    <HealthBadge target={brandTarget} health={health} />
    <Breadcrumbs target={headingTarget} activeTab={activeTab} heading={heading} />
    <ContextActions target={actionsTarget} activeTab={activeTab} onPalette={() => setPaletteOpen(true)} onCustomize={() => setCustomizeOpen(true)} />
    <TableEnhancers activeTab={activeTab} />
    <CommandPalette open={paletteOpen} query={paletteQuery} setQuery={setPaletteQuery} results={searchResults} loading={searchLoading} onClose={() => setPaletteOpen(false)} onNavigate={navigate} />
    <DashboardCustomizer open={customizeOpen} prefs={prefs} setPrefs={setPrefs} labels={metricLabels} onClose={() => setCustomizeOpen(false)} />
  </>
}
