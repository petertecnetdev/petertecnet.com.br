/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'

const SDK_VERSION = '2.0.0'
const AUTH_VERSION = '2.0.0'
const INSIGHTS_VERSION = '1.0.0'
const SDK_URL = `https://petertecnet.com.br/ecosystem/peter-ecosystem.js?v=${SDK_VERSION}`
const AUTH_URL = `https://petertecnet.com.br/ecosystem/peter-auth-session.js?v=${AUTH_VERSION}`
const INSIGHTS_URL = `https://petertecnet.com.br/ecosystem/peter-insights.js?v=${INSIGHTS_VERSION}`
let sdkPromise
let authPromise
let insightsPromise

function loadScript({ selector, src, datasetKey, datasetValue, isReady, errorMessage }) {
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
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error(errorMessage)), { once: true })
    document.head.appendChild(script)
  })
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

function loadIdentity(apiBaseUrl, appSlug) {
  const configure = () => window.PeterTecnetAuthSession?.configure({
    apiBaseUrl: apiBaseUrl || 'https://api.petertecnet.com.br/api',
    appSlug: appSlug || '',
  })

  if (window.PeterTecnetAuthSession?.version === AUTH_VERSION) return Promise.resolve(configure())

  if (!authPromise) authPromise = loadScript({
    selector: 'script[data-peter-auth-session]', src: AUTH_URL, datasetKey: 'peterAuthSession', datasetValue: AUTH_VERSION,
    isReady: () => window.PeterTecnetAuthSession?.version === AUTH_VERSION,
    errorMessage: 'Não foi possível carregar o Peter Identity SDK.',
  })

  return authPromise.then(configure)
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

export default function PeterAccountGateway({ apiBaseUrl, appSlug, children }) {
  const hostRef = useRef(null)
  const [identityReady, setIdentityReady] = useState(false)

  useEffect(() => {
    let active = true
    const host = hostRef.current

    loadIdentity(apiBaseUrl, appSlug)
      .catch(error => console.error('[Peter Identity]', error))
      .finally(() => {
        if (active) setIdentityReady(true)
      })

    Promise.all([loadSdk(), loadInsights()]).then(() => {
      if (!active || !host) return
      const launcher = document.createElement('peter-ecosystem-launcher')
      launcher.setAttribute('api-base', apiBaseUrl || 'https://api.petertecnet.com.br/api')
      launcher.setAttribute('app-slug', appSlug || '')
      launcher.setAttribute('sdk-version', SDK_VERSION)
      host.replaceChildren(launcher)
    }).catch(error => console.error('[Peter Tecnet Ecosystem]', error))

    return () => {
      active = false
      host?.replaceChildren()
    }
  }, [apiBaseUrl, appSlug])

  return <>{identityReady ? children : null}<span ref={hostRef} style={{ display: 'contents' }} /></>
}
