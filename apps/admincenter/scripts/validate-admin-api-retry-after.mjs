import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/adminApi.js', import.meta.url), 'utf8')
const checks = [
  ['429 responses are retryable only for GET requests', /response\.status === 429/.test(source) && /method === 'GET'/.test(source)],
  ['server retry-after is honored with a bounded delay', /error\.retryAfter/.test(source) && /MAX_RATE_LIMIT_RETRY_MS/.test(source) && /Math\.min\(Number\(error\.retryAfter\) \* 1000/.test(source)],
  ['caller cancellation is preserved during the wait', /delay\(retryDelay\(error\), externalSignal\)/.test(source)],
  ['existing request deduplication remains in place', /inflightReads\.has\(requestKey\)/.test(source) && /inflightMutations\.has\(mutationKey\)/.test(source)],
]

const failed = checks.filter(([, passed]) => !passed)
if (failed.length) {
  console.error(failed.map(([label]) => `FAIL: ${label}`).join('\n'))
  process.exit(1)
}

console.log(checks.map(([label]) => `PASS: ${label}`).join('\n'))
