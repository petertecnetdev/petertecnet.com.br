import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const source = fs.readFileSync(path.join(root, 'src/adminRuntimeMonitor.js'), 'utf8')

const required = [
  'function sanitizeText',
  'Bearer [REDACTED]',
  '[REDACTED]',
  'MAX_ERROR_TEXT',
  'MAX_STACK_TEXT',
  'sanitizeText(error?.message',
  'sanitizeText(error?.stack',
  'sanitizeText(event.filename',
]

const missing = required.filter(token => !source.includes(token))
if (missing.length) {
  console.error('Runtime diagnostics redaction contract failed:')
  for (const token of missing) console.error(`- missing ${token}`)
  process.exit(1)
}

if (/return\s+\{\s*name:\s*error\?\.name[\s\S]{0,200}stack:\s*error\?\.stack/.test(source)) {
  console.error('Raw error fields are still exposed by the runtime monitor.')
  process.exit(1)
}

console.log('Runtime diagnostics redaction contract passed.')
