import { useEffect, useMemo, useState } from 'react'
import {
  fetchDiscoveryExperiment,
  fetchDiscoveryRecommendations,
  getDiscoverySessionId,
  sendDiscoveryExperimentEvent,
  trackDiscoveryEvent,
} from './discoveryApi.js'
import './PublicLearningOverlay.css'

function surfaceForPath(path) {
  if (path === '/') return 'landing.hero'
  if (path.startsWith('/blog/')) return 'content.recommendation'
  if (path === '/buscar') return 'search.results'
  if (path.startsWith('/solucoes/') || path.startsWith('/empresas/')) return 'catalog.recommendation'
  return 'public.discovery'
}

export default function PublicLearningOverlay() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const surface = useMemo(() => surfaceForPath(path), [path])
  const sessionId = useMemo(() => getDiscoverySessionId(), [])
  const [experiment, setExperiment] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchDiscoveryExperiment({ surface, session_id: sessionId, application: 'peter-tecnet' }, controller.signal)
      .then(payload => setExperiment(payload?.data || null))
      .catch(() => null)
    fetchDiscoveryRecommendations({ session_id: sessionId, limit: 5 }, controller.signal)
      .then(payload => setRecommendations(payload?.data || []))
      .catch(() => setRecommendations([]))
    return () => controller.abort()
  }, [surface, sessionId])

  useEffect(() => {
    if (!experiment?.experiment_id || !experiment?.variant_key) return
    sendDiscoveryExperimentEvent({
      experiment_id: experiment.experiment_id,
      variant_key: experiment.variant_key,
      session_id: sessionId,
      event_type: 'exposure',
      metadata: { path, goal: experiment.goal_event },
    }).catch(() => null)
  }, [experiment, path, sessionId])

  const payload = experiment?.payload || {}
  const heroVisible = path === '/' && experiment && (payload.headline || payload.body || payload.cta_label)

  const experimentClick = () => {
    if (!experiment) return
    sendDiscoveryExperimentEvent({
      experiment_id: experiment.experiment_id,
      variant_key: experiment.variant_key,
      session_id: sessionId,
      event_type: 'conversion',
      metadata: { path, goal: experiment.goal_event || 'cta_click' },
    }).catch(() => null)
    trackDiscoveryEvent('cta_click', {
      entityType: 'experiment',
      entityId: experiment.key,
      metadata: { destination: payload.cta_url || '/buscar', position: surface, experiment_id: experiment.experiment_id, variant_key: experiment.variant_key },
    })
  }

  return <>
    {heroVisible && <section className={`learning-experiment-hero layout-${payload.layout || 'compact'}`} aria-label="Experiência personalizada">
      <div>
        <small>EXPERIÊNCIA EM OTIMIZAÇÃO</small>
        <strong>{payload.headline || 'Encontre a melhor solução para o que você precisa.'}</strong>
        {payload.body && <p>{payload.body}</p>}
      </div>
      <a href={payload.cta_url || '/buscar'} onClick={experimentClick}>{payload.cta_label || 'Explorar soluções'}</a>
    </section>}

    {recommendations.length > 0 && <aside className={`learning-recommendation-dock ${open ? 'is-open' : ''}`} aria-label="Recomendações para você">
      <button type="button" className="learning-dock-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span>✦</span><strong>Para você</strong><small>{recommendations.length}</small>
      </button>
      {open && <div className="learning-dock-panel">
        <header><div><small>DISCOVERY LEARNING</small><strong>Próximos caminhos</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar recomendações">×</button></header>
        <div>{recommendations.map(row => <a href={row.url} key={`${row.type}-${row.id}`} onClick={() => trackDiscoveryEvent('cta_click', { entityType: row.type, entityId: row.id, metadata: { destination: row.url, position: 'recommendation-rail', category: row.category } })}>
          <small>{row.category || (row.type === 'item' ? 'Produto/serviço' : row.type)}</small>
          <strong>{row.title}</strong>
          <span>{row.location || row.description || 'Abrir recomendação →'}</span>
        </a>)}</div>
      </div>}
    </aside>}
  </>
}
