import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const sdkSource = readFileSync(resolve(root, 'public/ecosystem/peter-identity.js'), 'utf8')
const chromeCandidates = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)
const chrome = chromeCandidates.find(existsSync)
if (!chrome) throw new Error('Chrome/Chromium não encontrado para o E2E cross-domain do Peter Identity.')

const profileDir = mkdtempSync(join(tmpdir(), 'peter-identity-e2e-'))
let globalSession = false
let globalLogoutCount = 0
const events = []

const json = (res, status, payload, origin, extra = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' } : {}),
    ...extra,
  })
  res.end(JSON.stringify(payload))
}

const corsHeaders = origin => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Accept,Authorization,Content-Type,Origin,X-Peter-App,X-Peter-CSRF,X-Peter-Device,X-Peter-Device-Name,X-Peter-Identity-SDK,X-Peter-Step-Up,X-Peter-Step-Up-Retry,X-Peter-Identity-Retry',
})

function appPage(appSlug, phase, port) {
  const phaseCode = {
    establish: `localStorage.setItem('token','seed-${appSlug}'); await PeterIdentity.initialize({apiBaseUrl:API,appSlug:APP}); assert(PeterIdentity.getAccessToken()?.startsWith('${appSlug}-token-'),'initial app token');`,
    restore: `await PeterIdentity.initialize({apiBaseUrl:API,appSlug:APP}); assert(PeterIdentity.getAccessToken()?.startsWith('${appSlug}-token-'),'cross-domain restore');`,
    localLogout: `await PeterIdentity.initialize({apiBaseUrl:API,appSlug:APP}); await PeterIdentity.logoutCurrentApp(); const recovered=await PeterIdentity.recover({force:true}); assert(!PeterIdentity.getAccessToken()&&!recovered,'local logout opt-out');`,
    stillAuthenticated: `await PeterIdentity.initialize({apiBaseUrl:API,appSlug:APP}); assert(Boolean(PeterIdentity.getAccessToken()),'other app remains authenticated');`,
    globalLogout: `await PeterIdentity.initialize({apiBaseUrl:API,appSlug:APP}); const observer=new MutationObserver(()=>{const root=document.querySelector('#peter-identity-step-up');const input=root?.querySelector('input');const button=root?.querySelector('.pi-confirm');if(input&&button){input.value='e2e-password';button.click();observer.disconnect();}});observer.observe(document.documentElement,{childList:true,subtree:true});const ok=await PeterIdentity.logoutEverywhere();assert(ok===true&&!PeterIdentity.getAccessToken(),'global logout');`,
    noRestore: `await PeterIdentity.initialize({apiBaseUrl:API,appSlug:APP}); assert(!PeterIdentity.getAccessToken(),'global logout blocks new app restore');`,
  }[phase]

  return `<!doctype html><html><head><meta charset="utf-8"><title>${appSlug}-${phase}</title></head><body><pre id="result">pending</pre><script src="http://peter.petertecnet.test:${port}/peter-identity.js"></script><script>
  const APP=${JSON.stringify(appSlug)};const API='http://api.petertecnet.test:${port}/api';
  const result=document.querySelector('#result');const assert=(value,label)=>{if(!value)throw new Error(label)};
  (async()=>{try{${phaseCode} result.textContent=JSON.stringify({ok:true,app:APP,phase:${JSON.stringify(phase)},token:Boolean(PeterIdentity.getAccessToken()),paused:PeterIdentity.isSsoPaused()});document.body.dataset.done='true'}catch(error){result.textContent=JSON.stringify({ok:false,app:APP,phase:${JSON.stringify(phase)},message:error?.message||String(error)});document.body.dataset.done='true'}})();
  <\/script></body></html>`
}

