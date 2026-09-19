import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const app = read('src/App.jsx')
const main = read('src/main.jsx')
const navigation = read('src/AdminAppNavigation.jsx')
const session = read('src/AdminSessionGuard.jsx')
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
check(!main.includes('AdminAppNavigation'), 'main não deve montar o controlador legado de navegação.')
check(!main.includes('AdminEstablishmentsIntegration'), 'main não deve montar integração DOM de estabelecimentos.')
check(!main.includes('AdminItemsIntegration'), 'main não deve montar integração DOM de itens.')
check(!main.includes('AdminApplicationsExperience'), 'main não deve montar experiência duplicada de aplicações.')
check(!main.includes('AdminSessionGuard'), 'main não deve duplicar validação/montagem administrativa.')
check(navigation.includes('MutationObserver'), 'Arquivo legado permanece disponível apenas para compatibilidade histórica.')
check(session.includes('AdminAppNavigation'), 'Guard legado permanece isolado e não montado pelo entrypoint.')

if (failures.length) {
  console.error('Admin stability validation failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Admin stability validation passed.')
