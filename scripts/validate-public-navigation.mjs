import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { handlePublicNavigationKeyDown, publicNavigationMenuLabel } from '../src/publicSiteNavigation.js'

const calls = []
const escapeEvent = {
  key: 'Escape',
  preventDefault() { calls.push('preventDefault') },
}
const handled = handlePublicNavigationKeyDown(escapeEvent, {
  close: () => calls.push('close'),
  focusTrigger: () => calls.push('focus'),
})

assert.equal(handled, true)
assert.deepEqual(calls, ['preventDefault', 'close', 'focus'])
assert.equal(publicNavigationMenuLabel(false), 'Abrir menu')
assert.equal(publicNavigationMenuLabel(true), 'Fechar menu')

const ignoredCalls = []
assert.equal(handlePublicNavigationKeyDown({ key: 'Tab', preventDefault: () => ignoredCalls.push('preventDefault') }, {
  close: () => ignoredCalls.push('close'),
  focusTrigger: () => ignoredCalls.push('focus'),
}), false)
assert.deepEqual(ignoredCalls, [])

const component = await readFile(new URL('../src/PublicSiteHeader.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/MarketingExperience.css', import.meta.url), 'utf8')
const requiredMarkup = [
  'aria-expanded={open}',
  'aria-controls={navigationId}',
  'aria-label={publicNavigationMenuLabel(open)}',
  'id={navigationId}',
  "aria-current={currentActive === item.id ? 'page' : undefined}",
  'onClick={close}',
  "document.addEventListener('keydown', onKeyDown)",
]
for (const contract of requiredMarkup) {
  assert.ok(component.includes(contract), `Contrato de navegação ausente: ${contract}`)
}
assert.match(styles, /@media \(max-width: 860px\)[\s\S]*?\.mkt-menu \{ display: block;/)
assert.match(styles, /\.mkt-nav\.is-open\s*\{\s*display:\s*flex;/)

for (const path of ['MarketingExperience.jsx', 'PublicBlogIndex.jsx', 'PublicBlogArticle.jsx', 'PublicDiscoveryExperience.jsx']) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
  assert.ok(source.includes("import PublicSiteHeader from './PublicSiteHeader.jsx'"), `Header compartilhado ausente em ${path}`)
  assert.ok(source.includes('<PublicSiteHeader'), `Header compartilhado não renderizado em ${path}`)
}

console.log('Navegação pública responsiva, ARIA, Escape e superfícies compartilhadas: PASS')
