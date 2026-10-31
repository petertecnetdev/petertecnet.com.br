import { useEffect } from 'react'
import PublicSiteHeader from './PublicSiteHeader.jsx'
import { platformSeoEntities } from './seoEntities.js'
import { updatePageSeo } from './seo.js'
import { trackDiscoveryEvent } from './discoveryApi.js'
import './PlatformDetailPage.css'

const ORIGIN = 'https://petertecnet.com.br'
const CONTACT_EMAIL = 'contato@petertecnet.com.br'

function PlatformShell({ children }) {
  return <div className="platform-detail-shell">
    <PublicSiteHeader active="platforms" />
    {children}
    <footer className="platform-detail-footer">
      <div className="platform-detail-container">
        <a href="/" className="platform-detail-footer-brand">Peter Tecnet</a>
        <span>Tecnologia para resolver problemas reais.</span>
        <a href="/#plataformas">Conheça outras plataformas ↗</a>
      </div>
    </footer>
  </div>
}

function NotFound({ slug }) {
  useEffect(() => {
    updatePageSeo({
      title: 'Plataforma não encontrada | Peter Tecnet',
      description: 'A plataforma solicitada não está disponível no catálogo público da Peter Tecnet.',
      path: `/plataformas/${encodeURIComponent(slug)}`,
      robots: 'noindex, nofollow',
    })
  }, [slug])

  return <PlatformShell>
    <main className="platform-detail-not-found">
      <span>404 · CATÁLOGO DE PLATAFORMAS</span>
      <h1>Esta plataforma não foi encontrada.</h1>
      <p>Confira o endereço ou volte ao catálogo para conhecer as soluções disponíveis.</p>
      <a href="/#plataformas">Ver plataformas <span>↗</span></a>
    </main>
  </PlatformShell>
}

export default function PlatformDetailPage({ slug }) {
  const platform = platformSeoEntities[slug]

  useEffect(() => {
    if (!platform || platform.category === 'LifestyleApplication') return
    updatePageSeo({
      title: platform.title,
      description: platform.description,
      path: `/plataformas/${slug}`,
      image: platform.image || '/thumbnail.jpg',
      type: 'website',
      keywords: platform.intents,
      schema: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: platform.name,
        applicationCategory: platform.category,
        operatingSystem: 'Web',
        description: platform.description,
        url: `${ORIGIN}/plataformas/${slug}`,
        publisher: { '@type': 'Organization', name: 'Peter Tecnet', url: ORIGIN },
        sameAs: platform.domain ? [platform.domain] : [],
      },
    })
    trackDiscoveryEvent('page_view', {
      entityType: 'application',
      entityId: slug,
      metadata: { page: 'platform_detail' },
    })
  }, [platform, slug])

  if (!platform) return <NotFound slug={slug} />

  const faqs = platform.faq?.length
    ? platform.faq
    : [
        [`O que é a ${platform.name}?`, platform.description],
        [`Para quem a ${platform.name} é indicada?`, platform.headline],
        ['Como conhecer a plataforma?', 'Acesse o site oficial da solução ou entre em contato com a equipe Peter Tecnet para entender se ela atende à sua operação.'],
      ]

  return <PlatformShell>
    <main className="platform-detail-page">
      <section className="platform-detail-hero">
        <div className="platform-detail-orbit platform-detail-orbit-one" />
        <div className="platform-detail-orbit platform-detail-orbit-two" />
        <div className="platform-detail-container platform-detail-hero-content">
          <nav className="platform-detail-breadcrumb" aria-label="Você está aqui">
            <a href="/">Início</a><span>/</span><a href="/#plataformas">Plataformas</a><span>/</span><strong>{platform.name}</strong>
          </nav>
          <div className="platform-detail-hero-grid">
            <div className="platform-detail-copy">
              <p className="platform-detail-eyebrow"><span /> {platform.eyebrow || 'PLATAFORMA DIGITAL'}</p>
              <h1>{platform.name}<span>.</span></h1>
              <h2>{platform.headline}</h2>
              <p className="platform-detail-description">{platform.description}</p>
              <div className="platform-detail-actions">
                {platform.domain && <a className="platform-detail-button primary" href={platform.domain} target="_blank" rel="noreferrer">Acessar plataforma <span>↗</span></a>}
                <a className="platform-detail-button secondary" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Quero conhecer a ${platform.name}`)}`}>Falar com a Peter Tecnet</a>
              </div>
              <div className="platform-detail-trust"><span className="platform-detail-trust-mark">PT</span><span>Uma solução do ecossistema <strong>Peter Tecnet</strong></span></div>
            </div>
            <aside className="platform-detail-product-card" aria-label={`Resumo da plataforma ${platform.name}`}>
              <div className="platform-detail-card-top"><span>PLATAFORMA PETER TECNET</span><span className="platform-detail-live-dot" /></div>
              <div className="platform-detail-monogram">{platform.name.slice(0, 1).toUpperCase()}</div>
              <strong>{platform.name}</strong>
              <p>{platform.eyebrow || 'Solução digital'}</p>
              <div className="platform-detail-card-line" />
              <div className="platform-detail-card-bottom"><span>PRODUTO DIGITAL</span><span>PT / ECOSYSTEM</span></div>
            </aside>
          </div>
        </div>
      </section>

      <section className="platform-detail-section platform-detail-benefits">
        <div className="platform-detail-container">
          <div className="platform-detail-section-heading">
            <p>O QUE A PLATAFORMA ENTREGA</p>
            <h2>Recursos pensados para <span>simplificar a operação.</span></h2>
            <div>{platform.description}</div>
          </div>
          <div className="platform-detail-benefit-grid">
            {(platform.benefits || []).map((benefit, index) => <article className="platform-detail-benefit" key={benefit}>
              <span className="platform-detail-benefit-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="platform-detail-benefit-icon" aria-hidden="true">{['⌘', '◈', '↗', '◎'][index % 4]}</div>
              <p>{benefit}</p>
            </article>)}
          </div>
        </div>
      </section>

      {(platform.intents || []).length > 0 && <section className="platform-detail-section platform-detail-usecases">
        <div className="platform-detail-container platform-detail-usecase-layout">
          <div><p className="platform-detail-section-kicker">APLICAÇÕES</p><h2>Feita para necessidades <span>concretas.</span></h2></div>
          <div className="platform-detail-intents">{platform.intents.map(intent => <span key={intent}>{intent}</span>)}</div>
        </div>
      </section>}

      <section className="platform-detail-section platform-detail-faq">
        <div className="platform-detail-container platform-detail-faq-layout">
          <div className="platform-detail-section-heading">
            <p>DÚVIDAS FREQUENTES</p>
            <h2>Entenda melhor a <span>{platform.name}.</span></h2>
          </div>
          <div className="platform-detail-faq-list">
            {faqs.map(([question, answer]) => <details key={question}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>)}
          </div>
        </div>
      </section>

      <section className="platform-detail-cta">
        <div className="platform-detail-container">
          <p>PRÓXIMO PASSO</p>
          <h2>Quer entender como a {platform.name} pode ajudar sua operação?</h2>
          <span>Conheça a solução e converse com a equipe Peter Tecnet.</span>
          <div className="platform-detail-actions">
            {platform.domain && <a className="platform-detail-button primary" href={platform.domain} target="_blank" rel="noreferrer">Conhecer {platform.name} <span>↗</span></a>}
            <a className="platform-detail-button secondary" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Informações sobre ${platform.name}`)}`}>Entrar em contato</a>
          </div>
        </div>
      </section>
    </main>
  </PlatformShell>
}
