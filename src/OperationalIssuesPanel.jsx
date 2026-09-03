import { useMemo, useState } from 'react'
import './OperationalIssuesPanel.css'

const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const label = value => String(value || '—').replaceAll('_', ' ')

const STATUS_LABELS = {
  new: 'Novo', acknowledged: 'Reconhecido', investigating: 'Investigando', fixed: 'Corrigido',
  monitoring: 'Monitorando', resolved: 'Resolvido', ignored: 'Ignorado', expected: 'Esperado',
}

const CATEGORY_LABELS = {
  authentication: 'Autenticação', authorization: 'Autorização', validation: 'Validação', rate_limit: 'Rate limit',
  business_rule: 'Regra de negócio', database: 'Banco de dados', timeout: 'Timeout', dependency: 'Dependência externa',
  server_exception: 'Exceção do servidor', access_control: 'Controle de acesso', application_error: 'Erro da aplicação',
  security: 'Segurança', operational: 'Operacional',
}

function trendText(trend) {
  if (!trend) return 'sem tendência'
  if (trend.direction === 'new') return `novo · ${trend.current_24h} nas últimas 24h`
  if (trend.direction === 'up') return `↑ ${Math.abs(trend.change_percent || 0)}% vs. período anterior`
  if (trend.direction === 'down') return `↓ ${Math.abs(trend.change_percent || 0)}% vs. período anterior`
  return `estável · ${trend.current_24h || 0} nas últimas 24h`
}

function issueDiagnostic(issue) {
  return [
    `Problema: ${issue.fingerprint}`,
    `Prioridade: ${issue.priority} · impacto ${issue.impact_score}/100`,
    `Status: ${STATUS_LABELS[issue.status] || issue.status}`,
    `Severidade: ${issue.severity}`,
    `Categoria: ${CATEGORY_LABELS[issue.category] || issue.category}`,
    `Domínio: ${issue.domain || 'platform'}`,
    `Ocorrências: ${issue.occurrence_count}`,
    `Usuários afetados: ${issue.users_affected_count}`,
    `Aplicações afetadas: ${issue.applications_affected_count}`,
    `Primeira ocorrência: ${fmt(issue.first_seen_at)}`,
    `Última ocorrência: ${fmt(issue.last_seen_at)}`,
    `HTTP: ${issue.latest_http_status || '—'}`,
    `Código: ${issue.latest_error_code || '—'}`,
    `Rota: ${[issue.latest_method, issue.latest_route].filter(Boolean).join(' ') || '—'}`,
    `Mensagem: ${issue.latest_message || issue.title || '—'}`,
    `Versão: ${issue.source_version || '—'}`,
    `Commit: ${issue.source_commit || '—'}`,
    `Regressões: ${issue.regression_count || 0}`,
  ].join('\n')
}

