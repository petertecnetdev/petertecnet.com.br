import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  captureCognitiveState,
  fetchCognitiveBeliefs,
  fetchCognitiveDashboard,
  fetchCognitiveExperimentRuns,
  fetchCognitiveExperiments,
  fetchCognitiveLearningEvents,
  fetchCognitiveMemories,
  fetchDefaultCognitiveAgent,
  updateCognitiveAgent,
} from './cognitiveApi.js'
import './CognitiveControlCenter.css'

const pct = value => `${Math.round(Number(value || 0) * 100)}%`
const dateTime = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const shortDay = value => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`))

function MetricCard({ label, value, hint, tone = 'neutral' }) {
  return <article className={`cog-metric is-${tone}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>
}

function Confidence({ value }) {
  const number = Math.max(0, Math.min(1, Number(value || 0)))
  return <div className="cog-confidence" title={`${Math.round(number * 100)}%`}><i><b style={{ width: `${number * 100}%` }} /></i><span>{Math.round(number * 100)}%</span></div>
}

function Timeline({ rows = [] }) {
  const max = Math.max(...rows.flatMap(row => [Number(row.observations || 0), Number(row.learning_events || 0)]), 1)
  return <div className="cog-timeline" role="img" aria-label="Evolução de observações e eventos de aprendizagem nos últimos 14 dias">
    {rows.map(row => <div className="cog-timeline-day" key={row.day} title={`${row.day}: ${row.observations} observações, ${row.learning_events} aprendizados`}>
      <div className="cog-bars"><i className="is-observation" style={{ height: `${Math.max(4, Number(row.observations || 0) / max * 100)}%` }} /><i className="is-learning" style={{ height: `${Math.max(4, Number(row.learning_events || 0) / max * 100)}%` }} /></div>
      <small>{shortDay(row.day)}</small>
    </div>)}
  </div>
}

function Empty({ children }) {
  return <div className="cog-empty">{children}</div>
}

