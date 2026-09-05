import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { connectMissionControlRealtime } from './missionControlRealtime.js'
import './ActivityCenter.css'

const EMPTY_FILTERS = {
  search: '', range: '24h', app_id: '', establishment_id: '', user_id: '', type: '',
  outcome: '', severity: '', source: '', environment: '', method: '', entity_type: '',
  session_key: '', correlation_id: '', request_id: '',
}

function toQuery(filters, page = 1) {
  const params = new URLSearchParams({ page: String(page), per_page: '50' })
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value))
  })
  return params.toString()
}

function compact(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number.isFinite(number) ? number : 0)
}

function when(value, withSeconds = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: withSeconds ? 'medium' : 'short' })
}

function duration(value) {
  const ms = Number(value)
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`
}

function actorName(user) {
  if (!user) return 'Visitante'
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.user_name || user.email || `Usuário #${user.id}`
}

function establishmentName(establishment) {
  return establishment?.fantasy || establishment?.name || null
}

function statusClass(row) {
  if (row?.severity === 'critical' || row?.outcome === 'error') return 'danger'
  if (['attention', 'suspicious'].includes(row?.severity) || ['pending', 'denied'].includes(row?.outcome)) return 'warning'
  return 'success'
}

function friendlyType(value) {
  return String(value || 'atividade').replace(/^frontend_/, '').replaceAll('_', ' ')
}

