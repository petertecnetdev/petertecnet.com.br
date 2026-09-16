import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist')
const origin = 'https://petertecnet.com.br'
const logo = `${origin}/petertecnet-logo-circular.jpg`
const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')

const pages = [
  { slug:'empresa-de-desenvolvimento-de-software', title:'Empresa de Desenvolvimento de Software | Peter Tecnet', h1:'Empresa de desenvolvimento de software, sistemas e produtos digitais', description:'A Peter Tecnet desenvolve software sob medida, sistemas, aplicativos, sites, APIs, integrações, automações e também cria e opera plataformas digitais próprias.', intents:['empresa de desenvolvimento de software','empresa de software','desenvolvedora de sistemas','fábrica de software'], services:['Software e sistemas sob medida','Aplicativos e plataformas digitais','APIs, integrações e automações','Sites e experiências web'] },
  { slug:'fabrica-de-software', title:'Fábrica de Software e Sistemas Sob Medida | Peter Tecnet', h1:'Fábrica de software para transformar necessidades de negócio em sistemas reais', description:'Desenvolvimento de software, sistemas web, painéis, portais, APIs e integrações sob medida pela Peter Tecnet.', intents:['fábrica de software','software house','empresa de sistemas','desenvolvimento sob medida'], services:['Descoberta e escopo','Arquitetura e UX','Frontend e backend','Publicação e evolução'] },
  { slug:'desenvolvimento-de-sistemas', title:'Desenvolvimento de Sistemas para Empresas | Peter Tecnet', h1:'Desenvolvimento de sistemas para empresas', description:'Criamos sistemas web, painéis administrativos, portais, bancos de dados e integrações alinhados à operação da sua empresa.', intents:['desenvolvimento de sistemas','empresa que desenvolve sistemas','sistema para empresa','sistema personalizado'], services:['Sistemas web','Painéis administrativos','Portais e áreas autenticadas','Integrações e dados'] },
  { slug:'software-sob-medida', title:'Software Sob Medida para Empresas | Peter Tecnet', h1:'Software sob medida para a rotina da sua empresa', description:'Projetamos software personalizado para processos que não cabem em ferramentas genéricas, com arquitetura preparada para evolução.', intents:['software sob medida','software personalizado','sistema sob medida','programa para empresa'], services:['Mapeamento do processo','Regras de negócio','Interface e experiência','Infraestrutura e evolução'] },
  { slug:'desenvolvimento-de-aplicativos', title:'Empresa de Desenvolvimento de Aplicativos | Peter Tecnet', h1:'Desenvolvimento de aplicativos e plataformas digitais', description:'A Peter Tecnet desenvolve aplicativos e plataformas digitais com autenticação, dados, pagamentos, notificações, APIs e administração.', intents:['empresa de desenvolvimento de aplicativos','criar aplicativo','desenvolvimento de app','aplicativo para empresa'], services:['Experiência do usuário','Aplicação responsiva/PWA','Backend e APIs','Pagamentos e notificações'] },
  { slug:'empresa-de-criacao-de-sites', title:'Empresa de Criação de Sites Profissionais | Peter Tecnet', h1:'Criação de sites profissionais para empresas', description:'Sites institucionais, landing pages e experiências web rápidas, responsivas, mensuráveis e preparadas para SEO e conversão.', intents:['empresa de criação de sites','desenvolvimento de sites','site profissional','criar site para empresa'], services:['Arquitetura de conteúdo','UI/UX responsiva','SEO técnico','Medição e conversão'] },
  { slug:'desenvolvimento-de-software-goiania', title:'Desenvolvimento de Software em Goiânia | Peter Tecnet', h1:'Desenvolvimento de software em Goiânia e atendimento digital para todo o Brasil', description:'Peter Tecnet desenvolve software, sistemas, aplicativos, sites, APIs e automações para empresas em Goiânia e projetos atendidos digitalmente em todo o Brasil.', intents:['desenvolvimento de software Goiânia','empresa de software Goiânia','desenvolvimento de sistemas Goiânia','criação de aplicativos Goiânia'], services:['Software sob medida','Aplicativos','Sites','APIs e automações'] },
]

const products = [
  ['Cutinapp','/plataformas/cutinapp','eventos, ingressos, participantes e check-in por QR Code'],
  ['Plat','/plataformas/plat','gestão digital de estabelecimentos, incluindo bares e restaurantes'],
  ['Nexus','/plataformas/nexus','catálogo digital, produtos, serviços, links e QR Codes'],
  ['Rasoio','/plataformas/rasoio','agendamento online, profissionais, serviços e disponibilidade'],
  ['PayFlow','/plataformas/payflow','clientes, oportunidades, propostas, cobranças e follow-up'],
  ['Locaio','/plataformas/locaio','descoberta e agendamento de serviços locais'],
  ['Kryvion','/plataformas/kryvion','monitoramento e inteligência de mercado cripto'],
  ['Laora','/plataformas/laora','descoberta, conexões e experiências sociais'],
]