export default function CognitiveControlCenter() {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [agent, setAgent] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [memories, setMemories] = useState([])
  const [beliefs, setBeliefs] = useState([])
  const [learningEvents, setLearningEvents] = useState([])
  const [experiments, setExperiments] = useState([])
  const [runs, setRuns] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const resolvedAgent = await fetchDefaultCognitiveAgent()
      setAgent(resolvedAgent)
      const [dashboardPayload, memoriesPayload, beliefsPayload, eventsPayload, experimentsPayload, runsPayload] = await Promise.all([
        fetchCognitiveDashboard(resolvedAgent.id),
        fetchCognitiveMemories(resolvedAgent.id, { per_page: 16 }),
        fetchCognitiveBeliefs(resolvedAgent.id, { per_page: 16 }),
        fetchCognitiveLearningEvents(resolvedAgent.id, { per_page: 16 }),
        fetchCognitiveExperiments(),
        fetchCognitiveExperimentRuns(resolvedAgent.id),
      ])
      setDashboard(dashboardPayload)
      setMemories(memoriesPayload?.data || [])
      setBeliefs(beliefsPayload?.data || [])
      setLearningEvents(eventsPayload?.data || [])
      setExperiments(Array.isArray(experimentsPayload) ? experimentsPayload : [])
      setRuns(runsPayload?.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const summary = dashboard?.summary || {}
  const system = dashboard?.system || {}
  const liveAgent = dashboard?.agent || agent
  const isLearning = Boolean(system.enabled && system.auto_learn && liveAgent?.learning_enabled && liveAgent?.status === 'active')
  const contradictionTone = Number(summary.contradiction_rate || 0) > 0.25 ? 'danger' : Number(summary.contradiction_rate || 0) > 0.1 ? 'warn' : 'good'

  const runByExperiment = useMemo(() => {
    const map = new Map()
    runs.forEach(run => {
      const id = run.experiment_id || run.experiment?.id
      if (!id || map.has(id)) return
      map.set(id, run)
    })
    return map
  }, [runs])

  const captureState = async () => {
    if (!liveAgent?.id) return
    setActing(true)
    setNotice('')
    setError('')
    try {
      await captureCognitiveState(liveAgent.id)
      setNotice('Snapshot cognitivo capturado com sucesso.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActing(false)
    }
  }

  const toggleLearning = async () => {
    if (!liveAgent?.id) return
    setActing(true)
    setNotice('')
    setError('')
    try {
      await updateCognitiveAgent(liveAgent.id, { learning_enabled: !liveAgent.learning_enabled })
      setNotice(liveAgent.learning_enabled ? 'Aprendizado do agente pausado.' : 'Aprendizado do agente retomado.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActing(false)
    }
  }

  return <main className="ecosystem-main cognitive-control-center">
    <header className="ecosystem-top cog-top">
      <div>
        <p className="admin-kicker">Peter Tecnet Admin Center / Cognitive Research Core</p>
        <h1>Centro Cognitivo</h1>
        <p>Memória, crenças, confiança, contradições e evolução do aprendizado contínuo do ecossistema.</p>
      </div>
      <div className="cog-actions">
        <span className={`cog-live ${isLearning ? 'is-live' : 'is-paused'}`}><i />{isLearning ? 'Aprendendo em produção' : 'Aprendizado pausado'}</span>
        <button type="button" onClick={captureState} disabled={acting || loading}>Capturar estado</button>
        <button type="button" className="is-secondary" onClick={toggleLearning} disabled={acting || loading || !liveAgent}>{liveAgent?.learning_enabled ? 'Pausar aprendizado' : 'Retomar aprendizado'}</button>
        <button type="button" className="is-ghost" onClick={load} disabled={loading}>Atualizar</button>
      </div>
    </header>

    {error && <div className="cog-notice is-error">{error}</div>}
    {notice && <div className="cog-notice is-success">{notice}</div>}
    {loading && <div className="cog-notice">Sincronizando estado cognitivo…</div>}

    <section className="cog-status-grid">
      <article className="cog-agent-card">
        <div className="cog-orb" aria-hidden="true"><span /><i /></div>
        <div><p className="admin-kicker">AGENTE PERSISTENTE</p><h2>{liveAgent?.name || 'Peter Cognitive Core'}</h2><p>{liveAgent?.purpose || 'Aprender com o uso do ecossistema mantendo memória, evidência e continuidade.'}</p><div className="cog-agent-meta"><span>Status: <b>{liveAgent?.status || '—'}</b></span><span>Última atividade: <b>{dateTime(liveAgent?.last_active_at)}</b></span><span>Ambiente: <b>{system.environment || '—'}</b></span></div></div>
      </article>
      <article className="cog-safety-card"><p className="admin-kicker">CONTROLES</p><h3>Aprendizado controlado</h3><div><span>Observer automático</span><b className={system.auto_learn ? 'is-on' : 'is-off'}>{system.auto_learn ? 'Ativo' : 'Desligado'}</b></div><div><span>Metas autogeradas</span><b className={system.allow_self_generated_goals ? 'is-warn' : 'is-on'}>{system.allow_self_generated_goals ? 'Permitidas' : 'Bloqueadas'}</b></div><div><span>Limiar de memória</span><b>{pct(system.memory_threshold)}</b></div><div><span>Fila</span><b>{system.queue || 'default'}</b></div></article>
    </section>

    <section className="cog-metrics">
      <MetricCard label="Observações" value={summary.observations || 0} hint={`${summary.observations_24h || 0} nas últimas 24h`} />
      <MetricCard label="Memórias ativas" value={summary.active_memories || 0} hint={`${summary.memory_reinforcements || 0} reforços acumulados`} tone="good" />
      <MetricCard label="Crenças" value={summary.beliefs || 0} hint={`${summary.uncertain_beliefs || 0} incertas · ${summary.retracted_beliefs || 0} retraídas`} />
      <MetricCard label="Confiança média" value={pct(summary.belief_confidence_avg)} hint={`memórias ${pct(summary.memory_confidence_avg)}`} tone="good" />
      <MetricCard label="Contradição" value={pct(summary.contradiction_rate)} hint={`${summary.contradiction_count || 0} contradições / ${summary.evidence_count || 0} evidências`} tone={contradictionTone} />
      <MetricCard label="Aprendizados / 24h" value={summary.learning_events_24h || 0} hint={`${summary.learning_events || 0} eventos no histórico`} />
    </section>

    <section className="cog-grid cog-overview-grid">
      <article className="cog-panel cog-timeline-panel"><div className="cog-panel-head"><div><p className="admin-kicker">EVOLUÇÃO TEMPORAL</p><h2>Uso → observação → aprendizado</h2></div><div className="cog-legend"><span><i className="is-observation" />Observações</span><span><i className="is-learning" />Aprendizados</span></div></div><Timeline rows={dashboard?.timeline || []} /></article>
      <article className="cog-panel cog-state-panel"><div className="cog-panel-head"><div><p className="admin-kicker">ESTADO INTERNO</p><h2>Último snapshot</h2></div><small>{dateTime(dashboard?.recent?.state?.captured_at)}</small></div>{dashboard?.recent?.state ? <div className="cog-state-grid"><div><span>Crenças no snapshot</span><strong>{dashboard.recent.state.metrics?.belief_count ?? 0}</strong></div><div><span>Memórias</span><strong>{dashboard.recent.state.metrics?.memory_count ?? 0}</strong></div><div><span>Metas ativas</span><strong>{dashboard.recent.state.active_goals?.length ?? 0}</strong></div><div><span>Incertezas</span><strong>{dashboard.recent.state.uncertainties?.length ?? 0}</strong></div></div> : <Empty>Nenhum snapshot capturado ainda.</Empty>}</article>
    </section>

    <section className="cog-panel">
      <div className="cog-panel-head"><div><p className="admin-kicker">CRENÇAS CONSOLIDADAS</p><h2>O que o agente acredita e com quanta confiança</h2></div><span>{summary.active_beliefs || 0} ativas</span></div>
      {beliefs.length ? <div className="cog-table-wrap"><table><thead><tr><th>Crença</th><th>Confiança</th><th>Evidências</th><th>Contradições</th><th>Status</th><th>Atualizada</th></tr></thead><tbody>{beliefs.map(belief => <tr key={belief.id}><td><strong>{belief.subject}</strong><span>{belief.predicate} · {belief.object_key}</span></td><td><Confidence value={belief.confidence} /></td><td>{belief.evidence_count || 0}</td><td className={Number(belief.contradiction_count || 0) ? 'is-attention' : ''}>{belief.contradiction_count || 0}</td><td><span className={`cog-status is-${belief.status}`}>{belief.status}</span></td><td>{dateTime(belief.last_evidence_at || belief.updated_at)}</td></tr>)}</tbody></table></div> : <Empty>As primeiras crenças aparecerão conforme o ecossistema gerar evidências suficientes.</Empty>}
    </section>

    <section className="cog-grid">
      <article className="cog-panel"><div className="cog-panel-head"><div><p className="admin-kicker">MEMÓRIA</p><h2>Memórias adquiridas</h2></div><span>{summary.active_memories || 0}</span></div><div className="cog-memory-list">{memories.map(memory => <article key={memory.id}><div><span>{memory.memory_type}</span><small>{dateTime(memory.created_at)}</small></div><strong>{memory.title || memory.summary?.slice(0, 90) || 'Memória'}</strong><p>{memory.summary}</p><footer><span>Importância {pct(memory.importance)}</span><span>Confiança {pct(memory.confidence)}</span><span>Reforços {memory.reinforcement_count || 0}</span></footer></article>)}{!memories.length && <Empty>Nenhuma memória consolidada ainda.</Empty>}</div></article>
      <article className="cog-panel"><div className="cog-panel-head"><div><p className="admin-kicker">TRILHA DE APRENDIZAGEM</p><h2>Como o estado está mudando</h2></div><span>{summary.learning_events || 0}</span></div><div className="cog-event-list">{learningEvents.map(event => <article key={event.id}><i className={Number(event.confidence_delta || 0) < 0 ? 'is-negative' : 'is-positive'} /><div><strong>{String(event.event_type || '').replaceAll('_', ' ')}</strong><p>{event.reason || 'Mudança cognitiva registrada com proveniência auditável.'}</p><small>{dateTime(event.created_at)} · Δ confiança {Number(event.confidence_delta || 0).toFixed(3)}</small></div></article>)}{!learningEvents.length && <Empty>Nenhum evento de aprendizagem registrado.</Empty>}</div></article>
    </section>

    <section className="cog-panel cog-research-panel">
      <div className="cog-panel-head"><div><p className="admin-kicker">PESQUISA DE CONSCIÊNCIA</p><h2>Indicadores e experimentos</h2><p>Resultados são evidências funcionais; não constituem prova de consciência subjetiva.</p></div><div className="cog-run-summary"><span><b>{summary.experiment_passed || 0}</b> passaram</span><span><b>{summary.experiment_failed || 0}</b> falharam</span><span><b>{summary.experiment_inconclusive || 0}</b> inconclusivos</span></div></div>
      <div className="cog-experiment-grid">{experiments.map(experiment => { const run = runByExperiment.get(experiment.id); return <article key={experiment.id}><header><span>{experiment.dimension}</span>{run && <b className={`is-${run.result}`}>{run.result}</b>}</header><h3>{experiment.name}</h3><p>{experiment.hypothesis}</p><footer><span>Peso {Number(experiment.weight || 0).toFixed(2)}</span><span>{run?.score != null ? `Último score ${pct(run.score)}` : 'Ainda não executado'}</span></footer></article> })}{!experiments.length && <Empty>O framework experimental ainda não foi inicializado.</Empty>}</div>
    </section>
  </main>
}
