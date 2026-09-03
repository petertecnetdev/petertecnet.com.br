import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.cwd())
const dist = join(root, 'dist')
const assets = join(dist, 'assets')
const output = join(root, 'artifacts', 'admin-ui')
const chromeProfile = join(output, '.chrome-profile')

if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html não encontrado. Execute npm run build antes do teste visual.')
if (!existsSync(assets)) throw new Error('dist/assets não encontrado.')

const cssFiles = readdirSync(assets).filter(file => file.endsWith('.css')).map(file => join(assets, file))
if (!cssFiles.length) throw new Error('Nenhum CSS de produção foi encontrado em dist/assets.')

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)
const chrome = chromeCandidates.find(existsSync)
if (!chrome) throw new Error('Chrome/Chromium não encontrado para validação responsiva real.')

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

const viewports = [
  { name: 'mobile-360', width: 360, height: 800, mobile: true, expectedMetrics: 1 },
  { name: 'mobile-390', width: 390, height: 844, mobile: true, expectedMetrics: 1 },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false, expectedMetrics: 2 },
  { name: 'notebook-1024', width: 1024, height: 768, mobile: false, expectedMetrics: 2 },
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false, expectedMetrics: 4 },
  { name: 'wide-1920', width: 1920, height: 1080, mobile: false, expectedMetrics: 4 },
]

const navItems = ['Mission Control', 'Visão geral', 'Atividade', 'Financeiro', 'Aplicações', 'Usuários', 'Perfis e permissões', 'Estabelecimentos', 'Itens', 'Site institucional', 'Auditoria']
const icons = ['⌘', '▦', '⌁', '¤', '◇', '◉', '⌗', '⌂', '▣', '✦', '◎']
const cssLinks = cssFiles.map(file => `<link rel="stylesheet" href="${pathToFileURL(file).href}">`).join('\n')

function fixture() {
  const nav = navItems.map((label, index) => `<button ${index === 0 ? 'class="active"' : ''} data-admin-tab="tab-${index}" data-icon="${icons[index]}">${label}</button>`).join('')
  const metrics = Array.from({ length: 8 }, (_, index) => `<article class="metric-card"><span>Indicador ${index + 1}</span><strong>${(index + 1) * 17}</strong><small>amostra responsiva</small></article>`).join('')
  const rows = Array.from({ length: 5 }, (_, index) => `<tr><td>#${index + 1}</td><td>Registro operacional ${index + 1} com conteúdo suficiente</td><td>Ativo</td><td>03/09/2026</td></tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${cssLinks}<style>*{animation:none!important;transition:none!important}</style></head><body>
  <header class="admin-mobile-topbar"><button class="admin-mobile-menu-button" aria-expanded="false"><span></span><span></span><span></span></button><a class="admin-mobile-identity"><img src=""><span><small>Admin Center</small><strong>Mission Control</strong></span></a><span class="admin-mobile-topbar-spacer"></span></header>
  <main class="ecosystem-shell"><aside class="ecosystem-sidebar" id="admin-mobile-drawer"><a class="admin-brand ecosystem-brand"><img src=""><span><b>Peter Tecnet</b><small>Mission Control</small></span></a><nav>${nav}</nav><div class="sidebar-foot"><a>Site Peter Tecnet</a><button>Sair</button></div></aside><section class="ecosystem-main"><header class="ecosystem-top"><div><p class="admin-kicker">Peter Tecnet Command Center</p><h1>Mission Control</h1></div><div class="top-actions"><button>Atualizar</button></div></header><div class="admin-stack"><div class="metric-grid">${metrics}</div><div class="admin-grid"><section class="admin-panel"><div class="panel-title"><h2>Operação</h2></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Descrição</th><th>Status</th><th>Data</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="admin-panel"><div class="panel-title"><h2>Resumo</h2></div><p>Conteúdo para validar largura, quebra e densidade visual.</p></section></div></div></section></main><button class="admin-mobile-backdrop"></button>
  </body></html>`
}

const fixturePath = join(output, 'admin-fixture.html')
writeFileSync(fixturePath, fixture())
const fixtureUrl = pathToFileURL(fixturePath).href
const debuggingPort = 9222

const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--allow-file-access-from-files',
  '--hide-scrollbars',
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${chromeProfile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] })

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForDebugger() {
  let lastError
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
      const pages = await response.json()
      if (pages?.[0]?.webSocketDebuggerUrl) return pages[0].webSocketDebuggerUrl
    } catch (error) {
      lastError = error
    }
    await sleep(100)
  }
  throw new Error(`Chrome DevTools não iniciou: ${lastError?.message || 'timeout'}`)
}

class CdpClient {
  constructor(url) {
    this.url = url
    this.sequence = 0
    this.pending = new Map()
    this.waiters = new Map()
  }

