import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const read = path => readFileSync(resolve(root, path), 'utf8')
const failures = []
const check = (name, condition) => condition ? console.log(`✓ ${name}`) : (console.error(`✗ ${name}`), failures.push(name))

const app = read('src/App.jsx')
const realtime = read('src/missionControlRealtime.js')
const agents = read('src/AgentChatPanel.jsx')
const support = read('src/SupportAdminApp.jsx')
const events = read('src/important-events-overlay.js')
const main = read('src/main.jsx')

check('dashboard fallback is not aggressive', app.includes('BACKGROUND_REFRESH_MS = 120000') && !app.includes('}, 15000)'))
check('agent polling is contextual and >= 60s', agents.includes("dataset?.adminPage === 'agents'") && agents.includes('}, 60000)'))
check('support launcher does not poll localStorage', !/setInterval\(update,\s*1500/.test(support))
check('important events polling is >= 120s', events.includes('POLL_MS = 120000'))
check('realtime stops retry loops while offline', realtime.includes('!navigator.onLine') && realtime.includes("state('offline')"))
check('realtime reconnects on browser online event', realtime.includes("window.addEventListener('online', handleOnline)"))
check('legacy navigation layers are absent from runtime entrypoint', !main.includes('AdminNavigationStandard.css') && !main.includes('AdminHamburgerPolish.css'))
check('hidden modules are conditional', ["agents","notifications","users","establishments","items","financial"].every(page => app.includes(`activePage === '${page}'`)))

if (failures.length) {
  console.error(`\n${failures.length} contrato(s) de runtime violado(s).`)
  process.exit(1)
}
console.log('\nAdmin runtime contracts validated.')