export default function OperationalIssuesPanel({ issues, onRefresh, onUpdate, onCreateIncident, fetchDetails }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [priority, setPriority] = useState('all')
  const [category, setCategory] = useState('all')
  const [domain, setDomain] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [details, setDetails] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const rows = issues?.data || []
  const categories = issues?.filters?.categories || []
  const domains = issues?.filters?.domains || []
  const summary = issues?.summary || {}

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const active = ['new', 'acknowledged', 'investigating', 'fixed', 'monitoring']
    return rows.filter(issue => {
      const haystack = [issue.fingerprint, issue.title, issue.latest_message, issue.latest_error_code, issue.latest_route, issue.category, issue.domain, ...(issue.applications || []).flatMap(app => [app.name, app.slug])]
        .filter(Boolean).join(' ').toLowerCase()
      return (status === 'all' || (status === 'active' ? active.includes(issue.status) : issue.status === status))
        && (priority === 'all' || issue.priority === priority)
        && (category === 'all' || issue.category === category)
        && (domain === 'all' || issue.domain === domain)
        && (!needle || haystack.includes(needle))
    })
  }, [rows, query, status, priority, category, domain])

  async function toggleDetails(issue) {
    if (openId === issue.id) { setOpenId(null); return }
    setOpenId(issue.id)
    if (details[issue.id] || !fetchDetails) return
    setLoadingId(issue.id)
    try {
      const payload = await fetchDetails(issue.id)
      setDetails(current => ({ ...current, [issue.id]: payload }))
    } finally {
      setLoadingId(null)
    }
  }

  async function copy(issue) {
    const payload = issueDiagnostic(issue)
    try {
      await navigator.clipboard.writeText(payload)
      setCopiedId(issue.id)
      window.setTimeout(() => setCopiedId(null), 1600)
    } catch {
      window.prompt('Copie o diagnóstico:', payload)
    }
  }

  async function changeStatus(issue, next, note) {
    if (['ignored', 'expected'].includes(next) && !window.confirm(`Marcar ${issue.fingerprint} como ${STATUS_LABELS[next].toLowerCase()}?`)) return
    await onUpdate?.(issue.id, { status: next, note })
  }

  return <div className="oi-stack">
    <section className="cc-panel oi-hero">
      <header>
        <div><b>Operational Issues Center</b><small>Problemas persistentes agrupados por causa provável, com ciclo de vida, impacto, tendência e histórico.</small></div>
        <button onClick={onRefresh}>Atualizar agora</button>
      </header>
      <div className="oi-summary">
        <Summary label="Abertos" value={summary.open || 0}/>
        <Summary label="Críticos" value={summary.critical || 0} danger={summary.critical > 0}/>
        <Summary label="P0" value={summary.p0 || 0} danger={summary.p0 > 0}/>
        <Summary label="P1" value={summary.p1 || 0} warning={summary.p1 > 0}/>
        <Summary label="Regressões" value={summary.regressions || 0} warning={summary.regressions > 0}/>
        <Summary label="Resolvidos" value={summary.resolved || 0}/>
      </div>
    </section>

    <section className="cc-panel">
      <div className="oi-filters">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar fingerprint, erro, rota, domínio ou aplicação..."/>
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="active">Ativos</option><option value="all">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
        <select value={priority} onChange={event => setPriority(event.target.value)}><option value="all">Todas prioridades</option>{['P0','P1','P2','P3'].map(item => <option key={item}>{item}</option>)}</select>
        <select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas categorias</option>{categories.map(item => <option key={item} value={item}>{CATEGORY_LABELS[item] || label(item)}</option>)}</select>
        <select value={domain} onChange={event => setDomain(event.target.value)}><option value="all">Todos domínios</option>{domains.map(item => <option key={item}>{item}</option>)}</select>
      </div>

      <div className="oi-list">
        {filtered.length ? filtered.map(issue => <article className={`oi-card severity-${issue.severity} priority-${String(issue.priority || '').toLowerCase()}`} key={issue.id}>
          <div className="oi-card-top">
            <div className="oi-badges"><span className={`oi-priority ${String(issue.priority || '').toLowerCase()}`}>{issue.priority}</span><span className={`cc-status ${issue.severity}`}>{label(issue.severity)}</span><span className={`cc-status ${issue.status}`}>{STATUS_LABELS[issue.status] || label(issue.status)}</span></div>
            <div className="oi-impact"><strong>{issue.impact_score}</strong><small>impacto / 100</small></div>
          </div>

          <div className="oi-title"><code>{issue.fingerprint}</code><h3>{issue.title || issue.latest_message || 'Problema operacional'}</h3></div>
          <div className="oi-meta"><span>{CATEGORY_LABELS[issue.category] || label(issue.category)}</span><span>domínio <b>{issue.domain || 'platform'}</b></span><span className={`trend-${issue.trend?.direction || 'stable'}`}>{trendText(issue.trend)}</span>{issue.regression_count > 0 && <span className="oi-regression">regressão ×{issue.regression_count}</span>}</div>

          <div className="oi-numbers">
            <Metric label="Ocorrências" value={issue.occurrence_count}/><Metric label="Usuários" value={issue.users_affected_count}/><Metric label="Apps" value={issue.applications_affected_count}/><Metric label="Estabelecimentos" value={issue.establishments_affected_count}/>
          </div>

          <div className="oi-route"><code>{[issue.latest_method, issue.latest_route].filter(Boolean).join(' ') || 'rota não identificada'}</code><span>{issue.latest_http_status ? `HTTP ${issue.latest_http_status}` : issue.latest_error_code || 'sem HTTP'}</span></div>

          {!!issue.applications?.length && <div className="oi-apps">{issue.applications.map(app => <span key={app.id}>{app.name || app.slug}{app.version ? ` · ${app.version}` : ''}</span>)}</div>}

          <div className="oi-time"><span>Primeiro: {fmt(issue.first_seen_at)}</span><span>Último: {fmt(issue.last_seen_at)}</span>{issue.source_commit && <span>commit <code>{issue.source_commit.slice(0, 10)}</code></span>}</div>

          <div className="oi-actions">
            <button onClick={() => toggleDetails(issue)}>{openId === issue.id ? 'Fechar detalhes' : 'Ver ocorrências e histórico'}</button>
            <button onClick={() => copy(issue)}>{copiedId === issue.id ? 'Copiado' : 'Copiar diagnóstico'}</button>
            {issue.status === 'new' && <button onClick={() => changeStatus(issue, 'acknowledged')}>Reconhecer</button>}
            {['new','acknowledged'].includes(issue.status) && <button onClick={() => changeStatus(issue, 'investigating')}>Investigar</button>}
            {issue.status === 'investigating' && <button onClick={() => changeStatus(issue, 'fixed')}>Marcar corrigido</button>}
            {issue.status === 'fixed' && <button onClick={() => changeStatus(issue, 'monitoring')}>Monitorar</button>}
            {['fixed','monitoring'].includes(issue.status) && <button onClick={() => changeStatus(issue, 'resolved')}>Resolver</button>}
            {!['resolved','ignored','expected'].includes(issue.status) && <button onClick={() => onCreateIncident?.(issue.id)}>Criar incidente</button>}
            {!['ignored','resolved'].includes(issue.status) && <button className="muted" onClick={() => changeStatus(issue, 'expected')}>Esperado</button>}
            {!['ignored','resolved'].includes(issue.status) && <button className="muted" onClick={() => changeStatus(issue, 'ignored')}>Ignorar</button>}
          </div>

          {openId === issue.id && <IssueDetails loading={loadingId === issue.id} payload={details[issue.id]}/>} 
        </article>) : <p className="cc-empty">Nenhum problema corresponde aos filtros atuais.</p>}
      </div>
    </section>
  </div>
}

