import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')
const checks = []
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail })
  if (!pass) console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`)
  else console.log(`✓ ${name}`)
}

check(
  'location parser preserves the dashboard destination',
  !app.includes("requestedPage === 'dashboard' ? 'users' : requestedPage"),
  'page=visao-geral/dashboard must not be coerced to users',
)
check(
  'navigation preserves explicit dashboard destinations',
  !app.includes("PAGE_CONFIG[section] && section !== 'dashboard' ? section : 'users'"),
  'go(\'dashboard\') must not discard the requested page',
)
check(
  'dashboard deep-link is represented in the page config',
  app.includes("dashboard: { slug: 'visao-geral', label: 'Visão geral' }"),
)

if (checks.some(item => !item.pass)) process.exit(1)
console.log(`Admin navigation deep-link contract passed (${checks.length} checks).`)
