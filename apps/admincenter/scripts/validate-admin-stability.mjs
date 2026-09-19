import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const app = read('src/App.jsx')
const main = read('src/main.jsx')
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

check(app.includes('data-admin-page={activePage}'), 'App deve controlar a página ativa no React.')
check(app.includes("['establishments', 'Estabelecimentos'"), 'Estabelecimentos deve estar na navegação React.')
check(app.includes("['items', 'Itens'"), 'Itens deve estar na navegação React.')
check(app.includes('<AdminEstablishmentsPage />'), 'Estabelecimentos deve ser renderizado na árvore React.')
check(app.includes('<AdminItemsManager applications={applications} />'), 'Itens deve ser renderizado na árvore React.')
check(app.includes('BACKGROUND_REFRESH_MS = 120000'), 'Fallback de atualização deve ser >= 120s.')
check(app.includes('refreshInFlightRef.current'), 'Refresh global deve impedir concorrência.')
check(app.includes("document.visibilityState !== 'visible'"), 'Refresh em background deve respeitar visibilidade.')
check(app.includes('BACKGROUND_REFRESH_PAGES.has(activePageRef.current)'), 'Refresh deve respeitar a página ativa.')
check(!main.includes('AdminAppNavigation'), 'Entry point não pode montar controlador legado de navegação.')
check(!main.includes('AdminEstablishmentsIntegration'), 'Entry point não pode montar integração DOM de estabelecimentos.')
check(!main.includes('AdminItemsIntegration'), 'Entry point não pode montar integração DOM de itens.')
check(!main.includes('AdminApplicationsExperience'), 'Entry point não pode montar experiência duplicada de aplicações.')
check(!main.includes('AdminSessionGuard'), 'Entry point não pode duplicar validação/montagem administrativa.')
check(!app.includes("document.addEventListener('click', handleClick, true)"), 'App não pode capturar cliques globais para navegar.')
check(!app.includes('new MutationObserver'), 'App principal não pode depender de MutationObserver para navegar.')
check(app.includes('searchSequenceRef.current'), 'Busca global deve ignorar respostas assíncronas obsoletas.')
check(app.includes("activePage === 'agents'") && app.includes("activePage === 'notifications'"), 'Módulos pesados devem montar somente quando ativos.')
check(app.includes('<AdminModuleBoundary'), 'Módulos administrativos críticos devem ter Error Boundary.')
check(app.includes('handleSidebarKeyDown') && app.includes('aria-controls="admin-navigation"'), 'Drawer deve ter foco e teclado controlados pelo React.')
check(app.includes('navigator.onLine') && app.includes('admin-offline-banner'), 'Admin deve preservar leitura e sinalizar modo offline.')
check(!main.includes('GlobalImageInputEnhancer'), 'Runtime principal não deve inserir DOM dentro de componentes React via enhancer global.')

if (failures.length) {
  console.error('Admin stability validation failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Admin stability validation passed.')