const server = createServer((req, res) => {
  const host = String(req.headers.host || '').split(':')[0]
  const origin = req.headers.origin || ''
  const url = new URL(req.url || '/', `http://${host}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin)); res.end(); return
  }

  if (host === 'peter.petertecnet.test' && url.pathname === '/peter-identity.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(sdkSource); return
  }

  if (host !== 'api.petertecnet.test') {
    const [, phase, appSlug] = url.pathname.split('/')
    if (phase && appSlug) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(appPage(appSlug, phase, server.address().port)); return
    }
    res.writeHead(404); res.end('not found'); return
  }

  const app = String(req.headers['x-peter-app'] || 'unknown')
  const cookies = String(req.headers.cookie || '')
  const hasCookie = globalSession && cookies.includes('peter_ecosystem_session=e2e-session')
  events.push({ method: req.method, path: url.pathname, app, hasCookie })

  if (url.pathname === '/api/account/identity/protocol') return json(res, 200, { success: true, data: { name: 'Peter Identity', protocol_version: '3.0', sdk_min_version: '3.0.0', capabilities: { global_sso: true } } }, origin)

  if (url.pathname === '/api/account/identity/sso/session' && req.method === 'POST') {
    if (!String(req.headers.authorization || '').startsWith('Bearer ')) return json(res, 401, { success: false, code: 'UNAUTHENTICATED' }, origin)
    globalSession = true
    return json(res, 200, { success: true, data: { rollout: true } }, origin, { 'Set-Cookie': ['peter_ecosystem_session=e2e-session; Path=/; HttpOnly; SameSite=Lax', 'peter_ecosystem_refresh=e2e-refresh; Path=/; HttpOnly; SameSite=Lax'] })
  }

  if (url.pathname === '/api/account/identity/sso/csrf' && req.method === 'GET') {
    if (!hasCookie) return json(res, 401, { success: false, code: 'NO_GLOBAL_SESSION' }, origin)
    return json(res, 200, { success: true, data: { csrf_token: `csrf-${app}` } }, origin)
  }

  if (url.pathname === '/api/account/identity/sso/exchange' && req.method === 'POST') {
    if (!hasCookie || req.headers['x-peter-csrf'] !== `csrf-${app}`) return json(res, 401, { success: false, code: 'SSO_REJECTED' }, origin)
    return json(res, 200, { success: true, data: { access_token: `${app}-token-${Date.now()}` } }, origin, { 'Set-Cookie': 'peter_ecosystem_refresh=e2e-refresh-rotated; Path=/; HttpOnly; SameSite=Lax' })
  }

  if (url.pathname === '/api/account/identity/logout' && req.method === 'POST') return json(res, 200, { success: true }, origin)

  if (url.pathname === '/api/account/identity/step-up/options' && req.method === 'GET') return json(res, 200, { success: true, data: { methods: { password: true, totp: false, passkey: false } } }, origin)
  if (url.pathname === '/api/account/identity/step-up/password' && req.method === 'POST') return json(res, 200, { success: true, data: { token: 'e2e-step-up' } }, origin)

  if (url.pathname === '/api/account/identity/logout-everywhere' && req.method === 'POST') {
    if (req.headers['x-peter-step-up'] !== 'e2e-step-up') return json(res, 428, { success: false, code: 'STEP_UP_REQUIRED', step_up_action: 'logout_everywhere' }, origin)
    globalSession = false; globalLogoutCount += 1
    return json(res, 200, { success: true }, origin, { 'Set-Cookie': ['peter_ecosystem_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax', 'peter_ecosystem_refresh=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'] })
  }

  return json(res, 404, { success: false, message: 'mock route not found', path: url.pathname }, origin)
})

function runChrome(url, port) {
  return new Promise((resolveRun, rejectRun) => {
    const rules = ['nexus.petertecnet.test', 'cutinapp.petertecnet.test', 'rasoio.petertecnet.test', 'api.petertecnet.test', 'peter.petertecnet.test'].map(host => `MAP ${host} 127.0.0.1`).join(',')
    const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-proxy-server', `--host-resolver-rules=${rules}`, `--user-data-dir=${profileDir}`, '--virtual-time-budget=7000', '--dump-dom', url]
    const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', rejectRun)
    child.on('close', code => {
      if (code !== 0) return rejectRun(new Error(`Chrome exit ${code}: ${stderr || stdout}`))
      const match = stdout.match(/<pre id="result">([^<]+)<\/pre>/)
      if (!match) return rejectRun(new Error(`Resultado E2E ausente para ${url}. DOM: ${stdout.slice(-2000)}`))
      const decoded = match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&')
      const result = JSON.parse(decoded)
      if (!result.ok) return rejectRun(new Error(`${result.app}/${result.phase}: ${result.message}`))
      resolveRun(result)
    })
  })
}

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
const port = server.address().port
const phases = [
  ['nexus', 'establish'],
  ['cutinapp', 'restore'],
  ['cutinapp', 'localLogout'],
  ['nexus', 'stillAuthenticated'],
  ['nexus', 'globalLogout'],
  ['rasoio', 'noRestore'],
]

try {
  for (const [app, phase] of phases) {
    const url = `http://${app}.petertecnet.test:${port}/${phase}/${app}`
    const result = await runChrome(url, port)
    console.log(`✓ ${app}: ${phase}`, result)
  }
  if (globalLogoutCount !== 1) throw new Error(`Logout global esperado 1 vez, observado ${globalLogoutCount}.`)
  const exchangedApps = new Set(events.filter(event => event.path.endsWith('/sso/exchange')).map(event => event.app))
  if (!exchangedApps.has('nexus') || !exchangedApps.has('cutinapp')) throw new Error(`Troca SSO cross-domain incompleta: ${[...exchangedApps].join(', ')}`)
  console.log(`\nPeter Identity cross-domain E2E OK. ${events.length} chamadas de API observadas.`)
} finally {
  await new Promise(resolveClose => server.close(resolveClose))
  rmSync(profileDir, { recursive: true, force: true })
}
