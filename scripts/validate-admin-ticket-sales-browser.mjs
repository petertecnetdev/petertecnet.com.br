import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.cwd())
const dist = join(root, 'dist')
const assets = join(dist, 'assets')
const output = join(root, 'artifacts', 'admin-ticket-sales')

if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html não encontrado. Execute npm run build antes do teste visual.')
const cssFile = readdirSync(assets).find(file => /^AdminTicketSalesPage-.*\.css$/.test(file))
if (!cssFile) throw new Error('CSS de produção da área de ingressos não encontrado em dist/assets.')

const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find(existsSync)
if (!chrome) throw new Error('Chrome/Chromium não encontrado para validação responsiva real.')

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

const cssUrl = pathToFileURL(join(assets, cssFile)).href
const viewports = [
  { name: 'mobile-360', width: 360, height: 800, metricColumns: 1, stacked: true },
  { name: 'tablet-768', width: 768, height: 1024, metricColumns: 2, stacked: true },
  { name: 'desktop-1440', width: 1440, height: 900, metricColumns: 3, stacked: false },
]

const metrics = ['Ingressos vendidos', 'Receita bruta', 'Disponíveis', 'Check-ins', 'Cortesias', 'Estornos/cancelados']
  .map((label, index) => `<article class="ats-metric"><span>${label}</span><strong>${index === 1 ? 'R$ 12.450,00' : index * 23 + 18}</strong><small>Indicador operacional</small></article>`).join('')
const eventCards = Array.from({ length: 4 }, (_, index) => `<button class="ats-event-card${index === 0 ? ' is-selected' : ''}"><div class="ats-event-card__top"><span class="ats-status ats-status--${index ? 'future' : 'live'}">${index ? 'Próximo' : 'Acontecendo'}</span><small>#${index + 1}</small></div><strong>Evento operacional ${index + 1}</strong><span>05/09/2026 22:00</span><div class="ats-event-card__numbers"><span><b>${42 + index}</b> vendidos</span><span><b>${80 - index}</b> disponíveis</span></div><div class="ats-progress"><i style="width:45%"></i></div><div class="ats-event-card__footer"><span>R$ 4.200,00</span><span>18 check-ins</span></div></button>`).join('')
const ticketRows = Array.from({ length: 3 }, (_, index) => `<div class="ats-ticket-row"><span><strong>Lote ${index + 1}</strong><small>Inteira · capacidade 100</small></span><span>R$ 30,00</span><span><b>42</b><small>31 pedidos</small></span><span>5</span><span>53</span><span><b>R$ 1.260,00</b><small>18 check-ins</small></span></div>`).join('')

function markup() {
  return `<main class="ats-page"><header class="ats-header"><a class="ats-brand"><span><strong>Peter Tecnet</strong><small>Admin Center</small></span></a><div class="ats-header__copy"><p>Eventos · Operação comercial</p><h1>Ingressos por evento</h1><span>Acompanhe vendas confirmadas, disponibilidade, receita, cortesias, estornos e check-ins por estabelecimento.</span></div><a class="ats-header__back">Voltar ao ecossistema</a></header><section class="ats-toolbar"><label class="ats-search"><span>Pesquisar estabelecimento</span><input value="Lafyesta Pub"></label><label class="ats-select"><span>Estabelecimento</span><select><option>Lafyesta Pub · São Paulo/SP</option></select></label><div class="ats-context"><span>Contexto atual</span><strong>Lafyesta Pub</strong><small>São Paulo · SP</small></div></section><div class="ats-layout"><aside class="ats-events"><div class="ats-section-title"><div><span>Eventos</span><h2>4 encontrados</h2></div></div><div class="ats-event-list">${eventCards}</div></aside><section class="ats-detail"><div class="ats-event-heading"><div><span>Evento #1</span><h2>I Love Eletro</h2><p>05/09/2026 22:00 · Lafyesta Pub · São Paulo · SP</p></div><span class="ats-status ats-status--live">Acontecendo</span></div><div class="ats-metrics">${metrics}</div><section class="ats-panel"><div class="ats-panel__head"><div><span>Inventário</span><h3>Tipos de ingresso</h3></div></div><div class="ats-ticket-table"><div class="ats-ticket-row ats-ticket-row--head"><span>Ingresso</span><span>Preço</span><span>Vendidos</span><span>Cortesias</span><span>Disponíveis</span><span>Receita</span></div>${ticketRows}</div></section></section></div></main>`
}

