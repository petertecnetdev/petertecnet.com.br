import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sdkPath = resolve('public/ecosystem/peter-ecosystem.js')
const authSessionPath = resolve('public/ecosystem/peter-auth-session.js')
const source = readFileSync(sdkPath, 'utf8')
const authSessionSource = readFileSync(authSessionPath, 'utf8')

execFileSync(process.execPath, ['--check', sdkPath], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', authSessionPath], { stdio: 'inherit' })

const required = [
  "const SDK_VERSION = '2.0.0'",
  "customElements.define(ELEMENT_NAME",
  "account/ecosystem",
  "account/sso/handoff",
  "account/sso/exchange",
  "interactions/batch",
  "ecosystem_launcher_opened",
  "ecosystem_app_selected",
  "ecosystem_handoff_success",
  "ecosystem_handoff_failed",
  "FAVORITES_KEY",
  "RECENTS_KEY",
  "Buscar ferramenta",
  "operational_status",
  "maintenance_message",
  "sessionStorage",
  "cache: 'no-store'",
]

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`SDK contract marker missing: ${marker}`)
}

const authRequired = [
  "const VERSION = '1.0.0'",
  "credentials: 'include'",
  "/account/sso/session",
  "/account/sso/session/exchange",
  "peter_ecosystem_session",
  "X-Peter-Auth-Session",
  "PeterTecnetAuthSession",
]

for (const marker of authRequired) {
  if (!authSessionSource.includes(marker)) throw new Error(`Auth session contract marker missing: ${marker}`)
}

if (/APP_LOGOS\s*=/.test(source)) throw new Error('The centralized SDK must not contain a hardcoded application logo registry.')
if (/searchParams\.set\(['\"](?:token|access_token|auth_token)['\"]/.test(source)) throw new Error('JWT-like tokens must never be written to cross-application URLs.')
if (!/searchParams\.set\(['\"]peter_sso['\"]/.test(source)) throw new Error('SSO navigation must use the one-time peter_sso handoff code.')
if (!source.includes("host.endsWith('.petertecnet.com.br')")) throw new Error('Cross-app navigation must remain restricted to Peter Tecnet HTTPS domains.')
if (/document\.cookie/.test(authSessionSource)) throw new Error('The global SSO client must never read the HttpOnly session cookie.')
if (/searchParams\.set\(['\"](?:token|access_token|auth_token)['\"]/.test(authSessionSource)) throw new Error('The global SSO client must never place JWTs in URLs.')

console.log('Peter Tecnet Ecosystem SDK + global SSO session contract OK')
