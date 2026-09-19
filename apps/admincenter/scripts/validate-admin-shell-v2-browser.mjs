import { existsSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.cwd())
const assets = join(root, 'dist', 'assets')
const output = join(root, 'artifacts', 'admin-shell-v2')
if (!existsSync(assets)) throw new Error('dist/assets não encontrado.')

const chrome = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean).find(existsSync)
if (!chrome) throw new Error('Chrome/Chromium não encontrado.')

const css = readdirSync(assets)
  .filter(name => name.endsWith('.css'))
  .map(name => `<link rel="stylesheet" href="${pathToFileURL(join(assets, name)).href}">`)
  .join('\n')

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

const cases = [
  { name: 'desktop-open', width: 1440, height: 900, open: true, mobile: false },
  { name: 'desktop-closed', width: 1440, height: 900, open: false, mobile: false },
  { name: 'mobile-closed', width: 390, height: 844, open: false, mobile: true },
  { name: 'mobile-open', width: 390, height: 844, open: true, mobile: true },
]

function page(test) {
  const nav = ['Visão geral','Operações','Agentes','Financeiro','Aplicações','Usuários','Estabelecimentos','Itens','Notificações','Atividade']
    .map((label, index) => `<button class="${index === 0 ? 'active' : ''}"><span>•</span><b>${label}</b><i>→</i></button>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}<style>*{animation:none!important;transition:none!important}</style></head><body>
  <div class="admin-shell" data-admin-page="dashboard" data-sidebar-open="${test.open ? 'true' : 'false'}" data-density="comfortable">
    <div class="sidebar-backdrop ${test.open ? 'visible' : ''}"></div>
    <aside class="sidebar ${test.open ? 'open' : ''}" aria-hidden="${test.open ? 'false' : 'true'}"><a class="brand"><span>PT</span></a><nav><p>GESTÃO</p>${nav}</nav></aside>
    <main class="workspace"><header class="topbar"><button class="hamburger"><span></span><span></span><span></span></button></header><div class="content"><section class="hero-section" data-admin-page-key="dashboard"><h1>Dashboard administrativo</h1></section><section class="metrics-grid" data-admin-page-key="dashboard"><article class="metric-card"><strong>42</strong></article></section></div></main>
  </div>
  <pre id="result" hidden></pre>
  <script>addEventListener('load',()=>requestAnimationFrame(()=>{const shell=document.querySelector('.admin-shell');const sidebar=document.querySelector('.sidebar');const workspace=document.querySelector('.workspace');const backdrop=document.querySelector('.sidebar-backdrop');const checks=[];const add=(name,pass,detail='')=>checks.push({name,pass:Boolean(pass),detail});const side=getComputedStyle(sidebar);const work=workspace.getBoundingClientRect();add('no-horizontal-overflow',document.documentElement.scrollWidth<=innerWidth+2,document.documentElement.scrollWidth+'/'+innerWidth);add('workspace-contained',work.left>=-2&&work.right<=innerWidth+2,JSON.stringify({left:work.left,right:work.right,width:innerWidth}));if(${test.mobile}){add('mobile-sidebar-width',sidebar.getBoundingClientRect().width<=innerWidth*.92+2,String(sidebar.getBoundingClientRect().width));add('mobile-open-state',${test.open} ? side.transform==='none'||side.transform==='matrix(1, 0, 0, 1, 0, 0)' : side.transform!=='none',side.transform);add('mobile-backdrop-state',${test.open} ? getComputedStyle(backdrop).pointerEvents==='auto' : getComputedStyle(backdrop).pointerEvents==='none',getComputedStyle(backdrop).pointerEvents)}else{add('desktop-sidebar-state',${test.open} ? side.transform==='none'||side.transform==='matrix(1, 0, 0, 1, 0, 0)' : side.transform!=='none',side.transform);add('desktop-workspace-offset',${test.open} ? work.left>=295 : work.left<=2,String(work.left));add('desktop-no-backdrop',getComputedStyle(backdrop).pointerEvents==='none',getComputedStyle(backdrop).pointerEvents)}document.querySelector('#result').textContent=JSON.stringify({name:'${test.name}',ok:checks.every(c=>c.pass),checks});document.body.dataset.complete='true'}));<\/script>
  </body></html>`
}

function parse(html) {
  const match = html.match(/<pre id="result" hidden="">([^<]+)<\/pre>/) || html.match(/<pre id="result" hidden>([^<]+)<\/pre>/)
  if (!match) return null
  return JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
}

const failures = []
for (const test of cases) {
  const file = join(output, `${test.name}.html`)
  writeFileSync(file, page(test))
  const run = spawnSync(chrome, [
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--allow-file-access-from-files','--virtual-time-budget=2500',
    `--window-size=${Math.max(500,test.width)},${Math.max(800,test.height)}`,
    '--dump-dom', pathToFileURL(file).href,
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  const result = run.status === 0 ? parse(run.stdout) : null
  if (!result) {
    failures.push(`${test.name}: browser probe não retornou resultado`)
    continue
  }
  console.log(`${result.ok ? '✓' : '✗'} ${test.name}: ${result.checks.map(c=>`${c.name}=${c.pass?'ok':'FAIL'}`).join(', ')}`)
  if (!result.ok) failures.push(`${test.name}: ${result.checks.filter(c=>!c.pass).map(c=>`${c.name} (${c.detail})`).join('; ')}`)
}

if (failures.length) {
  failures.forEach(item => console.error('- '+item))
  process.exit(1)
}
console.log('Admin shell V2 browser smoke passed.')
