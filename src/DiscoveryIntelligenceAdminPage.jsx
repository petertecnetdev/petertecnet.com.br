import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAdminContent,
  fetchDiscoveryAnalytics,
  fetchDiscoveryLandingCandidates,
  fetchSeoDiagnostics,
  fetchWebVitalAnalytics,
} from './discoveryApi.js'
import './DiscoveryIntelligenceAdminPage.css'

const metricLabel = { LCP: 'Largest Contentful Paint', INP: 'Interaction to Next Paint', CLS: 'Cumulative Layout Shift', FCP: 'First Contentful Paint', TTFB: 'Time to First Byte' }
const metricUnit = name => name === 'CLS' ? '' : ' ms'
const pathForIssue = issue => issue?.url || (issue?.type === 'item' ? '/admin/items' : issue?.type === 'establishment' ? '/admin/establishments' : '/admin/content')

function Stat({ label, value, hint, tone }) {
  return <article className={`di-stat ${tone ? `is-${tone}` : ''}`}><span>{label}</span><strong>{value ?? 0}</strong>{hint && <small>{hint}</small>}</article>
}

function VitalCard({ metric }) {
  const tone = metric.poor_rate >= 25 ? 'danger' : metric.good_rate >= 75 ? 'good' : 'warn'
  return <article className={`di-vital is-${tone}`}><header><span>{metric.name}</span><small>{metricLabel[metric.name]}</small></header><strong>{metric.p75}{metricUnit(metric.name)}</strong><div><span>p50 {metric.p50}{metricUnit(metric.name)}</span><span>p95 {metric.p95}{metricUnit(metric.name)}</span></div><footer><b>{metric.good_rate}% bom</b><em>{metric.poor_rate}% ruim</em></footer></article>
}

function Funnel({ rows = [] }) {
  const max = Math.max(...rows.map(row => Number(row.total || 0)), 1)
  return <div className="di-funnel">{rows.map(row => <div key={row.stage}><div><strong>{String(row.stage).replaceAll('_', ' ')}</strong><span>{row.total}</span></div><i><b style={{ width: `${Math.max(3, Number(row.total || 0) / max * 100)}%` }} /></i></div>)}</div>
}

export default function DiscoveryIntelligenceAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [seo, setSeo] = useState(null)
  const [vitals, setVitals] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [content, setContent] = useState([])
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [analyticsPayload, seoPayload, vitalsPayload, candidatePayload, contentPayload] = await Promise.all([
        fetchDiscoveryAnalytics({ days }),
        fetchSeoDiagnostics(),
        fetchWebVitalAnalytics({ days }),
        fetchDiscoveryLandingCandidates({ limit: 80 }).catch(() => ({ data: [] })),
        fetchAdminContent().catch(() => ({ data: { entries: [] } })),
      ])
      setAnalytics(analyticsPayload?.data || null)
      setSeo(seoPayload?.data || null)
      setVitals(vitalsPayload?.data || null)
      setCandidates(candidatePayload?.data || [])
      setContent(contentPayload?.data?.entries || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const clusters = useMemo(() => {
    const map = new Map()
    content.filter(entry => entry.status === 'published').forEach(entry => {
      const key = entry.cluster || entry.category || 'sem-cluster'
      const row = map.get(key) || { name: key, total: 0, applications: new Set(), tags: new Set() }
      row.total += 1
      if (entry.application?.slug) row.applications.add(entry.application.slug)
      ;(entry.tags || []).forEach(tag => row.tags.add(tag))
      map.set(key, row)
    })
    return [...map.values()].map(row => ({ ...row, applications: [...row.applications], tags: [...row.tags] })).sort((a, b) => b.total - a.total)
  }, [content])

  const summary = analytics?.summary || {}
  const seoSummary = seo?.summary || {}
  const issues = seo?.issues || []
  const highIssues = issues.filter(issue => issue.severity === 'alta')
  const pathVitals = vitals?.paths || []

  return <main className="ecosystem-main discovery-intelligence-admin">
    <header className="ecosystem-top di-top"><div><p className="admin-kicker">Peter Tecnet Admin Center / Growth Intelligence</p><h1>SEO, descoberta e performance real</h1><p>Uma visão única do caminho busca → página → interesse → conversão, incluindo saúde técnica e Core Web Vitals dos usuários.</p></div><div className="top-actions"><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select><button type="button" onClick={load}>Atualizar</button><a href="/buscar" target="_blank" rel="noreferrer">Busca global ↗</a></div></header>

    {error && <div className="di-notice is-error">{error}</div>}
    {loading && <div className="di-notice">Atualizando inteligência de descoberta…</div>}

    <section className="di-stats">
      <Stat label="SEO score" value={`${seo?.score ?? 0}/100`} hint={`${seoSummary.indexable_pages || 0} páginas analisadas`} tone={(seo?.score || 0) >= 80 ? 'good' : (seo?.score || 0) >= 55 ? 'warn' : 'danger'} />
      <Stat label="Sessões" value={summary.sessions} hint={`${summary.page_views || 0} page views`} />
      <Stat label="CTA rate" value={`${summary.cta_rate || 0}%`} hint={`${summary.cta_clicks || 0} cliques`} />
      <Stat label="Conversão" value={`${summary.conversion_rate || 0}%`} hint={`${summary.conversions || 0} conversões`} tone="good" />
      <Stat label="Problemas críticos SEO" value={seoSummary.high_issues} hint={`${seoSummary.medium_issues || 0} médios`} tone={seoSummary.high_issues ? 'danger' : 'good'} />
      <Stat label="Sem tráfego / 30d" value={seoSummary.without_traffic_30d} hint="oportunidades de melhoria" tone={seoSummary.without_traffic_30d ? 'warn' : 'good'} />
    </section>

    <section className="di-grid">
      <article className="di-panel"><div className="di-panel-head"><div><p className="admin-kicker">AQUISIÇÃO</p><h2>Funil de descoberta</h2></div><a href="/admin/content">Gerenciar conteúdo →</a></div><Funnel rows={analytics?.funnel || []} /></article>
      <article className="di-panel"><div className="di-panel-head"><div><p className="admin-kicker">ORIGEM</p><h2>Canais que trazem sessões</h2></div></div><div className="di-source-list">{(analytics?.sources || []).slice(0, 10).map(row => <div key={row.source}><strong>{row.source}</strong><span>{row.sessions} sessões</span><b>{row.total} eventos</b></div>)}</div></article>
    </section>

    <section className="di-panel di-vitals-panel"><div className="di-panel-head"><div><p className="admin-kicker">REAL USER MONITORING</p><h2>Core Web Vitals reais</h2><p>{vitals?.samples || 0} amostras coletadas diretamente dos navegadores.</p></div></div><div className="di-vitals">{(vitals?.metrics || []).length ? vitals.metrics.map(metric => <VitalCard metric={metric} key={metric.name} />) : <p className="di-empty">As primeiras métricas aparecerão depois que visitantes navegarem pela versão com RUM ativo.</p>}</div>{pathVitals.length > 0 && <div className="di-table-wrap"><table><thead><tr><th>Página</th><th>Amostras</th><th>Ruins</th><th>p75 por métrica</th></tr></thead><tbody>{pathVitals.slice(0, 20).map(row => <tr key={row.path}><td><a href={row.path} target="_blank" rel="noreferrer">{row.path}</a></td><td>{row.samples}</td><td>{row.poor}</td><td>{row.metrics.map(metric => `${metric.name} ${metric.p75}${metricUnit(metric.name)}`).join(' · ')}</td></tr>)}</tbody></table></div>}</section>

    <section className="di-grid di-seo-grid">
      <article className="di-panel"><div className="di-panel-head"><div><p className="admin-kicker">SEO HEALTH</p><h2>Prioridades automáticas</h2></div><span>{issues.length} achados</span></div><div className="di-issue-list">{issues.slice(0, 50).map((issue, index) => <a href={pathForIssue(issue)} key={`${issue.type}-${issue.id}-${issue.code}-${index}`} className={`is-${issue.severity}`}><span>{issue.severity}</span><div><strong>{issue.label}</strong><p>{issue.message}</p><small>{issue.code}</small></div></a>)}{!issues.length && <p className="di-empty">Nenhum problema SEO relevante encontrado.</p>}</div></article>
      <article className="di-panel"><div className="di-panel-head"><div><p className="admin-kicker">PÁGINAS SEM TRAÇÃO</p><h2>Conteúdo que precisa de distribuição</h2></div></div><div className="di-quiet-list">{(seo?.without_traffic || []).slice(0, 35).map(row => <a href={row.url} target="_blank" rel="noreferrer" key={`${row.type}-${row.id}`}><small>{row.type}</small><strong>{row.label}</strong><span>Abrir página ↗</span></a>)}{!(seo?.without_traffic || []).length && <p className="di-empty">Todas as páginas analisadas possuem algum tráfego recente.</p>}</div></article>
    </section>

    <section className="di-grid">
      <article className="di-panel"><div className="di-panel-head"><div><p className="admin-kicker">CLUSTERS EDITORIAIS</p><h2>Teia semântica de conteúdo</h2></div><a href="/admin/content">Criar conteúdo →</a></div><div className="di-clusters">{clusters.map(cluster => <div key={cluster.name}><strong>{cluster.name}</strong><span>{cluster.total} conteúdos publicados</span><small>{cluster.tags.slice(0, 6).join(' · ') || 'Sem tags'}</small></div>)}{!clusters.length && <p className="di-empty">Publique conteúdo pela API para formar clusters automaticamente.</p>}</div></article>
      <article className="di-panel"><div className="di-panel-head"><div><p className="admin-kicker">PROGRAMMATIC SEO SEGURO</p><h2>Páginas locais elegíveis</h2></div><span>{candidates.length}</span></div><div className="di-candidates">{candidates.slice(0, 35).map(row => { const term = String(row.term).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); const city = row.city ? String(row.city).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : ''; return <a href={`/descobrir/${term}${city ? `/${city}` : ''}`} target="_blank" rel="noreferrer" key={`${row.term}-${row.city}`}><strong>{row.term}</strong><span>{row.city || 'Brasil'}</span><small>{row.count} itens · {row.establishments} empresas</small></a> })}{!candidates.length && <p className="di-empty">Novas páginas ficam elegíveis automaticamente quando houver volume suficiente de itens e empresas.</p>}</div></article>
    </section>

    {highIssues.length > 0 && <section className="di-notice is-warning"><strong>Prioridade recomendada:</strong> corrija primeiro os {highIssues.length} problemas de severidade alta; depois trabalhe páginas sem tráfego e clusters com pouca cobertura.</section>}
  </main>
}
