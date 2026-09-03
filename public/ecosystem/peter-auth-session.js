(() => {
  'use strict'

  const VERSION = '1.0.0'
  const TOKEN_KEYS = ['petertecnet_admin_token', 'petertecnet_token', 'token', 'access_token', 'auth_token']
  const STORAGE_EVENT = 'peter:auth-storage-mutated'
  const DEFAULT_API = 'https://api.petertecnet.com.br/api'
  const RESTORE_THROTTLE_MS = 5000

  if (window.PeterTecnetAuthSession?.version === VERSION) return

  const state = {
    api: DEFAULT_API,
    slug: '',
    configured: false,
    started: false,
    syncing: null,
    queued: false,
    lastToken: null,
    globalReady: false,
    signedOut: false,
    suppressStorageSync: false,
    lastRestoreAt: 0,
  }

  const normalizeApi = value => String(value || DEFAULT_API).replace(/\/+$/, '')
  const normalizeSlug = value => String(value || '').trim().toLowerCase()
  const token = () => TOKEN_KEYS.map(key => localStorage.getItem(key)).find(Boolean) || null
  const hasIncomingHandoff = () => new URL(window.location.href).searchParams.has('peter_sso')

  const dispatchAuthChanged = source => {
    window.dispatchEvent(new Event('authChanged'))
    window.dispatchEvent(new CustomEvent('peter:auth-changed', { detail: { source } }))
  }

  const headers = extra => ({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Peter-App': state.slug,
    'X-Peter-Auth-Session': VERSION,
    ...extra,
  })

  const request = (path, options = {}) => fetch(`${state.api}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...options,
    headers: headers(options.headers || {}),
  })

  const persistToken = data => {
    if (!data?.access_token) return
    state.signedOut = false
    state.lastToken = data.access_token
    state.globalReady = true
    localStorage.setItem('token', data.access_token)
    if (state.slug === 'payflow') localStorage.setItem('petertecnet_token', data.access_token)
    if (state.slug === 'peter-tecnet') localStorage.setItem('petertecnet_admin_token', data.access_token)
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
    dispatchAuthChanged('ecosystem-global-sso')
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

  const establish = async currentToken => request('/account/sso/session', {
    method: 'POST',
    keepalive: true,
    headers: { Authorization: `Bearer ${currentToken}` },
    body: '{}',
  })

  const restore = async (force = false) => {
    if (!state.slug || state.signedOut || hasIncomingHandoff()) return false
    const now = Date.now()
    if (!force && now - state.lastRestoreAt < RESTORE_THROTTLE_MS) return false
    state.lastRestoreAt = now

    try {
      const response = await request('/account/sso/session/exchange', {
        method: 'POST',
        body: JSON.stringify({ application: state.slug }),
      })

      if (response.status === 204 || response.status === 401) return false
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.data?.access_token) return false
      persistToken(payload.data)
      return true
    } catch {
      return false
    }
  }

  const revoke = async () => {
    try {
      await request('/account/sso/session', {
        method: 'DELETE',
        keepalive: true,
        body: null,
      })
    } catch {}
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
          clearLocalSession()
          await restore(true)
        }
      } catch {}
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
    if (state.suppressStorageSync) return
    if (state.queued) return
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

  const start = () => {
    if (state.started) return
    state.started = true
    patchStorage()

    window.addEventListener(STORAGE_EVENT, () => scheduleSync('storage-mutation'))
    window.addEventListener('storage', event => {
      if (!event.key || TOKEN_KEYS.includes(event.key)) scheduleSync('storage')
    })
    window.addEventListener('authChanged', () => scheduleSync('authChanged'))
    window.addEventListener('peter:auth-changed', () => scheduleSync('peter:auth-changed'))
    window.addEventListener('focus', () => scheduleSync('focus'))
    window.addEventListener('pageshow', () => scheduleSync('pageshow'))
  }

  const configure = ({ apiBaseUrl, appSlug } = {}) => {
    state.api = normalizeApi(apiBaseUrl)
    state.slug = normalizeSlug(appSlug)
    state.configured = Boolean(state.slug)
    start()
    scheduleSync('configure')
  }

  const logout = async () => {
    state.signedOut = true
    clearLocalSession()
    await revoke()
    dispatchAuthChanged('ecosystem-global-logout')
  }

  window.PeterTecnetAuthSession = Object.freeze({
    version: VERSION,
    configure,
    sync: () => scheduleSync('manual'),
    logout,
  })

  const current = document.currentScript
  if (current?.dataset?.appSlug) {
    configure({
      apiBaseUrl: current.dataset.apiBase,
      appSlug: current.dataset.appSlug,
    })
  }
})()