function meta(html, attr, key, value) {
  const re = new RegExp(`<meta\\s+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["'][^>]*>`, 'i')
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}">`
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`)
}

function render(base, page) {
  const route = `/servicos/${page.slug}`
  const url = `${origin}${route}`
  let html = base.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(page.title)}</title>`)
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${url}">`)
  html = meta(html,'name','description',page.description)
  html = meta(html,'name','robots','index, follow, max-image-preview:large, max-snippet:-1')
  html = meta(html,'property','og:title',page.title)
  html = meta(html,'property','og:description',page.description)
  html = meta(html,'property','og:url',url)
  html = meta(html,'property','og:type','website')
  html = meta(html,'property','og:image',logo)
  html = meta(html,'name','twitter:card','summary_large_image')
  const schema = {
    '@context':'https://schema.org','@graph':[
      {'@type':'Organization','@id':`${origin}/#organization`,name:'Peter Tecnet',url:origin,logo,taxID:'42.595.409/0001-48',description:'Empresa de tecnologia, desenvolvimento de software e operadora de plataformas digitais próprias.'},
      {'@type':'Service','@id':`${url}#service`,name:page.h1,description:page.description,url,provider:{'@id':`${origin}/#organization`},areaServed:{'@type':'Country',name:'Brasil'}},
      {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Peter Tecnet',item:origin},{'@type':'ListItem',position:2,name:'Serviços',item:`${origin}/servicos`},{'@type':'ListItem',position:3,name:page.h1,item:url}]}
    ]
  }
  const productsHtml = products.map(([name,path,text]) => `<article><h3><a href="${path}">${name}</a></h3><p>${escapeHtml(text)}.</p></article>`).join('')
  const body = `<main style="max-width:1100px;margin:auto;padding:48px 22px;font-family:system-ui;color:#eef6ff;background:#03070c"><nav><a href="/">Peter Tecnet</a> · <a href="/servicos/desenvolvimento-de-software">Serviços</a> · <a href="/plataformas">Plataformas</a> · <a href="/portfolio">Cases</a></nav><header><p>Peter Tecnet · Tecnologia e produtos digitais</p><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.description)}</p><p><a href="/orcamento?origem=${encodeURIComponent(page.slug)}">Solicitar orçamento</a></p></header><section><h2>O que desenvolvemos</h2><ul>${page.services.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></section><section><h2>Projetos para clientes e plataformas próprias</h2><p>A Peter Tecnet atua em duas frentes complementares: desenvolve soluções digitais sob medida para clientes e cria, mantém e opera plataformas próprias. Os produtos do ecossistema demonstram experiência prática na construção e evolução de software em produção.</p><div>${productsHtml}</div></section><section><h2>Como podemos ser encontrados</h2><p>Esta página responde a necessidades relacionadas a ${page.intents.map(escapeHtml).join(', ')}. O conteúdo descreve serviços reais da Peter Tecnet sem criar páginas artificiais ou promessas de posicionamento.</p></section><section><h2>Próximo passo</h2><p>Explique o problema, processo ou produto que precisa ser criado. A partir disso definimos escopo, arquitetura, integrações, experiência e publicação.</p><p><a href="/orcamento?servico=${encodeURIComponent(page.slug)}">Pedir orçamento</a></p></section></main>`
  html = html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>\n</head>`)
  html = html.replace(/<div id=["']root["']>[\s\S]*?<\/div>\s*(?=<\/body>)/i, `<div id="root">${body}</div>`)
  return { html, route }
}

const base = await readFile(join(dist,'index.html'),'utf8')
const routes=[]
for (const page of pages) {
  const {html,route}=render(base,page)
  const target=join(dist,route.replace(/^\//,''),'index.html')
  await mkdir(dirname(target),{recursive:true})
  await writeFile(target,html,'utf8')
  routes.push(route)
}

const sitemapPath=join(dist,'sitemap.xml')
let sitemap=await readFile(sitemapPath,'utf8')
const today=new Date().toISOString().slice(0,10)
const additions=routes.filter(route=>!sitemap.includes(`<loc>${origin}${route}</loc>`)).map(route=>`  <url><loc>${origin}${route}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.90</priority></url>`).join('\n')
if(additions){ sitemap=sitemap.replace('</urlset>',`${additions}\n</urlset>`); await writeFile(sitemapPath,sitemap,'utf8') }
console.log(`[commercial-seo] ${routes.length} páginas comerciais adicionais geradas.`)
