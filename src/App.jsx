import { useEffect, useState } from 'react'
import './App.css'
import { AdminPage, LoginPage } from './Admin'
import FinanceCenter from './admin/FinanceCenter'

const services = [
  ['01', 'Aplicativos', 'Experiências mobile rápidas, intuitivas e conectadas ao seu negócio.'],
  ['02', 'Plataformas web', 'Sistemas responsivos e escaláveis para transformar processos em resultados.'],
  ['03', 'APIs & backend', 'Arquiteturas seguras para integrar dados, usuários e operações.'],
  ['04', 'Software sob medida', 'Tecnologia criada em torno da sua operação, sem limitações genéricas.'],
]
const stack = ['React', 'Laravel', 'Flutter', 'JavaScript', 'PHP', 'MySQL', 'APIs REST', 'Cloud']
const API_ORIGIN = 'https://api.petertecnet.com.br'
const defaultSite = {
  navigation: [
    { label: 'Soluções', href: '#solucoes' }, { label: 'Processo', href: '#processo' },
    { label: 'Tecnologia', href: '#tecnologia' }, { label: 'Projetos', href: '#projetos' },
    { label: 'Iniciar projeto', href: '#contato', highlight: true },
  ],
  hero: {
    eyebrow: 'Tecnologia em movimento', title: 'Ideias. Código. Impacto.',
    description: 'Transformamos ideias em produtos digitais escaláveis. Aplicativos, plataformas e sistemas feitos para resolver problemas reais e gerar negócios.',
    primary_label: 'Começar um projeto', primary_href: '#contato', secondary_label: 'Explorar soluções', secondary_href: '#solucoes',
  },
  contact: {
    kicker: 'Vamos construir algo relevante', title: 'Sua ideia pode ser o próximo grande produto.',
    description: 'Conte o que você quer transformar. Nós ajudamos a encontrar o melhor caminho tecnológico.',
    email: 'contato@petertecnet.com.br', instagram: 'https://www.instagram.com/petertecnet/',
  },
}

