import { useEffect, useMemo, useState } from 'react'
import './CommandCenter.css'
import CriticalEventsPanel from './CriticalEventsPanel'
import OperationalIssuesPanel from './OperationalIssuesPanel'

const API = 'https://api.petertecnet.com.br/api'
const fmt = v => v ? new Date(v).toLocaleString('pt-BR') : '—'

async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) { localStorage.removeItem('token'); window.location.href = '/login' }
  if (!response.ok) throw new Error(data?.message || data?.error || 'Falha no Command Center.')
  return data
}

export default function CommandCenter() {
  const [section, setSection] = useState('overview')
  const [focusTarget, setFocusTarget] = useState('')
  const [overview, setOverview] = useState(null)
  const [security, setSecurity] = useState(null)
  const [issues, setIssues] = useState(null)
  const [intelligence, setIntelligence] = useState(null)
  const [queues, setQueues] = useState(null)
  const [incidents, setIncidents] = useState(null)
  const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(true)
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'warning', application_id: '' })

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const [o, s, q, i, operationalIssues, operationalIntelligence] = await Promise.all([
        api('/admin/ecosystem/command/overview'),
        api('/admin/ecosystem/command/security'),
        api('/admin/ecosystem/command/queues'),
        api('/admin/ecosystem/command/incidents'),
        api('/admin/ecosystem/command/issues?status=all&per_page=100'),
        api('/admin/ecosystem/command/intelligence'),
      ])
      setOverview(o); setSecurity(s); setQueues(q); setIncidents(i); setIssues(operationalIssues); setIntelligence(operationalIntelligence)
    } catch (e) { setError(e.message) } finally { if (!silent) setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!live) return undefined
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') load(true) }, 15000)
    return () => window.clearInterval(id)
  }, [live])

  useEffect(() => {
    if (!focusTarget) return undefined
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`cc-detail-${focusTarget}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    const clearTimer = window.setTimeout(() => setFocusTarget(''), 2200)
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer) }
  }, [section, focusTarget])

  function navigateSection(nextSection) {
    setFocusTarget('')
    setSection(nextSection)
  }

  function openKpi(target) {
    const destination = {
      applications: 'overview', incidents: 'incidents', queues: 'queues', scheduler: 'queues', backup: 'queues', security: 'security', issues: 'issues',
    }[target] || 'overview'
    setFocusTarget(target)
    setSection(destination)
  }

  async function runSearch(e) {
    e?.preventDefault()
    if (search.trim().length < 2) return
    setLoading(true); setError('')
    try { setSearchResult(await api(`/admin/ecosystem/command/search?q=${encodeURIComponent(search.trim())}`)); navigateSection('search') }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function createIncident(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      await api('/admin/ecosystem/command/incidents', { method: 'POST', body: JSON.stringify({ ...incidentForm, application_id: incidentForm.application_id || null }) })
      setIncidentForm({ title: '', description: '', severity: 'warning', application_id: '' }); await load(true); navigateSection('incidents')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function updateIncident(id, status) {
    setLoading(true); setError('')
    try { await api(`/admin/ecosystem/command/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(true) }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function updateOperationalIssue(id, patch) {
    setLoading(true); setError('')
    try {
      await api(`/admin/ecosystem/command/issues/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      await load(true)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function createIssueIncident(id) {
    if (!window.confirm('Criar um incidente operacional a partir deste problema?')) return
    setLoading(true); setError('')
    try {
      await api(`/admin/ecosystem/command/issues/${id}/incident`, { method: 'POST', body: JSON.stringify({}) })
      await load(true)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function createRepairPlan(id) {
    if (!window.confirm('Preparar um plano de correção supervisionado para este problema? Nenhuma alteração será aplicada automaticamente em produção.')) return null
    setLoading(true); setError('')
    try {
      const payload = await api(`/admin/ecosystem/command/issues/${id}/repair-plan`, { method: 'POST', body: JSON.stringify({}) })
      await load(true)
      return payload
    } catch (e) { setError(e.message); return null } finally { setLoading(false) }
  }

  async function fetchIssueDetails(id) {
    const [details, intel] = await Promise.all([
      api(`/admin/ecosystem/command/issues/${id}`),
      api(`/admin/ecosystem/command/issues/${id}/intelligence`),
    ])
    return { ...details, ...intel }
  }

  async function retryJob(uuid) {
    if (!window.confirm(`Reprocessar o job ${uuid}?`)) return
    setLoading(true); setError('')
    try { await api(`/admin/ecosystem/command/queues/${uuid}/retry`, { method: 'POST' }); await load(true) }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const score = Number(overview?.score || 0)
  const apps = overview?.applications || []
  const incidentRows = incidents?.data || []
  const searchGroups = useMemo(() => Object.entries(searchResult?.groups || {}).filter(([, rows]) => rows?.length), [searchResult])
  const criticalCount = security?.critical_events_24h ?? overview?.security?.critical_events_24h ?? 0
  const errorCount = security?.errors_24h ?? overview?.security?.errors_24h ?? 0
  const activeAlerts = intelligence?.summary?.active_alerts || 0

  return <div className="cc-stack">
    <section className="cc-hero">
      <div><p>MISSION CONTROL · PETER TECNET</p><h2>Centro operacional do ecossistema</h2><span>Disponibilidade, problemas, segurança, SLOs, deploys, anomalias, jornadas, filas e incidentes em uma única sala de controle.</span></div>
      <div className={`cc-score ${score >= 90 ? 'ok' : score >= 70 ? 'warn' : 'bad'}`}><strong>{score}</strong><small>HEALTH SCORE</small></div>
    </section>

    <div className="cc-toolbar">
      <nav>{[['overview','Operações'],['search','Busca global'],['issues','Problemas'],['incidents','Incidentes'],['security','Segurança'],['queues','Filas & runtime']].map(([k,l]) => <button key={k} className={section===k?'active':''} onClick={()=>navigateSection(k)}>{l}</button>)}</nav>
      <div className="cc-live"><i className={live?'on':''}/>{live?'Monitoramento ativo':'Monitoramento pausado'}<button onClick={()=>setLive(v=>!v)}>{live?'Pausar':'Ativar'}</button></div>
    </div>

    <form className="cc-global-search" onSubmit={runSearch}><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar usuário, e-mail, CPF, aplicação, estabelecimento, item, evento, pedido ou pagamento..."/><button>Buscar</button></form>
    {error && <div className="cc-notice bad"><b>Falha operacional</b><span>{error}</span></div>}
    {loading && <div className="cc-loading">Sincronizando telemetria operacional…</div>}

    {section === 'overview' && <>
      <div className="cc-kpis">
        <Kpi title="Apps operacionais" value={`${overview?.summary?.operational || 0}/${overview?.summary?.applications || 0}`} sub={`${overview?.summary?.degraded || 0} degradados · ${overview?.summary?.down || 0} fora`} onClick={()=>openKpi('applications')} destination="Ver frota de aplicações" />
        <Kpi title="Incidentes abertos" value={overview?.summary?.open_incidents || 0} sub={`${overview?.summary?.critical_incidents || 0} críticos`} danger={overview?.summary?.critical_incidents > 0} onClick={()=>openKpi('incidents')} destination="Gerenciar incidentes"/>
        <Kpi title="Alertas inteligentes" value={activeAlerts} sub={`${intelligence?.summary?.critical_alerts || 0} alta prioridade`} danger={activeAlerts > 0} onClick={()=>openKpi('issues')} destination="Ver causas e SLOs"/>
        <Kpi title="Jobs na fila" value={overview?.queues?.queued || 0} sub={`${overview?.queues?.failed || 0} falharam`} danger={overview?.queues?.failed > 0} onClick={()=>openKpi('queues')} destination="Ver filas e falhas"/>
        <Kpi title="Scheduler" value={overview?.runtime?.scheduler?.status === 'healthy' ? 'ONLINE' : 'ATENÇÃO'} sub={fmt(overview?.runtime?.scheduler?.last_seen_at)} danger={overview?.runtime?.scheduler?.status !== 'healthy'} onClick={()=>openKpi('scheduler')} destination="Detalhar scheduler"/>
        <Kpi title="Backup" value={overview?.runtime?.backup?.status || 'unknown'} sub={fmt(overview?.runtime?.backup?.last_success_at)} danger={overview?.runtime?.backup?.status === 'failed'} onClick={()=>openKpi('backup')} destination="Detalhar backup"/>
        <Kpi title="Eventos críticos 24h" value={criticalCount} sub={`${security?.suspicious_24h || 0} suspeitos · ${errorCount} erros`} danger={criticalCount > 0} onClick={()=>openKpi('security')} destination="Investigar eventos críticos"/>
      </div>
      <section id="cc-detail-applications" className={`cc-panel ${focusTarget==='applications'?'cc-focus':''}`}><header><div><b>Frota de aplicações</b><small>Estado, telemetria, taxa de erro, latência e última comunicação.</small></div><button onClick={()=>load()}>Atualizar agora</button></header><div className="cc-app-grid">{apps.map(app => <article className="cc-app" key={app.id}><div className="cc-app-head"><img src={app.logo || '/petertecnetlogo.png'} alt=""/><div><b>{app.name}</b><small>{app.slug} · {app.version || 'sem versão'}</small></div><Status value={app.status}/></div><dl><div><dt>Interações 24h</dt><dd>{app.requests_24h}</dd></div><div><dt>Erros 24h</dt><dd>{app.error_rate_24h}%</dd></div><div><dt>Latência</dt><dd>{app.probe_latency_ms ?? app.avg_latency_ms_1h ?? '—'} ms</dd></div><div><dt>HTTP</dt><dd>{app.probe_http_status || '—'}</dd></div></dl><footer><span>Última atividade {fmt(app.last_activity_at)}</span><a href={app.url} target="_blank" rel="noreferrer">Abrir ↗</a></footer></article>)}</div></section>
      <div className="cc-grid"><section className="cc-panel"><header><div><b>Incidentes prioritários</b><small>Ocorrências que exigem decisão operacional.</small></div><button onClick={()=>openKpi('incidents')}>Gerenciar</button></header><IncidentList rows={overview?.incidents || []} updateIncident={updateIncident}/></section><section className="cc-panel"><header><div><b>Runtime</b><small>Estado da infraestrutura que sustenta o ecossistema.</small></div></header><Info label="Ambiente" value={overview?.runtime?.environment}/><Info label="Laravel" value={overview?.runtime?.laravel}/><Info label="PHP" value={overview?.runtime?.php}/><Info label="Banco" value={`${overview?.runtime?.database?.driver || '—'} · ${overview?.runtime?.database?.connected ? 'conectado' : 'falha'}`}/><Info label="Fila" value={`${overview?.queues?.queued || 0} aguardando · ${overview?.queues?.failed || 0} falhos`}/></section></div>
    </>}

    {section === 'search' && <section className="cc-panel"><header><div><b>Busca global 360°</b><small>{searchResult ? `${searchResult.total} resultado(s) para “${searchResult.query}”` : 'Pesquise qualquer entidade operacional do ecossistema.'}</small></div></header>{searchGroups.length ? searchGroups.map(([group, rows]) => <div className="cc-search-group" key={group}><h3>{group}</h3>{rows.map((row,i)=><article key={row.id ?? i}><b>{row.name || row.title || row.email || row.public_id || row.provider_payment_id || `#${row.id}`}</b><span>{Object.entries(row).filter(([k,v])=>!['name','title'].includes(k)&&v!=null).slice(0,6).map(([k,v])=>`${k}: ${String(v)}`).join(' · ')}</span></article>)}</div>) : <Empty text="Use a busca acima para localizar qualquer entidade."/>}</section>}

    {section === 'issues' && <div id="cc-detail-issues" className={focusTarget==='issues'?'cc-focus':''}><OperationalIssuesPanel issues={issues} intelligence={intelligence} onRefresh={()=>load()} onUpdate={updateOperationalIssue} onCreateIncident={createIssueIncident} onCreateRepairPlan={createRepairPlan} fetchDetails={fetchIssueDetails}/></div>}

    {section === 'incidents' && <div id="cc-detail-incidents" className={`cc-grid ${focusTarget==='incidents'?'cc-focus':''}`}><section className="cc-panel"><header><div><b>Abrir incidente</b><small>Registre uma ocorrência para acompanhamento até a resolução.</small></div></header><form className="cc-form" onSubmit={createIncident}><label>Título<input value={incidentForm.title} onChange={e=>setIncidentForm({...incidentForm,title:e.target.value})} required/></label><label>Severidade<select value={incidentForm.severity} onChange={e=>setIncidentForm({...incidentForm,severity:e.target.value})}><option value="info">Informativo</option><option value="warning">Atenção</option><option value="critical">Crítico</option></select></label><label>Aplicação<select value={incidentForm.application_id} onChange={e=>setIncidentForm({...incidentForm,application_id:e.target.value})}><option value="">Ecossistema</option>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="wide">Descrição<textarea rows="5" value={incidentForm.description} onChange={e=>setIncidentForm({...incidentForm,title:incidentForm.title,description:e.target.value})}/></label><button className="primary">Abrir incidente</button></form></section><section className="cc-panel"><header><div><b>Incidentes</b><small>Ciclo: aberto → reconhecido → investigando → resolvido.</small></div></header><IncidentList rows={incidentRows} updateIncident={updateIncident}/></section></div>}

    {section === 'security' && <div id="cc-detail-security" className={focusTarget==='security'?'cc-focus':''}><CriticalEventsPanel security={security} onOpenIssues={()=>navigateSection('issues')}/></div>}

    {section === 'queues' && <>
      <div id="cc-detail-queues" className={`cc-grid ${focusTarget==='queues'?'cc-focus':''}`}><section className="cc-panel"><header><div><b>Filas</b><small>Processamento assíncrono da API.</small></div></header><Info label="Aguardando" value={queues?.queued || 0}/><Info label="Falhos" value={queues?.failed || 0}/><Info label="Job mais antigo" value={fmt(queues?.oldest_available_at)}/></section><section className="cc-panel"><header><div><b>Jobs com falha</b><small>Retry manual auditado.</small></div></header>{queues?.failed_rows?.length ? queues.failed_rows.map(row=><article className="cc-job" key={row.uuid}><div><b>{row.queue || row.connection}</b><small>{row.uuid} · {fmt(row.failed_at)}</small><p>{String(row.exception || '').split('\n')[0]}</p></div><button onClick={()=>retryJob(row.uuid)}>Reprocessar</button></article>) : <Empty text="Nenhum job com falha."/>}</section></div>
      <div className="cc-runtime-grid">
        <RuntimeDetail id="cc-detail-scheduler" title="Scheduler" description="Execução das rotinas agendadas da API." data={overview?.runtime?.scheduler} focus={focusTarget==='scheduler'} primaryDateLabel="Última comunicação" primaryDate={overview?.runtime?.scheduler?.last_seen_at}/>
        <RuntimeDetail id="cc-detail-backup" title="Backup" description="Estado e última execução conhecida da rotina de backup." data={overview?.runtime?.backup} focus={focusTarget==='backup'} primaryDateLabel="Último sucesso" primaryDate={overview?.runtime?.backup?.last_success_at}/>
      </div>
    </>}
  </div>
}

function Kpi({title,value,sub,danger,onClick,destination}){return <button type="button" className={`cc-kpi cc-kpi-button ${danger?'danger':''}`} onClick={onClick} aria-label={`${title}: ${value ?? 'sem valor'}. ${destination || 'Abrir detalhes'}`}><span>{title}</span><strong>{value ?? '—'}</strong><small>{sub}</small><span className="cc-kpi-link">{destination || 'Abrir detalhes'} <b aria-hidden="true">→</b></span></button>}
function Info({label,value}){return <div className="cc-info"><span>{label}</span><b>{value ?? '—'}</b></div>}
function Status({value}){const v=String(value||'unknown');return <span className={`cc-status ${v}`}>{v.replaceAll('_',' ')}</span>}
function Empty({text}){return <p className="cc-empty">{text}</p>}
function IncidentList({rows,updateIncident}){return <div className="cc-incidents">{rows?.length ? rows.map(row=><article key={row.id} className={`cc-incident ${row.severity}`}><div><div><Status value={row.severity}/><small>{row.public_id} · {fmt(row.created_at)}</small></div><b>{row.title}</b><p>{row.description || row.application_name || row.source}</p></div><div className="cc-incident-actions"><Status value={row.status}/>{row.status==='open'&&<button onClick={()=>updateIncident(row.id,'acknowledged')}>Reconhecer</button>}{['open','acknowledged'].includes(row.status)&&<button onClick={()=>updateIncident(row.id,'investigating')}>Investigar</button>}{row.status!=='resolved'&&<button onClick={()=>updateIncident(row.id,'resolved')}>Resolver</button>}</div></article>) : <Empty text="Nenhum incidente aberto."/>}</div>}
function RuntimeDetail({id,title,description,data,focus,primaryDateLabel,primaryDate}){const rows=Object.entries(data||{}).filter(([key,value])=>!['status','last_seen_at','last_success_at'].includes(key)&&value!=null&&typeof value!=='object').slice(0,8);return <section id={id} className={`cc-panel cc-runtime-detail ${focus?'cc-focus':''}`}><header><div><b>{title}</b><small>{description}</small></div><Status value={data?.status||'unknown'}/></header><Info label={primaryDateLabel} value={fmt(primaryDate)}/>{rows.map(([key,value])=><Info key={key} label={humanKey(key)} value={typeof value==='boolean'?(value?'sim':'não'):String(value)}/>)}</section>}
function humanKey(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase())}
