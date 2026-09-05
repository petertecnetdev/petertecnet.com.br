import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.cwd())
const assets = join(root, 'dist', 'assets')
const output = join(root, 'artifacts', 'admin-interaction-guard')
const safetyPath = join(root, 'src', 'admin', 'adminInteractionSafety.js')
const safetyModule = pathToFileURL(safetyPath).href

if (!existsSync(assets)) throw new Error('dist/assets não encontrado. Execute npm run build antes do teste.')

const safetySource = readFileSync(safetyPath, 'utf8')
const mobileContracts = [
  ['mobile breakpoint', safetySource.includes("const MOBILE_QUERY = '(max-width: 760px)'" )],
  ['mobile state reconciliation', safetySource.includes('bodyOpen !== backdropOpen || bodyOpen !== buttonOpen')],
  ['stale body lock removal', safetySource.includes("document.body.classList.remove('admin-mobile-menu-open')")],
  ['stale backdrop removal', safetySource.includes("backdrop.classList.remove('is-open')")],
  ['closed drawer becomes inert', safetySource.includes('setInert(drawer, true)')],
  ['desktop drawer becomes interactive', safetySource.includes('setInert(drawer, false)')],
]

for (const [name, pass] of mobileContracts) {
  console.log(`${pass ? '✓' : '✗'} interaction-contract/${name}`)
  if (!pass) throw new Error(`Contrato do watchdog ausente: ${name}`)
}

const cssFiles = readdirSync(assets).filter(file => file.endsWith('.css')).map(file => join(assets, file))
const cssLinks = cssFiles.map(file => `<link rel="stylesheet" href="${pathToFileURL(file).href}">`).join('\n')
const chromeCandidates = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)
const chrome = chromeCandidates.find(existsSync)
if (!chrome) throw new Error('Chrome/Chromium não encontrado.')

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

function probeDocument() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${cssLinks}<style>*{animation:none!important;transition:none!important}#click-probe{position:absolute;left:45%;top:45%;width:150px;height:52px;z-index:2}</style></head>
  <body style="pointer-events:none">
    <main id="root" class="ecosystem-shell admin-persistent-shell" inert>
      <aside class="ecosystem-sidebar admin-persistent-sidebar" inert aria-hidden="true"><nav><button>Visão geral</button></nav></aside>
      <section class="ecosystem-main admin-persistent-main" data-admin-persistent-content inert aria-hidden="true"><button id="click-probe" type="button">Clique saudável</button></section>
    </main>
    <button class="admin-mobile-backdrop is-open" aria-hidden="true" tabindex="0"></button>
    <button class="admin-mobile-menu-button" aria-expanded="false"></button>
    <div class="peter-processing"><div class="peter-processing__visual"><i></i><i></i></div><strong>Atualizando ecossistema...</strong></div>
    <div class="admin-command-overlay" id="orphan-overlay"></div>
    <pre id="result" hidden></pre>
    <script type="module">
      import { repairAdminInteractionState } from '${safetyModule}'
      let clicks = 0
      document.querySelector('#click-probe').addEventListener('click', () => { clicks += 1 })
      addEventListener('load', () => requestAnimationFrame(() => {
        const outcome = repairAdminInteractionState({ force: true })
        requestAnimationFrame(() => {
          const checks = []
          const add = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail })
          const root = document.querySelector('#root')
          const main = document.querySelector('.admin-persistent-main')
          const drawer = document.querySelector('.admin-persistent-sidebar')
          const backdrop = document.querySelector('.admin-mobile-backdrop')
          const processing = document.querySelector('.peter-processing')
          const probe = document.querySelector('#click-probe')
          const rect = probe.getBoundingClientRect()
          const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          top?.closest?.('#click-probe')?.click()
          const backdropStyle = getComputedStyle(backdrop)
          const processingRect = processing.getBoundingClientRect()

          add('guard-activated', document.body.classList.contains('admin-interaction-guard-active'))
          add('root-not-inert', !root.inert, String(root.inert))
          add('content-not-inert', !main.inert, String(main.inert))
          add('content-not-aria-hidden', main.getAttribute('aria-hidden') !== 'true', main.getAttribute('aria-hidden') || 'none')
          add('body-pointer-events-restored', document.body.style.pointerEvents !== 'none', document.body.style.pointerEvents || 'default')
          add('processing-nonblocking', getComputedStyle(processing).pointerEvents === 'none', getComputedStyle(processing).pointerEvents)
          add('processing-no-longer-fullscreen', processingRect.width < innerWidth * .95 && processingRect.height < innerHeight * .25, processingRect.width + 'x' + processingRect.height)
          add('stale-backdrop-closed', !backdrop.classList.contains('is-open'), backdrop.className)
          add('stale-backdrop-nonblocking', backdropStyle.display === 'none' || backdropStyle.pointerEvents === 'none', backdropStyle.display + '/' + backdropStyle.pointerEvents)
          add('orphan-overlay-removed', !document.querySelector('#orphan-overlay'))
          add('underlying-button-hit-test', Boolean(top?.closest?.('#click-probe')), top?.className || top?.tagName || 'none')
          add('underlying-button-clicked', clicks === 1, String(clicks))
          add('repair-reported', outcome.repaired > 0, String(outcome.repaired))
          add('desktop-drawer-interactive', !drawer.inert, String(drawer.inert))
          add('desktop-drawer-visible-to-a11y', !drawer.hasAttribute('aria-hidden'), drawer.getAttribute('aria-hidden') || 'none')

          document.querySelector('#result').textContent = JSON.stringify({ scenario: 'poisoned-admin', checks, ok: checks.every(check => check.pass) })
          document.body.dataset.complete = 'true'
        })
      }))
    <\/script>
  </body></html>`
}

function parse(html) {
  const match = html.match(/<pre id="result" hidden="">([^<]+)<\/pre>/) || html.match(/<pre id="result" hidden>([^<]+)<\/pre>/)
  if (!match) return null
  return JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#39;', "'"))
}

function runProbe(url, common, attempts = 6) {
  let last = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const run = spawnSync(chrome, [...common, '--dump-dom', url], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    last = run
    if (run.status !== 0) continue
    const result = parse(run.stdout)
    if (result) return { result, attempt, run }
  }
  return { result: null, attempt: attempts, run: last }
}

const file = join(output, 'poisoned-admin.html')
writeFileSync(file, probeDocument())
const common = [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--allow-file-access-from-files', '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=3500', '--window-size=1280,800',
]
const probe = runProbe(pathToFileURL(file).href, common)
const result = probe.result
if (!result) {
  const detail = probe.run?.stderr?.trim() || probe.run?.stdout?.trim()?.slice(-500) || 'sem saída do Chromium'
  throw new Error(`Chromium não concluiu o probe após ${probe.attempt} tentativas (${detail})`)
}

console.log(`${result.ok ? '✓' : '✗'} interaction-guard/poisoned-admin: ${result.checks.map(check => `${check.name}=${check.pass ? 'ok' : 'FAIL'}`).join(', ')}${probe.attempt > 1 ? ` (tentativa ${probe.attempt})` : ''}`)
if (!result.ok) {
  const failed = result.checks.filter(check => !check.pass).map(check => `${check.name} (${check.detail})`).join('; ')
  throw new Error(`Falhas no watchdog de interação administrativa: ${failed}`)
}

console.log('\nWatchdog de interação validado contra DOM administrativo deliberadamente congelado.')