function initials(user) {
  return actorName(user).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'V'
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(rows) {
  const header = ['Data', 'Status', 'Atividade', 'Usuário', 'E-mail', 'Aplicação', 'Estabelecimento', 'Entidade', 'Rota', 'Método', 'Origem', 'Duração ms', 'Sessão', 'Request ID']
  const lines = rows.map(row => [
    when(row.created_at, true), row.outcome, row.name || row.type, actorName(row.user), row.user?.email,
    row.application?.name, establishmentName(row.establishment), `${row.entity?.type || ''} ${row.entity?.id || ''}`.trim(),
    row.route, row.method, row.source, row.duration_ms, row.session_key, row.request_id,
  ].map(escapeCsv).join(','))
  const blob = new Blob([`\uFEFF${header.map(escapeCsv).join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `peter-tecnet-atividades-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function MiniLine({ rows = [] }) {
  const max = Math.max(...rows.map(row => Number(row.total || 0)), 1)
  const points = rows.map((row, index) => {
    const x = rows.length <= 1 ? 50 : (index / (rows.length - 1)) * 100
    const y = 89 - (Number(row.total || 0) / max) * 72
    return `${x},${y}`
  }).join(' ')
  return <div className="ac-line-chart">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Volume de atividades no período">
      <line x1="0" y1="25" x2="100" y2="25"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="75" x2="100" y2="75"/>
      {points && <><polyline className="ac-area" points={`0,100 ${points} 100,100`}/><polyline className="ac-line" points={points}/></>}
    </svg>
    <div className="ac-chart-axis"><span>{rows[0]?.label || '—'}</span><b>{compact(max)} pico</b><span>{rows.at(-1)?.label || '—'}</span></div>
  </div>
}

function Metric({ label, value, detail, tone = '' }) {
  return <article className={`ac-metric ${tone}`}><span>{label}</span><b>{value}</b><small>{detail}</small></article>
}

function Select({ label, value, onChange, children }) {
  return <label className="ac-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}

function ActivityDrawer({ row, detail, loading, onClose }) {
  const activity = detail?.activity || row
  if (!activity) return null
  return <div className="ac-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="ac-drawer" role="dialog" aria-modal="true" aria-label="Detalhes da atividade">
      <header><div><p>ATIVIDADE #{activity.id}</p><h3>{activity.name || friendlyType(activity.type)}</h3></div><button onClick={onClose} aria-label="Fechar detalhes">×</button></header>
      {loading ? <div className="ac-drawer-loading">Carregando contexto completo…</div> : <>
        <div className="ac-detail-hero">
          <span className={`ac-state ${statusClass(activity)}`}>{activity.outcome || 'success'}</span>
          <b>{when(activity.created_at, true)}</b><small>{activity.severity || 'normal'} · {activity.environment || 'ambiente não informado'}</small>
        </div>
        <section className="ac-detail-grid">
          <div><span>Usuário</span><b>{actorName(activity.user)}</b><small>{activity.user?.email || 'Sessão anônima'}</small></div>
          <div><span>Aplicação</span><b>{activity.application?.name || 'Não identificada'}</b><small>{activity.application?.slug || '—'}</small></div>
          <div><span>Estabelecimento</span><b>{establishmentName(activity.establishment) || 'Não vinculado'}</b><small>{activity.establishment ? `#${activity.establishment.id} · ${activity.establishment.city || ''}${activity.establishment.uf ? `/${activity.establishment.uf}` : ''}` : '—'}</small></div>
          <div><span>Objeto</span><b>{activity.entity?.name || activity.entity?.type || 'Não informado'}</b><small>{activity.entity?.id ? `${activity.entity?.type || 'Entidade'} #${activity.entity.id}` : '—'}</small></div>
          <div><span>Dispositivo</span><b>{activity.device?.label || 'Não identificado'}</b><small>{activity.source || '—'}</small></div>
          <div><span>Desempenho</span><b>{duration(activity.duration_ms)}</b><small>HTTP {activity.http_status || '—'}</small></div>
        </section>
        <section className="ac-technical"><h4>Rastreamento técnico</h4>
          <dl><div><dt>Rota</dt><dd>{activity.method || '—'} {activity.route || activity.page || '—'}</dd></div><div><dt>Página</dt><dd>{activity.page || '—'}</dd></div><div><dt>Origem</dt><dd>{activity.origin || activity.referer || '—'}</dd></div><div><dt>Sessão</dt><dd>{activity.session_key || '—'}</dd></div><div><dt>Correlação</dt><dd>{activity.correlation_id || '—'}</dd></div><div><dt>Request</dt><dd>{activity.request_id || '—'}</dd></div><div><dt>Rede</dt><dd>{activity.network_fingerprint ? `${activity.network_fingerprint.slice(0, 18)}…` : '—'}</dd></div></dl>
        </section>
        {activity.content && <section className="ac-metadata"><h4>Contexto sanitizado</h4><pre>{JSON.stringify(activity.content, null, 2)}</pre></section>}
        <section className="ac-related"><h4>Mesma sessão / correlação <span>{detail?.related?.length || 0}</span></h4>
          {detail?.related?.length ? detail.related.map(item => <button key={item.id} type="button"><span className={`ac-dot ${statusClass(item)}`}/><div><b>{item.name || friendlyType(item.type)}</b><small>{when(item.created_at, true)} · {item.application?.name || 'Ecossistema'}</small></div></button>) : <p>Nenhuma atividade relacionada encontrada.</p>}
        </section>
      </>}
    </aside>
  </div>
}

export default function ActivityCenter({ request, tokenKey = 'petertecnet_admin_token' }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [overview, setOverview] = useState(null)
  const [facets, setFacets] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [live, setLive] = useState(true)
  const [realtime, setRealtime] = useState('connecting')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const realtimeRefresh = useRef(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 320)
    return () => window.clearTimeout(timer)
  }, [filters.search])

  const effectiveFilters = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch])

  const load = useCallback(async ({ quiet = false } = {}) => {
    quiet ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const query = toQuery(effectiveFilters, page)
      const overviewQuery = toQuery(effectiveFilters, 1).replace(/(^|&)page=1(&|$)/, '$1').replace(/(^|&)per_page=50(&|$)/, '$1')
      const [listResult, overviewResult] = await Promise.all([
        request(`/admin/ecosystem/activities?${query}`),
        request(`/admin/ecosystem/activities/overview?${overviewQuery}`),
      ])
      setData(listResult)
      setOverview(overviewResult)
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as atividades.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [effectiveFilters, page, request])

  useEffect(() => {
    request('/admin/ecosystem/activities/facets').then(setFacets).catch(() => {})
  }, [request])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const disconnect = connectMissionControlRealtime({
      token: () => localStorage.getItem(tokenKey),
      events: ['ecosystem.updated'],
      onState: setRealtime,
      onUpdate: payload => {
        if (!live) return
        const modules = Array.isArray(payload?.modules) ? payload.modules : []
        if (modules.length && !modules.includes('activity')) return
        window.clearTimeout(realtimeRefresh.current)
        realtimeRefresh.current = window.setTimeout(() => load({ quiet: true }), 500)
      },
    })
    return () => { window.clearTimeout(realtimeRefresh.current); disconnect?.() }
  }, [live, load, tokenKey])

  useEffect(() => {
    if (!live) return undefined
    const interval = window.setInterval(() => load({ quiet: true }), 30000)
    return () => window.clearInterval(interval)
  }, [live, load])

  useEffect(() => {
    if (!selected?.id) { setDetail(null); return }
    setDetailLoading(true)
    request(`/admin/ecosystem/activities/${selected.id}`)
      .then(setDetail)
      .catch(() => setDetail({ activity: selected, related: [] }))
      .finally(() => setDetailLoading(false))
  }, [selected, request])

  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])

  function change(key, value) {
    setPage(1)
    setFilters(current => ({ ...current, [key]: value }))
  }

  function reset() {
    setPage(1)
    setFilters(EMPTY_FILTERS)
  }

  const summary = overview?.summary || data?.summary || {}
  const health = overview?.health || { label: 'Calculando', status: 'degraded', score: 0 }
  const rows = data?.activity || []
  const pagination = data?.pagination || {}
  const hasFilters = Object.entries(filters).some(([key, value]) => value && !(key === 'range' && value === '24h'))

  return <div className="activity-center">
    <div className="ac-commandbar">
      <div className="ac-live-status"><span className={`ac-live-dot ${live ? realtime : 'paused'}`}/><div><b>{live ? (realtime === 'connected' ? 'Ao vivo' : 'Sincronização ativa') : 'Atualização pausada'}</b><small>{overview?.generated_at ? `Atualizado ${when(overview.generated_at, true)}` : 'Conectando à telemetria'}</small></div></div>
      <div className="ac-command-actions"><button className={live ? 'active' : ''} onClick={() => setLive(value => !value)}>{live ? 'Pausar ao vivo' : 'Ativar ao vivo'}</button><button onClick={() => load({ quiet: true })}>{refreshing ? 'Atualizando…' : 'Atualizar'}</button><button onClick={() => downloadCsv(rows)} disabled={!rows.length}>Exportar CSV</button></div>
    </div>

    <div className="ac-health-strip">
      <div className={`ac-health-score ${health.status}`}><span>ECOSYSTEM PULSE</span><b>{health.score ?? 0}</b><small>{health.label}</small></div>
      <Metric label="Atividades" value={compact(summary.total)} detail="no período selecionado"/>
      <Metric label="Usuários ativos" value={compact(summary.users)} detail={`${compact(summary.anonymous)} ações anônimas`}/>
      <Metric label="Aplicações" value={compact(summary.applications)} detail={`${compact(summary.sessions)} sessões observadas`}/>
      <Metric label="Estabelecimentos" value={compact(summary.establishments)} detail="identificados na amostra"/>
      <Metric label="Falhas" value={compact(summary.errors)} detail={`${Number(summary.error_rate || 0).toFixed(2)}% de erro`} tone={Number(summary.error_rate) >= 3 ? 'danger' : ''}/>
      <Metric label="Latência p95" value={duration(summary.p95_duration_ms)} detail={`média ${duration(summary.avg_duration_ms)}`}/>
    </div>

    <section className="ac-filters">
      <label className="ac-search"><span>⌕</span><input value={filters.search} onChange={event => change('search', event.target.value)} placeholder="Buscar usuário, e-mail, ação, rota, request ou aplicação…"/></label>
      <Select label="Período" value={filters.range} onChange={value => change('range', value)}>{(facets?.ranges || [{ value: '24h', label: 'Últimas 24 horas' }]).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
      <Select label="Aplicação" value={filters.app_id} onChange={value => change('app_id', value)}><option value="">Todas</option>{(facets?.applications || []).map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</Select>
      <Select label="Estabelecimento" value={filters.establishment_id} onChange={value => change('establishment_id', value)}><option value="">Todos</option>{(facets?.establishments || []).map(establishment => <option key={establishment.id} value={establishment.id}>{establishment.fantasy || establishment.name}</option>)}</Select>
      <Select label="Resultado" value={filters.outcome} onChange={value => change('outcome', value)}><option value="">Todos</option>{(facets?.outcomes || []).map(value => <option key={value} value={value}>{value}</option>)}</Select>
      <button className="ac-advanced-toggle" onClick={() => setAdvanced(value => !value)}>{advanced ? 'Menos filtros' : 'Filtros avançados'} <span>{advanced ? '−' : '+'}</span></button>
      {hasFilters && <button className="ac-reset" onClick={reset}>Limpar filtros</button>}
      {advanced && <div className="ac-advanced-grid">
        <Select label="Usuário" value={filters.user_id} onChange={value => change('user_id', value)}><option value="">Todos</option>{(facets?.users || []).map(user => <option key={user.id} value={user.id}>{actorName(user)} · {user.email}</option>)}</Select>
        <Select label="Tipo de atividade" value={filters.type} onChange={value => change('type', value)}><option value="">Todos</option>{(facets?.types || []).map(value => <option key={value} value={value}>{friendlyType(value)}</option>)}</Select>
        <Select label="Severidade" value={filters.severity} onChange={value => change('severity', value)}><option value="">Todas</option>{(facets?.severities || []).map(value => <option key={value} value={value}>{value}</option>)}</Select>
        <Select label="Origem" value={filters.source} onChange={value => change('source', value)}><option value="">Todas</option>{(facets?.sources || []).map(value => <option key={value} value={value}>{value}</option>)}</Select>
        <Select label="Método" value={filters.method} onChange={value => change('method', value)}><option value="">Todos</option>{(facets?.methods || []).map(value => <option key={value} value={value}>{value}</option>)}</Select>
        <Select label="Entidade" value={filters.entity_type} onChange={value => change('entity_type', value)}><option value="">Todas</option>{(facets?.entity_types || []).map(value => <option key={value} value={value}>{value}</option>)}</Select>
        <label className="ac-field"><span>Sessão</span><input value={filters.session_key} onChange={event => change('session_key', event.target.value)} placeholder="session key"/></label>
        <label className="ac-field"><span>Correlação</span><input value={filters.correlation_id} onChange={event => change('correlation_id', event.target.value)} placeholder="correlation id"/></label>
        <label className="ac-field"><span>Request</span><input value={filters.request_id} onChange={event => change('request_id', event.target.value)} placeholder="request id"/></label>
      </div>}
    </section>

    {error && <div className="ac-error">{error}<button onClick={() => load()}>Tentar novamente</button></div>}

    <div className="ac-analytics">
      <article className="ac-panel ac-volume"><header><div><span>VOLUME OPERACIONAL</span><h3>Movimento do ecossistema</h3></div><small>{overview?.window ? `${when(overview.window.from)} → ${when(overview.window.to)}` : '—'}</small></header><MiniLine rows={overview?.timeline || []}/></article>
      <article className="ac-panel"><header><div><span>APLICAÇÕES</span><h3>Mais movimentadas</h3></div></header><div className="ac-ranking">{(overview?.top_applications || []).slice(0, 6).map((row, index) => <div key={row.application?.id || index}><i>{String(index + 1).padStart(2, '0')}</i><div><b>{row.application?.name || 'Aplicação'}</b><small>{compact(row.users)} usuários · {compact(row.errors)} falhas</small></div><strong>{compact(row.total)}</strong></div>)}</div></article>
      <article className="ac-panel"><header><div><span>AÇÕES</span><h3>Principais atividades</h3></div></header><div className="ac-ranking">{(overview?.top_types || []).slice(0, 6).map((row, index) => <div key={row.type || index}><i>{String(index + 1).padStart(2, '0')}</i><div><b>{friendlyType(row.type)}</b><small>{compact(row.errors)} falhas</small></div><strong>{compact(row.total)}</strong></div>)}</div></article>
    </div>

    <article className="ac-feed">
      <header><div><span>FEED OPERACIONAL</span><h3>Tudo que está acontecendo</h3><p>Usuários, aplicações, estabelecimentos, recursos e sinais técnicos em uma única linha do tempo.</p></div><b>{compact(data?.pagination?.total)} registros</b></header>
      <div className="ac-table-wrap"><table><thead><tr><th>Horário</th><th>Status</th><th>Atividade</th><th>Usuário</th><th>Aplicação</th><th>Estabelecimento / recurso</th><th>Origem</th><th>Duração</th><th/></tr></thead><tbody>
        {loading ? Array.from({ length: 8 }, (_, index) => <tr className="ac-loading-row" key={index}><td colSpan="9"><span/></td></tr>) : rows.length ? rows.map(row => <tr key={row.id} onClick={() => setSelected(row)} tabIndex="0" onKeyDown={event => { if (event.key === 'Enter') setSelected(row) }}>
          <td><time>{when(row.created_at, true)}</time></td><td><span className={`ac-state ${statusClass(row)}`}>{row.outcome || 'success'}</span></td><td><div className="ac-action"><b>{row.name || friendlyType(row.type)}</b><small>{row.method ? `${row.method} ` : ''}{row.page || row.route || friendlyType(row.type)}</small></div></td>
          <td><div className="ac-user"><span>{initials(row.user)}</span><div><b>{actorName(row.user)}</b><small>{row.user?.email || 'Não autenticado'}</small></div></div></td>
          <td><div className="ac-app"><b>{row.application?.name || '—'}</b><small>{row.application?.slug || row.environment || '—'}</small></div></td>
          <td><div className="ac-resource"><b>{establishmentName(row.establishment) || row.entity?.name || '—'}</b><small>{row.establishment ? `Estabelecimento #${row.establishment.id}` : row.entity?.id ? `${row.entity.type || 'Entidade'} #${row.entity.id}` : 'Sem vínculo'}</small></div></td>
          <td><span className="ac-source">{row.source || 'domain'}</span></td><td><span className={Number(row.duration_ms) > 2000 ? 'ac-slow' : ''}>{duration(row.duration_ms)}</span></td><td><button type="button" aria-label={`Ver atividade ${row.id}`}>›</button></td>
        </tr>) : <tr><td colSpan="9"><div className="ac-empty"><b>Nenhuma atividade encontrada</b><span>Ajuste os filtros ou aguarde novos eventos do ecossistema.</span></div></td></tr>}
      </tbody></table></div>
      <footer><span>Página {pagination.current_page || 1} de {pagination.last_page || 1}</span><div><button disabled={(pagination.current_page || 1) <= 1} onClick={() => setPage(value => Math.max(value - 1, 1))}>← Anterior</button><button disabled={!pagination.has_more} onClick={() => setPage(value => value + 1)}>Próxima →</button></div></footer>
    </article>

    <div className="ac-bottom-grid">
      <article className="ac-panel"><header><div><span>USUÁRIOS</span><h3>Mais ativos</h3></div></header><div className="ac-people">{(overview?.top_users || []).slice(0, 7).map((row, index) => <div key={row.user?.id || index}><span>{initials(row.user)}</span><div><b>{actorName(row.user)}</b><small>{row.user?.email || '—'} · {when(row.last_activity_at)}</small></div><strong>{compact(row.total)}</strong></div>)}</div></article>
      <article className="ac-panel"><header><div><span>ESTABELECIMENTOS</span><h3>Mais movimentados</h3></div></header><div className="ac-people">{(overview?.top_establishments || []).slice(0, 7).map((row, index) => <div key={row.establishment?.id || index}><span>⌂</span><div><b>{establishmentName(row.establishment)}</b><small>{row.establishment?.city || '—'}{row.establishment?.uf ? `/${row.establishment.uf}` : ''} · {compact(row.users)} usuários</small></div><strong>{compact(row.total)}</strong></div>)}</div></article>
      <article className="ac-panel ac-errors"><header><div><span>SINAIS DE FALHA</span><h3>Erros recentes</h3></div></header><div>{(overview?.latest_errors || []).length ? overview.latest_errors.map(row => <button key={row.id} onClick={() => setSelected(row)}><span className="ac-dot danger"/><div><b>{row.name || friendlyType(row.type)}</b><small>{row.application?.name || 'Ecossistema'} · {when(row.created_at, true)}</small></div><strong>#{row.id}</strong></button>) : <div className="ac-empty compact"><b>Nenhuma falha no período</b><span>O recorte atual não retornou erros.</span></div>}</div></article>
    </div>

    <ActivityDrawer row={selected} detail={detail} loading={detailLoading} onClose={() => setSelected(null)}/>
  </div>
}
