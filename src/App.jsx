import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { AdminPage, LoginPage } from './Admin'
import {
  fetchApplications,
  fetchPeterCatalog,
  fetchPeterItem,
  fetchSite,
  formatCurrency,
  getItemImage,
  resolveAssetUrl,
} from './landingApi'
import useLandingMotion from './useLandingMotion'
import { updatePageSeo } from './seo'

const defaultContact = {
  email: 'contato@petertecnet.com.br',
  instagram: 'https://www.instagram.com/petertecnet/',
}

const solutionPaths = [
  {
    id: 'eventos',
    label: 'Eventos e ingressos',
    title: 'Quero criar eventos e vender ingressos',
    description: 'Organize produção, vendas, promoters, participantes e validação de entradas em uma operação digital.',
    slugs: ['cutinapp'],
  },
  {
    id: 'catalogo',
    label: 'Catálogo e presença',
    title: 'Quero colocar meus produtos e serviços online',
    description: 'Crie presença digital, organize itens e transforme seu catálogo em um ponto de descoberta e conversão.',
    slugs: ['nexus'],
  },
  {
    id: 'atendimento',
    label: 'Atendimento e vendas',
    title: 'Quero vender e acompanhar clientes melhor',
    description: 'Estruture atendimento, oportunidades, propostas, cobranças e follow-up em um fluxo comercial contínuo.',
    slugs: ['payflow', 'peter-payflow'],
  },
  {
    id: 'agenda',
    label: 'Agenda e serviços',
    title: 'Quero organizar agenda, equipe e serviços',
    description: 'Digitalize a operação de serviços com agenda, equipe, clientes e disponibilidade conectados.',
    slugs: ['rasoio'],
  },
  {
    id: 'crypto',
    label: 'Crypto e inteligência de mercado',
    title: 'Quero acompanhar o mercado cripto com mais inteligência',
    description: 'Use dados, monitoramento, análise de cenário, gestão de risco e automações para acompanhar ativos digitais com mais contexto e disciplina, sem promessas de retorno.',
    slugs: ['kryvion'],
  },
  {
    id: 'conexoes',
    label: 'Comunidade e conexões',
    title: 'Quero criar conexões e experiências sociais',
    description: 'Use produtos do ecossistema voltados a descoberta, relacionamento, comunidade e novas interações.',
    slugs: ['laora', 'plat'],
  },
]

const capabilities = [
  ['Produto digital', 'Da ideia à operação', 'Estratégia, experiência, engenharia e evolução contínua no mesmo ciclo.'],
  ['Integrações', 'Sistemas que conversam', 'APIs, autenticação, pagamentos, dados e automações conectados sem criar ilhas.'],
  ['Dados e inteligência', 'Informação para decidir melhor', 'IA, análise de dados, monitoramento e automações aplicadas a operações, produtos e mercados digitais.'],
  ['Software sob medida', 'Tecnologia para um problema real', 'Quando o produto pronto não resolve, construímos a solução certa para a operação.'],
]

const normalizeText = value => String(value || '').toLocaleLowerCase('pt-BR')

function MarketingHeader({ menuOpen, setMenuOpen }) {
  const closeMenu = () => setMenuOpen(false)
  return <header className="pt-nav">
    <a className="pt-brand" href="/#inicio" onClick={closeMenu} aria-label="Peter Tecnet — início">
      <span className="pt-brand-mark"><img src="/petertecnetlogo.png" alt="" /></span>
      <span><strong>Peter Tecnet</strong><small>Technology ecosystem</small></span>
    </a>
    <button className="pt-menu-toggle" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><span /><span /></button>
    <nav className={menuOpen ? 'pt-nav-links is-open' : 'pt-nav-links'} aria-label="Navegação principal">
      <a href="/#ecossistema" onClick={closeMenu}>Ecossistema</a>
      <a href="/#catalogo" onClick={closeMenu}>Catálogo</a>
      <a href="/#como-funciona" onClick={closeMenu}>Como funciona</a>
      <a href="/#empresa" onClick={closeMenu}>Para empresas</a>
      <a className="pt-nav-cta" href="/#comece" onClick={closeMenu}>Encontre sua solução <span>↗</span></a>
    </nav>
  </header>
}

