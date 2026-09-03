(() => {
  'use strict'

  const VERSION = '2.0.0'
  const DEFAULT_API = 'https://api.petertecnet.com.br/api'
  const TOKEN_KEYS = ['petertecnet_admin_token', 'petertecnet_token', 'token', 'access_token', 'auth_token']
  const DEVICE_KEY = 'peter_identity_device_id'
  const STORAGE_EVENT = 'peter:identity-storage'
  const RESTORE_THROTTLE_MS = 4000

  if (window.PeterTecnetAuthSession?.version === VERSION) return

  const state = {
    api: DEFAULT_API,
    slug: '',
    configured: false,
    initializing: null,
    recovery: null,
    lastRecoveryAt: 0,
    globalReady: false,
    lastToken: null,
  }

  const normalizeApi = value => String(value || DEFAULT_API).replace(/\/+$/, '')
  const normalizeSlug = value => String(value || '').trim().toLowerCase()
  const localSignoutKey = () => `peter_identity_local_signed_out:${state.slug || 'unknown'}`
  const hasLocalSignout = () => state.slug && localStorage.getItem(localSignoutKey()) === '1'
  const markLocalSignout = value => {
    if (!state.slug) return
    if (value) localStorage.setItem(localSignoutKey(), '1')
    else localStorage.removeItem(localSignoutKey())
  }

  const currentToken = () => TOKEN_KEYS.map(key => localStorage.getItem(key)).find(Boolean) || null

  const deviceId = () => {
    let value = localStorage.getItem(DEVICE_KEY)
    if (value) return value
    value = window.crypto?.randomUUID?.() || `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(DEVICE_KEY, value)
    return value
  }

  const deviceName = () => {
    const ua = navigator.userAgent || ''
    const platform = /iPhone|iPad/i.test(ua) ? 'iOS'
      : /Android/i.test(ua) ? 'Android'
        : /Windows/i.test(ua) ? 'Windows'
          : /Macintosh|Mac OS/i.test(ua) ? 'macOS'
            : /Linux/i.test(ua) ? 'Linux' : 'Device'
    const browser = /Edg\//i.test(ua) ? 'Edge'
      : /OPR\//i.test(ua) ? 'Opera'
        : /Firefox\//i.test(ua) ? 'Firefox'
          : /Chrome\//i.test(ua) ? 'Chrome'
            : /Safari\//i.test(ua) ? 'Safari' : 'Browser'
    return `${platform} · ${browser}`
  }

  const headers = extra => ({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Peter-App': state.slug,
    'X-Peter-Application': state.slug,
    'X-Peter-Auth-Session': VERSION,
    'X-Peter-Device': deviceId(),
    'X-Peter-Device-Name': deviceName(),
    ...extra,
  })

  const request = (path, options = {}) => fetch(`${state.api}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...options,
    headers: headers(options.headers || {}),
  })

  const dispatch = source => {
    window.dispatchEvent(new Event('authChanged'))
    window.dispatchEvent(new CustomEvent('peter:auth-changed', { detail: { source } }))
  }

  const persist = data => {
    const token = data?.access_token
    if (!token) return false
    markLocalSignout(false)
    state.lastToken = token
    state.globalReady = true
    localStorage.setItem('token', token)
    if (state.slug === 'payflow') localStorage.setItem('petertecnet_token', token)
    if (state.slug === 'peter-tecnet') localStorage.setItem('petertecnet_admin_token', token)
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
    dispatch('peter-identity')
    return true
  }

  const clearLocal = () => {
    state.lastToken = null
    state.globalReady = false
    TOKEN_KEYS.forEach(key => localStorage.removeItem(key))
    localStorage.removeItem('user')
  }

  const establish = async token => {
    if (!token || !state.slug) return false
    try {
      const response = await request('/account/identity/sso/session', {
        method: 'POST',
        keepalive: true,
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ application: state.slug }),
      })
      if (response.ok) {
        state.globalReady = true
        state.lastToken = token
        markLocalSignout(false)
        return true
      }
      return false
    } catch {
      // A valid local JWT remains usable if the central SSO layer is temporarily unavailable.
      return false
    }
  }

  const exchangeGlobal = async () => {
    if (!state.slug) return false
    try {
      const csrfResponse = await request(`/account/identity/sso/csrf?application=${encodeURIComponent(state.slug)}`)
      if (csrfResponse.status === 204) return false
      const csrfPayload = await csrfResponse.json().catch(() => ({}))
      const csrf = csrfPayload?.data?.csrf_token
      if (!csrfResponse.ok || !csrf) return false

      const response = await request('/account/identity/sso/exchange', {
        method: 'POST',
        headers: { 'X-Peter-CSRF': csrf },
        body: JSON.stringify({ application: state.slug }),
      })
      if (response.status === 204) return false
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.data?.access_token) return false
      return persist(payload.data)
    } catch {
      return false
    }
  }

  const recover = async ({ force = false, ignoreLocalSignout = false } = {}) => {
    if (!state.configured || !state.slug) return false
    if (hasLocalSignout() && !ignoreLocalSignout) return false
    if (state.recovery) return state.recovery

    const now = Date.now()
    if (!force && now - state.lastRecoveryAt < RESTORE_THROTTLE_MS) return Boolean(currentToken())
    state.lastRecoveryAt = now

    state.recovery = (async () => {
      const token = currentToken()
      if (token) {
        const established = await establish(token)
        if (established) return true

        // Do not erase a token merely because Redis/network/SSO is unavailable.
        // Only a confirmed 401 from an authenticated application request should trigger recovery.
        return true
      }
      return exchangeGlobal()
    })().finally(() => {
      state.recovery = null
    })

    return state.recovery
  }

  const renewAfterUnauthorized = async oldToken => {
    if (currentToken() && currentToken() !== oldToken) return true
    clearLocal()
    return recover({ force: true, ignoreLocalSignout: false })
  }

  const authorizedFetch = async (input, init = {}) => {
    const firstToken = currentToken()
    const firstHeaders = new Headers(init.headers || {})
    if (firstToken && !firstHeaders.has('Authorization')) firstHeaders.set('Authorization', `Bearer ${firstToken}`)

    let response = await fetch(input, { ...init, headers: firstHeaders })
    if (response.status !== 401 || init.__peterIdentityRetry) return response

    const recovered = await renewAfterUnauthorized(firstToken)
    if (!recovered || !currentToken()) return response

    const retryHeaders = new Headers(init.headers || {})
    retryHeaders.set('Authorization', `Bearer ${currentToken()}`)
    response = await fetch(input, { ...init, __peterIdentityRetry: true, headers: retryHeaders })
    return response
  }

  const interceptAxios = instance => {
    if (!instance?.interceptors || instance.__peterIdentityIntercepted) return instance
    instance.__peterIdentityIntercepted = true

    instance.interceptors.request.use(config => {
      const token = currentToken()
      if (token && !config.headers?.Authorization) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    instance.interceptors.response.use(
      response => response,
      async error => {
        const config = error?.config
        if (error?.response?.status !== 401 || !config || config.__peterIdentityRetry) throw error
        config.__peterIdentityRetry = true
        const oldToken = currentToken()
        const recovered = await renewAfterUnauthorized(oldToken)
        if (!recovered || !currentToken()) throw error
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${currentToken()}`
        return instance.request(config)
      },
    )

    return instance
  }

  const authenticatedJson = async (path, options = {}) => {
    const token = currentToken()
    if (!token) throw new Error('Não há sessão local autenticada.')
    const response = await request(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || 'Não foi possível concluir a operação de identidade.')
    return payload
  }

  const logoutCurrentApp = async () => {
    markLocalSignout(true)
    const token = currentToken()
    if (token) {
      try {
        await request('/account/identity/logout', {
          method: 'POST',
          keepalive: true,
          headers: { Authorization: `Bearer ${token}` },
          body: '{}',
        })
      } catch {}
    }
    clearLocal()
    dispatch('peter-identity-local-logout')
  }

  const logoutEverywhere = async () => {
    const token = currentToken()
    if (token) {
      try {
        await request('/account/identity/logout-everywhere', {
          method: 'POST',
          keepalive: true,
          headers: { Authorization: `Bearer ${token}` },
          body: '{}',
        })
      } catch {}
    }
    markLocalSignout(false)
    clearLocal()
    dispatch('peter-identity-global-logout')
  }

  const resumeGlobalSession = async () => {
    markLocalSignout(false)
    return recover({ force: true, ignoreLocalSignout: true })
  }

  const configure = ({ apiBaseUrl, appSlug } = {}) => {
    state.api = normalizeApi(apiBaseUrl)
    state.slug = normalizeSlug(appSlug)
    state.configured = Boolean(state.slug)
    if (!state.initializing) {
      state.initializing = recover().finally(() => { state.initializing = null })
    }
    return state.initializing
  }

  const sessions = () => authenticatedJson('/account/identity/sessions')
  const security = () => authenticatedJson('/account/identity/security')
  const revokeSession = id => authenticatedJson(`/account/identity/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  const revokeOtherSessions = () => authenticatedJson('/account/identity/sessions/revoke-others', { method: 'POST', body: '{}' })
  const revokeAllSessions = () => authenticatedJson('/account/identity/sessions', { method: 'DELETE' })

  window.addEventListener('storage', event => {
    if (!event.key || TOKEN_KEYS.includes(event.key)) {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key: event.key } }))
    }
  })

  window.PeterTecnetAuthSession = Object.freeze({
    version: VERSION,
    configure,
    ready: () => state.initializing || Promise.resolve(Boolean(currentToken())),
    recover,
    resumeGlobalSession,
    getAccessToken: currentToken,
    authorizedFetch,
    interceptAxios,
    sessions,
    security,
    revokeSession,
    revokeOtherSessions,
    revokeAllSessions,
    logoutCurrentApp,
    logoutEverywhere,
    // Backward-compatible alias: explicit logout is local by default.
    logout: logoutCurrentApp,
  })

  const current = document.currentScript
  if (current?.dataset?.appSlug) {
    configure({
      apiBaseUrl: current.dataset.apiBase,
      appSlug: current.dataset.appSlug,
    })
  }
})()
