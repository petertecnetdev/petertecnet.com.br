import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sdkPath = resolve('public/ecosystem/peter-ecosystem.js')
const authPath = resolve('public/ecosystem/peter-auth-session.js')
const insightsPath = resolve('public/ecosystem/peter-insights.js')
const source = readFileSync(sdkPath, 'utf8')
const auth = readFileSync(authPath, 'utf8')
const insights = readFileSync(insightsPath, 'utf8')

execFileSync(process.execPath, ['--check', sdkPath], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', authPath], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', insightsPath], { stdio: 'inherit' })

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

const authMarkers = [
  "const VERSION = '2.0.0'",
  "credentials: 'include'",
  "account/identity/sso/session",
  "account/identity/sso/csrf",
  "account/identity/sso/exchange",
  "account/identity/logout-everywhere",
  "'X-Peter-CSRF'",
  "logoutCurrentApp",
  "logoutEverywhere",
  "authorizedFetch",
  "interceptAxios",
  "resumeGlobalSession",
  "peter_identity_local_signed_out",
]

for (const marker of authMarkers) {
  if (!auth.includes(marker)) throw new Error(`Identity SDK contract marker missing: ${marker}`)
}

const insightMarkers = [
  "const VERSION = '1.0.0'",
  "const ELEMENT = 'peter-insight-chart'",
  "customElements.define(ELEMENT",
  "type === 'line'",
  "type === 'donut'",
  "Intl.NumberFormat('pt-BR'",
  "prefers-reduced-motion",
]

for (const marker of insightMarkers) {
  if (!insights.includes(marker)) throw new Error(`Insights contract marker missing: ${marker}`)
}

if (/APP_LOGOS\s*=/.test(source)) throw new Error('The centralized SDK must not contain a hardcoded application logo registry.')
if (/searchParams\.set\(['\"](?:token|access_token|auth_token)['\"]/.test(source + auth)) throw new Error('JWT-like tokens must never be written to cross-application URLs.')
if (!/searchParams\.set\(['\"]peter_sso['\"]/.test(source)) throw new Error('SSO navigation must use the one-time peter_sso handoff code.')
if (!source.includes("host.endsWith('.petertecnet.com.br')")) throw new Error('Cross-app navigation must remain restricted to Peter Tecnet HTTPS domains.')
if (/document\.cookie/.test(auth)) throw new Error('The Identity SDK must never read HttpOnly session secrets through document.cookie.')

console.log('Peter Tecnet Ecosystem + Identity + Insights SDK contracts OK')
