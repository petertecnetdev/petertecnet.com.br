(() => {
  'use strict'

  const VERSION = '2.0.0'
  const TOKEN_KEYS = ['petertecnet_admin_token', 'petertecnet_token', 'token', 'access_token', 'auth_token']
  const STORAGE_EVENT = 'peter:auth-storage-mutated'
  const DEFAULT_API = 'https://api.petertecnet.com.br/api'
  const DEVICE_KEY = 'peter_identity_device_id'
  const RESTORE_THROTTLE_MS = 5000
  const nativeFetch = window.fetch.bind(window)

  if (window.PeterTecnetAuthSession?.version === VERSION) return

  const state = {
    api: DEFAULT_API,
    slug: '',
    configured: false,
    started: false,
    syncing: null,
    recovering: null,
    queued: false,
    lastToken: null,
    globalReady: false,
    signedOut: false,
    suppressStorageSync: false,
    lastRestoreAt: 0,
    fetchPatched: false,
    axiosInstances: new WeakSet(),
  }

  const normalizeApi = value => String(value || DEFAULT_API).replace(/\/+$/, '')
  const normalizeSlug = value => String(value || '').trim().toLowerCase()
  const token = () => TOKEN_KEYS.map(key => localStorage.getItem(key)).find(Boolean) || null
  const hasIncomingHandoff = () => new URL(window.location.href).searchParams.has('peter_sso')

  const randomUuid = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID()
    const bytes = new Uint8Array(16)
    window.crypto?.getRandomValues?.(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return [...bytes].map((value, index) => {
      const hex = value.toString(16).padStart(2, '0')
      return [4, 6, 8, 10].includes(index) ? `-${hex}` : hex
    }).join('')
  }

  const deviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = randomUuid()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  }

  const deviceName = () => {
    const platform = navigator.userAgentData?.platform || navigator.platform || 'Dispositivo'
    return `${platform} · ${navigator.userAgentData?.brands?.[0]?.brand || 'Navegador'}`.slice(0, 150)
  }

  const dispatchAuthChanged = source => {
    window.dispatchEvent(new Event('authChanged'))
    window.dispatchEvent(new CustomEvent('peter:auth-changed', { detail: { source } }))
  }

  const baseHeaders = extra => ({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Peter-App': state.slug,
    'X-Peter-Auth-Session': VERSION,
    'X-Peter-Device': deviceId(),
    'X-Peter-Device-Name': deviceName(),
    ...extra,
  })

  const request = (path, options = {}) => nativeFetch(`${state.api}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...options,
    headers: baseHeaders(options.headers || {}),
  })

  const persistToken = data => {
    if (!data?.access_token) return false
    state.signedOut = false
    state.lastToken = data.access_token
    state.globalReady = true
    state.suppressStorageSync = true
    try {
      localStorage.setItem('token', data.access_token)
      if (state.slug === 'payflow') localStorage.setItem('petertecnet_token', data.access_token)
      if (state.slug === 'peter-tecnet') localStorage.setItem('petertecnet_admin_token', data.access_token)
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
    } finally {
      state.suppressStorageSync = false
    }
    dispatchAuthChanged('peter-identity')
    return true
  }

  const clearLocalSession = () => {
    state.suppressStorageSync = true
    state.lastToken = null
    state.globalReady = false
    try {
      TOKEN_KEYS.forEach(key => localStorage.removeItem(key))
      localStorage.removeItem('user')
    } finally {
      state.suppressStorageSync = false
    }
  }

  const establish = async currentToken => request('/identity/v1/session', {
    method: 'POST',
    keepalive: true,
    headers: { Authorization: `Bearer ${currentToken}` },
    body: '{}',
  })

  const csrf = async () => {
    const response = await request(`/identity/v1/session/csrf?application=${encodeURIComponent(state.slug)}`, {
      method: 'GET',
    })
    if (response.status === 204) return null
    const payload = await response.json().catch(() => ({}))
    return response.ok ? payload?.data?.csrf_token || null : null
  }

  const performRestore = async (force = false) => {
    if (!state.slug || state.signedOut || hasIncomingHandoff()) return false
    const now = Date.now()
    if (!force && now - state.lastRestoreAt < RESTORE_THROTTLE_MS) return false
    state.lastRestoreAt = now

    try {
      const csrfToken = await csrf()
      if (!csrfToken) return false

      const response = await request('/identity/v1/session/exchange', {
        method: 'POST',
        headers: { 'X-Peter-CSRF': csrfToken },
        body: JSON.stringify({ application: state.slug }),
      })

      if (response.status === 204 || response.status === 401) return false
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.data?.access_token) return false
      return persistToken(payload.data)
    } catch {
      // Existing local JWT remains untouched when the Identity service is unreachable.
      return false
    }
  }

  const restore = (force = false) => {
    if (state.recovering) return state.recovering
    state.recovering = performRestore(force).finally(() => {
      state.recovering = null
    })
    return state.recovering
  }

  const revokeAmbientSession = async () => {
    try {
      const csrfToken = await csrf()
      await request('/identity/v1/session', {
        method: 'DELETE',
        keepalive: true,
        headers: csrfToken ? { 'X-Peter-CSRF': csrfToken } : {},
        body: JSON.stringify({ application: state.slug }),
      })
    } catch {}
  }

  const authRequest = async (path, options = {}, retry = true) => {
    const currentToken = token()
    const response = await request(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
    })

    if (response.status !== 401 || !retry) return response
    const restored = await restore(true)
    if (!restored) return response

    const renewed = token()
    return request(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(renewed ? { Authorization: `Bearer ${renewed}` } : {}),
        'X-Peter-Sso-Retry': '1',
      },
    })
  }

  const performSync = async (reason = 'sync') => {
    if (!state.configured || !state.slug) return

    const currentToken = token()
    if (currentToken) {
      state.signedOut = false
      if (currentToken === state.lastToken && state.globalReady) return
      state.lastToken = currentToken
      state.globalReady = false

      try {
        const response = await establish(currentToken)
        if (response.ok) {
          state.globalReady = true
          return
        }
        if (response.status === 401) {
          const restored = await restore(true)
          if (!restored) clearLocalSession()
        }
      } catch {
        // Do not destroy a potentially valid local session because central SSO is unavailable.
      }
      return
    }

    state.lastToken = null
    state.globalReady = false
    if (state.signedOut) return

    await restore(
      reason === 'focus'
      || reason === 'pageshow'
      || reason === 'storage'
      || reason === 'storage-mutation'
      || reason === 'authChanged'
      || reason === 'peter:auth-changed'
    )
  }

  const scheduleSync = reason => {
    if (state.suppressStorageSync || state.queued) return
    state.queued = true
    queueMicrotask(() => {
      state.queued = false
      if (state.syncing) {
        state.syncing.finally(() => scheduleSync(reason))
        return
      }
      state.syncing = performSync(reason).finally(() => {
        state.syncing = null
      })
    })
  }

  const patchStorage = () => {
    if (window.__peterTecnetAuthStoragePatched) return
    window.__peterTecnetAuthStoragePatched = true

    const originalSetItem = Storage.prototype.setItem
    const originalRemoveItem = Storage.prototype.removeItem
    const originalClear = Storage.prototype.clear

    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value)
      if (this === window.localStorage && TOKEN_KEYS.includes(String(key))) {
        window.dispatchEvent(new CustomEvent(STORAGE_EVENT, {
          detail: { operation: 'set', key: String(key) },
        }))
      }
    }

    Storage.prototype.removeItem = function (key) {
      originalRemoveItem.call(this, key)
      if (this === window.localStorage && TOKEN_KEYS.includes(String(key))) {
        window.dispatchEvent(new CustomEvent(STORAGE_EVENT, {
          detail: { operation: 'remove', key: String(key) },
        }))
      }
    }

    Storage.prototype.clear = function () {
      const hadToken = this === window.localStorage && Boolean(token())
      originalClear.call(this)
      if (hadToken) {
        window.dispatchEvent(new CustomEvent(STORAGE_EVENT, {
          detail: { operation: 'clear', key: null },
        }))
      }
    }
  }

  const urlIsApi = input => {
    try {
      const raw = input instanceof Request ? input.url : String(input)
      return new URL(raw, window.location.href).href.startsWith(`${state.api}/`)
    } catch {
      return false
    }
  }

  const getAuthorization = (input, init = {}) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value))
    return headers.get('Authorization') || ''
  }

  const retryFetchWithToken = async (input, init = {}) => {
    const renewed = token()
    if (!renewed) return null
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value))
    headers.set('Authorization', `Bearer ${renewed}`)
    headers.set('X-Peter-App', state.slug)
    headers.set('X-Peter-Device', deviceId())
    headers.set('X-Peter-Sso-Retry', '1')
    return nativeFetch(input, { ...init, headers })
  }

  const patchFetch = () => {
    if (state.fetchPatched || window.__peterIdentityFetchPatched) return
    state.fetchPatched = true
    window.__peterIdentityFetchPatched = true

    window.fetch = async (input, init = {}) => {
      const response = await nativeFetch(input, init)
      if (!state.configured || response.status !== 401 || !urlIsApi(input)) return response
      if (!/^Bearer\s+/i.test(getAuthorization(input, init))) return response
      if (new Headers(init.headers || {}).get('X-Peter-Sso-Retry') === '1') return response

      const restored = await restore(true)
      if (!restored) return response
      return (await retryFetchWithToken(input, init)) || response
    }
  }

  const interceptAxios = axios => {
    if (!axios?.interceptors?.request || !axios?.interceptors?.response || state.axiosInstances.has(axios)) return axios
    state.axiosInstances.add(axios)

    axios.interceptors.request.use(config => {
      const requestUrl = String(config?.url || '')
      const baseUrl = String(config?.baseURL || '')
      const targetsIdentityApi = requestUrl.startsWith(state.api) || baseUrl.startsWith(state.api)
      if (!targetsIdentityApi && baseUrl && !state.api.startsWith(baseUrl.replace(/\/+$/, ''))) return config

      const currentToken = token()
      config.headers = config.headers || {}
      if (currentToken && !config.headers.Authorization) config.headers.Authorization = `Bearer ${currentToken}`
      config.headers['X-Peter-App'] = state.slug
      config.headers['X-Peter-Device'] = deviceId()
      return config
    })

    axios.interceptors.response.use(
      response => response,
      async error => {
        const config = error?.config
        if (error?.response?.status !== 401 || !config || config.__peterSsoRetry) throw error
        if (!/^Bearer\s+/i.test(String(config.headers?.Authorization || ''))) throw error

        config.__peterSsoRetry = true
        const restored = await restore(true)
        if (!restored) throw error
        const renewed = token()
        if (!renewed) throw error
        config.headers.Authorization = `Bearer ${renewed}`
        config.headers['X-Peter-Sso-Retry'] = '1'
        return axios.request(config)
      }
    )

    return axios
  }

  const start = () => {
    if (state.started) return
    state.started = true
    patchStorage()
    patchFetch()

    window.addEventListener(STORAGE_EVENT, () => scheduleSync('storage-mutation'))
    window.addEventListener('storage', event => {
      if (!event.key || TOKEN_KEYS.includes(event.key)) scheduleSync('storage')
    })
    window.addEventListener('authChanged', () => scheduleSync('authChanged'))
    window.addEventListener('peter:auth-changed', () => scheduleSync('peter:auth-changed'))
    window.addEventListener('focus', () => scheduleSync('focus'))
    window.addEventListener('pageshow', () => scheduleSync('pageshow'))
  }

  const configure = ({ apiBaseUrl, appSlug, axios } = {}) => {
    state.api = normalizeApi(apiBaseUrl)
    state.slug = normalizeSlug(appSlug)
    state.configured = Boolean(state.slug)
    start()
    if (axios) interceptAxios(axios)
    if (window.axios) interceptAxios(window.axios)
    scheduleSync('configure')
    return window.PeterTecnetAuthSession
  }

  const logout = async ({ scope = 'global' } = {}) => {
    const normalizedScope = scope === 'current-app' ? 'current-app' : 'global'
    state.signedOut = true

    let currentToken = token()
    if (!currentToken && normalizedScope === 'global') {
      state.signedOut = false
      await restore(true)
      state.signedOut = true
      currentToken = token()
    }

    try {
      if (currentToken) {
        const response = await request('/identity/v1/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
          body: JSON.stringify({ scope: normalizedScope }),
        })
        if (!response.ok && normalizedScope === 'global') await revokeAmbientSession()
      } else if (normalizedScope === 'global') {
        await revokeAmbientSession()
      }
    } catch {
      if (normalizedScope === 'global') await revokeAmbientSession()
    } finally {
      clearLocalSession()
      dispatchAuthChanged(normalizedScope === 'global' ? 'peter-identity-global-logout' : 'peter-identity-app-logout')
    }
  }

  const sessions = async () => {
    const response = await authRequest('/identity/v1/sessions', { method: 'GET' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || 'Não foi possível carregar as sessões.')
    return payload?.data || { sessions: [] }
  }

  const revokeSession = async sessionId => {
    const response = await authRequest(`/identity/v1/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
    if (!response.ok && response.status !== 204) throw new Error('Não foi possível encerrar a sessão.')
    return true
  }

  const revokeOtherSessions = async () => {
    const response = await authRequest('/identity/v1/sessions', { method: 'DELETE' })
    const payload = response.status === 204 ? {} : await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || 'Não foi possível encerrar as outras sessões.')
    return payload?.data || {}
  }

  const authEvents = async (limit = 50) => {
    const response = await authRequest(`/identity/v1/events?limit=${Math.max(1, Math.min(Number(limit) || 50, 200))}`, { method: 'GET' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || 'Não foi possível carregar o histórico de autenticação.')
    return payload?.data?.events || []
  }

  const authorizedFetch = async (input, init = {}) => {
    const currentToken = token()
    const headers = new Headers(init.headers || {})
    if (currentToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${currentToken}`)
    headers.set('X-Peter-App', state.slug)
    headers.set('X-Peter-Device', deviceId())

    const response = await nativeFetch(input, { ...init, headers })
    if (response.status !== 401 || headers.get('X-Peter-Sso-Retry') === '1') return response
    const restored = await restore(true)
    if (!restored) return response
    headers.set('Authorization', `Bearer ${token()}`)
    headers.set('X-Peter-Sso-Retry', '1')
    return nativeFetch(input, { ...init, headers })
  }

  window.PeterTecnetAuthSession = Object.freeze({
    version: VERSION,
    configure,
    sync: () => scheduleSync('manual'),
    recover: () => restore(true),
    getAccessToken: token,
    getDeviceId: deviceId,
    authorizedFetch,
    interceptAxios,
    sessions,
    revokeSession,
    revokeOtherSessions,
    authEvents,
    logout,
    logoutCurrentApp: () => logout({ scope: 'current-app' }),
    logoutEverywhere: () => logout({ scope: 'global' }),
  })

  const current = document.currentScript
  if (current?.dataset?.appSlug) {
    configure({
      apiBaseUrl: current.dataset.apiBase,
      appSlug: current.dataset.appSlug,
    })
  }
})()
