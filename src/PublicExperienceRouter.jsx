import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PublicDiscoveryExperience from './PublicDiscoveryExperience.jsx'
import SmartImage from './components/SmartImage.jsx'
import { formatCurrency, getItemImage } from './landingApi.js'
import { updatePageSeo } from './seo.js'
import {
  fetchContentEntry,
  fetchDiscoveryLanding,
  fetchDiscoverySearch,
  trackDiscoveryEvent,
} from './discoveryApi.js'
import './PublicExperienceRouter.css'
import './NavDiscoverySearch.css'

const ORIGIN = 'https://petertecnet.com.br'
const FALLBACK_GROUP_LABELS = {
  applications: 'Plataformas',
  items: 'Produtos e serviços',
  establishments: 'Empresas',
  content: 'Conteúdos',
  events: 'Eventos',
  artists: 'Artistas',
}
const TYPE_LABELS = {
  application: 'Plataforma', item: 'Produto/serviço', establishment: 'Empresa',
  content: 'Conteúdo', event: 'Evento', artist: 'Artista',
}
const searchCache = new Map()

function groupEntries(data) {
  const results = data?.results || {}
  const labels = { ...FALLBACK_GROUP_LABELS, ...(data?.group_labels || {}) }
  return Object.entries(results)
    .filter(([, rows]) => Array.isArray(rows) && rows.length)
    .map(([key, rows]) => ({ key, label: labels[key] || key.replaceAll('_', ' '), rows }))
}

function flattenResults(data) {
  return groupEntries(data).flatMap(group => group.rows.map(row => ({ ...row, groupKey: group.key, groupLabel: group.label })))
}

function ResultThumb({ result }) {
  const src = result.image_url || result.image || result.logo || null
  if (!src) return <span className="search-result-thumb is-fallback" aria-hidden="true">{String(result.title || '?').slice(0, 1).toUpperCase()}</span>
  return <span className="search-result-thumb"><img src={src} alt="" loading="lazy" /></span>
}

function ResultMeta({ result, compact = false }) {
  const metadata = Array.isArray(result.metadata) ? result.metadata.filter(row => row?.value) : []
  if (!metadata.length && !result.location && !result.category && result.price == null) return null
  return <div className={`search-result-meta ${compact ? 'is-compact' : ''}`}>
    {result.location && <span>{result.location}</span>}
    {!result.location && result.category && <span>{result.category}</span>}
    {!compact && metadata.slice(0, 4).map((row, index) => <span key={`${row.label}-${index}`}><b>{row.label}:</b> {row.value}</span>)}
    {result.price != null && <strong>{formatCurrency(result.price)}</strong>}
  </div>
}

