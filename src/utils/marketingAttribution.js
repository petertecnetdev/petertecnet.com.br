const STORAGE_KEY = 'petertecnet:marketing:attribution:v1'

const ATTRIBUTION_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
]

function readStoredAttribution(storage = window.sessionStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStoredAttribution(value, storage = window.sessionStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Attribution must never block navigation or conversion.
  }
}

export function captureMarketingAttribution(location = window.location, storage = window.sessionStorage) {
  const stored = readStoredAttribution(storage)
  const params = new URLSearchParams(location.search || '')
  const captured = { ...stored }

  for (const key of ATTRIBUTION_PARAMS) {
    if (captured[key]) continue
    const value = String(params.get(key) || '').trim()
    if (value) captured[key] = value.slice(0, 240)
  }

  if (!captured.landing_path) captured.landing_path = String(location.pathname || '/').slice(0, 500)
  if (!captured.captured_at) captured.captured_at = new Date().toISOString()

  if (Object.keys(captured).some(key => ATTRIBUTION_PARAMS.includes(key))) {
    writeStoredAttribution(captured, storage)
  }

  return captured
}

export function withMarketingAttribution(href, attribution = {}, baseHref = window.location.href) {
  if (!href || !String(href).startsWith('/orcamento')) return href

  const url = new URL(href, baseHref)
  for (const key of ATTRIBUTION_PARAMS) {
    const value = String(attribution?.[key] || '').trim()
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value)
  }

  return `${url.pathname}${url.search}${url.hash}`
}

export function marketingAttributionMetadata(attribution = {}) {
  return ATTRIBUTION_PARAMS.reduce((metadata, key) => {
    const value = String(attribution?.[key] || '').trim()
    if (value) metadata[key] = value
    return metadata
  }, {
    landing_path: attribution?.landing_path || undefined,
  })
}
