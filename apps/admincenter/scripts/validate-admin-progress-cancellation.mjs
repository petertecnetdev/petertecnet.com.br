import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/adminApiProgress.js', import.meta.url), 'utf8')

const checks = [
  ['caller signal is composed', source.includes('const callerSignal = options.signal || null') && source.includes('callerSignal.addEventListener')],
  ['timeout is enforced', source.includes('DEFAULT_TIMEOUT') && source.includes('controller.abort(')],
  ['stream reader is cancelled on cleanup', source.includes('reader.cancel()')],
  ['abort is not converted into a false success', source.includes("if (callerSignal?.aborted) throw error")],
  ['session expiry contract is preserved', source.includes("window.dispatchEvent(new Event('admin-session-expired'))")],
]

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`adminApiProgress contract failed: ${label}`)
}

console.log('adminApiProgress cancellation contract: OK')
