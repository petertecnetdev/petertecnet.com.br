import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const sourceRoot = join(scriptDir, '../src')
const failures = []
const scannedDialogs = []

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(absolutePath))
      continue
    }

    if (['.js', '.jsx', '.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(absolutePath)
    }
  }

  return files
}

const files = await collectSourceFiles(sourceRoot)

for (const filePath of files) {
  const source = await readFile(filePath, 'utf8')
  const dialogCount = (source.match(/role=["']dialog["']/g) || []).length

  if (dialogCount === 0) continue

  const file = relative(sourceRoot, filePath)
  scannedDialogs.push({ file, dialogCount })

  if (!source.includes('aria-modal="true"') && !source.includes("aria-modal='true'")) {
    failures.push(`${file}: dialog must expose aria-modal="true".`)
  }

  const hasAccessibleName = source.includes('aria-label=') || source.includes('aria-labelledby=')
  if (!hasAccessibleName) {
    failures.push(`${file}: dialog must expose aria-label or aria-labelledby.`)
  }
}

if (scannedDialogs.length === 0) {
  failures.push('No Admin Center dialog implementation was found for validation.')
}

if (failures.length > 0) {
  console.error('Dialog accessibility validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Dialog accessibility validation passed for ${scannedDialogs.length} source file(s).`)