const resolveAssetUrl = (path) => {
  if (!path) return '/petertecnetlogo.png'
  if (/^https?:\/\//i.test(path)) return path
  return `${API_ORIGIN}/${path.replace(/^\/+/, '')}`
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
  const [site, setSite] = useState(defaultSite)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.allSettled([
      fetch(`${API_ORIGIN}/api/applications`, { headers: { Accept: 'application/json' }, signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch(`${API_ORIGIN}/api/ecosystem/site`, { headers: { Accept: 'application/json' }, signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
    ]).then(([appsResult, siteResult]) => {
      if (appsResult.status === 'fulfilled') { setApplications(Array.isArray(appsResult.value.applications) ? appsResult.value.applications : []); setProjectsStatus('success') }
      else setProjectsStatus('error')
      if (siteResult.status === 'fulfilled' && siteResult.value?.site) setSite(prev => ({ ...prev, ...siteResult.value.site }))
    })
    return () => controller.abort()
  }, [])

  const closeMenu = () => setMenuOpen(false)
  const hero = site.hero || defaultSite.hero
  const contact = site.contact || defaultSite.contact
  const navigation = Array.isArray(site.navigation) ? site.navigation : defaultSite.navigation

  return <div className="site-shell">
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <a className="brand" href="#inicio" onClick={closeMenu} aria-label="Peter Tecnet — início"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></a>
      <button className="menu-toggle" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
      <nav className={menuOpen ? 'nav-links nav-links--open' : 'nav-links'} aria-label="Navegação principal">
        {navigation.map((item, index) => <a key={`${item.label}-${index}`} className={item.highlight ? 'nav-contact' : ''} href={item.href || '#'} onClick={closeMenu}>{item.label}{item.highlight && <span> ↗</span>}</a>)}
      </nav>
    </header>

    <main>
      <section className="hero" id="inicio"><video className="hero-video" autoPlay muted loop playsInline><source src="/video.mp4" type="video/mp4" /></video><div className="hero-overlay" /><div className="grid" /><div className="orb orb--one" /><div className="orb orb--two" />
        <div className="hero-content container"><p className="eyebrow"><i /> {hero.eyebrow}</p><h1><Title text={hero.title} /></h1><p className="hero-copy">{hero.description}</p><div className="hero-actions"><a className="button button--primary" href={hero.primary_href || '#contato'}>{hero.primary_label || 'Começar um projeto'} <span>↗</span></a><a className="button button--ghost" href={hero.secondary_href || '#solucoes'}>{hero.secondary_label || 'Explorar soluções'} <span>↓</span></a></div></div>
        <div className="hero-foot container"><span>Role para explorar</span><span>PT / DIGITAL STUDIO</span></div>
      </section>

      <section className="metrics" aria-label="Diferenciais"><div className="container metrics-grid"><div><strong>360°</strong><span>Ciclo de desenvolvimento</span></div><div><strong>01</strong><span>Estratégia integrada</span></div><div><strong>∞</strong><span>Possibilidades digitais</span></div><div><strong>24/7</strong><span>Tecnologia em operação</span></div></div></section>

      <section className="section" id="solucoes"><div className="container"><div className="section-head"><p className="kicker">O que fazemos</p><h2>Construímos o <span>digital.</span></h2><p>Do conceito ao produto em produção, criamos soluções tecnológicas completas para empresas e empreendedores.</p></div><div className="services-grid">{services.map(([number, title, description]) => <article className="service-card" key={title}><div className="card-top"><span>{number}</span><b>↗</b></div><div className="service-icon">⌁</div><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>

      <section className="section process" id="processo"><div className="container process-layout"><div className="section-head sticky-copy"><p className="kicker">Nosso processo</p><h2>Da visão à <span>realidade.</span></h2><p>Clareza para decidir, método para construir e proximidade em cada etapa.</p></div><ol className="process-list"><li><span>01</span><div><h3>Descoberta</h3><p>Entendemos o problema, os objetivos e o cenário do negócio.</p></div></li><li><span>02</span><div><h3>Estratégia</h3><p>Definimos arquitetura, experiência e prioridades do produto.</p></div></li><li><span>03</span><div><h3>Desenvolvimento</h3><p>Construímos com entregas contínuas, qualidade e transparência.</p></div></li><li><span>04</span><div><h3>Evolução</h3><p>Colocamos em operação, analisamos e melhoramos continuamente.</p></div></li></ol></div></section>

      <section className="section technology" id="tecnologia"><div className="container technology-layout"><div className="tech-visual"><div className="tech-ring"><img src="/petertecnetlogo.png" alt="Peter Tecnet" /></div></div><div className="section-head"><p className="kicker">Tecnologia com propósito</p><h2>Base sólida.<br /><span>Escala real.</span></h2><p>Escolhemos ferramentas maduras e modernas para entregar produtos rápidos, seguros e sustentáveis.</p><div className="stack-list">{stack.map(item => <span key={item}>{item}</span>)}</div></div></div></section>

      <section className="section projects" id="projetos"><div className="container"><div className="section-head"><p className="kicker">Produtos Peter Tecnet</p><h2>Ferramentas que já estão<br /><span>em movimento.</span></h2><p>Conheça produtos digitais desenvolvidos para simplificar operações e criar novas possibilidades.</p></div>
        {projectsStatus === 'loading' && <div className="projects-grid" aria-label="Carregando projetos">{[1,2,3].map(item => <div className="project-card project-card--loading" key={item} />)}</div>}
        {projectsStatus === 'success' && applications.length > 0 && <div className="projects-grid">{applications.map(application => <article className="project-card" key={application.id || application.slug}><div className="project-logo"><img src={resolveAssetUrl(application.logo)} alt={`Logo ${application.name}`} loading="lazy" /></div><div className="project-body"><div className="project-meta"><span>Peter Tecnet</span>{application.version && <span>v{application.version}</span>}</div><h3>{application.name}</h3><p>{application.description || 'Produto digital desenvolvido pela Peter Tecnet.'}</p>{application.url && <a href={application.url} target="_blank" rel="noreferrer">Conhecer projeto <span>↗</span></a>}</div></article>)}</div>}
        {projectsStatus === 'success' && applications.length === 0 && <p className="projects-message">Novos produtos serão apresentados em breve.</p>}{projectsStatus === 'error' && <p className="projects-message">Nossos projetos estão temporariamente indisponíveis. Tente novamente mais tarde.</p>}
      </div></section>

      <section className="contact" id="contato"><div className="grid" /><div className="container contact-content"><p className="kicker">{contact.kicker}</p><h2><Title text={contact.title} /></h2><p>{contact.description}</p><div className="contact-actions"><a className="button button--primary" href={`mailto:${contact.email}`}>{contact.email} <span>↗</span></a><a className="button button--ghost" href={contact.instagram} target="_blank" rel="noreferrer">Instagram @petertecnet <span>↗</span></a></div></div></section>
    </main>

    <footer><div className="container footer-inner"><div className="brand"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></div><p>© {new Date().getFullYear()} Peter Tecnet. Tecnologia em movimento.</p><div className="footer-links"><a href="/login">Administrar</a><a href={contact.instagram} target="_blank" rel="noreferrer">Instagram ↗</a><a href="#inicio">Voltar ao topo ↑</a></div></div></footer>
  </div>
}

function FinanceLauncher() {
  return <a href="/admin/finance" aria-label="Abrir financeiro do ecossistema" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 80, padding: '12px 18px', borderRadius: 999, textDecoration: 'none', fontWeight: 800, color: '#06101d', background: '#fff', boxShadow: '0 12px 34px rgba(0,0,0,.28)' }}>Financeiro ↗</a>
}

function App() {
  const path = window.location.pathname
  if (path === '/login') return <LoginPage />
  if (path === '/admin/finance') return <FinanceCenter />
  if (path.startsWith('/admin')) return <><AdminPage /><FinanceLauncher /></>
  return <LandingPage />
}

export default App
