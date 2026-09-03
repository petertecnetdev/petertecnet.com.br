import { useMemo, useState } from 'react'
import './OperationalIssuesPanel.css'

const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const label = value => String(value || '—').replaceAll('_', ' ')
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

export default function OperationalIssuesPanel({ issues, intelligence, onRefresh, onUpdate, onCreateIncident, onCreateRepairPlan, fetchDetails }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [priority, setPriority] = useState('all')
  const [category, setCategory] = useState('all')
  const [domain, setDomain] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [details, setDetails] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const [planId, setPlanId] = useState(null)
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

  async function loadDetails(issueId, force = false) {
    if ((!force && details[issueId]) || !fetchDetails) return details[issueId]
    setLoadingId(issueId)
    try {
      const payload = await fetchDetails(issueId)
      setDetails(current => ({ ...current, [issueId]: payload }))
      return payload
    } finally {
      setLoadingId(null)
    }
  }

  async function toggleDetails(issue) {
    if (openId === issue.id) { setOpenId(null); return }
    setOpenId(issue.id)
    await loadDetails(issue.id)
  }

  async function prepareRepairPlan(issue) {
    setPlanId(issue.id)
    try {
      const result = await onCreateRepairPlan?.(issue.id)
      if (result) {
        setOpenId(issue.id)
        await loadDetails(issue.id, true)
      }
    } finally {
      setPlanId(null)
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
        <div><b>Operational Issues Center</b><small>Problemas persistentes, correlação entre falhas, deploys, SLOs, anomalias, jornadas e correção supervisionada.</small></div>
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

    <IntelligenceOverview intelligence={intelligence}/>

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
            <button onClick={() => toggleDetails(issue)}>{openId === issue.id ? 'Fechar inteligência' : 'Diagnóstico avançado'}</button>
            <button onClick={() => copy(issue)}>{copiedId === issue.id ? 'Copiado' : 'Copiar diagnóstico'}</button>
            {!['resolved','ignored','expected'].includes(issue.status) && <button className="primary-action" disabled={planId === issue.id} onClick={() => prepareRepairPlan(issue)}>{planId === issue.id ? 'Preparando…' : 'Preparar plano de correção'}</button>}
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

function IntelligenceOverview({ intelligence }) {
  if (!intelligence) return null
  const summary = intelligence.summary || {}
  const alerts = intelligence.alerts || []
  const deployments = intelligence.deployments || []
  const slos = intelligence.slos || []
  return <section className="cc-panel oi-intel-overview">
    <header><div><b>Inteligência operacional</b><small>Análise contínua executada no backend, mesmo com o Admin Center fechado.</small></div><span className="oi-supervised">AUTOMAÇÃO SUPERVISIONADA</span></header>
    <div className="oi-intel-summary">
      <Summary label="Alertas ativos" value={summary.active_alerts || 0} danger={summary.critical_alerts > 0}/>
      <Summary label="Alta prioridade" value={summary.critical_alerts || 0} danger={summary.critical_alerts > 0}/>
      <Summary label="Deploys 24h" value={summary.deployments_24h || 0}/>
      <Summary label="Planos de correção" value={summary.repair_plans || 0} warning={summary.repair_plans > 0}/>
    </div>
    <div className="oi-intel-board">
      <div><h4>Alertas inteligentes</h4>{alerts.length ? alerts.slice(0,5).map(alert => <article className={`oi-mini-alert ${alert.level}`} key={alert.id}><span>{label(alert.level)}</span><b>{alert.fingerprint}</b><small>{alert.reason}</small></article>) : <p>Nenhum alerta acionável.</p>}</div>
      <div><h4>Deploys recentes</h4>{deployments.length ? deployments.slice(0,5).map(deploy => <article className="oi-mini-row" key={deploy.id}><b>{deploy.application_name || 'Ecossistema'}</b><code>{deploy.commit_sha?.slice(0,10) || deploy.version || 'versão não informada'}</code><small>{fmt(deploy.deployed_at)}</small></article>) : <p>Nenhum deploy registrado ainda.</p>}</div>
      <div><h4>SLOs ativos</h4>{slos.filter(item => item.enabled).slice(0,6).map(slo => <article className="oi-mini-row" key={slo.id}><b>{slo.domain}</b><span>{Number(slo.availability_target).toLocaleString('pt-BR')}% disponibilidade</span><small>erro ≤ {Number(slo.max_error_rate).toLocaleString('pt-BR')}% · p95 ≤ {slo.p95_latency_ms} ms</small></article>)}</div>
    </div>
  </section>
}

function IssueDetails({ loading, payload }) {
  if (loading) return <div className="oi-detail-loading">Correlacionando telemetria, deploys, SLOs e ocorrências…</div>
  if (!payload) return null
  const occurrences = payload.occurrences || []
  const history = payload.history || []
  return <div className="oi-detail-stack">
    <IssueIntelligence intelligence={payload.intelligence}/>
    <div className="oi-details">
      <div><h4>Últimas ocorrências</h4>{occurrences.length ? occurrences.slice(0, 30).map(row => <div className="oi-occurrence" key={row.id}><span>{fmt(row.occurred_at)}</span><code>{row.application_slug || row.application_name || 'app?'}</code><span>{row.http_status ? `HTTP ${row.http_status}` : '—'}</span><code>{row.request_id || `interaction #${row.interaction_id}`}</code><span>{row.user_email || 'visitante'}</span></div>) : <p>Nenhuma ocorrência armazenada.</p>}</div>
      <div><h4>Histórico do problema</h4>{history.length ? history.map(row => <div className="oi-history" key={row.id}><span>{fmt(row.created_at)}</span><b>{row.from_status ? `${STATUS_LABELS[row.from_status] || row.from_status} → ` : ''}{STATUS_LABELS[row.to_status] || row.to_status}</b><small>{row.actor_email || 'automação'}{row.note ? ` · ${row.note}` : ''}</small></div>) : <p>Nenhuma transição registrada.</p>}</div>
    </div>
  </div>
}

function IssueIntelligence({ intelligence }) {
  if (!intelligence) return <div className="oi-intel-empty">Inteligência operacional ainda não calculada para este problema.</div>
  const cause = intelligence.probable_cause || {}
  const deploy = intelligence.deploy_correlation || {}
  const slo = intelligence.slo || {}
  const anomaly = intelligence.anomaly || {}
  const financial = intelligence.financial_impact || {}
  const rollback = intelligence.rollback || {}
  const assistant = intelligence.correction_assistant || {}
  const correlations = intelligence.correlations || []
  const journeys = intelligence.journeys || []
  const runbooks = intelligence.runbooks || []
  const dependency = intelligence.dependency_map || {}

  return <div className="oi-intelligence">
    <section className="oi-intel-card cause"><header><b>Causa provável</b><span>{cause.confidence || 0}% confiança</span></header><p>{cause.summary}</p>{cause.evidence?.length > 0 && <div className="oi-evidence">{cause.evidence.map(item => <code key={item}>{item}</code>)}</div>}{cause.candidate_files?.length > 0 && <div className="oi-candidates"><small>Arquivos/camadas candidatas</small>{cause.candidate_files.slice(0,6).map(item => <div key={item.path}><code>{item.path}</code><span>{item.confidence}% · {item.reason}</span></div>)}</div>}</section>

    <section className={`oi-intel-card deploy ${deploy.strong_temporal_correlation ? 'attention' : ''}`}><header><b>Correlação com deploy</b><span>{deploy.strong_temporal_correlation ? 'FORTE' : deploy.matched ? 'encontrado' : 'não confirmado'}</span></header>{deploy.matched ? <><InfoLine label="Commit" value={deploy.commit_sha?.slice(0,12) || '—'}/><InfoLine label="Deploy" value={fmt(deploy.deployed_at)}/><InfoLine label="Erro começou depois" value={deploy.minutes_before_first_error == null ? '—' : `${Math.round(deploy.minutes_before_first_error)} min`}/><InfoLine label="Commit anterior" value={deploy.previous_commit_sha?.slice(0,12) || '—'}/></> : <p>Não há deploy registrado suficientemente próximo para atribuir causalidade.</p>}</section>

    <section className={`oi-intel-card slo ${slo.breached ? 'danger' : ''}`}><header><b>SLO / confiabilidade</b><span>{slo.breached ? 'VIOLAÇÃO' : slo.available ? 'dentro da meta' : 'sem amostra'}</span></header>{slo.available && <div className="oi-slo-grid"><SloMetric label="Disponibilidade" actual={`${slo.actual?.availability ?? 0}%`} target={`≥ ${slo.target?.availability ?? 0}%`} bad={slo.breaches?.includes('availability')}/><SloMetric label="Taxa de erro" actual={`${slo.actual?.error_rate ?? 0}%`} target={`≤ ${slo.target?.max_error_rate ?? 0}%`} bad={slo.breaches?.includes('error_rate')}/><SloMetric label="p95" actual={`${slo.actual?.p95_latency_ms ?? '—'} ms`} target={`≤ ${slo.target?.p95_latency_ms ?? '—'} ms`} bad={slo.breaches?.includes('p95_latency')}/></div>}</section>

    <section className={`oi-intel-card anomaly ${anomaly.detected ? 'attention' : ''}`}><header><b>Detecção de anomalia</b><span>{anomaly.detected ? 'PICO DETECTADO' : 'normal'}</span></header><InfoLine label="Última hora" value={anomaly.recent_1h ?? 0}/><InfoLine label="Baseline/hora" value={anomaly.baseline_hourly ?? 0}/><InfoLine label="Multiplicador" value={anomaly.multiplier == null ? 'novo padrão' : `${anomaly.multiplier}×`}/></section>

    {financial.applicable && <section className={`oi-intel-card finance ${financial.failed_payments > 0 ? 'danger' : ''}`}><header><b>Impacto financeiro potencial</b><span>{financial.failed_payments || 0} pagamentos</span></header><strong className="oi-money">{money(financial.potentially_affected_amount)}</strong><small>Estimativa baseada em pagamentos falhos temporalmente correlacionados; não representa perda confirmada.</small></section>}

    <section className={`oi-intel-card rollback ${rollback.recommended ? 'danger' : ''}`}><header><b>Rollback inteligente</b><span>{rollback.recommended ? 'RECOMENDADO' : 'não indicado'}</span></header><p>{rollback.reason}</p>{rollback.recommended && <><InfoLine label="Voltar para" value={rollback.target_commit?.slice(0,12) || '—'}/><div className="oi-manual-guard">Exige aprovação manual. O Admin Center não executa rollback ou deploy automaticamente.</div></>}</section>

    {correlations.length > 0 && <section className="oi-intel-card wide"><header><b>Problemas possivelmente relacionados</b><span>{correlations.length}</span></header><div className="oi-correlations">{correlations.map(item => <div key={item.issue_id}><span className={`oi-priority ${String(item.priority || '').toLowerCase()}`}>{item.priority}</span><code>{item.fingerprint}</code><b>{item.score}%</b><small>{item.reasons.map(label).join(' · ')}</small></div>)}</div></section>}

    {journeys.length > 0 && <section className="oi-intel-card wide"><header><b>Jornadas afetadas</b><span>{journeys.length}</span></header><div className="oi-journeys">{journeys.map(journey => <div key={journey.slug}><b>{journey.name}</b><div>{journey.steps.map(step => <span className={step === journey.affected_step ? 'affected' : ''} key={step}>{step}</span>)}</div></div>)}</div></section>}

    {dependency.nodes?.length > 0 && <section className="oi-intel-card wide"><header><b>Mapa de dependências</b><span>domínio {dependency.affected_domain}</span></header><div className="oi-dependency">{dependency.nodes.map(node => <span className={node.state === 'affected' ? 'affected' : ''} key={node.id}>{node.id}</span>)}</div></section>}

    {runbooks.length > 0 && <section className="oi-intel-card wide"><header><b>Runbooks recomendados</b><span>{runbooks.length}</span></header><div className="oi-runbooks">{runbooks.map(runbook => <details key={runbook.slug}><summary>{runbook.title}<span>risco {runbook.risk_level}</span></summary><p>{runbook.description}</p><ol>{runbook.steps.map(step => <li key={step}>{step}</li>)}</ol></details>)}</div></section>}

    <section className="oi-intel-card wide assistant"><header><b>Correção assistida</b><span>{assistant.mode === 'supervised' ? 'SUPERVISIONADA' : label(assistant.mode)}</span></header><p>O sistema preparou contexto, arquivos candidatos, validações e estratégia de rollback. Alterações em código e produção continuam dependentes de revisão, testes e CI.</p>{assistant.validation_gates?.length > 0 && <div className="oi-gates">{assistant.validation_gates.map((gate,index) => <span key={gate}><b>{index + 1}</b>{gate}</span>)}</div>}</section>
  </div>
}

function Summary({ label: title, value, danger, warning }) { return <article className={`${danger ? 'danger' : ''} ${warning ? 'warning' : ''}`}><span>{title}</span><strong>{value}</strong></article> }
function Metric({ label: title, value }) { return <div><span>{title}</span><b>{value ?? 0}</b></div> }
function InfoLine({ label: title, value }) { return <div className="oi-info-line"><span>{title}</span><b>{value ?? '—'}</b></div> }
function SloMetric({ label: title, actual, target, bad }) { return <div className={bad ? 'bad' : ''}><span>{title}</span><strong>{actual}</strong><small>meta {target}</small></div> }
