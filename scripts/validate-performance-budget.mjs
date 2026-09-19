import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')
const assets = join(dist, 'assets')
const MAX_JS_ENTRY = 300 * 1024
const MAX_CSS_ENTRY = 160 * 1024
const MAX_TOTAL_INITIAL = 650 * 1024

const files = await readdir(assets)
let total = 0
const violations = []

for (const file of files) {
  if (!/\.(js|css)$/.test(file)) continue
  const path = join(assets, file)
  const { size } = await stat(path)
  const source = await readFile(path, 'utf8')
  const isInitial = /entry|index|marketing-hub|react/i.test(file) || source.includes('Peter Tecnet')
  if (!isInitial) continue
  total += size
  if (file.endsWith('.js') && size > MAX_JS_ENTRY) violations.push(`${file}: ${size} bytes > JS budget ${MAX_JS_ENTRY}`)
  if (file.endsWith('.css') && size > MAX_CSS_ENTRY) violations.push(`${file}: ${size} bytes > CSS budget ${MAX_CSS_ENTRY}`)
}

if (total > MAX_TOTAL_INITIAL) violations.push(`initial JS/CSS: ${total} bytes > budget ${MAX_TOTAL_INITIAL}`)
if (violations.length) {
  console.error('[performance-budget] FAILED')
  violations.forEach(item => console.error(' -', item))
  process.exit(1)
}
console.log(`[performance-budget] OK: initial assets ${total} bytes (budget ${MAX_TOTAL_INITIAL})`)
