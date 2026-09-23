import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const failures = []

const entry = read('src/admin.css')
const quality = read('src/AdminQualityLayer.css')

const imports = [...entry.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(match => match[1])
const duplicates = imports.filter((value, index) => imports.indexOf(value) !== index)
if (duplicates.length > 0) {
  failures.push(`admin.css repeats stylesheet imports: ${[...new Set(duplicates)].join(', ')}`)
}

const reducedMotionContracts = (quality.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g) || []).length
if (reducedMotionContracts !== 1) {
  failures.push(`AdminQualityLayer.css must contain exactly one reduced-motion contract (found ${reducedMotionContracts})`)
}

const contrastContracts = (quality.match(/@media\s*\(prefers-contrast:\s*more\)/g) || []).length
if (contrastContracts !== 1) {
  failures.push(`AdminQualityLayer.css must contain exactly one high-contrast contract (found ${contrastContracts})`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Admin CSS contract validation passed.')