  async connect() {
    this.socket = new WebSocket(this.url)
    await new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => rejectPromise(new Error('Timeout conectando ao Chrome DevTools.')), 8000)
      this.socket.addEventListener('open', () => { clearTimeout(timeout); resolvePromise() }, { once: true })
      this.socket.addEventListener('error', () => { clearTimeout(timeout); rejectPromise(new Error('Falha no WebSocket do Chrome DevTools.')) }, { once: true })
    })
    this.socket.addEventListener('message', event => this.onMessage(event))
  }

  onMessage(event) {
    const message = JSON.parse(String(event.data))
    if (message.id) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
      return
    }
    const queue = this.waiters.get(message.method)
    if (!queue?.length) return
    const waiter = queue.shift()
    waiter(message.params)
  }

  send(method, params = {}) {
    const id = ++this.sequence
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  waitFor(method, timeoutMs = 8000) {
    return new Promise((resolvePromise, rejectPromise) => {
      const queue = this.waiters.get(method) || []
      const timeout = setTimeout(() => {
        const current = this.waiters.get(method) || []
        const index = current.indexOf(done)
        if (index >= 0) current.splice(index, 1)
        rejectPromise(new Error(`Timeout aguardando ${method}`))
      }, timeoutMs)
      const done = params => { clearTimeout(timeout); resolvePromise(params) }
      queue.push(done)
      this.waiters.set(method, queue)
    })
  }

  close() {
    this.socket?.close()
  }
}

const evaluateChecks = viewport => `(() => {
  const checks = []
  const add = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail })
  const shell = document.querySelector('.ecosystem-shell')
  const sidebar = document.querySelector('.ecosystem-sidebar')
  const main = document.querySelector('.ecosystem-main')
  const topbar = document.querySelector('.admin-mobile-topbar')
  const grid = document.querySelector('.metric-grid')
  const tableWrap = document.querySelector('.table-wrap')
  const width = window.innerWidth
  const height = window.innerHeight
  const closedTransform = getComputedStyle(sidebar).transform
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
  const mainRect = main.getBoundingClientRect()

  add('requested-viewport-width', Math.abs(width - ${viewport.width}) <= 1, width + ' requested=${viewport.width}')
  add('requested-viewport-height', Math.abs(height - ${viewport.height}) <= 1, height + ' requested=${viewport.height}')
  add('no-page-horizontal-overflow', document.documentElement.scrollWidth <= width + 2, document.documentElement.scrollWidth + '/' + width)
  add('main-contained-in-viewport', mainRect.left >= -2 && mainRect.right <= width + 2, JSON.stringify({ left: mainRect.left, right: mainRect.right, width }))
  add('table-scroll-contained', tableWrap.scrollWidth >= tableWrap.clientWidth && tableWrap.getBoundingClientRect().right <= mainRect.right + 2, tableWrap.scrollWidth + '/' + tableWrap.clientWidth)
  add('metric-columns', columns === ${viewport.expectedMetrics}, String(columns))

  if (${viewport.mobile}) {
    add('mobile-shell-block', getComputedStyle(shell).display === 'block', getComputedStyle(shell).display)
    add('mobile-topbar-fixed', getComputedStyle(topbar).position === 'fixed', getComputedStyle(topbar).position)
    add('mobile-drawer-closed-offcanvas', closedTransform !== 'none', closedTransform)
    document.body.classList.add('admin-mobile-menu-open')
    const openTransform = getComputedStyle(sidebar).transform
    add('mobile-drawer-opens', openTransform === 'none' || openTransform === 'matrix(1, 0, 0, 1, 0, 0)', openTransform)
    add('mobile-drawer-width', sidebar.getBoundingClientRect().width <= width * .9, String(sidebar.getBoundingClientRect().width))
  } else {
    add('desktop-shell-grid', getComputedStyle(shell).display === 'grid', getComputedStyle(shell).display)
    const sidebarWidth = sidebar.getBoundingClientRect().width
    add('desktop-sidebar-width', sidebarWidth >= 200 && sidebarWidth <= 300, String(sidebarWidth))
    add('mobile-topbar-hidden', getComputedStyle(topbar).display === 'none', getComputedStyle(topbar).display)
  }

  return { viewport: '${viewport.name}', requestedWidth: ${viewport.width}, requestedHeight: ${viewport.height}, width, height, columns, checks, ok: checks.every(check => check.pass) }
})()`

const failures = []
let cdp
try {
  const websocketUrl = await waitForDebugger()
  cdp = new CdpClient(websocketUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  for (const viewport of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
      positionX: 0,
      positionY: 0,
      dontSetVisibleSize: false,
    })
    await cdp.send('Emulation.setScrollbarsHidden', { hidden: true })

    const loaded = cdp.waitFor('Page.loadEventFired')
    await cdp.send('Page.navigate', { url: fixtureUrl })
    await loaded
    await sleep(80)

    const evaluation = await cdp.send('Runtime.evaluate', {
      expression: evaluateChecks(viewport),
      returnByValue: true,
      awaitPromise: true,
    })
    const result = evaluation?.result?.value
    if (!result) throw new Error(`${viewport.name}: Chrome não retornou o resultado da validação.`)

    console.log(`${result.ok ? '✓' : '✗'} ${viewport.name} requested=${result.requestedWidth}x${result.requestedHeight} actual=${result.width}x${result.height}: ${result.checks.map(check => `${check.name}=${check.pass ? 'ok' : 'FAIL'}`).join(', ')}`)
    if (!result.ok) failures.push(`${viewport.name}: ${result.checks.filter(check => !check.pass).map(check => `${check.name} (${check.detail})`).join('; ')}`)

    const capture = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    writeFileSync(join(output, `${viewport.name}.png`), Buffer.from(capture.data, 'base64'))
  }
} finally {
  cdp?.close()
  browser.kill('SIGTERM')
  await sleep(50)
  if (!browser.killed) browser.kill('SIGKILL')
  rmSync(chromeProfile, { recursive: true, force: true })
}

if (failures.length) {
  console.error('\nFalhas responsivas detectadas:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`\nAdmin Center validado com emulação real em ${viewports.length} viewports. Screenshots: ${output}`)
