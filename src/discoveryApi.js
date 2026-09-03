const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const SESSION_KEY = 'peter_discovery_session'
const A11Y_SESSION_KEY = 'peter_accessibility_audits'

function token() {
  return localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token') || ''
}

async function request(path, { method = 'GET', body, auth = false, signal, keepalive = false } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    signal,
    keepalive,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (auth && response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('petertecnet_admin_token')
    window.location.assign('/login')
    throw new Error('Sessão expirada.')
  }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Falha na API (${response.status}).`)
    error.status = response.status
    error.validation = data?.errors || null
    throw error
  }
  return data
}

function queryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const value = query.toString()
  return value ? `?${value}` : ''
}

function normalizeRankedSearch(payload) {
  const data = payload?.data || {}
  const groups = data.results || {}
  const hydrate = rows => (rows || []).map(row => ({
    ...row,
    price: row.price ?? row.metadata?.price,
    establishment: row.establishment ?? row.metadata?.establishment,
    application: row.application ?? row.metadata?.slug,
  }))
  const results = {
    applications: hydrate(groups.application || groups.applications),
    content: hydrate(groups.content),
    establishments: hydrate(groups.establishment || groups.establishments),
    items: hydrate(groups.item || groups.items),
  }
  return {
    ...payload,
    data: {
      ...data,
      results,
      totals: Object.fromEntries(Object.entries(results).map(([key, rows]) => [key, rows.length])),
      intent: data.intent || { query: data.query, dominant_entity: Object.entries(results).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || null },
    },
  }
}

export const fetchContentEntries = (params = {}, signal) => request(`/v1/content${queryString(params)}`, { signal })
export const fetchContentEntry = (slug, params = {}, signal) => request(`/v1/content/${encodeURIComponent(slug)}${queryString(params)}`, { signal })
export const fetchDiscoveryCategories = (params = {}, signal) => request(`/v1/discovery/categories${queryString(params)}`, { signal })
export const fetchDiscoveryCategory = (slug, params = {}, signal) => request(`/v1/discovery/categories/${encodeURIComponent(slug)}${queryString(params)}`, { signal })
export const fetchDiscoveryEstablishment = (identifier, params = {}, signal) => request(`/v1/discovery/establishments/${encodeURIComponent(identifier)}${queryString(params)}`, { signal })
export const fetchDiscoveryItem = (identifier, params = {}, signal) => request(`/v1/discovery/items/${encodeURIComponent(identifier)}${queryString(params)}`, { signal })
export const fetchDiscoverySearch = async (params = {}, signal) => normalizeRankedSearch(await request(`/v1/discovery/ranked-search${queryString(params)}`, { signal }))
export const fetchDiscoveryLanding = (params = {}, signal) => request(`/v1/discovery/landing${queryString(params)}`, { signal })
export const fetchDiscoveryLandingCandidates = (params = {}, signal) => request(`/v1/discovery/landing-candidates${queryString(params)}`, { signal })
export const fetchDiscoveryRecommendations = (params = {}, signal) => request(`/v1/discovery/recommendations${queryString(params)}`, { signal })
export const fetchDiscoveryExperiment = (params = {}, signal) => request(`/v1/discovery/experiments/resolve${queryString(params)}`, { signal })
export const sendDiscoveryExperimentEvent = payload => request('/v1/discovery/experiments/events', { method: 'POST', body: payload, keepalive: true })
export const fetchMediaCapabilities = signal => request('/v1/discovery/media/capabilities', { signal })

export const fetchAdminContent = (params = {}, signal) => request(`/admin/content${queryString(params)}`, { auth: true, signal })
export const createAdminContent = payload => request('/admin/content', { method: 'POST', body: payload, auth: true })
export const updateAdminContent = (id, payload) => request(`/admin/content/${id}`, { method: 'PATCH', body: payload, auth: true })
export const publishAdminContent = id => request(`/admin/content/${id}/publish`, { method: 'POST', auth: true })
export const deleteAdminContent = id => request(`/admin/content/${id}`, { method: 'DELETE', auth: true })
export const fetchDiscoveryAnalytics = (params = {}, signal) => request(`/admin/discovery/analytics${queryString(params)}`, { auth: true, signal })
export const fetchWebVitalAnalytics = (params = {}, signal) => request(`/admin/discovery/web-vitals${queryString(params)}`, { auth: true, signal })
export const fetchSeoDiagnostics = (params = {}, signal) => request(`/admin/discovery/seo-diagnostics${queryString(params)}`, { auth: true, signal })
export const fetchDiscoveryGrowth = (params = {}, signal) => request(`/admin/discovery/growth${queryString(params)}`, { auth: true, signal })
export const syncSearchPerformance = payload => request('/admin/discovery/growth/search-performance/sync', { method: 'POST', body: payload, auth: true })
export const importSearchPerformance = payload => request('/admin/discovery/growth/search-performance/import', { method: 'POST', body: payload, auth: true })
export const rebuildDiscoverySearchIndex = () => request('/admin/discovery/growth/search-index/rebuild', { method: 'POST', auth: true })
export const runPublicDiscoveryMonitor = (limit = 80) => request('/admin/discovery/growth/monitor', { method: 'POST', body: { limit }, auth: true })
export const createDiscoveryExperiment = payload => request('/admin/discovery/growth/experiments', { method: 'POST', body: payload, auth: true })
export const updateDiscoveryExperiment = (id, payload) => request(`/admin/discovery/growth/experiments/${id}`, { method: 'PATCH', body: payload, auth: true })

export function getDiscoverySessionId() {
  let value = sessionStorage.getItem(SESSION_KEY)
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    sessionStorage.setItem(SESSION_KEY, value)
  }
  return value
}

function deviceClass() {
  return window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop'
}

function acquisitionSource() {
  const params = new URLSearchParams(window.location.search)
  const campaign = params.get('utm_campaign') || undefined
  const medium = params.get('utm_medium') || undefined
  const term = params.get('utm_term') || undefined
  const content = params.get('utm_content') || undefined
  const explicit = params.get('utm_source')
  if (explicit) return { source: explicit.slice(0, 80), campaign, medium, term, content }

  try {
    const referrer = document.referrer ? new URL(document.referrer) : null
    if (!referrer || referrer.host === window.location.host) return { source: 'direto', campaign, medium, term, content }
    const host = referrer.hostname.toLowerCase()
    if (host.includes('google.')) return { source: 'google', campaign, medium, term, content }
    if (host.includes('bing.')) return { source: 'bing', campaign, medium, term, content }
    if (host.includes('instagram.')) return { source: 'instagram', campaign, medium, term, content }
    if (host.includes('facebook.') || host.includes('fb.')) return { source: 'facebook', campaign, medium, term, content }
    if (host.includes('whatsapp.')) return { source: 'whatsapp', campaign, medium, term, content }
    return { source: 'referral', campaign, medium, term, content }
  } catch {
    return { source: 'direto', campaign, medium, term, content }
  }
}

export function trackDiscoveryEvent(eventType, { entityType, entityId, application, metadata = {} } = {}) {
  const acquisition = acquisitionSource()
  const payload = {
    application,
    session_id: getDiscoverySessionId(),
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : undefined,
    path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    source: acquisition.source,
    referrer: document.referrer || undefined,
    metadata: {
      ...metadata,
      campaign: metadata.campaign || acquisition.campaign,
      medium: metadata.medium || acquisition.medium,
      term: metadata.term || acquisition.term,
      content: metadata.content || acquisition.content,
      device_class: deviceClass(),
    },
  }

  const send = () => request('/v1/discovery/events', { method: 'POST', body: payload, keepalive: true }).catch(() => null)
  if ('requestIdleCallback' in window) window.requestIdleCallback(send, { timeout: 1400 })
  else window.setTimeout(send, 180)
}

export function trackDiscoveryConversion({ entityType = 'conversion', entityId, application, value, goal, leadId, opportunityId, experiment } = {}) {
  trackDiscoveryEvent('conversion', {
    entityType,
    entityId,
    application,
    metadata: {
      goal,
      conversion_value: value,
      lead_id: leadId,
      opportunity_id: opportunityId,
      experiment_id: experiment?.experiment_id,
      variant_key: experiment?.variant_key,
    },
  })
  if (experiment?.experiment_id && experiment?.variant_key) {
    sendDiscoveryExperimentEvent({
      experiment_id: experiment.experiment_id,
      variant_key: experiment.variant_key,
      session_id: getDiscoverySessionId(),
      event_type: 'conversion',
      conversion_value: value,
      metadata: { path: window.location.pathname, goal },
    }).catch(() => null)
  }
}

function metricRating(name, value) {
  const thresholds = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  }
  const [good, poor] = thresholds[name] || [Infinity, Infinity]
  return value <= good ? 'good' : value > poor ? 'poor' : 'needs-improvement'
}

export function reportWebVital(metricName, metricValue, application = 'peter-tecnet') {
  const value = Number(metricValue)
  if (!Number.isFinite(value) || value < 0) return
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const navigation = performance.getEntriesByType?.('navigation')?.[0]
  const payload = {
    application,
    session_id: getDiscoverySessionId(),
    metric_name: metricName,
    metric_value: Number(value.toFixed(metricName === 'CLS' ? 4 : 2)),
    rating: metricRating(metricName, value),
    path: window.location.pathname.slice(0, 500),
    device_class: deviceClass(),
    connection_type: connection?.effectiveType || undefined,
    navigation_type: navigation?.type || undefined,
  }
  request('/v1/discovery/web-vitals', { method: 'POST', body: payload, keepalive: true }).catch(() => null)
}

export function installWebVitals(application = 'peter-tecnet') {
  if (!('PerformanceObserver' in window)) return () => {}
  const observers = []
  let lcp = null
  let cls = 0
  let inp = 0
  let flushed = false

  const observe = (type, handler, options = { type, buffered: true }) => {
    try {
      const observer = new PerformanceObserver(list => handler(list.getEntries()))
      observer.observe(options)
      observers.push(observer)
    } catch { /* unsupported entry type */ }
  }

  observe('largest-contentful-paint', entries => { lcp = entries.at(-1)?.startTime ?? lcp })
  observe('layout-shift', entries => {
    entries.forEach(entry => { if (!entry.hadRecentInput) cls += entry.value || 0 })
  })
  observe('event', entries => {
    entries.forEach(entry => { if ((entry.duration || 0) > inp) inp = entry.duration || 0 })
  }, { type: 'event', buffered: true, durationThreshold: 40 })
  observe('paint', entries => {
    const fcp = entries.find(entry => entry.name === 'first-contentful-paint')
    if (fcp) reportWebVital('FCP', fcp.startTime, application)
  })

  const navigation = performance.getEntriesByType?.('navigation')?.[0]
  if (navigation?.responseStart) reportWebVital('TTFB', navigation.responseStart, application)

  const flush = () => {
    if (flushed) return
    flushed = true
    if (lcp !== null) reportWebVital('LCP', lcp, application)
    reportWebVital('CLS', cls, application)
    if (inp > 0) reportWebVital('INP', inp, application)
  }
  const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
  document.addEventListener('visibilitychange', onVisibility, { passive: true })
  window.addEventListener('pagehide', flush, { passive: true })

  return () => {
    observers.forEach(observer => observer.disconnect())
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', flush)
  }
}

function accessibilityIssueCounts() {
  const counts = {}
  const add = (code, total) => { if (total > 0) counts[code] = total }
  add('missing_alt', [...document.images].filter(image => !image.hasAttribute('alt')).length)
  add('empty_link_name', [...document.querySelectorAll('a[href]')].filter(link => !(link.textContent || '').trim() && !link.getAttribute('aria-label') && !link.querySelector('img[alt]')).length)
  add('empty_button_name', [...document.querySelectorAll('button')].filter(button => !(button.textContent || '').trim() && !button.getAttribute('aria-label') && !button.getAttribute('title')).length)
  add('unlabelled_control', [...document.querySelectorAll('input, select, textarea')].filter(control => {
    if (control.type === 'hidden') return false
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby') || control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return false
    return !control.closest('label')
  }).length)
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id).filter(Boolean)
  add('duplicate_id', ids.length - new Set(ids).size)
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(node => Number(node.tagName.slice(1)))
  add('heading_jump', headings.filter((level, index) => index > 0 && level - headings[index - 1] > 1).length)
  return counts
}

export function installAccessibilityAudit(application = 'peter-tecnet') {
  const path = window.location.pathname.slice(0, 500)
  const key = `${application}:${path}`
  const already = new Set(JSON.parse(sessionStorage.getItem(A11Y_SESSION_KEY) || '[]'))
  if (already.has(key)) return () => {}
  const run = () => {
    const counts = accessibilityIssueCounts()
    const weighted = (counts.missing_alt || 0) * 4 + (counts.unlabelled_control || 0) * 6 + (counts.empty_link_name || 0) * 5 + (counts.empty_button_name || 0) * 5 + (counts.duplicate_id || 0) * 3 + (counts.heading_jump || 0) * 2
    const score = Math.max(0, Math.min(100, 100 - weighted))
    request('/v1/discovery/accessibility', {
      method: 'POST',
      keepalive: true,
      body: {
        application,
        session_id: getDiscoverySessionId(),
        path,
        score,
        device_class: deviceClass(),
        issues: Object.entries(counts).map(([code, count]) => ({ code, count })),
        metadata: { viewport: `${window.innerWidth}x${window.innerHeight}`, reduced_motion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false },
      },
    }).catch(() => null)
    already.add(key)
    sessionStorage.setItem(A11Y_SESSION_KEY, JSON.stringify([...already].slice(-80)))
  }
  const timer = window.setTimeout(() => 'requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 2200 }) : run(), 1200)
  return () => window.clearTimeout(timer)
}

export function optimizedMediaUrl(uuid, { width = 960, format = 'auto', quality = 78 } = {}) {
  if (!uuid) return null
  return `${API}/v1/discovery/media/${encodeURIComponent(uuid)}${queryString({ width, format, quality })}`
}