function SearchInput({ initial = '', city = '', compact = false }) {
  const [query, setQuery] = useState(initial)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef(null)

  useEffect(() => setQuery(initial), [initial])
  useEffect(() => {
    const close = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) {
      setResults(null)
      setLoading(false)
      setOpen(false)
      setActiveIndex(-1)
      return undefined
    }

    const cacheKey = `${value.toLocaleLowerCase('pt-BR')}|${city.toLocaleLowerCase('pt-BR')}|${compact ? 1 : 0}`
    if (searchCache.has(cacheKey)) {
      setResults(searchCache.get(cacheKey))
      setOpen(true)
      return undefined
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setOpen(true)
      fetchDiscoverySearch({ q: value, city: city || undefined, limit: compact ? 6 : 10 }, controller.signal)
        .then(payload => {
          const data = payload?.data || null
          if (data) searchCache.set(cacheKey, data)
          if (searchCache.size > 50) searchCache.delete(searchCache.keys().next().value)
          setResults(data)
        })
        .catch(error => {
          if (error?.name !== 'AbortError') setResults(null)
        })
        .finally(() => setLoading(false))
    }, compact ? 180 : 220)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [query, city, compact])

  const allResults = flattenResults(results)
  const top = allResults.slice(0, compact ? 7 : 10)
  const total = results?.totals ? Object.values(results.totals).reduce((sum, value) => sum + Number(value || 0), 0) : allResults.length

  const navigateTo = result => {
    if (!result?.url) return
    trackDiscoveryEvent('cta_click', { entityType: result.type, entityId: result.id, metadata: { destination: result.url, position: 'global-search' } })
    window.location.assign(result.url)
  }

  const submit = event => {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    trackDiscoveryEvent('search', { entityType: 'search', entityId: value, metadata: { term: value } })
    const params = new URLSearchParams({ q: value })
    if (city) params.set('city', city)
    window.location.assign(`/buscar?${params}`)
  }

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (!top.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex(index => (index + 1) % top.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex(index => (index <= 0 ? top.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      navigateTo(top[activeIndex])
    }
  }

  return <div ref={rootRef} className={`global-discovery ${compact ? 'is-compact' : ''}`}>
    <form onSubmit={submit} className="global-discovery-form" role="search">
      <span className="global-discovery-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m21 21-4.35-4.35m2.35-5.15A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" /></svg></span>
      <input
        value={query}
        onChange={event => { setQuery(event.target.value); setActiveIndex(-1) }}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={compact ? 'Pesquisar no ecossistema…' : 'Busque produtos, serviços, empresas, eventos, artistas e conteúdos…'}
        aria-label="Busca global Peter Tecnet"
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
      />
      {query && <button className="global-discovery-clear" type="button" aria-label="Limpar busca" onClick={() => { setQuery(''); setResults(null); setOpen(false) }}>×</button>}
      {loading && <span className="global-discovery-loader" aria-label="Pesquisando" />}
      {!compact && <button className="global-discovery-submit" type="submit">Buscar</button>}
    </form>

    {open && query.trim().length >= 2 && <div className="global-discovery-suggestions" role="listbox">
      <div className="global-discovery-panel-head">
        <span>{loading ? 'Pesquisando em toda a API pública…' : `${total} resultado${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}`}</span>
        {!loading && results?.intent?.dominant_entity && <small>Busca global</small>}
      </div>
      {!loading && top.map((result, index) => <a
        href={result.url || '#'}
        role="option"
        aria-selected={activeIndex === index}
        className={activeIndex === index ? 'is-active' : ''}
        key={`${result.type}-${result.id}-${result.groupKey}`}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => trackDiscoveryEvent('cta_click', { entityType: result.type, entityId: result.id, metadata: { destination: result.url, position: 'global-search' } })}
      >
        <ResultThumb result={result} />
        <span className="global-discovery-result-copy">
          <small>{TYPE_LABELS[result.type] || result.groupLabel}</small>
          <strong>{result.title}</strong>
          {(result.description || result.location || result.category) && <span>{result.description || result.location || result.category}</span>}
          <ResultMeta result={result} compact />
        </span>
        <span className="global-discovery-arrow" aria-hidden="true">↗</span>
      </a>)}
      {!loading && top.length === 0 && <div className="global-discovery-empty"><strong>Nada encontrado.</strong><span>Tente outro termo ou uma busca mais ampla.</span></div>}
      {!loading && <a className="is-all" href={`/buscar?q=${encodeURIComponent(query.trim())}${city ? `&city=${encodeURIComponent(city)}` : ''}`}><span>Ver resultados completos</span><strong>→</strong></a>}
    </div>}
  </div>
}

function NavSearchPortal({ initial = '' }) {
  const [target, setTarget] = useState(null)
  useEffect(() => { setTarget(document.querySelector('.mkt-header .mkt-nav')) }, [])
  if (!target) return null
  return createPortal(<div className="mkt-discovery-search" role="search" aria-label="Busca global na navegação"><SearchInput initial={initial} compact /></div>, target)
}

function ResultGroup({ title, rows = [] }) {
  if (!rows.length) return null
  return <section className="search-result-group">
    <div className="search-result-heading"><h2>{title}</h2><span>{rows.length}</span></div>
    <div className="search-result-grid">{rows.map(row => <a className="search-result-card" href={row.url || '#'} key={`${row.type}-${row.id}`} onClick={() => trackDiscoveryEvent('cta_click', { entityType: row.type, entityId: row.id, metadata: { destination: row.url, position: 'search-results' } })}>
      <div className="search-result-card-top"><ResultThumb result={row} /><div><small>{TYPE_LABELS[row.type] || row.category || row.type}</small><strong>{row.title}</strong></div></div>
      <p>{row.description || row.location || 'Abrir resultado no ecossistema Peter Tecnet.'}</p>
      <ResultMeta result={row} />
      <span className="search-result-open">Ver detalhes <b>↗</b></span>
    </a>)}</div>
  </section>
}

function SearchGroups({ data }) {
  return groupEntries(data).map(group => <ResultGroup key={group.key} title={group.label} rows={group.rows} />)
}

function SearchPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const query = params.get('q') || ''
  const city = params.get('city') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(query))
  const [error, setError] = useState(false)

  useEffect(() => {
    updatePageSeo({ title: query ? `${query} | Busca Peter Tecnet` : 'Busca global | Peter Tecnet', description: 'Pesquise simultaneamente tudo que está publicado no ecossistema Peter Tecnet.', path: '/buscar', robots: 'noindex, follow' })
    if (!query) return undefined
    const controller = new AbortController()
    setError(false)
    fetchDiscoverySearch({ q: query, city: city || undefined, limit: 20 }, controller.signal)
      .then(payload => setData(payload?.data || null))
      .catch(error => { if (error?.name !== 'AbortError') setError(true) })
      .finally(() => setLoading(false))
    trackDiscoveryEvent('search', { entityType: 'search', entityId: query, metadata: { term: query } })
    return () => controller.abort()
  }, [query, city])

  const total = data?.totals ? Object.values(data.totals).reduce((sum, value) => sum + Number(value || 0), 0) : 0
  const discoverUrl = query ? `/descobrir/${encodeURIComponent(query.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))}${city ? `/${encodeURIComponent(city.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))}` : ''}` : null

  return <main className="search-page">
    <header className="search-page-hero"><a className="search-back" href="/">← Peter Tecnet</a><p>BUSCA GLOBAL</p><h1>Encontre qualquer coisa <span>pública no ecossistema.</span></h1><p className="search-page-lead">Uma única pesquisa para plataformas, empresas, catálogo, eventos, artistas e conteúdos publicados.</p><SearchInput initial={query} city={city} /></header>
    <div className="search-page-body">
      {loading && <div className="search-empty">Pesquisando em todas as fontes públicas da API…</div>}
      {error && !loading && <div className="search-empty"><h2>Não foi possível concluir a busca.</h2><p>Tente novamente em alguns instantes.</p></div>}
      {!loading && !error && query && <div className="search-summary"><strong>{total}</strong><span>resultados para “{query}”{city ? ` em ${city}` : ''}</span>{discoverUrl && total >= 4 && <a href={discoverUrl}>Abrir página de descoberta →</a>}</div>}
      {!loading && !error && query && total === 0 && <div className="search-empty"><h2>Nada encontrado ainda.</h2><p>Tente um termo mais amplo ou remova a cidade.</p></div>}
      {!loading && !error && <SearchGroups data={data} />}
    </div>
  </main>
}

function DiscoveryLandingPage({ term, city }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetchDiscoveryLanding({ q: term.replaceAll('-', ' '), city: city ? city.replaceAll('-', ' ') : undefined }, controller.signal)
      .then(payload => setData(payload?.data || null)).catch(() => setError(true))
    return () => controller.abort()
  }, [term, city])
  useEffect(() => {
    if (!data) return
    updatePageSeo({ title: data.seo?.title, description: data.seo?.description, path: data.seo?.canonical_path || window.location.pathname, robots: data.seo?.robots || (data.indexable ? 'index, follow' : 'noindex, follow'), schema: { '@context': 'https://schema.org', '@type': 'SearchResultsPage', name: data.seo?.title, description: data.seo?.description, url: `${ORIGIN}${data.seo?.canonical_path || window.location.pathname}` } })
    trackDiscoveryEvent('page_view', { entityType: 'discovery_landing', entityId: data.seo?.canonical_path, metadata: { term: data.query } })
  }, [data])
  if (error) return <PublicDiscoveryExperience />
  if (!data) return <main className="search-page"><div className="search-empty">Montando página de descoberta…</div></main>
  return <main className="search-page discovery-landing-page">
    <header className="search-page-hero"><a className="search-back" href="/">← Peter Tecnet</a><p>{data.indexable ? 'INDEXABLE DISCOVERY' : 'DISCOVERY'}</p><h1>{data.query}{data.city ? ` em ${data.city}` : ''}: <span>encontre o melhor caminho.</span></h1><p>{data.seo?.description}</p><SearchInput initial={data.query} city={data.city || ''} /></header>
    <div className="search-page-body">
      {!data.indexable && <div className="search-index-note">Esta página ainda não tem massa suficiente para indexação; ela continua útil para navegação e ganhará indexação automaticamente quando houver dados suficientes.</div>}
      <SearchGroups data={data} />
    </div>
  </main>
}

