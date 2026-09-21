import fs from 'node:fs'

const runtime = fs.readFileSync('public/ecosystem/peter-impersonation-sync-guard.js', 'utf8')
const index = fs.readFileSync('index.html', 'utf8')

const checks = [
  ['guard wraps the shared sync method', runtime.includes('runtime.sync = async')],
  ['guard deduplicates in-flight sync calls', runtime.includes('if (inFlight) return inFlight')],
  ['guard has bounded installation retries', runtime.includes('attempts >= 20')],
  ['guard is loaded after impersonation runtime', index.indexOf('peter-impersonation.js') < index.indexOf('peter-impersonation-sync-guard.js')],
]

const failures = checks.filter(([, ok]) => !ok)
if (failures.length) {
  console.error(failures.map(([label]) => `FAIL: ${label}`).join('\n'))
  process.exit(1)
}

console.log(`PASS: ${checks.length} impersonation sync guard checks`)
