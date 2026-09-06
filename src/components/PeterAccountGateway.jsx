/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react'

const SDK_VERSION = '3.0.0'
const TELEMETRY_VERSION = '3.3.1'
const INSIGHTS_VERSION = '1.0.0'
const SDK_URL = `https://petertecnet.com.br/ecosystem/peter-ecosystem-v3.js?v=${SDK_VERSION}`
const TELEMETRY_URL = `https://petertecnet.com.br/ecosystem/peter-telemetry-v3.js?v=${TELEMETRY_VERSION}`
const INSIGHTS_URL = `https://petertecnet.com.br/ecosystem/peter-insights.js?v=${INSIGHTS_VERSION}`
let sdkPromise
let telemetryPromise
let insightsPromise

function loadScript({ selector, src, datasetKey, datasetValue, isReady, errorMessage, attributes = {} }) {
  if (isReady()) return Promise.resolve()
  const existing = document.querySelector(selector)
  if (existing) {
    return new Promise((resolve, reject) => {
      if (isReady()) return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(errorMessage)), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset[datasetKey] = datasetValue
    Object.entries(attributes).forEach(([key, value]) => { script.dataset[key] = value || '' })
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error(errorMessage)), { once: true })
    document.head.appendChild(script)
  })
}

function loadTelemetry(apiBaseUrl, appSlug) {
  if (window.PeterTecnetTelemetry?.version === TELEMETRY_VERSION) {
    window.PeterTecnetTelemetry.start({ apiBaseUrl, appSlug })
    return Promise.resolve()
  }
  if (!telemetryPromise) telemetryPromise = loadScript({
    selector: 'script[data-peter-telemetry-sdk]', src: TELEMETRY_URL, datasetKey: 'peterTelemetrySdk', datasetValue: TELEMETRY_VERSION,
    attributes: { appSlug, apiBase: apiBaseUrl },
    isReady: () => window.PeterTecnetTelemetry?.version === TELEMETRY_VERSION,
    errorMessage: 'Não foi possível carregar a telemetria Peter Tecnet.',
  }).then(() => window.PeterTecnetTelemetry?.start({ apiBaseUrl, appSlug }))
  return telemetryPromise
}

function loadSdk() {
  if (window.PeterTecnetEcosystem?.version === SDK_VERSION && customElements.get('peter-ecosystem-launcher')) return Promise.resolve()
  if (!sdkPromise) sdkPromise = loadScript({
    selector: 'script[data-peter-ecosystem-sdk]', src: SDK_URL, datasetKey: 'peterEcosystemSdk', datasetValue: SDK_VERSION,
    isReady: () => Boolean(customElements.get('peter-ecosystem-launcher')),
    errorMessage: 'Não foi possível carregar o Peter Tecnet Ecosystem SDK.',
  })
  return sdkPromise
}

function loadInsights() {
  if (window.PeterTecnetInsights?.version === INSIGHTS_VERSION && customElements.get('peter-insight-chart')) return Promise.resolve()
  if (!insightsPromise) insightsPromise = loadScript({
    selector: 'script[data-peter-insights-sdk]', src: INSIGHTS_URL, datasetKey: 'peterInsightsSdk', datasetValue: INSIGHTS_VERSION,
    isReady: () => Boolean(customElements.get('peter-insight-chart')),
    errorMessage: 'Não foi possível carregar o Peter Tecnet Insights SDK.',
  })
  return insightsPromise
}

function dockLauncherInNavbar(launcher) {
  const selectors = [
    '[data-peter-ecosystem-slot]',
    '.navbar .container',
    '.navbar .container-fluid',
    '.navbar',
    'header nav',
    "nav[role='navigation']",
    'nav',
  ]
  const findTarget = () => selectors.map(selector => document.querySelector(selector)).find(Boolean) || null
  const applyDockedLayout = () => {
    if (!launcher?.isConnected || !launcher.shadowRoot) return
    const shell = launcher.shadowRoot.querySelector('.launcher')
    const button = launcher.shadowRoot.querySelector('.launcher-button')
    const panel = launcher.shadowRoot.querySelector('.panel')
    if (shell) Object.assign(shell.style, { position: 'relative', right: 'auto', top: 'auto', bottom: 'auto', zIndex: '2147483000', display: 'inline-flex', alignItems: 'center' })
    if (button) Object.assign(button.style, { width: '42px', height: '42px', flex: '0 0 auto', boxShadow: 'none' })
    if (panel) Object.assign(panel.style, { position: 'fixed', right: '12px', left: 'auto', top: 'calc(env(safe-area-inset-top) + 68px)', bottom: 'auto', width: 'min(370px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 92px)' })
  }
  const mount = () => {
    const target = findTarget()
    if (!target) return false
    const toggle = target.querySelector?.('.navbar-toggler')
    if (toggle && toggle.parentElement === target) target.insertBefore(launcher, toggle)
    else if (launcher.parentElement !== target) target.appendChild(launcher)
    launcher.style.display = 'inline-flex'
    launcher.style.alignItems = 'center'
    launcher.style.marginLeft = '8px'
    launcher.style.flex = '0 0 auto'
    launcher.setAttribute('data-peter-navbar-docked', 'true')
    applyDockedLayout()
    return true
  }
  mount()
  const shadowObserver = new MutationObserver(applyDockedLayout)
  if (launcher.shadowRoot) shadowObserver.observe(launcher.shadowRoot, { childList: true, subtree: true })
  const navObserver = new MutationObserver(() => { if (mount()) navObserver.disconnect() })
  if (launcher.getAttribute('data-peter-navbar-docked') !== 'true') navObserver.observe(document.body, { childList: true, subtree: true })
  return () => { shadowObserver.disconnect(); navObserver.disconnect() }
}

export default function PeterAccountGateway({ apiBaseUrl, appSlug, children }) {
  const hostRef = useRef(null)

  useEffect(() => {
    let active = true
    let launcher = null
    let cleanupDock = null
    const host = hostRef.current
    const api = apiBaseUrl || 'https://api.petertecnet.com.br/api'

    loadTelemetry(api, appSlug || '')
      .catch(error => console.error('[Peter Tecnet Telemetry]', error))
      .finally(() => loadSdk().then(() => {
        if (!active || !host) return
        launcher = document.createElement('peter-ecosystem-launcher')
        launcher.setAttribute('api-base', api)
        launcher.setAttribute('app-slug', appSlug || '')
        launcher.setAttribute('sdk-version', SDK_VERSION)
        host.replaceChildren(launcher)
        cleanupDock = dockLauncherInNavbar(launcher)
      }).catch(error => console.error('[Peter Tecnet Ecosystem]', error)))

    loadInsights().catch(error => console.error('[Peter Tecnet Insights]', error))

    return () => {
      active = false
      cleanupDock?.()
      launcher?.remove()
      host?.replaceChildren()
    }
  }, [apiBaseUrl, appSlug])

  return <>{children}<span ref={hostRef} style={{ display: 'contents' }} /></>
}
