import { useEffect, useMemo, useState } from 'react'
import './CommandCenter.css'

const API = 'https://api.petertecnet.com.br/api'
const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  const [overview, setOverview] = useState(null)
  const [security, setSecurity] = useState(null)
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
      const [o, s, q, i] = await Promise.all([
        api('/admin/ecosystem/command/overview'),
        api('/admin/ecosystem/command/security'),
        api('/admin/ecosystem/command/queues'),
        api('/admin/ecosystem/command/incidents'),
      ])
      setOverview(o); setSecurity(s); setQueues(q); setIncidents(i)
    } catch (e) { setError(e.message) } finally { if (!silent) setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!live) return undefined
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') load(true) }, 15000)
    return () => window.clearInterval(id)
  }, [live])

  async function runSearch(e) {
    e?.preventDefault()
    if (search.trim().length < 2) return
    setLoading(true); setError('')
    try { setSearchResult(await api(`/admin/ecosystem/command/search?q=${encodeURIComponent(search.trim())}`)); setSection('search') }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function createIncident(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      await api('/admin/ecosystem/command/incidents', { method: 'POST', body: JSON.stringify({ ...incidentForm, application_id: incidentForm.application_id || null }) })
      setIncidentForm({ title: '', description: '', severity: 'warning', application_id: '' }); await load(true); setSection('incidents')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function updateIncident(id, status) {
    setLoading(true); setError('')
    try { await api(`/admin/ecosystem/command/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(true) }
    catch (e) { setError(e.message) } finally { setLoading(false) }
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

  return <div className="cc-stack">
    <section className="cc-hero">
      <div><p>MISSION CONTROL · PETER TECNET</p><h2>Centro operacional do ecossistema</h2><span>Disponibilidade, segurança, filas, incidentes, backup, aplicações e busca global em uma única sala de controle.</span></div>
      <div className={`cc-score ${score >= 90 ? 'ok' : score >= 70 ? 'warn' : 'bad'}`}><strong>{score}</strong><small>HEALTH SCORE</small></div>
    </section>

    <div className="cc-toolbar">
      <nav>{[['overview','Operações'],['search','Busca global'],['incidents','Incidentes'],['security','Segurança'],['queues','Filas & runtime']].map(([k,l]) => <button key={k} className={section===k?'active':''} onClick={()=>setSection(k)}>{l}</button>)}</nav>
      <div className="cc-live"><i className={live?'on':''}/>{live?'Monitoramento ativo':'Monitoramento pausado'}<button onClick={()=>setLive(v=>!v)}>{live?'Pausar':'Ativar'}</button></div>
    </div>

    <form className="cc-global-search" onSubmit={runSearch}><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar usuário, e-mail, CPF, aplicação, estabelecimento, item, evento, pedido ou pagamento..."/><button>Buscar</button></form>
    {error && <div className="cc-notice bad"><b>Falha operacional</b><span>{error}</span></div>}
    {loading && <div className="cc-loading">Sincronizando telemetria operacional…</div>}

    {section === 'overview' && <>
      <div className="cc-kpis">
        <Kpi title="Apps operacionais" value={`${overview?.summary?.operational || 0}/${overview?.summary?.applications || 0}`} sub={`${overview?.summary?.degraded || 0} degradados · ${overview?.summary?.down || 0} fora`} />
        <Kpi title="Incidentes abertos" value={overview?.summary?.open_incidents || 0} sub={`${overview?.summary?.critical_incidents || 0} críticos`} danger={overview?.summary?.critical_incidents > 0}/>
        <Kpi title="Jobs na fila" value={overview?.queues?.queued || 0} sub={`${overview?.queues?.failed || 0} falharam`} danger={overview?.queues?.failed > 0}/>
        <Kpi title="Scheduler" value={overview?.runtime?.scheduler?.status === 'healthy' ? 'ONLINE' : 'ATENÇÃO'} sub={fmt(overview?.runtime?.scheduler?.last_seen_at)} danger={overview?.runtime?.scheduler?.status !== 'healthy'}/>
        <Kpi title="Backup" value={overview?.runtime?.backup?.status || 'unknown'} sub={fmt(overview?.runtime?.backup?.last_success_at)} danger={overview?.runtime?.backup?.status === 'failed'}/>
        <Kpi title="Eventos críticos 24h" value={overview?.security?.critical_events_24h || 0} sub={`${overview?.security?.errors_24h || 0} erros`} danger={overview?.security?.critical_events_24h > 0}/>
      </div>
      <section className="cc-panel"><header><div><b>Frota de aplicações</b><small>Estado, telemetria, taxa de erro, latência e última comunicação.</small></div><button onClick={()=>load()}>Atualizar agora</button></header><div className="cc-app-grid">{apps.map(app => <article className="cc-app" key={app.id}><div className="cc-app-head"><img src={app.logo || '/petertecnetlogo.png'} alt=""/><div><b>{app.name}</b><small>{app.slug} · {app.version || 'sem versão'}</small></div><Status value={app.status}/></div><dl><div><dt>Interações 24h</dt><dd>{app.requests_24h}</dd></div><div><dt>Erros 24h</dt><dd>{app.error_rate_24h}%</dd></div><div><dt>Latência</dt><dd>{app.probe_latency_ms ?? app.avg_latency_ms_1h ?? '—'} ms</dd></div><div><dt>HTTP</dt><dd>{app.probe_http_status || '—'}</dd></div></dl><footer><span>Última atividade {fmt(app.last_activity_at)}</span><a href={app.url} target="_blank" rel="noreferrer">Abrir ↗</a></footer></article>)}</div></section>
      <div className="cc-grid"><section className="cc-panel"><header><div><b>Incidentes prioritários</b><small>Ocorrências que exigem decisão operacional.</small></div><button onClick={()=>setSection('incidents')}>Gerenciar</button></header><IncidentList rows={overview?.incidents || []} updateIncident={updateIncident}/></section><section className="cc-panel"><header><div><b>Runtime</b><small>Estado da infraestrutura que sustenta o ecossistema.</small></div></header><Info label="Ambiente" value={overview?.runtime?.environment}/><Info label="Laravel" value={overview?.runtime?.laravel}/><Info label="PHP" value={overview?.runtime?.php}/><Info label="Banco" value={`${overview?.runtime?.database?.driver || '—'} · ${overview?.runtime?.database?.connected ? 'conectado' : 'falha'}`}/><Info label="Fila" value={`${overview?.queues?.queued || 0} aguardando · ${overview?.queues?.failed || 0} falhos`}/></section></div>
    </>}

    {section === 'search' && <section className="cc-panel"><header><div><b>Busca global 360°</b><small>{searchResult ? `${searchResult.total} resultado(s) para “${searchResult.query}”` : 'Pesquise qualquer entidade operacional do ecossistema.'}</small></div></header>{searchGroups.length ? searchGroups.map(([group, rows]) => <div className="cc-search-group" key={group}><h3>{group}</h3>{rows.map((row,i)=><article key={row.id ?? i}><b>{row.name || row.title || row.email || row.public_id || row.provider_payment_id || `#${row.id}`}</b><span>{Object.entries(row).filter(([k,v])=>!['name','title'].includes(k)&&v!=null).slice(0,6).map(([k,v])=>`${k}: ${String(v)}`).join(' · ')}</span></article>)}</div>) : <Empty text="Use a busca acima para localizar qualquer entidade."/>}</section>}

    {section === 'incidents' && <div className="cc-grid"><section className="cc-panel"><header><div><b>Abrir incidente</b><small>Registre uma ocorrência para acompanhamento até a resolução.</small></div></header><form className="cc-form" onSubmit={createIncident}><label>Título<input value={incidentForm.title} onChange={e=>setIncidentForm({...incidentForm,title:e.target.value})} required/></label><label>Severidade<select value={incidentForm.severity} onChange={e=>setIncidentForm({...incidentForm,severity:e.target.value})}><option value="info">Informativo</option><option value="warning">Atenção</option><option value="critical">Crítico</option></select></label><label>Aplicação<select value={incidentForm.application_id} onChange={e=>setIncidentForm({...incidentForm,application_id:e.target.value})}><option value="">Ecossistema</option>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="wide">Descrição<textarea rows="5" value={incidentForm.description} onChange={e=>setIncidentForm({...incidentForm,description:e.target.value})}/></label><button className="primary">Abrir incidente</button></form></section><section className="cc-panel"><header><div><b>Incidentes</b><small>Ciclo: aberto → reconhecido → investigando → resolvido.</small></div></header><IncidentList rows={incidentRows} updateIncident={updateIncident}/></section></div>}

    {section === 'security' && <><div className="cc-kpis three"><Kpi title="Críticos / suspeitos" value={security?.critical_events_24h || 0} sub="últimas 24 horas" danger={security?.critical_events_24h > 0}/><Kpi title="Acessos negados" value={security?.denied_24h || 0} sub="últimas 24 horas" danger={security?.denied_24h > 0}/><Kpi title="Erros" value={security?.errors_24h || 0} sub="últimas 24 horas" danger={security?.errors_24h > 0}/></div><section className="cc-panel"><header><div><b>Eventos de segurança</b><small>Telemetria de atenção, suspeita e criticidade.</small></div></header><div className="cc-table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Resultado</th><th>Severidade</th><th>Rota</th><th>Usuário</th></tr></thead><tbody>{security?.events?.length ? security.events.map(e=><tr key={e.id}><td>{fmt(e.created_at)}</td><td>{e.interaction_type}</td><td>{e.outcome || '—'}</td><td><Status value={e.severity || 'normal'}/></td><td>{e.route || e.url || '—'}</td><td>{e.user_id || '—'}</td></tr>) : <tr><td colSpan="6">Nenhum evento crítico recente.</td></tr>}</tbody></table></div></section></>}

    {section === 'queues' && <div className="cc-grid"><section className="cc-panel"><header><div><b>Filas</b><small>Processamento assíncrono da API.</small></div></header><Info label="Aguardando" value={queues?.queued || 0}/><Info label="Falhos" value={queues?.failed || 0}/><Info label="Job mais antigo" value={fmt(queues?.oldest_available_at)}/></section><section className="cc-panel"><header><div><b>Jobs com falha</b><small>Retry manual auditado.</small></div></header>{queues?.failed_rows?.length ? queues.failed_rows.map(row=><article className="cc-job" key={row.uuid}><div><b>{row.queue || row.connection}</b><small>{row.uuid} · {fmt(row.failed_at)}</small><p>{String(row.exception || '').split('\n')[0]}</p></div><button onClick={()=>retryJob(row.uuid)}>Reprocessar</button></article>) : <Empty text="Nenhum job com falha."/>}</section></div>}
  </div>
}

function Kpi({title,value,sub,danger}){return <article className={`cc-kpi ${danger?'danger':''}`}><span>{title}</span><strong>{value ?? '—'}</strong><small>{sub}</small></article>}
function Info({label,value}){return <div className="cc-info"><span>{label}</span><b>{value ?? '—'}</b></div>}
function Status({value}){const v=String(value||'unknown');return <span className={`cc-status ${v}`}>{v.replaceAll('_',' ')}</span>}
function Empty({text}){return <p className="cc-empty">{text}</p>}
function IncidentList({rows,updateIncident}){return <div className="cc-incidents">{rows?.length ? rows.map(row=><article key={row.id} className={`cc-incident ${row.severity}`}><div><div><Status value={row.severity}/><small>{row.public_id} · {fmt(row.created_at)}</small></div><b>{row.title}</b><p>{row.description || row.application_name || row.source}</p></div><div className="cc-incident-actions"><Status value={row.status}/>{row.status==='open'&&<button onClick={()=>updateIncident(row.id,'acknowledged')}>Reconhecer</button>}{['open','acknowledged'].includes(row.status)&&<button onClick={()=>updateIncident(row.id,'investigating')}>Investigar</button>}{row.status!=='resolved'&&<button onClick={()=>updateIncident(row.id,'resolved')}>Resolver</button>}</div></article>) : <Empty text="Nenhum incidente aberto."/>}</div>}
