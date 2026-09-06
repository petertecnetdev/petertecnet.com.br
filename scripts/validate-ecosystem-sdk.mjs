import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sdkPath = resolve('public/ecosystem/peter-ecosystem.js')
const insightsPath = resolve('public/ecosystem/peter-insights.js')
const ecosystemV3Path = resolve('public/ecosystem/peter-ecosystem-v3.js')
const telemetryV3Path = resolve('public/ecosystem/peter-telemetry-v3.js')
const source = readFileSync(sdkPath, 'utf8')
const insights = readFileSync(insightsPath, 'utf8')
const ecosystemV3 = readFileSync(ecosystemV3Path, 'utf8')
const telemetryV3 = readFileSync(telemetryV3Path, 'utf8')

execFileSync(process.execPath, ['--check', sdkPath], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', insightsPath], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', ecosystemV3Path], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', telemetryV3Path], { stdio: 'inherit' })

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
if (/searchParams\.set\(['\"](?:token|access_token|auth_token)['\"]/.test(source)) throw new Error('JWT-like tokens must never be written to cross-application URLs.')
if (!/searchParams\.set\(['\"]peter_sso['\"]/.test(source)) throw new Error('SSO navigation must use the one-time peter_sso handoff code.')
if (!source.includes("host.endsWith('.petertecnet.com.br')")) throw new Error('Cross-app navigation must remain restricted to Peter Tecnet HTTPS domains.')

const telemetryVersion = telemetryV3.match(/const VERSION = '([^']+)'/)?.[1]
const launcherTelemetryVersion = ecosystemV3.match(/const TELEMETRY_VERSION = '([^']+)'/)?.[1]

if (!telemetryVersion) throw new Error('Telemetry SDK version marker is missing.')
if (!launcherTelemetryVersion) throw new Error('Ecosystem v3 telemetry version marker is missing.')
if (telemetryVersion !== launcherTelemetryVersion) {
  throw new Error(`Telemetry version drift: runtime ${telemetryVersion} != launcher ${launcherTelemetryVersion}`)
}
if (!telemetryV3.includes("const SCHEMA = '3'")) throw new Error('Telemetry v3 must continue emitting schema 3.')
if (!telemetryV3.includes('trackAction:')) throw new Error('Telemetry SDK must expose the shared semantic trackAction helper.')
if (!telemetryV3.includes('entityContext(')) throw new Error('Telemetry SDK must preserve generic entity context for API actions.')
if (!telemetryV3.includes("if (action.type === 'logout') flush(true)")) throw new Error('Telemetry SDK must preserve the logout attribution flush.')

console.log('Peter Tecnet Ecosystem + Insights SDK contracts OK')
