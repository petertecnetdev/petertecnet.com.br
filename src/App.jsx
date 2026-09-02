import { useEffect, useState } from 'react'
import './App.css'
import { AdminPage, LoginPage } from './Admin'

const API_ORIGIN = 'https://api.petertecnet.com.br'
const PETER_TECNET_CNPJ = '42595409000148'

const capabilities = [
  ['01', 'Produtos digitais', 'Criamos e evoluímos produtos digitais próprios para diferentes mercados e necessidades.'],
  ['02', 'Plataformas e aplicativos', 'Experiências web e mobile pensadas para operações reais, usuários reais e crescimento contínuo.'],
  ['03', 'APIs e integrações', 'Conectamos sistemas, dados, autenticação, pagamentos e operações com arquitetura segura e escalável.'],
  ['04', 'Soluções personalizadas', 'Quando uma empresa precisa de algo específico, transformamos o problema em uma solução tecnológica sob medida.'],
]

const stack = ['React', 'Laravel', 'JavaScript', 'PHP', 'MySQL', 'APIs REST', 'WebSockets', 'Cloud']

const defaultSite = {
  navigation: [
    { label: 'Ecossistema', href: '#ecossistema' },
    { label: 'Serviços', href: '#servicos' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Tecnologia', href: '#tecnologia' },
    { label: 'Fale conosco', href: '#contato', highlight: true },
  ],
  contact: {
    email: 'contato@petertecnet.com.br',
    instagram: 'https://www.instagram.com/petertecnet/',
  },
}

const resolveAssetUrl = (path) => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${API_ORIGIN}/${String(path).replace(/^\/+/, '')}`
}

const getItemImage = (item) => {
  if (item?.image_url) return resolveAssetUrl(item.image_url)
  const files = Array.isArray(item?.files) ? item.files : []
  const preferred = files.find(file => file?.is_primary) || files.find(file => file?.type === 'image') || files[0]
  return resolveAssetUrl(preferred?.public_url || preferred?.url || preferred?.path)
}

function Title({ text }) {
  const parts = String(text || '').trim().split(/\s+/)
  if (parts.length < 2) return <>{text}</>
  return <>{parts.slice(0, -1).join(' ')} <span>{parts.at(-1)}</span></>
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [applications, setApplications] = useState([])
  const [projectsStatus, setProjectsStatus] = useState('loading')
  const [services, setServices] = useState([])
  const [servicesStatus, setServicesStatus] = useState('loading')
  const [nexusCompany, setNexusCompany] = useState(null)
  const [site, setSite] = useState(defaultSite)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    Promise.allSettled([
      fetch(`${API_ORIGIN}/api/applications`, {
        headers: { Accept: 'application/json' }, signal: controller.signal,
      }).then(response => {
        if (!response.ok) throw new Error('applications')
        return response.json()
      }),
      fetch(`${API_ORIGIN}/api/ecosystem/site`, {
        headers: { Accept: 'application/json' }, signal: controller.signal,
      }).then(response => {
        if (!response.ok) throw new Error('site')
        return response.json()
      }),
      fetch(`${API_ORIGIN}/api/nexus/public/catalog-by-cnpj/${PETER_TECNET_CNPJ}`, {
        headers: { Accept: 'application/json' }, signal: controller.signal,
      }).then(response => {
        if (!response.ok) throw new Error('nexus-services')
        return response.json()
      }),
    ]).then(([appsResult, siteResult, servicesResult]) => {
      if (appsResult.status === 'fulfilled') {
        setApplications(Array.isArray(appsResult.value?.applications) ? appsResult.value.applications : [])
        setProjectsStatus('success')
      } else {
        setProjectsStatus('error')
      }

      if (siteResult.status === 'fulfilled' && siteResult.value?.site) {
        const remoteSite = siteResult.value.site
        setSite(prev => ({
          ...prev,
          ...remoteSite,
          navigation: Array.isArray(remoteSite.navigation) ? remoteSite.navigation : prev.navigation,
          contact: { ...prev.contact, ...(remoteSite.contact || {}) },
        }))
      }

      if (servicesResult.status === 'fulfilled' && servicesResult.value?.success) {
        setServices(Array.isArray(servicesResult.value.items) ? servicesResult.value.items : [])
        setNexusCompany(servicesResult.value.establishment || null)
        setServicesStatus('success')
      } else {
        setServicesStatus('error')
      }
    })

    return () => controller.abort()
  }, [])

  const closeMenu = () => setMenuOpen(false)
  const contact = site.contact || defaultSite.contact
  const navigation = Array.isArray(site.navigation) ? site.navigation : defaultSite.navigation

  return <div className="site-shell">
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <a className="brand" href="#inicio" onClick={closeMenu} aria-label="Peter Tecnet — início">
        <img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span>
      </a>
      <button className="menu-toggle" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
      <nav className={menuOpen ? 'nav-links nav-links--open' : 'nav-links'} aria-label="Navegação principal">
        {navigation.map((item, index) => <a key={`${item.label}-${index}`} className={item.highlight ? 'nav-contact' : ''} href={item.href || '#'} onClick={closeMenu}>{item.label}{item.highlight && <span> ↗</span>}</a>)}
      </nav>
    </header>

    <main>
      <section className="hero" id="inicio">
        <video className="hero-video" autoPlay muted loop playsInline><source src="/video.mp4" type="video/mp4" /></video>
        <div className="hero-overlay" /><div className="grid" /><div className="orb orb--one" /><div className="orb orb--two" />
        <div className="hero-content container">
          <p className="eyebrow"><i /> Tecnologia em movimento</p>
          <h1><Title text="Tecnologia que cria soluções reais." /></h1>
          <p className="hero-copy">A Peter Tecnet cria, opera e evolui plataformas, aplicativos e produtos digitais para pessoas e empresas. Um ecossistema de tecnologia construído para transformar necessidades reais em experiências simples, conectadas e escaláveis.</p>
          <div className="hero-actions">
            <a className="button button--primary" href="#ecossistema">Conhecer o ecossistema <span>↓</span></a>
            <a className="button button--ghost" href="#servicos">Ver nossos serviços <span>↗</span></a>
          </div>
        </div>
        <div className="hero-foot container"><span>Produtos próprios + soluções empresariais</span><span>PT / TECHNOLOGY ECOSYSTEM</span></div>
      </section>

      <section className="metrics" aria-label="Peter Tecnet em números e princípios">
        <div className="container metrics-grid">
          <div><strong>360°</strong><span>Ecossistema conectado</span></div>
          <div><strong>24/7</strong><span>Produtos em operação</span></div>
          <div><strong>API</strong><span>Arquitetura integrada</span></div>
          <div><strong>∞</strong><span>Evolução contínua</span></div>
        </div>
      </section>

      <section className="section projects" id="ecossistema">
        <div className="container">
          <div className="section-head">
            <p className="kicker">Ecossistema Peter Tecnet</p>
            <h2>Produtos digitais que já estão <span>em movimento.</span></h2>
            <p>Rasoio, Nexus, Cutinapp, Plat e outras soluções fazem parte de um ecossistema criado e evoluído pela Peter Tecnet para atender diferentes mercados.</p>
          </div>
          {projectsStatus === 'loading' && <div className="projects-grid" aria-label="Carregando produtos">{[1,2,3].map(item => <div className="project-card project-card--loading" key={item} />)}</div>}
          {projectsStatus === 'success' && applications.length > 0 && <div className="projects-grid">{applications.map(application => <article className="project-card" key={application.id || application.slug}>
            <div className="project-logo"><img src={resolveAssetUrl(application.logo) || '/petertecnetlogo.png'} alt={`Logo ${application.name}`} loading="lazy" /></div>
            <div className="project-body"><div className="project-meta"><span>Produto Peter Tecnet</span>{application.version && <span>v{application.version}</span>}</div><h3>{application.name}</h3><p>{application.description || 'Produto digital desenvolvido e evoluído pela Peter Tecnet.'}</p>{application.url && <a href={application.url} target="_blank" rel="noreferrer">Conhecer produto <span>↗</span></a>}</div>
          </article>)}</div>}
          {projectsStatus === 'success' && applications.length === 0 && <p className="projects-message">Novos produtos Peter Tecnet serão apresentados em breve.</p>}
          {projectsStatus === 'error' && <p className="projects-message">Não foi possível carregar o ecossistema agora. Nossos produtos continuam disponíveis em seus respectivos canais.</p>}
        </div>
      </section>

      <section className="section nexus-services" id="servicos">
        <div className="container">
          <div className="section-head section-head--split">
            <div><p className="kicker">Serviços Peter Tecnet</p><h2>O que podemos construir <span>com você.</span></h2></div>
            <p>{nexusCompany?.description || 'Além dos nossos próprios produtos, aplicamos nossa experiência em tecnologia para criar soluções, integrações e experiências digitais para empresas.'}</p>
          </div>

          {servicesStatus === 'loading' && <div className="services-grid">{[1,2,3,4].map(item => <div className="service-card service-card--loading" key={item} />)}</div>}
          {servicesStatus === 'success' && services.length > 0 && <div className="services-grid">{services.map((item, index) => {
            const image = getItemImage(item)
            return <article className="service-card service-card--nexus" key={item.id || item.slug || item.name}>
              {image && <div className="service-media"><img src={image} alt={item.name} loading="lazy" /></div>}
              <div className="card-top"><span>{String(index + 1).padStart(2, '0')}</span><b>NEXUS ↗</b></div>
              <h3>{item.name}</h3>
              <p>{item.description || 'Solução tecnológica oferecida pela Peter Tecnet.'}</p>
              {(item.category || item.type) && <div className="service-tags">{item.category && <span>{item.category}</span>}{item.type && <span>{item.type}</span>}</div>}
            </article>
          })}</div>}

          {(servicesStatus === 'error' || (servicesStatus === 'success' && services.length === 0)) && <>
            <div className="services-grid">{capabilities.map(([number, title, description]) => <article className="service-card" key={title}><div className="card-top"><span>{number}</span><b>↗</b></div><div className="service-icon">⌁</div><h3>{title}</h3><p>{description}</p></article>)}</div>
            <p className="nexus-sync-note">Os serviços cadastrados no catálogo Nexus da Peter Tecnet serão exibidos aqui automaticamente assim que o catálogo público estiver disponível.</p>
          </>}
        </div>
      </section>

      <section className="section about" id="sobre">
        <div className="container about-layout">
          <div className="section-head"><p className="kicker">Quem somos</p><h2>Não fazemos apenas software. Criamos <span>produtos digitais.</span></h2></div>
          <div className="about-copy">
            <p>A Peter Tecnet é uma empresa brasileira de tecnologia dedicada à criação, desenvolvimento, operação e evolução de soluções digitais. Identificamos necessidades, transformamos oportunidades em produtos e mantemos cada solução em constante evolução.</p>
            <p>Nosso ecossistema atende diferentes segmentos por meio de plataformas próprias. Também desenvolvemos soluções personalizadas quando uma empresa precisa de tecnologia específica, integrações ou novos fluxos digitais.</p>
            <div className="identity-chip"><span>Peter Tecnet</span><small>CNPJ 42.595.409/0001-48</small></div>
          </div>
        </div>
      </section>

      <section className="section process" id="processo">
        <div className="container process-layout"><div className="section-head sticky-copy"><p className="kicker">Como trabalhamos</p><h2>Produto nasce. Aprende. <span>Evolui.</span></h2><p>Usamos estratégia, engenharia e aprendizado contínuo para transformar tecnologia em solução útil.</p></div><ol className="process-list"><li><span>01</span><div><h3>Entender</h3><p>Mapeamos necessidades, contexto, usuários e oportunidade.</p></div></li><li><span>02</span><div><h3>Projetar</h3><p>Definimos experiência, arquitetura, integrações e prioridades.</p></div></li><li><span>03</span><div><h3>Construir</h3><p>Desenvolvemos com entregas contínuas, segurança, performance e qualidade.</p></div></li><li><span>04</span><div><h3>Evoluir</h3><p>Colocamos em operação, acompanhamos dados e melhoramos continuamente.</p></div></li></ol></div>
      </section>

      <section className="section technology" id="tecnologia"><div className="container technology-layout"><div className="tech-visual"><div className="tech-ring"><img src="/petertecnetlogo.png" alt="Peter Tecnet" /></div></div><div className="section-head"><p className="kicker">Tecnologia com propósito</p><h2>Uma base para vários <span>produtos.</span></h2><p>Arquitetura compartilhada, APIs, integrações e padrões de experiência permitem que o ecossistema Peter Tecnet cresça com consistência e velocidade.</p><div className="stack-list">{stack.map(item => <span key={item}>{item}</span>)}</div></div></div></section>

      <section className="contact" id="contato"><div className="grid" /><div className="container contact-content"><p className="kicker">Tecnologia para empresas</p><h2><Title text="Precisa de uma solução específica?" /></h2><p>Além de desenvolver nossos próprios produtos, podemos criar plataformas, aplicativos, APIs, integrações e automações para necessidades específicas da sua empresa.</p><div className="contact-actions"><a className="button button--primary" href={`mailto:${contact.email}`}>{contact.email} <span>↗</span></a><a className="button button--ghost" href={contact.instagram} target="_blank" rel="noreferrer">Instagram @petertecnet <span>↗</span></a></div></div></section>
    </main>

    <footer><div className="container footer-inner"><div className="brand"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></div><p>© {new Date().getFullYear()} Peter Tecnet. Plataformas, aplicativos e soluções tecnológicas.</p><div className="footer-links"><a href="/login">Administrar</a><a href={contact.instagram} target="_blank" rel="noreferrer">Instagram ↗</a><a href="#inicio">Voltar ao topo ↑</a></div></div></footer>
  </div>
}

function App() {
  if (window.location.pathname === '/login') return <LoginPage />
  if (window.location.pathname.startsWith('/admin')) return <AdminPage />
  return <LandingPage />
}

export default App
