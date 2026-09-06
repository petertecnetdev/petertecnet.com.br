import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')
const main = read('src/main.jsx')
const app = read('src/App.jsx')
const auth = read('src/AdminAuthProvider.jsx')
const data = read('src/AdminDataProvider.jsx')
const sw = read('public/service-worker.js')
const overview = read('src/ExecutiveOverview.jsx')

const checks = []
const check = (label, condition) => checks.push([label, Boolean(condition)])

check('single AdminAuthProvider owns admin authentication', main.includes('<AdminAuthProvider>') && app.includes('useAdminAuth'))
check('front no longer authorizes by literal owner email', !app.includes("OWNER_EMAIL") && !auth.includes("petertecnet@gmail.com"))
check('admin permission is verified through protected API endpoint', auth.includes("/admin/ecosystem/dashboard"))
check('shared AdminDataProvider cache is mounted', main.includes('<AdminDataProvider>') && data.includes('petertecnet_admin_data_cache_v2'))
check('executive overview is direct React composition', app.includes('<ExecutiveOverview') && !overview.includes('createPortal') && !overview.includes('MutationObserver'))
check('runtime does not mount legacy DOM bridges', !main.includes('AdminSessionGuard') && !main.includes('AdminOverviewNavigationBridge'))
check('App navigation is declarative', app.includes('data-admin-page={activePage}') && app.includes('data-admin-page-key="dashboard"'))
check('PWA uses root network-first navigation', sw.includes("CACHE_VERSION = 'petertecnet-admin-pwa-v7'") && !sw.includes("url.pathname.startsWith('/admin')"))
check('runtime release marker exists', app.includes('ADMIN_RELEASE_LABEL'))
check('transient API failure preserves session for retry', auth.includes("status: resolved === 'retryable' ? 'unavailable'") && auth.includes("if (resolved !== 'retryable')"))
check('support and telemetry join shared executive data', data.includes("/admin/support/summary") && data.includes("/admin/ecosystem/telemetry/health"))

let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failures += 1
}
if (failures) {
  console.error(`\n${failures} regressão(ões) de runtime detectada(s).`)
  process.exit(1)
}
console.log('\nAdmin Center runtime contract validated.')
