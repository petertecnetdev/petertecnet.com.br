import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'src/adminApi.js'), 'utf8')

const required = [
  'const requestGenerations = new Map()',
  'function nextRequestGeneration(requestKey)',
  'function isCurrentRequestGeneration(requestKey, generation)',
  'const generation = nextRequestGeneration(requestKey)',
  'isCurrentRequestGeneration(requestKey, generation)',
]

for (const snippet of required) {
  if (!source.includes(snippet)) {
    throw new Error(`Admin API cache-generation contract missing: ${snippet}`)
  }
}

const cacheWrite = source.indexOf('memoryCache.set(requestKey')
const guard = source.indexOf('isCurrentRequestGeneration(requestKey, generation)')
if (cacheWrite < 0 || guard < 0 || guard > cacheWrite) {
  throw new Error('Admin API cache writes must be guarded by the latest request generation')
}

console.log('Admin API cache-generation contract passed.')
