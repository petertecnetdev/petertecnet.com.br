import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/AdminAuthProvider.jsx', import.meta.url), 'utf8')

const required = [
  'composeAbortSignal(options.signal, controller.signal)',
  'if (typeof AbortSignal?.any === \'function\')',
  'options.signal?.aborted',
  'controller.abort(new DOMException(\'Request timeout\', \'TimeoutError\'))',
]

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Admin auth request signal contract missing: ${fragment}`)
  }
}

if (source.includes('signal: controller.signal')) {
  throw new Error('Admin auth request still discards caller signal')
}

console.log('Admin auth request signal contract passed')
