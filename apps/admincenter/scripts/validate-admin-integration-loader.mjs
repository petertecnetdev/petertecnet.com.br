import { readFile } from 'node:fs/promises'

const path = new URL('../src/components/PeterAccountGateway.jsx', import.meta.url)
const source = await readFile(path, 'utf8')

const requiredPatterns = [
  ['failed existing scripts are removed', /existing\.remove\(\)/],
  ['new failed scripts are removed', /script\.remove\(\)/],
  ['SDK promise resets after failure', /sdkPromise = null/],
  ['telemetry promise resets after failure', /telemetryPromise = null/],
  ['insights promise resets after failure', /insightsPromise = null/],
]

const missing = requiredPatterns.filter(([, pattern]) => !pattern.test(source)).map(([label]) => label)
if (missing.length) {
  throw new Error(`Admin integration loader retry contract failed: ${missing.join(', ')}`)
}

console.log('Admin integration loader retry contract: PASS')
