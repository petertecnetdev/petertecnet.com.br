/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'

const ECOSYSTEM_VERSION = '2.0.0'
const IDENTITY_VERSION = '3.0.0'
const INSIGHTS_VERSION = '1.0.0'
const ECOSYSTEM_URL = `https://petertecnet.com.br/ecosystem/peter-ecosystem.js?v=${ECOSYSTEM_VERSION}`
const IDENTITY_URL = `https://petertecnet.com.br/ecosystem/peter-identity.js?v=${IDENTITY_VERSION}`
const INSIGHTS_URL = `https://petertecnet.com.br/ecosystem/peter-insights.js?v=${INSIGHTS_VERSION}`
let ecosystemPromise
let identityPromise
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

function loadIdentity() {
  if (window.PeterIdentity?.version === IDENTITY_VERSION) return Promise.resolve()
  if (!identityPromise) identityPromise = loadScript({
    selector: 'script[data-peter-identity-sdk]', src: IDENTITY_URL, datasetKey: 'peterIdentitySdk', datasetValue: IDENTITY_VERSION,
    isReady: () => window.PeterIdentity?.version === IDENTITY_VERSION,
    errorMessage: 'Não foi possível carregar o Peter Identity SDK.',
  })
  return identityPromise
}

function loadEcosystem() {
  if (window.PeterTecnetEcosystem?.version === ECOSYSTEM_VERSION && customElements.get('peter-ecosystem-launcher')) return Promise.resolve()
  if (!ecosystemPromise) ecosystemPromise = loadScript({
    selector: 'script[data-peter-ecosystem-sdk]', src: ECOSYSTEM_URL, datasetKey: 'peterEcosystemSdk', datasetValue: ECOSYSTEM_VERSION,
    isReady: () => Boolean(customElements.get('peter-ecosystem-launcher')),
    errorMessage: 'Não foi possível carregar o Peter Tecnet Ecosystem SDK.',
  })
  return ecosystemPromise
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
    const base = apiBaseUrl || 'https://api.petertecnet.com.br/api'

    loadIdentity()
      .then(() => window.PeterIdentity?.initialize({ apiBaseUrl: base, appSlug: appSlug || '' }))
      .catch(error => {
        console.error('[Peter Identity]', error)
        return null
      })
      .finally(() => {
        if (active) setIdentityReady(true)
      })

    return () => { active = false }
  }, [apiBaseUrl, appSlug])

  useEffect(() => {
    let active = true
    const host = hostRef.current

    Promise.all([loadEcosystem(), loadInsights()]).then(() => {
      if (!active || !host) return
      const launcher = document.createElement('peter-ecosystem-launcher')
      launcher.setAttribute('api-base', apiBaseUrl || 'https://api.petertecnet.com.br/api')
      launcher.setAttribute('app-slug', appSlug || '')
      launcher.setAttribute('sdk-version', ECOSYSTEM_VERSION)
      host.replaceChildren(launcher)
    }).catch(error => console.error('[Peter Tecnet Ecosystem]', error))

    return () => {
      active = false
      host?.replaceChildren()
    }
  }, [apiBaseUrl, appSlug])

  if (!identityReady) {
    return <div role="status" aria-live="polite" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#07111f', color: '#dbeafe', fontFamily: 'Inter, system-ui, sans-serif' }}>Conectando sua Conta Peter Tecnet…</div>
  }

  return <>{children}<span ref={hostRef} style={{ display: 'contents' }} /></>
}
