import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { blogArticles } from '../src/marketingContent.js'
import { commercialSeoArticles, organizationSeo, platformSeoEntities } from '../src/seoEntities.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const origin = 'https://petertecnet.com.br'
const apiOrigin = 'https://api.petertecnet.com.br'
const peterCnpj = '42595409000148'
const defaultOgImage = `${origin}/thumbnail.jpg`

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const safeJson = value => JSON.stringify(value).replaceAll('<', '\\u003c')
const normalizeSlug = value => String(value || '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9-]+/g, '-')
const encodeSegment = value => encodeURIComponent(String(value))

function replaceTitle(html, title) {
  return html.replace(/<title>.*?<\/title>/is, `<title>${escapeHtml(title)}</title>`)
}
function replaceMeta(html, selector, value) {
  const escaped = escapeHtml(value)
  const isName = selector === 'description' || selector === 'robots'
  const pattern = new RegExp(`<meta\\s+${isName ? 'name' : 'property'}=["']${selector.replace(':', '\\:')}["'][^>]*>`, 'i')
  const replacement = `<meta ${isName ? 'name' : 'property'}="${selector}" content="${escaped}" />`
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`)
}
function replaceNamedMeta(html, name, value) {
  const pattern = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i')
  const replacement = `<meta name="${name}" content="${escapeHtml(value)}" />`
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`)
}
function replaceCanonical(html, url) {
  const pattern = /<link\s+rel=["']canonical["'][^>]*>/i
  const replacement = `<link rel="canonical" href="${escapeHtml(url)}" />`
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`)
}
function stripRuntimeScripts(html) {
  return html.replace(/\s*<script\s+type=["']module["'][^>]*>.*?<\/script>/gis, '')
    .replace(/\s*<script\s+type=["']module["'][^>]*src=["'][^"']+["'][^>]*><\/script>/gis, '')
}
function staticCss() {
  return `<style id="seo-static-style">
  :root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#03070c;color:#eef6ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#10213d 0,transparent 36%),#03070c;color:#eef6ff}a{color:#8ac8ff;text-decoration:none}a:hover{text-decoration:underline}.seo-shell{max-width:1120px;margin:0 auto;padding:28px 22px 72px}.seo-nav{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:10px 0 42px}.seo-brand{display:flex;align-items:center;gap:12px;color:#fff;font-weight:800}.seo-brand img{width:44px;height:44px;border-radius:50%}.seo-links{display:flex;gap:18px;flex-wrap:wrap}.seo-breadcrumb{font-size:.92rem;color:#9fb0c4;margin-bottom:24px}.seo-eyebrow{text-transform:uppercase;letter-spacing:.14em;color:#76b9ff;font-size:.78rem;font-weight:800}.seo-hero{padding:42px 0 34px}.seo-hero h1{font-size:clamp(2.2rem,6vw,4.8rem);line-height:.98;max-width:930px;margin:12px 0 22px}.seo-lead{font-size:clamp(1.08rem,2vw,1.35rem);line-height:1.7;color:#c8d5e3;max-width:850px}.seo-actions{display:flex;gap:12px;flex-wrap:wrap;margin:30px 0}.seo-button{display:inline-flex;padding:14px 18px;border:1px solid #375b82;border-radius:14px;background:#0d1a2a;color:#fff;font-weight:700}.seo-button.primary{background:#f4f8ff;color:#06101b;border-color:#f4f8ff}.seo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:28px 0}.seo-card{padding:24px;border:1px solid #1c334b;background:rgba(8,17,29,.82);border-radius:20px}.seo-card h2,.seo-card h3{margin-top:0}.seo-card p,.seo-card li{color:#bdcad8;line-height:1.65}.seo-card ul{padding-left:20px}.seo-tags{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.seo-tags span{padding:8px 11px;border:1px solid #24415f;border-radius:999px;color:#b8d9fa;font-size:.88rem}.seo-section{padding:34px 0}.seo-section>h2{font-size:clamp(1.7rem,3vw,2.5rem);margin-bottom:18px}.seo-footer{margin-top:48px;padding-top:24px;border-top:1px solid #193047;color:#93a6ba}.seo-note{padding:16px 18px;border-left:3px solid #79bfff;background:#091526;color:#c8d5e3;border-radius:8px}.seo-article{max-width:860px}.seo-article h2{margin-top:38px}.seo-article p{line-height:1.8;color:#c7d2df}@media(max-width:760px){.seo-grid{grid-template-columns:1fr}.seo-nav{align-items:flex-start;flex-direction:column}.seo-links{gap:12px}.seo-shell{padding:18px 18px 56px}}
  </style>`
}
function buildPageHtml(baseHtml, { title, description, route, type = 'website', schema, body, image = defaultOgImage }) {
  const url = `${origin}${route === '/' ? '/' : route}`
  let html = stripRuntimeScripts(baseHtml)
  html = replaceTitle(html, title)
  html = replaceMeta(html, 'description', description)
  html = replaceMeta(html, 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
  html = replaceMeta(html, 'og:title', title)
  html = replaceMeta(html, 'og:description', description)
  html = replaceMeta(html, 'og:url', url)
  html = replaceMeta(html, 'og:type', type)
  html = replaceMeta(html, 'og:image', image)
  html = replaceMeta(html, 'og:image:alt', `${title} — Peter Tecnet`)
  html = replaceNamedMeta(html, 'twitter:card', 'summary_large_image')
  html = replaceNamedMeta(html, 'twitter:title', title)
  html = replaceNamedMeta(html, 'twitter:description', description)
  html = replaceNamedMeta(html, 'twitter:image', image)
  html = replaceCanonical(html, url)
  html = html.replace('</head>', `    ${staticCss()}\n    <script id="prerender-page-schema" type="application/ld+json">${safeJson(schema)}</script>\n  </head>`)
  html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<\/body>)/i, `<div id="root">${body}</div>`)
  return html
}
async function writeRoute(baseHtml, route, payload) {
  const targetDir = path.join(distDir, route === '/' ? '' : route.replace(/^\//, ''))
  await mkdir(targetDir, { recursive: true })
  await writeFile(path.join(targetDir, 'index.html'), buildPageHtml(baseHtml, { ...payload, route }), 'utf8')
}
async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6500)
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.json()
  } finally { clearTimeout(timer) }
}
async function fetchPublicMarketingData() {
  let applications = []
  let items = []
  try {
    const payload = await fetchJson(`${apiOrigin}/api/applications`)
    applications = Array.isArray(payload?.applications) ? payload.applications : []
  } catch (error) { console.warn(`[seo] Applications unavailable: ${error.message}`) }
  const nexus = applications.find(app => normalizeSlug(app?.slug) === 'nexus')
  if (nexus?.id) {
    try {
      const discovery = await fetchJson(`${apiOrigin}/api/nexus/discovery?app_id=${encodeURIComponent(nexus.id)}&q=Peter%20Tecnet&limit=20`)
      const companies = Array.isArray(discovery?.establishments) ? discovery.establishments : []
      const company = companies.find(candidate => String(candidate?.cnpj || '').replace(/\D/g, '') === peterCnpj || `${candidate?.name || ''} ${candidate?.fantasy || ''}`.toLocaleLowerCase('pt-BR').includes('peter tecnet'))
      if (company?.slug || company?.id) {
        const catalog = await fetchJson(`${apiOrigin}/api/nexus/catalog/${encodeURIComponent(company.slug || company.id)}?app_id=${encodeURIComponent(nexus.id)}`)
        if (catalog?.success && Array.isArray(catalog.items)) items = catalog.items
      }
    } catch (error) { console.warn(`[seo] Catalog discovery unavailable: ${error.message}`) }
  }
  return { applications, items }
}
const shell = inner => `<div class="seo-shell"><nav class="seo-nav"><a class="seo-brand" href="/"><img src="/petertecnet-logo-circular.jpg" alt="Peter Tecnet"><span>Peter Tecnet</span></a><div class="seo-links"><a href="/plataformas">Plataformas</a><a href="/blog">Conteúdos</a><a href="/portfolio">Cases</a><a href="/orcamento">Contato</a></div></nav>${inner}<footer class="seo-footer">Peter Tecnet · CNPJ ${organizationSeo.taxID} · Ecossistema de plataformas e soluções digitais.</footer></div>`
function platformBody(entity, slug, application = {}) {
  const intents = entity.intents || []
  const benefits = entity.benefits || []
  const relatedArticles = [...blogArticles, ...commercialSeoArticles].filter(article => article.relatedPlatform === slug)
  return shell(`<main><div class="seo-breadcrumb"><a href="/">Peter Tecnet</a> / <a href="/plataformas">Plataformas</a> / ${escapeHtml(entity.name)}</div><section class="seo-hero"><p class="seo-eyebrow">${escapeHtml(entity.eyebrow)}</p><h1>${escapeHtml(entity.headline)}</h1><p class="seo-lead">${escapeHtml(entity.description)}</p><div class="seo-tags">${intents.map(intent => `<span>${escapeHtml(intent)}</span>`).join('')}</div><div class="seo-actions"><a class="seo-button primary" href="${escapeHtml(entity.domain || application.url || '#')}">Abrir ${escapeHtml(entity.name)} ↗</a><a class="seo-button" href="/orcamento">Falar com a Peter Tecnet ↗</a></div></section><section class="seo-section"><h2>O que ${escapeHtml(entity.name)} resolve</h2><div class="seo-grid">${benefits.map((benefit, index) => `<article class="seo-card"><p class="seo-eyebrow">0${index + 1}</p><p>${escapeHtml(benefit)}</p></article>`).join('')}</div></section>${entity.faq ? `<section class="seo-section"><h2>Perguntas frequentes</h2><div class="seo-grid">${entity.faq.map(([q,a]) => `<article class="seo-card"><h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p></article>`).join('')}</div></section>` : ''}${relatedArticles.length ? `<section class="seo-section"><h2>Conteúdos relacionados</h2><div class="seo-grid">${relatedArticles.map(article => `<article class="seo-card"><h3><a href="/blog/${escapeHtml(article.slug)}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.description)}</p></article>`).join('')}</div></section>` : ''}${entity.disclaimer ? `<p class="seo-note">${escapeHtml(entity.disclaimer)}</p>` : ''}</main>`)
}
function platformsBody(platforms) {
  return shell(`<main><section class="seo-hero"><p class="seo-eyebrow">Ecossistema Peter Tecnet</p><h1>Plataformas próprias para problemas específicos.</h1><p class="seo-lead">A Peter Tecnet cria e opera um ecossistema de produtos digitais próprios. Cada plataforma abaixo tem uma finalidade definida e pode compartilhar infraestrutura, dados e capacidades da API central sem perder sua identidade.</p></section><section class="seo-section"><h2>Produtos Peter Tecnet</h2><div class="seo-grid">${platforms.map(({ slug, entity }) => `<article class="seo-card"><p class="seo-eyebrow">${escapeHtml(entity.eyebrow || 'Produto digital')}</p><h2><a href="/plataformas/${encodeSegment(slug)}">${escapeHtml(entity.name)}</a></h2><p>${escapeHtml(entity.description)}</p><a href="/plataformas/${encodeSegment(slug)}">Entender ${escapeHtml(entity.name)} →</a></article>`).join('')}</div></section><section class="seo-section"><div class="seo-card"><h2>Peter Tecnet não é apenas desenvolvimento sob medida</h2><p>A empresa também oferece projetos personalizados, mas Plat, Rasoio, Cutinapp, Nexus, PayFlow, Laora, Locaio, Kryvion e demais produtos publicados são plataformas próprias do ecossistema Peter Tecnet.</p></div></section></main>`)
}
function articleBody(article) {
  return shell(`<main class="seo-article"><div class="seo-breadcrumb"><a href="/">Peter Tecnet</a> / <a href="/blog">Blog</a></div><p class="seo-eyebrow">${escapeHtml(article.category)} · ${escapeHtml(article.readTime)}</p><h1>${escapeHtml(article.title)}</h1><p class="seo-lead">${escapeHtml(article.intro)}</p>${article.sections.map(section => `<section><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</section>`).join('')}${article.relatedPlatform ? `<div class="seo-actions"><a class="seo-button primary" href="/plataformas/${escapeHtml(article.relatedPlatform)}">Conhecer ${escapeHtml(platformSeoEntities[article.relatedPlatform]?.name || article.relatedPlatform)} ↗</a></div>` : ''}</main>`)
}
function productBody(item) {
  const identifier = item.slug || item.id
  return shell(`<main class="seo-article"><div class="seo-breadcrumb"><a href="/">Peter Tecnet</a> / Catálogo</div><p class="seo-eyebrow">${escapeHtml(item.category || item.type || 'Produto e serviço')}</p><h1>${escapeHtml(item.name)}</h1><p class="seo-lead">${escapeHtml(item.description || `Conheça ${item.name} no catálogo Peter Tecnet.`)}</p><div class="seo-actions"><a class="seo-button primary" href="/solucoes/${encodeSegment(identifier)}">Ver solução</a><a class="seo-button" href="/orcamento">Solicitar atendimento</a></div></main>`)
}
function platformSchema(entity, slug) {
  const page = `${origin}/plataformas/${slug}`
  const softwareId = `${page}#software`
  const graph = [
    { '@type': 'WebPage', '@id': `${page}#webpage`, url: page, name: entity.title, description: entity.description, isPartOf: { '@id': `${origin}/#website` }, about: { '@id': softwareId }, breadcrumb: { '@id': `${page}#breadcrumb` }, inLanguage: 'pt-BR' },
    { '@type': 'BreadcrumbList', '@id': `${page}#breadcrumb`, itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Peter Tecnet', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: 'Plataformas', item: `${origin}/plataformas` }, { '@type': 'ListItem', position: 3, name: entity.name, item: page } ] },
    { '@type': ['SoftwareApplication','WebApplication'], '@id': softwareId, name: entity.name, alternateName: `${entity.name} Peter Tecnet`, description: entity.description, applicationCategory: entity.category || 'BusinessApplication', operatingSystem: 'Web', url: page, sameAs: entity.domain ? [entity.domain] : undefined, creator: { '@id': `${origin}/#organization` }, provider: { '@id': `${origin}/#organization` } },
    { '@type': 'Product', '@id': `${page}#product`, name: entity.name, description: entity.description, url: page, brand: { '@type': 'Brand', name: 'Peter Tecnet' }, manufacturer: { '@id': `${origin}/#organization` }, isRelatedTo: { '@id': softwareId } },
  ]
  if (entity.faq) graph.push({ '@type': 'FAQPage', '@id': `${page}#faq`, mainEntity: entity.faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) })
  return { '@context': 'https://schema.org', '@graph': graph }
}
async function main() {
  const baseHtml = await readFile(path.join(distDir, 'index.html'), 'utf8')
  const { applications, items } = await fetchPublicMarketingData()
  const sitemap = new Map()
  const add = (route, priority = '0.7', changefreq = 'weekly') => sitemap.set(route, { route, priority, changefreq })
  add('/', '1.0')
  add('/plataformas', '0.95')
  add('/blog', '0.85')

  const platformMap = new Map(Object.entries(platformSeoEntities).map(([slug, entity]) => [slug, { entity, application: {} }]))
  for (const app of applications) {
    const slug = normalizeSlug(app?.slug)
    if (!slug) continue
    const known = platformMap.get(slug)
    if (known) platformMap.set(slug, { ...known, application: app })
    else platformMap.set(slug, { application: app, entity: { name: app.name || slug, domain: app.url, title: `${app.name || slug} | Plataforma Peter Tecnet`, description: app.description || `${app.name || slug} é uma plataforma do ecossistema Peter Tecnet.`, headline: `${app.name || slug} é uma plataforma própria do ecossistema Peter Tecnet.`, eyebrow: 'Produto digital Peter Tecnet', benefits: ['Produto publicado e mantido dentro do ecossistema Peter Tecnet.'], intents: [] } })
  }
  const platformList = [...platformMap].map(([slug, data]) => ({ slug, ...data }))
  await writeRoute(baseHtml, '/plataformas', {
    title: 'Plataformas Peter Tecnet | Plat, Rasoio, Cutinapp, Nexus, PayFlow e mais',
    description: 'Conheça as plataformas próprias da Peter Tecnet, incluindo Plat, Rasoio, Cutinapp, Nexus, PayFlow, Laora, Locaio, Kryvion e outros produtos do ecossistema.',
    schema: { '@context': 'https://schema.org', '@graph': [ { '@type': 'CollectionPage', '@id': `${origin}/plataformas#page`, url: `${origin}/plataformas`, name: 'Plataformas Peter Tecnet', description: 'Produtos digitais próprios do ecossistema Peter Tecnet.', isPartOf: { '@id': `${origin}/#website` }, about: { '@id': `${origin}/#organization` } }, { '@type': 'ItemList', itemListElement: platformList.map(({ slug, entity }, index) => ({ '@type': 'ListItem', position: index + 1, name: entity.name, url: `${origin}/plataformas/${slug}` })) } ] },
    body: platformsBody(platformList),
  })
  for (const { slug, entity, application } of platformList) {
    const route = `/plataformas/${encodeSegment(slug)}`
    add(route, '0.9')
    await writeRoute(baseHtml, route, { title: entity.title, description: entity.description, schema: platformSchema(entity, slug), body: platformBody(entity, slug, application) })
  }

  const articles = [...blogArticles, ...commercialSeoArticles]
  await writeRoute(baseHtml, '/blog', {
    title: 'Blog Peter Tecnet | Plataformas, software, automação, vendas, agenda e eventos',
    description: 'Conteúdos sobre plataformas Peter Tecnet, gestão de estabelecimentos, agendamento, eventos, vendas, automação, APIs, SEO e produtos digitais.',
    schema: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog Peter Tecnet', url: `${origin}/blog`, publisher: { '@id': `${origin}/#organization` } },
    body: shell(`<main><section class="seo-hero"><p class="seo-eyebrow">Conteúdo Peter Tecnet</p><h1>Guias que conectam problemas reais às plataformas que podem resolvê-los.</h1></section><div class="seo-grid">${articles.map(article => `<article class="seo-card"><p class="seo-eyebrow">${escapeHtml(article.category)}</p><h2><a href="/blog/${article.slug}">${escapeHtml(article.title)}</a></h2><p>${escapeHtml(article.description)}</p></article>`).join('')}</div></main>`),
  })
  for (const article of articles) {
    const route = `/blog/${article.slug}`
    add(route, '0.8', 'monthly')
    await writeRoute(baseHtml, route, { title: article.seoTitle, description: article.description, type: 'article', schema: { '@context': 'https://schema.org', '@graph': [ { '@type': 'Article', headline: article.title, description: article.description, datePublished: article.date, dateModified: article.date, inLanguage: 'pt-BR', mainEntityOfPage: `${origin}${route}`, author: { '@id': `${origin}/#organization` }, publisher: { '@id': `${origin}/#organization` }, about: article.relatedPlatform ? { '@id': `${origin}/plataformas/${article.relatedPlatform}#software` } : undefined }, { '@type': 'BreadcrumbList', itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Peter Tecnet', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` }, { '@type': 'ListItem', position: 3, name: article.title, item: `${origin}${route}` } ] } ] }, body: articleBody(article) })
  }

  for (const item of items) {
    const identifier = item?.slug || item?.id
    if (!identifier || !item?.name) continue
    const route = `/solucoes/${encodeSegment(identifier)}`
    add(route, '0.75')
    const description = item.description || `${item.name}: conheça detalhes no catálogo Peter Tecnet.`
    await writeRoute(baseHtml, route, { title: `${item.name} | ${item.category || item.type || 'Solução'} | Peter Tecnet`, description, type: 'product', schema: { '@context': 'https://schema.org', '@graph': [ { '@type': item.type === 'service' ? 'Service' : 'Product', name: item.name, description, category: item.category || item.type || undefined, url: `${origin}${route}`, provider: { '@id': `${origin}/#organization` }, brand: { '@type': 'Brand', name: item.brand || 'Peter Tecnet' } }, { '@type': 'BreadcrumbList', itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Peter Tecnet', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: 'Soluções', item: `${origin}/#catalogo` }, { '@type': 'ListItem', position: 3, name: item.name, item: `${origin}${route}` } ] } ] }, body: productBody(item) })
  }

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...sitemap.values()].map(entry => `  <url><loc>${origin}${entry.route === '/' ? '/' : entry.route}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`).join('\n')}\n</urlset>\n`
  await writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8')
  console.log(`[seo] Generated ${sitemap.size} canonical public URLs: ${platformList.length} platforms, ${articles.length} articles, ${items.length} catalog items.`)
}
main().catch(error => { console.error('[seo] Failed:', error); process.exitCode = 1 })
