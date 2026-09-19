export const ADMIN_API_BASE = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const DEFAULT_TIMEOUT = 18000
const inflightReads = new Map()
const inflightMutations = new Map()
const memoryCache = new Map()
const requestHistory = new Map()
const requestStats = new Map()
const lastStormNotice = new Map()
const STORM_WINDOW_MS = 60000
const STORM_THRESHOLD = 25

function routeKey(path) {
  return String(path || '').split('?')[0]
}

function recordRequestStart(path) {
  const key = routeKey(path)
  const now = Date.now()
  const recent = (requestHistory.get(key) || []).filter(time => now - time < STORM_WINDOW_MS)
  recent.push(now)
  requestHistory.set(key, recent)

  if (recent.length >= STORM_THRESHOLD && now - Number(lastStormNotice.get(key) || 0) > STORM_WINDOW_MS) {
    lastStormNotice.set(key, now)
    window.dispatchEvent(new CustomEvent('admin-api-storm', { detail: { route: key, count: recent.length, windowMs: STORM_WINDOW_MS } }))
  }
  return { key, startedAt: performance.now() }
}

function recordRequestEnd(trace, ok) {
  if (!trace) return
  const duration = Math.max(0, performance.now() - trace.startedAt)
  const current = requestStats.get(trace.key) || { count: 0, failures: 0, totalDuration: 0, maxDuration: 0 }
  const next = {
    count: current.count + 1,
    failures: current.failures + (ok ? 0 : 1),
    totalDuration: current.totalDuration + duration,
    maxDuration: Math.max(current.maxDuration, duration),
  }
  requestStats.set(trace.key, next)
}

export function getAdminApiDiagnostics() {
  return [...requestStats.entries()].map(([route, stats]) => ({
    route,
    count: stats.count,
    failures: stats.failures,
    averageDuration: stats.count ? Math.round(stats.totalDuration / stats.count) : 0,
    maxDuration: Math.round(stats.maxDuration),
    callsLastMinute: (requestHistory.get(route) || []).filter(time => Date.now() - time < STORM_WINDOW_MS).length,
  })).sort((a, b) => b.callsLastMinute - a.callsLastMinute || b.averageDuration - a.averageDuration)
}

function delay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function requestError(response, payload) {
  const validation = Object.values(payload?.errors || {}).flat()?.[0]
  const error = new Error(validation || payload?.error || payload?.message || 'Não foi possível concluir a operação.')
  error.status = response.status
  error.retryAfter = Number(response.headers.get('Retry-After') || payload?.retry_after || 0)
  error.payload = payload
  return error
}

async function execute(path, options, attempt = 0) {
  const trace = attempt === 0 ? recordRequestStart(path) : null
  const token = localStorage.getItem(TOKEN_KEY)
  const method = String(options.method || 'GET').toUpperCase()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), Number(options.timeout || DEFAULT_TIMEOUT))
  let succeeded = false

  try {
    const response = await fetch(`${ADMIN_API_BASE}${path}`, {
      ...options,
      method,
      signal: controller.signal,
      cache: method === 'GET' ? 'no-store' : options.cache,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    const payload = response.status === 204 ? null : await response.json().catch(() => ({}))

    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/google') {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }

    if (!response.ok) {
      const error = requestError(response, payload)
      const retryable = method === 'GET' && attempt < 1 && (response.status >= 500 || response.status === 408)
      if (retryable && navigator.onLine) {
        await delay(350 + Math.round(Math.random() * 150))
        const retried = await execute(path, options, attempt + 1)
        succeeded = true
        return retried
      }
      throw error
    }

    succeeded = true
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('A API demorou para responder.')
      timeoutError.code = 'ADMIN_API_TIMEOUT'
      throw timeoutError
    }

    const retryableNetwork = method === 'GET' && attempt < 1 && navigator.onLine && error instanceof TypeError
    if (retryableNetwork) {
      await delay(350 + Math.round(Math.random() * 150))
      const retried = await execute(path, options, attempt + 1)
      succeeded = true
      return retried
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    if (attempt === 0) recordRequestEnd(trace, succeeded)
  }
}

export function invalidateAdminApi(prefix = '') {
  for (const key of memoryCache.keys()) {
    if (!prefix || key.includes(prefix)) memoryCache.delete(key)
  }
}

export function adminRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const cacheMs = Math.max(0, Number(options.cacheMs || 0))
  const requestKey = `${method}:${path}`

  if (method === 'GET') {
    const cached = memoryCache.get(requestKey)
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
    if (!options.force && inflightReads.has(requestKey)) return inflightReads.get(requestKey)
  } else {
    invalidateAdminApi()
    const mutationKey = `${requestKey}:${String(options.body || '')}`
    if (!options.force && inflightMutations.has(mutationKey)) return inflightMutations.get(mutationKey)
    const mutationPromise = execute(path, options)
    inflightMutations.set(mutationKey, mutationPromise)
    return mutationPromise.finally(() => {
      if (inflightMutations.get(mutationKey) === mutationPromise) inflightMutations.delete(mutationKey)
    })
  }

  const promise = execute(path, options).then(payload => {
    if (method === 'GET' && cacheMs > 0) {
      memoryCache.set(requestKey, { value: payload, expiresAt: Date.now() + cacheMs })
    }
    return payload
  })

  inflightReads.set(requestKey, promise)
  return promise.finally(() => {
    if (inflightReads.get(requestKey) === promise) inflightReads.delete(requestKey)
  })
}
