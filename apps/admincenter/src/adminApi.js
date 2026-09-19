const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const DEFAULT_TIMEOUT = 18000
const inflightReads = new Map()
const memoryCache = new Map()

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
  const token = localStorage.getItem(TOKEN_KEY)
  const method = String(options.method || 'GET').toUpperCase()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), Number(options.timeout || DEFAULT_TIMEOUT))

  try {
    const response = await fetch(`${API}${path}`, {
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

    if ((response.status === 401 || response.status === 403) && path !== '/auth/login' && path !== '/auth/google') {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }

    if (!response.ok) {
      const error = requestError(response, payload)
      const retryable = method === 'GET' && attempt < 1 && (response.status >= 500 || response.status === 408)
      if (retryable && navigator.onLine) {
        await delay(350 + Math.round(Math.random() * 150))
        return execute(path, options, attempt + 1)
      }
      throw error
    }

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
      return execute(path, options, attempt + 1)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
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
  }

  const promise = execute(path, options).then(payload => {
    if (method === 'GET' && cacheMs > 0) {
      memoryCache.set(requestKey, { value: payload, expiresAt: Date.now() + cacheMs })
    }
    return payload
  })

  if (method !== 'GET') return promise

  inflightReads.set(requestKey, promise)
  return promise.finally(() => {
    if (inflightReads.get(requestKey) === promise) inflightReads.delete(requestKey)
  })
}