function ApplicationCard({ application, index }) {
  return <article className="app-card" data-tilt>
    <div className="app-card-top">
      <span>{String(index + 1).padStart(2, '0')}</span>
      <span>{application.version ? `v${application.version}` : 'Peter Tecnet'}</span>
    </div>
    <div className="app-logo-wrap">
      <img src={resolveAssetUrl(application.logo) || '/petertecnetlogo.png'} alt={`Logo ${application.name}`} loading="lazy" />
    </div>
    <h3>{application.name}</h3>
    <p>{application.description || 'Produto digital desenvolvido e evoluído dentro do ecossistema Peter Tecnet.'}</p>
    {application.url && <a className="text-link" href={application.url} target="_blank" rel="noreferrer">Abrir plataforma <span>↗</span></a>}
  </article>
}

function CatalogCard({ item }) {
  const image = getItemImage(item)
  const identifier = item.slug || item.id
  return <article className="catalog-card" data-tilt>
    <a className="catalog-media" href={`/solucoes/${encodeURIComponent(identifier)}`} aria-label={`Ver ${item.name}`}>
      {image ? <img src={image} alt={item.name} loading="lazy" /> : <span className="catalog-placeholder"><img src="/petertecnetlogo.png" alt="" /></span>}
      {item.is_featured && <span className="featured-pill">Destaque</span>}
    </a>
    <div className="catalog-body">
      <div className="catalog-meta"><span>{item.category || item.type || 'Solução digital'}</span><strong>{formatCurrency(item.price)}</strong></div>
      <h3><a href={`/solucoes/${encodeURIComponent(identifier)}`}>{item.name}</a></h3>
      <p>{item.description || 'Solução disponível no catálogo Peter Tecnet.'}</p>
      <a className="text-link" href={`/solucoes/${encodeURIComponent(identifier)}`}>Ver detalhes <span>↗</span></a>
    </div>
  </article>
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [applications, setApplications] = useState([])
  const [appsStatus, setAppsStatus] = useState('loading')
  const [catalog, setCatalog] = useState([])
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [catalogCompany, setCatalogCompany] = useState(null)
  const [contact, setContact] = useState(defaultContact)
  const [selectedPath, setSelectedPath] = useState(solutionPaths[0].id)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('todos')
  const [showAllCatalog, setShowAllCatalog] = useState(false)

  useLandingMotion(true)

  useEffect(() => {
    updatePageSeo({
      title: 'Peter Tecnet | Software, IA, automações e tecnologia para o mercado crypto',
      description: 'Conheça o ecossistema Peter Tecnet: plataformas, software, IA, automações, integrações, produtos digitais e tecnologia para análise e inteligência no mercado cripto.',
      path: '/',
      keywords: ['Peter Tecnet', 'software', 'aplicativos', 'inteligência artificial', 'automação', 'APIs', 'integrações', 'crypto', 'cripto', 'criptomoedas', 'análise de mercado', 'ativos digitais', 'Kryvion'],
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      const [appsResult, siteResult] = await Promise.allSettled([
        fetchApplications(controller.signal),
        fetchSite(controller.signal),
      ])

      let loadedApplications = []
      if (appsResult.status === 'fulfilled') {
        loadedApplications = Array.isArray(appsResult.value?.applications) ? appsResult.value.applications : []
        setApplications(loadedApplications)
        setAppsStatus('success')
      } else {
        setAppsStatus('error')
      }

      if (siteResult.status === 'fulfilled' && siteResult.value?.site?.contact) {
        setContact(current => ({ ...current, ...siteResult.value.site.contact }))
      }

      try {
        const catalogPayload = await fetchPeterCatalog(loadedApplications, controller.signal)
        setCatalog(Array.isArray(catalogPayload.items) ? catalogPayload.items : [])
        setCatalogCompany(catalogPayload.establishment || null)
        setCatalogStatus('success')
      } catch (error) {
        if (error?.name !== 'AbortError') setCatalogStatus('error')
      }
    }

    load()
    return () => controller.abort()
  }, [])

  const categories = useMemo(() => {
    const values = catalog.map(item => item.category || item.type).filter(Boolean)
    return [...new Set(values)].slice(0, 10)
  }, [catalog])

  const filteredCatalog = useMemo(() => {
    const query = normalizeText(catalogQuery.trim())
    return catalog.filter(item => {
      const category = item.category || item.type || ''
      const matchesCategory = catalogCategory === 'todos' || category === catalogCategory
      const haystack = normalizeText(`${item.name} ${item.description} ${item.category} ${item.subcategory} ${item.brand}`)
      return matchesCategory && (!query || haystack.includes(query))
    })
  }, [catalog, catalogCategory, catalogQuery])

  const visibleCatalog = showAllCatalog ? filteredCatalog : filteredCatalog.slice(0, 8)
  const activePath = solutionPaths.find(path => path.id === selectedPath) || solutionPaths[0]
  const recommendedApps = applications.filter(application => activePath.slugs.includes(String(application.slug || '').toLowerCase()))

  return <div className="marketing-shell">
    <div className="scroll-progress" aria-hidden="true" />
    <div className="cursor-glow" aria-hidden="true" />
    <MarketingHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

    <main>
      <section className="pt-hero" id="inicio">
        <video className="pt-hero-video" autoPlay muted loop playsInline aria-hidden="true"><source src="/video.mp4" type="video/mp4" /></video>
        <div className="hero-atmosphere" aria-hidden="true" /><div className="hero-grid" aria-hidden="true" />
        <div className="hero-layout pt-container">
          <div className="hero-copy-block" data-reveal>
            <p className="eyebrow"><span /> Tecnologia para problemas reais</p>
            <h1>Encontre tecnologia para <em>vender, organizar, analisar e crescer.</em></h1>
            <p className="hero-lead">A Peter Tecnet cria e opera um ecossistema de plataformas, aplicativos e soluções digitais para negócios, operações e mercados digitais — agora também com tecnologia voltada a dados, inteligência e acompanhamento do mercado cripto.</p>
            <div className="hero-actions">
              <a className="pt-button pt-button-primary" href="#comece">Encontrar minha solução <span>↘</span></a>
              <a className="pt-button pt-button-secondary" href="#catalogo">Explorar catálogo <span>↗</span></a>
            </div>
            <div className="hero-trust"><span>CNPJ 42.595.409/0001-48</span><i /> <span>Produtos próprios + soluções empresariais + crypto</span></div>
          </div>

          <aside className="hero-console" data-reveal data-tilt aria-label="Ecossistema Peter Tecnet em tempo real">
            <div className="console-head"><span><i /> ECOSYSTEM / LIVE</span><small>API CONNECTED</small></div>
            <div className="console-logo"><img src="/petertecnetlogo.png" alt="Peter Tecnet" /><span className="ring ring-a" /><span className="ring ring-b" /></div>
            <div className="console-stats">
              <div><strong>{appsStatus === 'success' ? applications.length : '—'}</strong><span>plataformas ativas</span></div>
              <div><strong>{catalogStatus === 'success' ? catalog.length : '—'}</strong><span>soluções no catálogo</span></div>
            </div>
            <div className="console-stream"><span>01</span><p>Descubra a ferramenta certa</p><span>02</span><p>Ative e coloque em operação</p><span>03</span><p>Expanda dentro do ecossistema</p></div>
          </aside>
        </div>
        <div className="hero-marquee" aria-hidden="true"><div>PLATAFORMAS • APLICATIVOS • CRYPTO • IA • DADOS DE MERCADO • AUTOMAÇÕES • APIs • INTEGRAÇÕES • PRODUTOS DIGITAIS • </div><div>PLATAFORMAS • APLICATIVOS • CRYPTO • IA • DADOS DE MERCADO • AUTOMAÇÕES • APIs • INTEGRAÇÕES • PRODUTOS DIGITAIS • </div></div>
      </section>

      <section className="path-section" id="comece">
        <div className="pt-container">
          <div className="section-heading" data-reveal><p className="kicker">Áreas de atuação e objetivos</p><h2>Você não precisa conhecer nossas ferramentas. <span>Conte o que quer resolver.</span></h2><p>Escolha uma necessidade — de operações e vendas a dados e mercado cripto — e mostramos os produtos do ecossistema mais próximos dela.</p></div>
          <div className="path-layout" data-reveal>
            <div className="path-selector" role="tablist" aria-label="Objetivos">
              {solutionPaths.map(path => <button key={path.id} className={selectedPath === path.id ? 'path-option is-active' : 'path-option'} type="button" onClick={() => setSelectedPath(path.id)}><span>{path.label}</span><b>↗</b></button>)}
            </div>
            <div className="path-result">
              <p className="path-index">/{String(solutionPaths.findIndex(path => path.id === activePath.id) + 1).padStart(2, '0')}</p>
              <h3>{activePath.title}</h3>
              <p>{activePath.description}</p>
              <div className="recommended-apps">
                {appsStatus === 'loading' && <span className="mini-loading">Buscando produtos do ecossistema…</span>}
                {appsStatus === 'success' && recommendedApps.length === 0 && <span className="mini-loading">Produto desta área em integração ao ecossistema.</span>}
                {recommendedApps.map(application => <a key={application.id || application.slug} href={application.url || '#ecossistema'} target={application.url ? '_blank' : undefined} rel={application.url ? 'noreferrer' : undefined}><img src={resolveAssetUrl(application.logo) || '/petertecnetlogo.png'} alt="" /><span><strong>{application.name}</strong><small>{application.description || 'Produto Peter Tecnet'}</small></span><b>↗</b></a>)}
              </div>
              <a className="text-link path-contact" href={`mailto:${contact.email}?subject=${encodeURIComponent(`Quero resolver: ${activePath.label}`)}`}>Quero conversar sobre esse objetivo <span>↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section className="ecosystem-section" id="ecossistema">
        <div className="pt-container">
          <div className="section-heading section-heading-split" data-reveal><div><p className="kicker">Ecossistema Peter Tecnet</p><h2>Produtos feitos para entrar em operação, <span>não para ficar em apresentação.</span></h2></div><p>Cada produto resolve uma parte do dia a dia. Juntos, formam um ecossistema que acompanha diferentes necessidades — incluindo negócios, serviços, experiências digitais e inteligência para mercados como crypto.</p></div>
          {appsStatus === 'loading' && <div className="app-grid">{[1,2,3,4].map(value => <div className="app-card loading-card" key={value} />)}</div>}
          {appsStatus === 'success' && applications.length > 0 && <div className="app-grid">{applications.map((application, index) => <ApplicationCard application={application} index={index} key={application.id || application.slug} />)}</div>}
          {appsStatus === 'error' && <div className="state-panel">Não foi possível consultar o ecossistema agora. As plataformas continuam acessíveis por seus domínios Peter Tecnet.</div>}
        </div>
      </section>

      <section className="catalog-section" id="catalogo">
        <div className="pt-container">
          <div className="section-heading section-heading-split" data-reveal><div><p className="kicker">Catálogo conectado à Nexus</p><h2>Veja o que a Peter Tecnet <span>oferece agora.</span></h2></div><p>{catalogCompany?.description || 'Produtos e serviços cadastrados no catálogo da Peter Tecnet são trazidos da API e passam a fazer parte da própria experiência do site.'}</p></div>

          <div className="catalog-toolbar" data-reveal>
            <label className="catalog-search"><span>⌕</span><input value={catalogQuery} onChange={event => setCatalogQuery(event.target.value)} placeholder="Buscar solução, produto ou serviço…" aria-label="Buscar no catálogo" /></label>
            <div className="catalog-categories"><button className={catalogCategory === 'todos' ? 'is-active' : ''} onClick={() => setCatalogCategory('todos')} type="button">Todos</button>{categories.map(category => <button className={catalogCategory === category ? 'is-active' : ''} onClick={() => setCatalogCategory(category)} type="button" key={category}>{category}</button>)}</div>
          </div>

          {catalogStatus === 'loading' && <div className="catalog-grid">{[1,2,3,4].map(value => <div className="catalog-card loading-card" key={value} />)}</div>}
          {catalogStatus === 'success' && visibleCatalog.length > 0 && <><div className="catalog-grid">{visibleCatalog.map(item => <CatalogCard item={item} key={item.id || item.slug} />)}</div>{filteredCatalog.length > 8 && <button className="catalog-more" type="button" onClick={() => setShowAllCatalog(value => !value)}>{showAllCatalog ? 'Mostrar menos' : `Ver todos os ${filteredCatalog.length} itens`} <span>↘</span></button>}</>}
          {catalogStatus === 'success' && visibleCatalog.length === 0 && <div className="state-panel">Nenhum item do catálogo corresponde a essa busca.</div>}
          {catalogStatus === 'error' && <div className="state-panel">O catálogo não pôde ser carregado agora. A landing continua funcionando e a integração tenta automaticamente o endpoint compatível com a versão da API em produção.</div>}
        </div>
      </section>

      <section className="flow-section" id="como-funciona">
        <div className="pt-container flow-layout">
          <div className="section-heading flow-sticky" data-reveal><p className="kicker">Do visitante ao usuário ativo</p><h2>Entre por uma necessidade. <span>Continue pelo valor.</span></h2><p>O site passa a funcionar como porta de entrada para todo o ecossistema, conectando descoberta, ativação e evolução.</p></div>
          <ol className="flow-list">
            <li data-reveal><span>01</span><div><small>DESCUBRA</small><h3>Veja uma solução que faça sentido agora</h3><p>Objetivos, catálogo e páginas detalhadas reduzem a distância entre “o que vocês fazem?” e “isso resolve meu problema”.</p></div></li>
            <li data-reveal><span>02</span><div><small>ATIVE</small><h3>Entre diretamente na ferramenta certa</h3><p>Cada produto do ecossistema tem uma chamada clara para uso, teste, cadastro ou contato comercial.</p></div></li>
            <li data-reveal><span>03</span><div><small>EXPANDA</small><h3>Descubra outras ferramentas quando precisar</h3><p>O relacionamento não termina na primeira solução: o ecossistema apresenta próximos passos conforme novas necessidades aparecem.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="company-section" id="empresa">
        <div className="pt-container">
          <div className="company-intro" data-reveal><p className="kicker">Tecnologia para empresas e mercados digitais</p><h2>Produto próprio quando existe. <span>Solução sob medida quando precisa.</span></h2><p>A experiência de construir e operar nossas próprias plataformas também é aplicada em projetos empresariais e novas verticais: sistemas, integrações, automações, APIs, IA, análise de dados e tecnologia para o ecossistema crypto.</p></div>
          <div className="capability-grid">{capabilities.map(([label, title, description], index) => <article key={label} data-reveal><div><span>0{index + 1}</span><small>{label}</small></div><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>

      <section className="conversion-section" id="contato">
        <div className="conversion-grid" aria-hidden="true" />
        <div className="pt-container conversion-inner" data-reveal>
          <span className="conversion-orbit"><img src="/petertecnetlogo.png" alt="" /></span>
          <p className="kicker">Próximo passo</p>
          <h2>Você chegou procurando tecnologia. <span>Saia com um caminho.</span></h2>
          <p>Explore uma plataforma agora ou conte qual problema sua empresa precisa resolver. A Peter Tecnet pode atender com um produto do ecossistema ou construir a solução adequada.</p>
          <div className="hero-actions conversion-actions"><a className="pt-button pt-button-primary" href="#comece">Encontrar uma plataforma <span>↗</span></a><a className="pt-button pt-button-secondary" href={`mailto:${contact.email}`}>Falar com a Peter Tecnet <span>↗</span></a></div>
        </div>
      </section>
    </main>

    <footer className="pt-footer"><div className="pt-container footer-grid"><div className="pt-brand"><span className="pt-brand-mark"><img src="/petertecnetlogo.png" alt="" /></span><span><strong>Peter Tecnet</strong><small>Tecnologia em movimento</small></span></div><p>© {new Date().getFullYear()} Peter Tecnet · CNPJ 42.595.409/0001-48</p><nav><a href="/login">Administrar</a><a href={contact.instagram} target="_blank" rel="noreferrer">Instagram ↗</a><a href="#inicio">Topo ↑</a></nav></div></footer>
  </div>
}

function ProductPage({ identifier }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState('loading')
  const [payload, setPayload] = useState(null)

  useLandingMotion(status === 'success')

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const appsPayload = await fetchApplications(controller.signal)
        const applications = Array.isArray(appsPayload?.applications) ? appsPayload.applications : []
        const itemPayload = await fetchPeterItem(identifier, applications, controller.signal)
        setPayload(itemPayload)
        setStatus('success')
        const image = getItemImage(itemPayload.item)
        updatePageSeo({
          title: `${itemPayload.item?.name || 'Solução'} | Peter Tecnet`,
          description: itemPayload.item?.description || 'Conheça esta solução do catálogo Peter Tecnet.',
          path: `/solucoes/${encodeURIComponent(identifier)}`,
          image,
          type: 'product',
        })
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setStatus(error?.status === 404 ? 'not-found' : 'error')
          updatePageSeo({
            title: 'Solução não encontrada | Peter Tecnet',
            description: 'A solução solicitada não está disponível no catálogo público da Peter Tecnet.',
            path: `/solucoes/${encodeURIComponent(identifier)}`,
            robots: 'noindex, nofollow',
          })
        }
      }
    }
    load()
    return () => controller.abort()
  }, [identifier])

  if (status === 'loading') return <div className="product-state"><img src="/petertecnetlogo.png" alt="" /><p>Consultando o catálogo Peter Tecnet…</p></div>
  if (status === 'error' || status === 'not-found') return <div className="product-state"><img src="/petertecnetlogo.png" alt="" /><h1>{status === 'not-found' ? 'Solução não encontrada.' : 'Não foi possível carregar esta solução.'}</h1><p>Você pode voltar ao catálogo e explorar outras opções disponíveis.</p><a className="pt-button pt-button-primary" href="/#catalogo">Voltar ao catálogo <span>↗</span></a></div>

  const { item, establishment, otherItems } = payload
  const image = getItemImage(item)
  const contactEmail = establishment?.email || defaultContact.email
  const interestSubject = encodeURIComponent(`Interesse em ${item.name}`)
  const interestBody = encodeURIComponent(`Olá, quero saber mais sobre ${item.name}, que encontrei no site da Peter Tecnet.`)

  return <div className="marketing-shell product-shell">
    <div className="cursor-glow" aria-hidden="true" />
    <MarketingHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
    <main>
      <section className="product-hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="pt-container product-breadcrumb"><a href="/">Peter Tecnet</a><span>/</span><a href="/#catalogo">Catálogo</a><span>/</span><strong>{item.name}</strong></div>
        <div className="pt-container product-layout">
          <div className="product-copy" data-reveal>
            <div className="catalog-meta"><span>{item.category || item.type || 'Solução Peter Tecnet'}</span>{item.source_app?.name && <span>Origem: {item.source_app.name}</span>}</div>
            <h1>{item.name}</h1>
            <p className="product-description">{item.description || 'Solução disponível no catálogo Peter Tecnet.'}</p>
            <div className="product-price"><small>Investimento</small><strong>{formatCurrency(item.price)}</strong></div>
            <div className="hero-actions"><a className="pt-button pt-button-primary" href={`mailto:${contactEmail}?subject=${interestSubject}&body=${interestBody}`}>Tenho interesse <span>↗</span></a><a className="pt-button pt-button-secondary" href="/#catalogo">Explorar catálogo <span>↘</span></a></div>
          </div>
          <div className="product-visual" data-reveal data-tilt>{image ? <img src={image} alt={item.name} /> : <span><img src="/petertecnetlogo.png" alt="Peter Tecnet" /></span>}<div className="product-visual-data"><small>CATALOG / PETER TECNET</small><b>{item.slug || `ITEM-${item.id}`}</b></div></div>
        </div>
      </section>

      <section className="product-details"><div className="pt-container details-layout"><div className="section-heading" data-reveal><p className="kicker">Sobre esta solução</p><h2>Detalhes para decidir com <span>mais clareza.</span></h2></div><div className="detail-panel" data-reveal><p>{item.description || 'Entre em contato com a Peter Tecnet para entender aplicação, escopo e disponibilidade desta solução.'}</p><dl>{item.type && <><dt>Tipo</dt><dd>{item.type}</dd></>}{item.category && <><dt>Categoria</dt><dd>{item.category}</dd></>}{item.subcategory && <><dt>Subcategoria</dt><dd>{item.subcategory}</dd></>}{item.brand && <><dt>Marca</dt><dd>{item.brand}</dd></>}{establishment?.name && <><dt>Oferecido por</dt><dd>{establishment.fantasy || establishment.name}</dd></>}</dl></div></div></section>

      {otherItems.length > 0 && <section className="related-section"><div className="pt-container"><div className="section-heading" data-reveal><p className="kicker">Continue explorando</p><h2>Outras soluções do <span>mesmo catálogo.</span></h2></div><div className="catalog-grid">{otherItems.slice(0, 4).map(candidate => <CatalogCard item={candidate} key={candidate.id || candidate.slug} />)}</div></div></section>}
    </main>
    <footer className="pt-footer"><div className="pt-container footer-grid"><div className="pt-brand"><span className="pt-brand-mark"><img src="/petertecnetlogo.png" alt="" /></span><span><strong>Peter Tecnet</strong><small>Tecnologia em movimento</small></span></div><p>© {new Date().getFullYear()} Peter Tecnet</p><nav><a href="/#catalogo">Catálogo</a><a href="/">Início</a></nav></div></footer>
  </div>
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/login') return <LoginPage />
  if (path.startsWith('/admin')) return <AdminPage />
  const productMatch = path.match(/^\/solucoes\/([^/]+)$/)
  if (productMatch) return <ProductPage identifier={decodeURIComponent(productMatch[1])} />
  return <LandingPage />
}

export default App