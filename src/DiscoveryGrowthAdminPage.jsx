import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createDiscoveryExperiment,
  fetchDiscoveryGrowth,
  rebuildDiscoverySearchIndex,
  runPublicDiscoveryMonitor,
  syncSearchPerformance,
  updateDiscoveryExperiment,
} from './discoveryApi.js'
import './DiscoveryGrowthAdminPage.css'

const emptyExperiment = {
  name: '',
  key: '',
  surface: 'landing.hero',
  goal_event: 'conversion',
  allocation_percent: 100,
  status: 'draft',
  control_headline: '',
  challenger_headline: '',
  control_cta: 'Explorar soluções',
  challenger_cta: 'Conhecer agora',
  cta_url: '/buscar',
}

function Metric({ label, value, hint }) {
  return <article className="growth-metric"><small>{label}</small><strong>{value ?? '—'}</strong>{hint && <span>{hint}</span>}</article>
}

function Badge({ children, tone = 'neutral' }) {
  return <span className={`growth-badge tone-${tone}`}>{children}</span>
}

function percent(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'
}

function providerLabel(key) {
  return key === 'google' ? 'Google Search Console' : key === 'bing' ? 'Bing Webmaster' : key
}

export default function DiscoveryGrowthAdminPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [experimentForm, setExperimentForm] = useState(emptyExperiment)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await fetchDiscoveryGrowth({ days })
      setData(payload?.data || {})
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar o Growth Loop.')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const run = async (label, fn) => {
    setAction(label)
    setMessage('')
    setError('')
    try {
      const result = await fn()
      setMessage(result || 'Operação concluída.')
      await load()
    } catch (err) {
      setError(err?.message || 'A operação falhou.')
    } finally {
      setAction('')
    }
  }

  const searchTotals = useMemo(() => {
    const rows = data?.search_performance || []
    const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0)
    const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0)
    return { clicks, impressions, ctr: impressions ? clicks / impressions * 100 : 0 }
  }, [data])

  const saveExperiment = async event => {
    event.preventDefault()
    const payload = {
      name: experimentForm.name.trim(),
      key: experimentForm.key.trim(),
      surface: experimentForm.surface.trim(),
      goal_event: experimentForm.goal_event.trim() || 'conversion',
      allocation_percent: Number(experimentForm.allocation_percent || 100),
      status: experimentForm.status,
      variants: [
        { key: 'control', payload: { headline: experimentForm.control_headline.trim(), cta_label: experimentForm.control_cta.trim(), cta_url: experimentForm.cta_url.trim() || '/buscar' } },
        { key: 'challenger', payload: { headline: experimentForm.challenger_headline.trim(), cta_label: experimentForm.challenger_cta.trim(), cta_url: experimentForm.cta_url.trim() || '/buscar' } },
      ],
    }
    if (!payload.name || !payload.key || !payload.surface || !payload.variants.every(row => row.payload.headline)) {
      setError('Preencha nome, chave, superfície e os dois títulos do experimento.')
      return
    }
    await run('experiment', async () => {
      await createDiscoveryExperiment(payload)
      setExperimentForm(emptyExperiment)
      return 'Experimento criado. Ele só entra na experiência pública quando o status estiver “running”.'
    })
  }

  const toggleExperiment = experiment => run(`experiment-${experiment.id}`, async () => {
    const next = experiment.status === 'running' ? 'paused' : 'running'
    await updateDiscoveryExperiment(experiment.id, { status: next })
    return next === 'running' ? 'Experimento iniciado.' : 'Experimento pausado.'
  })

  if (loading && !data) return <main className="growth-admin"><div className="growth-loading">Carregando Discovery Growth Loop…</div></main>

  const providers = data?.providers || {}
  const opportunities = data?.opportunities || []
  const attribution = data?.attribution || []
  const experiments = data?.experiments || []
  const quality = data?.quality || {}
  const accessibility = data?.accessibility || {}
  const publicHealth = data?.public_health || {}

  return <main className="growth-admin">
    <header className="growth-hero">
      <div><small>DISCOVERY LEARNING LOOP</small><h1>Aquisição, experimentos e aprendizado</h1><p>Transforma sinais de busca, comportamento, qualidade técnica e conversões em oportunidades de crescimento mensuráveis para todo o ecossistema.</p></div>
      <div className="growth-toolbar"><label>Janela<select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option></select></label><button type="button" onClick={load} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
    </header>

    {(message || error) && <div className={`growth-alert ${error ? 'is-error' : 'is-success'}`}>{error || message}</div>}

    <section className="growth-metrics" aria-label="Indicadores principais">
      <Metric label="Impressões orgânicas" value={searchTotals.impressions.toLocaleString('pt-BR')} hint={`${searchTotals.clicks.toLocaleString('pt-BR')} cliques`} />
      <Metric label="CTR orgânico" value={percent(searchTotals.ctr)} hint={`${opportunities.length} oportunidades`} />
      <Metric label="Qualidade média" value={quality.average == null ? 'Sem amostra' : `${quality.average}/100`} hint={`${quality.ready || 0} prontos para publicar`} />
      <Metric label="Acessibilidade" value={accessibility.average_score == null ? 'Coletando' : `${accessibility.average_score}/100`} hint={`${accessibility.samples || 0} amostras reais`} />
      <Metric label="Saúde pública" value={`${publicHealth.healthy || 0}/${publicHealth.pages || 0}`} hint={`${publicHealth.unhealthy || 0} páginas com alerta`} />
      <Metric label="Índice de busca" value={(data?.search_index_documents || 0).toLocaleString('pt-BR')} hint="documentos ranqueáveis" />
    </section>

    <section className="growth-grid two">
      <article className="growth-card">
        <header><div><small>AQUISIÇÃO ORGÂNICA</small><h2>Google e Bing</h2></div><button type="button" disabled={!!action} onClick={() => run('search-sync', async () => { const payload = await syncSearchPerformance({ days: Math.min(days, 90) }); const failed = Object.entries(payload?.data || {}).filter(([, row]) => !row.success); return failed.length ? `Sincronização parcial: ${failed.map(([key]) => providerLabel(key)).join(', ')} sem dados/credenciais.` : 'Dados dos buscadores sincronizados.' })}>{action === 'search-sync' ? 'Sincronizando…' : 'Sincronizar agora'}</button></header>
        <div className="growth-provider-list">{Object.entries(providers).map(([key, provider]) => <div key={key}><span><strong>{providerLabel(key)}</strong><small>{provider.site_url || 'Site ainda não configurado'}</small></span><Badge tone={provider.configured ? 'good' : 'warn'}>{provider.configured ? 'Configurado' : 'Pendente'}</Badge></div>)}</div>
        <div className="growth-table-wrap"><table><thead><tr><th>Fonte</th><th>Cliques</th><th>Impressões</th><th>CTR</th><th>Posição</th></tr></thead><tbody>{(data?.search_performance || []).map(row => <tr key={row.provider}><td>{providerLabel(row.provider)}</td><td>{Number(row.clicks).toLocaleString('pt-BR')}</td><td>{Number(row.impressions).toLocaleString('pt-BR')}</td><td>{percent(row.ctr)}</td><td>{row.position ?? '—'}</td></tr>)}{!(data?.search_performance || []).length && <tr><td colSpan="5">Nenhum dado importado ainda.</td></tr>}</tbody></table></div>
      </article>

      <article className="growth-card">
        <header><div><small>SEO OPPORTUNITY ENGINE</small><h2>Próximas ações</h2></div><Badge tone={opportunities.length ? 'warn' : 'good'}>{opportunities.length}</Badge></header>
        <div className="growth-scroll-list">{opportunities.slice(0, 18).map((row, index) => <div className="growth-opportunity" key={`${row.provider}-${row.query}-${index}`}><span><strong>{row.query || row.page || 'Oportunidade orgânica'}</strong><small>{row.reason}</small></span><div><Badge>{row.position ? `Pos. ${row.position}` : row.provider}</Badge><Badge tone="warn">{row.impressions} imp.</Badge></div></div>)}{!opportunities.length && <p className="growth-empty">O motor ainda não encontrou oportunidades. Elas aparecem após os primeiros dados de busca.</p>}</div>
      </article>
    </section>

    <section className="growth-grid two">
      <article className="growth-card">
        <header><div><small>SEARCH ENGINE</small><h2>Índice ranqueado + cache</h2></div><button type="button" disabled={!!action} onClick={() => run('index', async () => { const payload = await rebuildDiscoverySearchIndex(); return `Índice reconstruído com ${payload?.data?.documents || 0} documentos.` })}>{action === 'index' ? 'Reconstruindo…' : 'Reconstruir índice'}</button></header>
        <p>Produtos, serviços, empresas, conteúdos e plataformas entram no mesmo índice genérico. O ranking considera correspondência, intenção, cidade, boost de entidade e tolerância simples a erro de digitação.</p>
        <div className="growth-callout"><strong>{(data?.search_index_documents || 0).toLocaleString('pt-BR')}</strong><span>documentos disponíveis para busca e recomendação</span></div>
      </article>

      <article className="growth-card">
        <header><div><small>PUBLIC RELIABILITY</small><h2>Monitor de páginas</h2></div><button type="button" disabled={!!action} onClick={() => run('monitor', async () => { const payload = await runPublicDiscoveryMonitor(80); return `${payload?.data?.checked || 0} páginas verificadas.` })}>{action === 'monitor' ? 'Verificando…' : 'Verificar agora'}</button></header>
        <div className="growth-health-summary"><span><b>{publicHealth.healthy || 0}</b> saudáveis</span><span><b>{publicHealth.unhealthy || 0}</b> com alerta</span></div>
        <div className="growth-scroll-list compact">{(publicHealth.checks || []).filter(row => !row.ok).slice(0, 12).map(row => <div key={row.path}><span><strong>{row.path}</strong><small>{(row.issues || []).join(' · ') || `HTTP ${row.status_code || '?'}`}</small></span><Badge tone="bad">Revisar</Badge></div>)}{!(publicHealth.checks || []).length && <p className="growth-empty">O monitor ainda não possui histórico. Ele roda automaticamente e também pode ser executado agora.</p>}</div>
      </article>
    </section>

    <section className="growth-card growth-experiments">
      <header><div><small>EXPERIMENTAÇÃO</small><h2>A/B tests genéricos</h2></div><Badge tone={experiments.some(row => row.status === 'running') ? 'good' : 'neutral'}>{experiments.filter(row => row.status === 'running').length} ativos</Badge></header>
      <div className="growth-experiment-layout">
        <form className="growth-experiment-form" onSubmit={saveExperiment}>
          <label>Nome<input value={experimentForm.name} onChange={event => setExperimentForm(row => ({ ...row, name: event.target.value }))} placeholder="Hero: proposta de valor" /></label>
          <label>Chave<input value={experimentForm.key} onChange={event => setExperimentForm(row => ({ ...row, key: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') }))} placeholder="landing-hero-value" /></label>
          <label>Superfície<select value={experimentForm.surface} onChange={event => setExperimentForm(row => ({ ...row, surface: event.target.value }))}><option value="landing.hero">Landing hero</option><option value="content.recommendation">Conteúdo / recomendação</option><option value="search.results">Busca / resultados</option><option value="catalog.recommendation">Catálogo / recomendação</option><option value="public.discovery">Discovery público</option></select></label>
          <label>Alocação (%)<input type="number" min="1" max="100" value={experimentForm.allocation_percent} onChange={event => setExperimentForm(row => ({ ...row, allocation_percent: event.target.value }))} /></label>
          <label className="span-2">Título controle<input value={experimentForm.control_headline} onChange={event => setExperimentForm(row => ({ ...row, control_headline: event.target.value }))} placeholder="Soluções digitais para crescer" /></label>
          <label className="span-2">Título challenger<input value={experimentForm.challenger_headline} onChange={event => setExperimentForm(row => ({ ...row, challenger_headline: event.target.value }))} placeholder="Encontre a solução certa agora" /></label>
          <label>CTA controle<input value={experimentForm.control_cta} onChange={event => setExperimentForm(row => ({ ...row, control_cta: event.target.value }))} /></label>
          <label>CTA challenger<input value={experimentForm.challenger_cta} onChange={event => setExperimentForm(row => ({ ...row, challenger_cta: event.target.value }))} /></label>
          <label className="span-2">Destino<input value={experimentForm.cta_url} onChange={event => setExperimentForm(row => ({ ...row, cta_url: event.target.value }))} placeholder="/buscar" /></label>
          <button className="span-2" type="submit" disabled={!!action}>{action === 'experiment' ? 'Criando…' : 'Criar experimento'}</button>
        </form>
        <div className="growth-experiment-list">{experiments.map(experiment => <article key={experiment.id}><header><span><strong>{experiment.name}</strong><small>{experiment.surface} · {experiment.key}</small></span><button type="button" disabled={!!action} onClick={() => toggleExperiment(experiment)}>{experiment.status === 'running' ? 'Pausar' : 'Iniciar'}</button></header><div>{(experiment.variants || []).map(variant => <span key={variant.key}><b>{variant.key}</b><strong>{variant.exposures || 0}</strong><small>exposições</small><em>{variant.conversions || 0} conv. · {percent(variant.rate)}</em></span>)}</div></article>)}{!experiments.length && <p className="growth-empty">Nenhum experimento criado ainda.</p>}</div>
      </div>
    </section>

    <section className="growth-grid two">
      <article className="growth-card">
        <header><div><small>PUBLICATION QUALITY</small><h2>Score automático</h2></div><Badge tone={(quality.average || 0) >= 80 ? 'good' : 'warn'}>{quality.average ?? '—'}/100</Badge></header>
        <div className="growth-quality-bars"><span><b>{quality.ready || 0}</b> prontos para publicar</span><span><b>{quality.needs_attention || 0}</b> precisam de atenção</span></div>
        <div className="growth-scroll-list compact">{(quality.rows || []).slice(0, 16).map(row => <a href={row.url} key={`${row.type}-${row.id}`}><span><strong>{row.label}</strong><small>Falta: {(row.missing || []).join(', ') || 'nenhum requisito crítico'}</small></span><Badge tone={row.score >= 80 ? 'good' : row.score < 60 ? 'bad' : 'warn'}>{row.score}</Badge></a>)}</div>
      </article>

      <article className="growth-card">
        <header><div><small>ACCESSIBILITY RUM</small><h2>WCAG em navegação real</h2></div><Badge tone={(accessibility.average_score || 0) >= 90 ? 'good' : 'warn'}>{accessibility.average_score ?? '—'}/100</Badge></header>
        <p>A coleta registra apenas tipos e quantidades de problemas estruturais — não captura texto digitado, conteúdo privado ou dados sensíveis.</p>
        <div className="growth-scroll-list compact">{(accessibility.pages || []).slice(0, 16).map(row => <div key={row.path}><span><strong>{row.path}</strong><small>{row.samples} amostras · {row.issues} ocorrências</small></span><Badge tone={row.score >= 90 ? 'good' : row.score < 70 ? 'bad' : 'warn'}>{row.score}</Badge></div>)}{!accessibility.pages?.length && <p className="growth-empty">As primeiras amostras aparecem conforme usuários reais navegam pelas páginas públicas.</p>}</div>
      </article>
    </section>

    <section className="growth-card">
      <header><div><small>CONVERSION ATTRIBUTION</small><h2>Origem → intenção → conversão</h2></div><Badge>{attribution.reduce((sum, row) => sum + Number(row.conversions || 0), 0)} conversões</Badge></header>
      <div className="growth-table-wrap"><table><thead><tr><th>Origem</th><th>Termo</th><th>Campanha</th><th>Sessões</th><th>Conversões</th></tr></thead><tbody>{attribution.map((row, index) => <tr key={`${row.source}-${row.term}-${index}`}><td>{row.source}</td><td>{row.term || '—'}</td><td>{row.campaign || '—'}</td><td>{row.sessions}</td><td>{row.conversions}</td></tr>)}{!attribution.length && <tr><td colSpan="5">As conversões atribuídas aparecerão aqui quando os fluxos chamarem o evento genérico de conversão.</td></tr>}</tbody></table></div>
    </section>
  </main>
}
