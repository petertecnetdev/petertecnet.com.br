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
const app = read('src/App.jsx')
const index = read('index.html')
const responsive = read('src/AdminResponsive.css')
const experience = read('src/AdminExperienceV2.css')
const appCss = read('src/App.css')
const establishmentsCss = read('src/AdminEstablishmentsIntegration.css')
const notificationsCss = read('src/NotificationsCenter.css')

const responsiveImport = main.indexOf("import './AdminResponsive.css'")
const experienceImport = main.indexOf("import './AdminExperienceV2.css'")
const appImport = main.indexOf("import './App.css'")
const feedbackImport = main.indexOf("import './AdminEstablishmentsFeedback.css'")

check('viewport meta is configured', /name="viewport"\s+content="[^"]*width=device-width/.test(index))
check('responsive layer is imported', responsiveImport >= 0)
check('responsive layer loads after base Admin CSS', responsiveImport > appImport && responsiveImport > feedbackImport)
check('legacy navigation/hamburger/topbar polish layers are not loaded', !main.includes("AdminNavigationStandard.css") && !main.includes("AdminHamburgerPolish.css") && !main.includes("AdminTopbarPolish.css"))
check('V2 experience is the final Admin CSS layer', experienceImport > responsiveImport)
check('entrypoint no longer mounts duplicate session/navigation controller', !main.includes('AdminSessionGuard') && !main.includes('AdminAppNavigation'))
check('entrypoint no longer mounts duplicate applications experience', !main.includes('AdminApplicationsExperience'))
check('React owns active page state', app.includes('data-admin-page={activePage}') && app.includes('setActivePage'))
check('navigation supports browser history', app.includes("window.addEventListener('popstate'") && app.includes('writePageHistory'))
check('navigation does not depend on document capture clicks', !app.includes("document.addEventListener('click', handleClick, true)"))
check('Estabelecimentos and Itens are native React modules', app.includes('<AdminEstablishmentsPage />') && app.includes('<AdminItemsManager applications={applications} />'))
check('active page is announced', app.includes("aria-current={activePage === id ? 'page' : undefined}"))
check('selected page resets viewport', app.includes("window.scrollTo({ top: 0, left: 0, behavior: 'auto' })"))
check('root surfaces cannot widen the page', responsive.includes('.admin-shell') && responsive.includes('overflow-x: clip'))
check('tables keep local scrolling on dense viewports', responsive.includes('.table-wrap') && responsive.includes('.est-table-wrap') && responsive.includes('.notification-table-wrap'))
check('financial table becomes cards on phones', responsive.includes(".table-wrap td:nth-child(1)::before { content: 'Aplicação'; }"))
check('notification history becomes cards on phones', responsive.includes(".notification-table td:nth-child(1)::before { content: 'Campanha'; }"))
check('mobile refresh action remains visible', responsive.includes('.icon-button') && responsive.includes('display: grid'))
check('mobile drawer respects viewport and safe area', experience.includes('width:min(360px,90vw)') && experience.includes('env(safe-area-inset-top)'))
check('very narrow screens have dedicated handling', responsive.includes('@media (max-width: 360px)'))
check('short landscape screens have dedicated handling', responsive.includes('@media (max-height: 620px) and (orientation: landscape)'))
check('touch targets have coarse-pointer handling', responsive.includes('@media (hover: none), (pointer: coarse)'))
check('reduced motion is respected', experience.includes('@media(prefers-reduced-motion:reduce)') || responsive.includes('@media (prefers-reduced-motion: reduce)'))
check('base dashboard still has tablet drawer breakpoint', appCss.includes('@media(max-width:980px)'))
check('establishments still has mobile card-table breakpoint', establishmentsCss.includes('@media(max-width:760px)') && establishmentsCss.includes('data-label'))
check('notifications still has mobile layout breakpoint', notificationsCss.includes('@media(max-width:760px)'))
check('V2 CSS renders one module at a time including Agents', experience.includes('[data-admin-page="agents"]') && experience.includes('[data-admin-page="establishments"]') && experience.includes('[data-admin-page="items"]'))
check('drawer navigation scrolls internally', experience.includes('.sidebar nav') && experience.includes('overflow-y:auto'))
check('V2 has tablet and phone breakpoints', experience.includes('@media(max-width:980px)') && experience.includes('@media(max-width:760px)') && experience.includes('@media(max-width:500px)'))

if (failures.length) {
  console.error(`\n${failures.length} regressão(ões) de responsividade/navegação detectada(s).`)
  process.exit(1)
}

console.log('\nAdmin Center responsive navigation contract validated.')
