import assert from 'node:assert/strict'
import { formatArticleDate } from '../src/marketingContent.js'

const apiTimestamp = '2026-09-08T07:56:06.000000Z'
const dateOnly = '2026-09-08'

assert.doesNotThrow(() => formatArticleDate(apiTimestamp), 'API ISO timestamps must never crash the landing')
assert.notEqual(formatArticleDate(apiTimestamp), 'Peter Tecnet', 'valid API timestamps must render as dates')
assert.notEqual(formatArticleDate(dateOnly), 'Peter Tecnet', 'date-only article values must remain supported')
assert.equal(formatArticleDate('not-a-date'), 'Peter Tecnet', 'invalid external dates must degrade safely')

console.log('[marketing-runtime] API article dates are safe')