function IssueDetails({ loading, payload }) {
  if (loading) return <div className="oi-detail-loading">Carregando ocorrências e histórico…</div>
  if (!payload) return null
  const occurrences = payload.occurrences || []
  const history = payload.history || []
  return <div className="oi-details">
    <div><h4>Últimas ocorrências</h4>{occurrences.length ? occurrences.slice(0, 30).map(row => <div className="oi-occurrence" key={row.id}><span>{fmt(row.occurred_at)}</span><code>{row.application_slug || row.application_name || 'app?'}</code><span>{row.http_status ? `HTTP ${row.http_status}` : '—'}</span><code>{row.request_id || `interaction #${row.interaction_id}`}</code><span>{row.user_email || 'visitante'}</span></div>) : <p>Nenhuma ocorrência armazenada.</p>}</div>
    <div><h4>Histórico do problema</h4>{history.length ? history.map(row => <div className="oi-history" key={row.id}><span>{fmt(row.created_at)}</span><b>{row.from_status ? `${STATUS_LABELS[row.from_status] || row.from_status} → ` : ''}{STATUS_LABELS[row.to_status] || row.to_status}</b><small>{row.actor_email || 'automação'}{row.note ? ` · ${row.note}` : ''}</small></div>) : <p>Nenhuma transição registrada.</p>}</div>
  </div>
}

function Summary({ label: title, value, danger, warning }) { return <article className={`${danger ? 'danger' : ''} ${warning ? 'warning' : ''}`}><span>{title}</span><strong>{value}</strong></article> }
function Metric({ label: title, value }) { return <div><span>{title}</span><b>{value ?? 0}</b></div> }
