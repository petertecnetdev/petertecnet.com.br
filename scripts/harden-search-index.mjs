import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const origin = 'https://petertecnet.com.br'
const today = new Date().toISOString().slice(0, 10)
const articleRoute = '/blog/davi-quase-nao-foi-carona-cutinapp'
const articleUrl = `${origin}${articleRoute}`

const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const safeJson = value => JSON.stringify(value).replaceAll('<', '\\u003c')

function setTag(html, regex, replacement) {
  return regex.test(html) ? html.replace(regex, replacement) : html.replace('</head>', `  ${replacement}\n</head>`)
}

function renderRecoveredArticle(base) {
  const title = 'Davi quase não foi: como a descoberta de eventos muda uma noite | Peter Tecnet'
  const description = 'A história de Davi mostra como descoberta, decisão, ingresso e participação podem acontecer no mesmo fluxo digital com a Cutinapp.'
  let html = base
  html = setTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
  html = setTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(description)}">`)
  html = setTag(html, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">')
  html = setTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${articleUrl}">`)
  for (const [property, value] of [['og:title', title], ['og:description', description], ['og:url', articleUrl], ['og:type', 'article']]) {
    html = setTag(html, new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i'), `<meta property="${property}" content="${esc(value)}">`)
  }
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', '@id': `${articleUrl}#article`, headline: title.replace(' | Peter Tecnet', ''), description, datePublished: '2026-09-15', dateModified: today, inLanguage: 'pt-BR', mainEntityOfPage: articleUrl, author: { '@id': `${origin}/#organization` }, publisher: { '@id': `${origin}/#organization` }, about: { '@type': 'SoftwareApplication', name: 'Cutinapp', url: 'https://cutinapp.petertecnet.com.br/' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Peter Tecnet', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` },
        { '@type': 'ListItem', position: 3, name: 'Davi quase não foi', item: articleUrl }
      ] }
    ]
  }
  html = html.replace('</head>', `  <script type="application/ld+json" id="recovered-article-schema">${safeJson(schema)}</script>\n</head>`)
  const body = `<main style="max-width:880px;margin:0 auto;padding:48px 22px 80px;font-family:Inter,system-ui,sans-serif;color:#eef6ff;line-height:1.75"><nav aria-label="Breadcrumb"><a href="/">Peter Tecnet</a> / <a href="/blog">Blog</a> / Cutinapp</nav><article><p>Eventos e descoberta digital</p><h1>Davi quase não foi: quando descobrir o evento certo muda a decisão</h1><p>Davi quase ficou em casa. Não porque faltavam opções, mas porque encontrar informações espalhadas sobre horário, local, proposta do evento e ingresso transformava uma decisão simples em trabalho. A experiência melhora quando descoberta, informação e participação ficam conectadas.</p><h2>Descoberta precisa responder às perguntas antes da compra</h2><p>Uma página pública de evento deve explicar claramente o que vai acontecer, quando, onde, quem organiza e como participar. Ela também precisa ter um endereço estável que possa ser encontrado em mecanismos de busca e compartilhado em mensagens e redes sociais.</p><p>É esse caminho que a <a href="https://cutinapp.petertecnet.com.br/">Cutinapp</a> desenvolve: uma rede social de eventos que conecta descoberta, interação, compra, participação e pós-evento, enquanto oferece ao produtor infraestrutura para organizar, divulgar, vender e administrar seus eventos.</p><h2>Do interesse ao ingresso sem perder o contexto</h2><p>Quando o visitante encontra um evento, a próxima ação deve ser evidente. Informações de ingresso, produção, local e eventos relacionados precisam permanecer conectadas. Isso reduz a distância entre descobrir uma programação e decidir participar.</p><p>Para produtores, páginas públicas também criam uma presença digital acumulativa: eventos, produções, artistas e locais podem se conectar por links e contexto, facilitando que pessoas encontrem novas programações organicamente.</p><h2>Depois do evento a página continua útil</h2><p>Uma boa página não precisa desaparecer quando o evento termina. Fotos, registros e informações do que aconteceu podem preservar a memória do evento, ajudar participantes a reviver a experiência e oferecer contexto para futuras edições.</p><h2>Conheça a plataforma</h2><p>Veja como a solução funciona na página da <a href="/plataformas/cutinapp">Cutinapp na Peter Tecnet</a> ou acesse os <a href="https://cutinapp.petertecnet.com.br/eventos">eventos públicos da Cutinapp</a>.</p></article></main>`
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${body}</div>`)
  return html
}

async function main() {
  const base = await readFile(join(dist, 'index.html'), 'utf8')
  const articleDir = join(dist, articleRoute.slice(1))
  await mkdir(articleDir, { recursive: true })
  await writeFile(join(articleDir, 'index.html'), renderRecoveredArticle(base), 'utf8')

  const sitemapPath = join(dist, 'sitemap.xml')
  let sitemap = await readFile(sitemapPath, 'utf8')
  if (!sitemap.includes(`<loc>${articleUrl}</loc>`)) {
    sitemap = sitemap.replace('</urlset>', `  <url><loc>${articleUrl}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>`)
  }
  sitemap = sitemap.replace(/<url>([\s\S]*?)<\/url>/g, block => block.includes('<lastmod>') ? block : block.replace('</url>', `<lastmod>${today}</lastmod></url>`))
  await writeFile(sitemapPath, sitemap, 'utf8')

  const robots = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nDisallow: /auth\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
  await writeFile(join(dist, 'robots.txt'), robots, 'utf8')
  console.log('[search-index] Soft-404 recovery, robots and sitemap lastmod hardening complete.')
}

main().catch(error => { console.error('[search-index] Failed:', error); process.exitCode = 1 })
