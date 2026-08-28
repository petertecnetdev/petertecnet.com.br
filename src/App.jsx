import { useEffect, useState } from 'react'
import './App.css'

const services = [
  ['01', 'Aplicativos', 'Experiências mobile rápidas, intuitivas e conectadas ao seu negócio.'],
  ['02', 'Plataformas web', 'Sistemas responsivos e escaláveis para transformar processos em resultados.'],
  ['03', 'APIs & backend', 'Arquiteturas seguras para integrar dados, usuários e operações.'],
  ['04', 'Software sob medida', 'Tecnologia criada em torno da sua operação, sem limitações genéricas.'],
]

const stack = ['React', 'Laravel', 'Flutter', 'JavaScript', 'PHP', 'MySQL', 'APIs REST', 'Cloud']

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="site-shell">
      <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <a className="brand" href="#inicio" onClick={closeMenu} aria-label="Peter Tecnet — início">
          <img src="/petertecnetlogo.png" alt="" />
          <span>Peter Tecnet</span>
        </a>

        <button className="menu-toggle" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span />
        </button>

        <nav className={menuOpen ? 'nav-links nav-links--open' : 'nav-links'} aria-label="Navegação principal">
          <a href="#solucoes" onClick={closeMenu}>Soluções</a>
          <a href="#processo" onClick={closeMenu}>Processo</a>
          <a href="#tecnologia" onClick={closeMenu}>Tecnologia</a>
          <a className="nav-contact" href="#contato" onClick={closeMenu}>Iniciar projeto <span>↗</span></a>
        </nav>
      </header>

      <main>
        <section className="hero" id="inicio">
          <video className="hero-video" autoPlay muted loop playsInline>
            <source src="/video.mp4" type="video/mp4" />
          </video>
          <div className="hero-overlay" />
          <div className="grid" />
          <div className="orb orb--one" /><div className="orb orb--two" />

          <div className="hero-content container">
            <p className="eyebrow"><i /> Tecnologia em movimento</p>
            <h1>Ideias.<br />Código.<br /><span>Impacto.</span></h1>
            <p className="hero-copy">Transformamos ideias em produtos digitais escaláveis. Aplicativos, plataformas e sistemas feitos para resolver problemas reais e gerar negócios.</p>
            <div className="hero-actions">
              <a className="button button--primary" href="#contato">Começar um projeto <span>↗</span></a>
              <a className="button button--ghost" href="#solucoes">Explorar soluções <span>↓</span></a>
            </div>
          </div>
          <div className="hero-foot container"><span>Role para explorar</span><span>PT / DIGITAL STUDIO</span></div>
        </section>

        <section className="metrics" aria-label="Diferenciais">
          <div className="container metrics-grid">
            <div><strong>360°</strong><span>Ciclo de desenvolvimento</span></div>
            <div><strong>01</strong><span>Estratégia integrada</span></div>
            <div><strong>∞</strong><span>Possibilidades digitais</span></div>
            <div><strong>24/7</strong><span>Tecnologia em operação</span></div>
          </div>
        </section>

        <section className="section" id="solucoes">
          <div className="container">
            <div className="section-head">
              <p className="kicker">O que fazemos</p>
              <h2>Construímos o <span>digital.</span></h2>
              <p>Do conceito ao produto em produção, criamos soluções tecnológicas completas para empresas e empreendedores.</p>
            </div>
            <div className="services-grid">
              {services.map(([number, title, description]) => (
                <article className="service-card" key={title}>
                  <div className="card-top"><span>{number}</span><b>↗</b></div>
                  <div className="service-icon">⌁</div>
                  <h3>{title}</h3><p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section process" id="processo">
          <div className="container process-layout">
            <div className="section-head sticky-copy">
              <p className="kicker">Nosso processo</p>
              <h2>Da visão à <span>realidade.</span></h2>
              <p>Clareza para decidir, método para construir e proximidade em cada etapa.</p>
            </div>
            <ol className="process-list">
              <li><span>01</span><div><h3>Descoberta</h3><p>Entendemos o problema, os objetivos e o cenário do negócio.</p></div></li>
              <li><span>02</span><div><h3>Estratégia</h3><p>Definimos arquitetura, experiência e prioridades do produto.</p></div></li>
              <li><span>03</span><div><h3>Desenvolvimento</h3><p>Construímos com entregas contínuas, qualidade e transparência.</p></div></li>
              <li><span>04</span><div><h3>Evolução</h3><p>Colocamos em operação, analisamos e melhoramos continuamente.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="section technology" id="tecnologia">
          <div className="container technology-layout">
            <div className="tech-visual"><div className="tech-ring"><img src="/petertecnetlogo.png" alt="Peter Tecnet" /></div></div>
            <div className="section-head">
              <p className="kicker">Tecnologia com propósito</p>
              <h2>Base sólida.<br /><span>Escala real.</span></h2>
              <p>Escolhemos ferramentas maduras e modernas para entregar produtos rápidos, seguros e sustentáveis.</p>
              <div className="stack-list">{stack.map(item => <span key={item}>{item}</span>)}</div>
            </div>
          </div>
        </section>

        <section className="contact" id="contato">
          <div className="grid" />
          <div className="container contact-content">
            <p className="kicker">Vamos construir algo relevante</p>
            <h2>Sua ideia pode ser o<br /><span>próximo grande produto.</span></h2>
            <p>Conte o que você quer transformar. Nós ajudamos a encontrar o melhor caminho tecnológico.</p>
            <a className="button button--primary" href="mailto:contato@petertecnet.com.br">contato@petertecnet.com.br <span>↗</span></a>
          </div>
        </section>
      </main>

      <footer><div className="container footer-inner"><div className="brand"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></div><p>© {new Date().getFullYear()} Peter Tecnet. Tecnologia em movimento.</p><a href="#inicio">Voltar ao topo ↑</a></div></footer>
    </div>
  )
}

export default App