function RelatedProduct({ item }) {
  const establishment = item.establishment
  return <article className="article-related-product">
    <a href={`/solucoes/${item.slug || item.id}`} className="article-related-image"><SmartImage files={item.files} src={getItemImage(item)} alt={item.name} /></a>
    <div><small>{item.category || item.type || 'Catálogo'}</small><h3><a href={`/solucoes/${item.slug || item.id}`}>{item.name}</a></h3><p>{item.description || `Disponível em ${establishment?.fantasy || establishment?.name || 'um estabelecimento do ecossistema'}.`}</p><strong>{formatCurrency(item.price)}</strong>{establishment?.slug && <a className="article-company-link" href={`/empresas/${establishment.slug}`}>{establishment.fantasy || establishment.name} →</a>}</div>
  </article>
}

function EnhancedArticlePage({ slug }) {
  const [article, setArticle] = useState(null)
  const [fallback, setFallback] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetchContentEntry(slug, {}, controller.signal).then(payload => setArticle(payload?.data || null)).catch(() => setFallback(true))
    return () => controller.abort()
  }, [slug])
  useEffect(() => {
    if (!article) return
    const seo = article.seo || {}
    updatePageSeo({ title: seo.title || `${article.title} | Peter Tecnet`, description: seo.description || article.excerpt, path: `/blog/${article.slug}`, image: seo.og_image, type: 'article', schema: { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: seo.description || article.excerpt, datePublished: article.published_at, dateModified: article.updated_at || article.published_at, mainEntityOfPage: `${ORIGIN}/blog/${article.slug}`, author: { '@type': 'Organization', name: 'Peter Tecnet' }, publisher: { '@type': 'Organization', name: 'Peter Tecnet' } } })
    trackDiscoveryEvent('content_view', { entityType: 'content', entityId: article.slug, application: article.application?.slug })
  }, [article])
  if (fallback) return <PublicDiscoveryExperience />
  if (!article) return <main className="article-enhanced"><div className="search-empty">Carregando conteúdo pela API…</div></main>
  const paragraphs = String(article.content || '').split(/\n\s*\n/).filter(Boolean)
  return <main className="article-enhanced">
    <header className="article-enhanced-hero"><a href="/blog">← Conteúdo</a><p>{article.category || 'PETER TECNET DISCOVERY'}</p><h1>{article.title}</h1><div>{article.excerpt}</div><small>{article.cluster ? `Cluster: ${article.cluster}` : 'Peter Tecnet'}</small></header>
    <article className="article-enhanced-body">{paragraphs.map((block, index) => {
      if (/^#{2,3}\s/.test(block)) return <h2 id={`sec-${index}`} key={index}>{block.replace(/^#{2,3}\s+/, '')}</h2>
      if (/^[-*]\s/m.test(block)) return <ul key={index}>{block.split('\n').map(line => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean).map(line => <li key={line}>{line}</li>)}</ul>
      return <p key={index}>{block.replace(/^#\s+/, '')}</p>
    })}</article>
    {(article.related_items || []).length > 0 && <section className="article-related-section"><div className="article-section-heading"><p>DO CONTEÚDO PARA A AÇÃO</p><h2>Produtos e serviços relacionados</h2><span>As recomendações vêm do mesmo contexto semântico do artigo.</span></div><div className="article-related-grid">{article.related_items.map(item => <RelatedProduct item={item} key={item.id} />)}</div></section>}
    {(article.related_content || []).length > 0 && <section className="article-related-section"><div className="article-section-heading"><p>CLUSTER EDITORIAL</p><h2>Continue aprofundando o tema</h2></div><div className="article-content-links">{article.related_content.map(row => <a href={`/blog/${row.slug}`} key={row.id}><small>{row.category}</small><strong>{row.title}</strong><span>{row.excerpt}</span></a>)}</div></section>}
  </main>
}

function AdaptiveHome() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const intentTerm = params.get('utm_term') || params.get('intent') || params.get('q') || ''
  return <><PublicDiscoveryExperience /><NavSearchPortal initial={intentTerm} /></>
}

export default function PublicExperienceRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const discover = path.match(/^\/descobrir\/([^/]+)(?:\/([^/]+))?$/)
  const article = path.match(/^\/blog\/([^/]+)$/)
  if (path === '/buscar') return <SearchPage />
  if (discover) return <DiscoveryLandingPage term={decodeURIComponent(discover[1])} city={discover[2] ? decodeURIComponent(discover[2]) : null} />
  if (article) return <EnhancedArticlePage slug={decodeURIComponent(article[1])} />
  if (path === '/') return <AdaptiveHome />
  return <PublicDiscoveryExperience />
}
