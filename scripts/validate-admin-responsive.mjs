import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const read = path => readFileSync(resolve(root, path), 'utf8')
const failures = []

function check(name, condition) {
  if (condition) console.log(`✓ ${name}`)
  else {
    console.error(`✗ ${name}`)
    failures.push(name)
  }
}

const main = read('src/main.jsx')
const index = read('index.html')
const responsive = read('src/AdminResponsive.css')
const appCss = read('src/App.css')
const establishmentsCss = read('src/AdminEstablishmentsIntegration.css')
const notificationsCss = read('src/NotificationsCenter.css')

const responsiveImport = main.indexOf("import './AdminResponsive.css'")
const appImport = main.indexOf("import './App.css'")
const feedbackImport = main.indexOf("import './AdminEstablishmentsFeedback.css'")

check('viewport meta is configured', /name="viewport"\s+content="[^"]*width=device-width/.test(index))
check('responsive layer is imported', responsiveImport >= 0)
check('responsive layer loads after base Admin CSS', responsiveImport > appImport && responsiveImport > feedbackImport)
check('root surfaces cannot widen the page', responsive.includes('.admin-shell') && responsive.includes('overflow-x: clip'))
check('tables keep local scrolling on dense viewports', responsive.includes('.table-wrap') && responsive.includes('.est-table-wrap') && responsive.includes('.notification-table-wrap'))
check('financial table becomes cards on phones', responsive.includes(".table-wrap td:nth-child(1)::before { content: 'Aplicação'; }"))
check('notification history becomes cards on phones', responsive.includes(".notification-table td:nth-child(1)::before { content: 'Campanha'; }"))
check('mobile refresh action remains visible', responsive.includes('.icon-button') && responsive.includes('display: grid'))
check('mobile drawer respects viewport and safe area', responsive.includes('max-width: 88vw') && responsive.includes('env(safe-area-inset-top)'))
check('very narrow screens have dedicated handling', responsive.includes('@media (max-width: 360px)'))
check('short landscape screens have dedicated handling', responsive.includes('@media (max-height: 620px) and (orientation: landscape)'))
check('touch targets have coarse-pointer handling', responsive.includes('@media (hover: none), (pointer: coarse)'))
check('reduced motion is respected', responsive.includes('@media (prefers-reduced-motion: reduce)'))
check('base dashboard still has tablet drawer breakpoint', appCss.includes('@media(max-width:980px)'))
check('establishments still has mobile card-table breakpoint', establishmentsCss.includes('@media(max-width:760px)') && establishmentsCss.includes('data-label'))
check('notifications still has mobile layout breakpoint', notificationsCss.includes('@media(max-width:760px)'))

if (failures.length) {
  console.error(`\n${failures.length} regressão(ões) de responsividade detectada(s).`)
  process.exit(1)
}

console.log('\nAdmin Center responsive contract validated.')
