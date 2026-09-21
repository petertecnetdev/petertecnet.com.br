import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve(process.cwd(), 'src/AccountAccessPage.jsx')
const source = fs.readFileSync(file, 'utf8')

const successIcons = [...source.matchAll(/className="account-access-success-icon"[^>]*>([^<]*)<\/div>/g)]
if (successIcons.length === 0) {
  throw new Error('Expected at least one account-access success icon to validate.')
}

const unhidden = successIcons.filter((match) => {
  const start = Math.max(0, match.index - 80)
  const fragment = source.slice(start, match.index + match[0].length)
  return !/aria-hidden\s*=\s*\{?['"]true['"]\}?/.test(fragment)
})

if (unhidden.length > 0) {
  throw new Error(
    `Found ${unhidden.length} decorative account-access success icon(s) without aria-hidden="true".`,
  )
}

console.log(`Account access accessibility validation passed (${successIcons.length} success icon(s)).`)
