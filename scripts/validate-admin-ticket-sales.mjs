import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const read = path => readFileSync(resolve(root, path), 'utf8')
const failures = []
const check = (name, condition) => {
  if (condition) console.log(`✓ ${name}`)
  else {
    console.error(`✗ ${name}`)
    failures.push(name)
  }
}

const entry = read('src/main.jsx')
const page = read('src/AdminTicketSalesPage.jsx')
const css = read('src/AdminTicketSalesPage.css')

check('canonical ingressos route is exposed', entry.includes("'/admin/ingressos'"))
check('ticket aliases are exposed', entry.includes("'/admin/tickets'") && entry.includes("'/admin/events/tickets'"))
check('legacy admin routes remain isolated', entry.includes("path === '/admin' || path.startsWith('/admin/')"))
check('ticket workspace is lazy loaded', entry.includes("lazy(() => import('./AdminTicketSalesPage.jsx'))"))
check('workspace remains inside account gateway', entry.includes('<PeterAccountGateway') && entry.includes('{appPage}'))

check('establishments endpoint is used', page.includes("/admin/ecosystem/establishments"))
check('events endpoint is scoped by establishment', page.includes('/resources/events`'))
check('ticket details endpoint is scoped by event', page.includes('/resources/events/${encodeURIComponent(eventId)}/tickets'))
check('admin bearer token is required', page.includes('Authorization: `Bearer ${token}`'))
check('request timeout exists', page.includes('AbortController') && page.includes('20000'))
check('paid ticket metric is visible', page.includes('Ingressos vendidos') && page.includes('summary.sold_count'))
check('gross revenue metric is visible', page.includes('Receita bruta') && page.includes('summary.gross_revenue'))
check('availability metric is visible', page.includes('Disponíveis') && page.includes('summary.available_count'))
check('courtesy is separated from paid sales', page.includes('Cortesias') && page.includes('summary.courtesy_count'))
check('reversals are separated from paid sales', page.includes('Estornos/cancelados') && page.includes('summary.reversed_count'))
check('check-in metric is visible', page.includes('Check-ins') && page.includes('summary.checked_in_count'))
check('per-ticket inventory table exists', page.includes('Tipos de ingresso') && page.includes('details.tickets'))
check('recent paid sales list exists', page.includes('Ingressos pagos recentes') && page.includes('details.recent_sales'))
check('holder and order information are rendered', page.includes('sale.holder_name') && page.includes('sale.order_public_id'))
check('deep-link context is preserved', page.includes("url.searchParams.set('establishment_id'") && page.includes("url.searchParams.set('event_id'"))

check('responsive tablet breakpoint exists', css.includes('@media (max-width: 1100px)'))
check('responsive mobile breakpoint exists', css.includes('@media (max-width: 760px)'))
check('small-mobile metric collapse exists', css.includes('@media (max-width: 430px)') && css.includes('.ats-metrics { grid-template-columns: 1fr; }'))
check('wide ticket table is horizontally contained', css.includes('.ats-ticket-table { overflow-x: auto; }'))
check('mobile event/detail layout stacks', css.includes('.ats-layout { display: flex; flex-direction: column;'))

if (failures.length) {
  console.error(`\n${failures.length} regressão(ões) detectada(s) na área administrativa de ingressos.`)
  process.exit(1)
}

console.log('\nContrato da área administrativa de ingressos validado.')