function probeDocument(viewport) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${cssUrl}"><style>*{animation:none!important;transition:none!important}</style></head><body>${markup()}<script>addEventListener('load',()=>requestAnimationFrame(()=>{const q=s=>document.querySelector(s);const checks=[];const add=(name,pass,detail='')=>checks.push({name,pass:Boolean(pass),detail});const layout=q('.ats-layout');const metrics=q('.ats-metrics');const table=q('.ats-ticket-table');const cols=getComputedStyle(metrics).gridTemplateColumns.split(' ').filter(Boolean).length;add('viewport-width',Math.abs(innerWidth-${viewport.width})<=1,String(innerWidth));add('no-page-horizontal-overflow',document.documentElement.scrollWidth<=innerWidth+2,document.documentElement.scrollWidth+'/'+innerWidth);add('metric-columns',cols===${viewport.metricColumns},String(cols));add('layout-mode',${viewport.stacked} ? getComputedStyle(layout).display==='flex' : getComputedStyle(layout).display==='grid',getComputedStyle(layout).display);add('ticket-table-contained',table.getBoundingClientRect().right<=innerWidth+2,String(table.getBoundingClientRect().right));add('ticket-table-scrollable',table.scrollWidth>=table.clientWidth,table.scrollWidth+'/'+table.clientWidth);parent.postMessage({source:'ats-probe',result:{ok:checks.every(c=>c.pass),checks}},'*')}));<\/script></body></html>`
}

function wrapperDocument(viewport, probeUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#030a11;overflow:hidden}iframe{display:block;width:${viewport.width}px;height:${viewport.height}px;border:0}</style></head><body><iframe src="${probeUrl}"></iframe><pre id="result" hidden></pre><script>addEventListener('message',e=>{if(e.data?.source!=='ats-probe')return;document.querySelector('#result').textContent=JSON.stringify(e.data.result)})<\/script></body></html>`
}

function parseResult(html) {
  const match = html.match(/<pre id="result" hidden="">([^<]+)<\/pre>/) || html.match(/<pre id="result" hidden>([^<]+)<\/pre>/)
  return match ? JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&')) : null
}

const failures = []
for (const viewport of viewports) {
  const probePath = join(output, `${viewport.name}-probe.html`)
  writeFileSync(probePath, probeDocument(viewport))
  const wrapperPath = join(output, `${viewport.name}.html`)
  writeFileSync(wrapperPath, wrapperDocument(viewport, pathToFileURL(probePath).href))
  const url = pathToFileURL(wrapperPath).href
  const common = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--hide-scrollbars', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=3000', `--window-size=${Math.max(500, viewport.width)},${Math.max(800, viewport.height)}`]
  const dumped = spawnSync(chrome, [...common, '--dump-dom', url], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  const result = dumped.status === 0 ? parseResult(dumped.stdout) : null
  if (!result) {
    failures.push(`${viewport.name}: navegador não concluiu o probe`)
    continue
  }
  console.log(`${result.ok ? '✓' : '✗'} ${viewport.name}: ${result.checks.map(check => `${check.name}=${check.pass ? 'ok' : 'FAIL'}`).join(', ')}`)
  if (!result.ok) failures.push(`${viewport.name}: ${result.checks.filter(check => !check.pass).map(check => `${check.name} (${check.detail})`).join('; ')}`)
  spawnSync(chrome, [...common, `--screenshot=${join(output, `${viewport.name}.png`)}`, url], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
}

if (failures.length) {
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`\nÁrea administrativa de ingressos validada em navegador real em ${viewports.length} viewports.`)
