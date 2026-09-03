(() => {
  'use strict'

  const VERSION = '3.0.0'
  const PROTOCOL = '3.0'
  const TOKEN_KEYS = ['petertecnet_admin_token', 'petertecnet_token', 'token', 'access_token', 'auth_token']
  const DEVICE_KEY = 'peter.identity.device.v3'
  const DEVICE_NAME_KEY = 'peter.identity.device-name.v3'
  const CIRCUIT_KEY = 'peter.identity.circuit.v3'
  const OPT_OUT_PREFIX = 'peter.identity.optout.v3:'
  const DEFAULT_API = 'https://api.petertecnet.com.br/api'
  const FAILURE_THRESHOLD = 3
  const COOLDOWN_MS = 60_000

  if (window.PeterIdentity?.version === VERSION) return

  const state = {
    apiBaseUrl: DEFAULT_API,
    appSlug: '',
    axios: null,
    initialized: false,
    initializePromise: null,
    recoverPromise: null,
    lastRecoverAt: 0,
    storagePatched: false,
    fetchPatched: false,
    internalStorageWrite: false,
    protocol: null,
  }

  const nativeFetch = window.fetch.bind(window)
  const normalizeBase = value => String(value || DEFAULT_API).replace(/\/+$/, '')
  const normalizeSlug = value => String(value || '').trim().toLowerCase()

  const uid = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  }

  const getDeviceId = () => {
    let value = localStorage.getItem(DEVICE_KEY)
    if (!value) {
      value = uid()
      try { localStorage.setItem(DEVICE_KEY, value) } catch {}
    }
    return value
  }

  const getDeviceName = () => {
    const saved = localStorage.getItem(DEVICE_NAME_KEY)
    if (saved) return saved
    const platform = navigator.userAgentData?.platform || navigator.platform || 'Dispositivo'
    return `${platform} · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Navegador'}`.slice(0, 180)
  }

  const tokenEntries = () => TOKEN_KEYS.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => Boolean(value))
  const getAccessToken = () => tokenEntries()[0]?.[1] || null

  const dispatchState = reason => {
    try {
      window.dispatchEvent(new CustomEvent('peter-identity-state', {
        detail: { reason, authenticated: Boolean(getAccessToken()), appSlug: state.appSlug, version: VERSION },
      }))
    } catch {}
  }

  const persistAccessToken = token => {
    if (!token) return clearAccessToken()
    state.internalStorageWrite = true
    try {
      const existing = tokenEntries().map(([key]) => key)
      const keys = existing.length ? existing : ['token', 'access_token']
      keys.forEach(key => localStorage.setItem(key, token))
    } finally {
      state.internalStorageWrite = false
    }
    dispatchState('token-updated')
  }

  const clearAccessToken = () => {
    state.internalStorageWrite = true
    try { TOKEN_KEYS.forEach(key => localStorage.removeItem(key)) } finally { state.internalStorageWrite = false }
    dispatchState('token-cleared')
  }

  const optOutKey = () => `${OPT_OUT_PREFIX}${state.appSlug || location.hostname}`
  const isOptedOut = () => localStorage.getItem(optOutKey()) === '1'
  const pauseSsoForCurrentApp = () => { try { localStorage.setItem(optOutKey(), '1') } catch {} }
  const resumeSso = () => { try { localStorage.removeItem(optOutKey()) } catch {} }

  const headers = (extra = {}, token = getAccessToken()) => {
    const out = new Headers(extra || {})
    out.set('Accept', 'application/json')
    out.set('X-Peter-Identity-SDK', VERSION)
    out.set('X-Peter-Device', getDeviceId())
    out.set('X-Peter-Device-Name', getDeviceName())
    if (state.appSlug) out.set('X-Peter-App', state.appSlug)
    if (token && !out.has('Authorization')) out.set('Authorization', `Bearer ${token}`)
    return out
  }

  const isApiUrl = value => {
    try {
      const url = new URL(value, location.href)
      return url.href.startsWith(`${state.apiBaseUrl}/`) || url.href === state.apiBaseUrl
    } catch { return false }
  }

  const readJson = async response => {
    try { return await response.clone().json() } catch { return null }
  }

  const requestInternal = async (path, options = {}) => {
    const url = /^https?:\/\//i.test(path) ? path : `${state.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const init = { ...options, credentials: options.credentials || 'include' }
    init.headers = headers(options.headers, options.token === null ? null : (options.token || getAccessToken()))
    if (options.json !== undefined) {
      init.body = JSON.stringify(options.json)
      init.headers.set('Content-Type', 'application/json')
    }
    delete init.json
    delete init.token
    return nativeFetch(url, init)
  }

  const getCircuit = () => {
    try { return JSON.parse(sessionStorage.getItem(CIRCUIT_KEY) || '{}') || {} } catch { return {} }
  }

  const setCircuit = value => {
    try { sessionStorage.setItem(CIRCUIT_KEY, JSON.stringify(value)) } catch {}
  }

  const circuitOpen = () => Number(getCircuit().openUntil || 0) > Date.now()
  const circuitSuccess = () => setCircuit({ failures: 0, openUntil: 0 })
  const circuitFailure = () => {
    const current = getCircuit()
    const failures = Number(current.failures || 0) + 1
    setCircuit({ failures, openUntil: failures >= FAILURE_THRESHOLD ? Date.now() + COOLDOWN_MS : 0 })
  }

  const classifyFailure = response => !response || response.status >= 500

  const protocol = async () => {
    try {
      const response = await requestInternal('/account/identity/protocol', { method: 'GET', token: null, credentials: 'omit' })
      if (!response.ok) return null
      state.protocol = (await response.json())?.data || null
      return state.protocol
    } catch { return null }
  }

  const establish = async () => {
    const token = getAccessToken()
    if (!token || !state.appSlug || circuitOpen()) return null

    try {
      const response = await requestInternal('/account/identity/sso/session', {
        method: 'POST',
        json: { application: state.appSlug },
      })
      if (response.ok) {
        circuitSuccess()
        return (await response.json())?.data || true
      }
      if (classifyFailure(response)) circuitFailure()
      return null
    } catch {
      circuitFailure()
      return null
    }
  }

  const csrf = async () => {
    const response = await requestInternal(`/account/identity/sso/csrf?application=${encodeURIComponent(state.appSlug)}`, {
      method: 'GET', token: null,
    })
    if (!response.ok) return { response, token: null }
    return { response, token: (await response.json())?.data?.csrf_token || null }
  }

  const recover = async ({ force = false } = {}) => {
    if (!state.appSlug || isOptedOut()) return getAccessToken()
    if (!force && Date.now() - state.lastRecoverAt < 5000) return getAccessToken()
    if (circuitOpen()) return getAccessToken()
    if (state.recoverPromise) return state.recoverPromise

    state.recoverPromise = (async () => {
      state.lastRecoverAt = Date.now()
      try {
        const csrfResult = await csrf()
        if (!csrfResult.token) {
          if (classifyFailure(csrfResult.response)) circuitFailure()
          return getAccessToken()
        }

        const response = await requestInternal('/account/identity/sso/exchange', {
          method: 'POST', token: null,
          headers: { 'X-Peter-CSRF': csrfResult.token },
          json: { application: state.appSlug },
        })
        const payload = await readJson(response)
        if (response.ok && payload?.data?.access_token) {
          persistAccessToken(payload.data.access_token)
          resumeSso()
          circuitSuccess()
          return payload.data.access_token
        }
        if (classifyFailure(response)) circuitFailure()
        return getAccessToken()
      } catch {
        circuitFailure()
        return getAccessToken()
      } finally {
        state.recoverPromise = null
      }
    })()

    return state.recoverPromise
  }

  const configure = ({ apiBaseUrl, appSlug, axios } = {}) => {
    if (apiBaseUrl) state.apiBaseUrl = normalizeBase(apiBaseUrl)
    if (appSlug !== undefined) state.appSlug = normalizeSlug(appSlug)
    if (axios) {
      state.axios = axios
      interceptAxios(axios)
    }
    patchStorage()
    patchFetch()
    return PeterIdentity
  }

  const initialize = async options => {
    if (options) configure(options)
    if (state.initializePromise) return state.initializePromise

    state.initializePromise = (async () => {
      patchStorage()
      patchFetch()
      if (state.axios) interceptAxios(state.axios)
      await protocol()

      const localToken = getAccessToken()
      if (localToken) {
        await establish()
        await recover({ force: true })
      } else if (!isOptedOut()) {
        await recover()
      }

      state.initialized = true
      dispatchState('initialized')
      return { authenticated: Boolean(getAccessToken()), token: getAccessToken(), protocol: state.protocol }
    })().finally(() => { state.initializePromise = null })

    return state.initializePromise
  }

  const sync = async () => {
    if (!getAccessToken()) return recover()
    const established = await establish()
    return established ? recover({ force: true }) : getAccessToken()
  }

  const patchStorage = () => {
    if (state.storagePatched) return
    state.storagePatched = true
    const originalSet = Storage.prototype.setItem
    const originalRemove = Storage.prototype.removeItem

    Storage.prototype.setItem = function (key, value) {
      originalSet.call(this, key, value)
      if (this === localStorage && TOKEN_KEYS.includes(String(key)) && value && !state.internalStorageWrite) {
        resumeSso()
        queueMicrotask(() => { establish().then(result => result && recover({ force: true })).catch(() => {}) })
      }
    }

    Storage.prototype.removeItem = function (key) {
      originalRemove.call(this, key)
      if (this === localStorage && TOKEN_KEYS.includes(String(key)) && !state.internalStorageWrite) {
        dispatchState('token-removed-by-app')
      }
    }
  }

  const retryWithToken = (request, token, extra = {}) => {
    const retryHeaders = new Headers(request.headers)
    if (token) retryHeaders.set('Authorization', `Bearer ${token}`)
    retryHeaders.set('X-Peter-Identity-Retry', '1')
    Object.entries(extra).forEach(([key, value]) => retryHeaders.set(key, value))
    return new Request(request, { headers: retryHeaders })
  }

  const patchFetch = () => {
    if (state.fetchPatched) return
    state.fetchPatched = true

    window.fetch = async (input, init) => {
      let request
      try { request = new Request(input, init) } catch { return nativeFetch(input, init) }
      if (!isApiUrl(request.url)) return nativeFetch(request)

      const preparedHeaders = headers(request.headers)
      const prepared = new Request(request, {
        headers: preparedHeaders,
        credentials: request.credentials === 'same-origin' ? 'include' : request.credentials,
      })
      let response = await nativeFetch(prepared.clone())

      if (response.status === 401 && prepared.headers.get('X-Peter-Identity-Retry') !== '1') {
        const payload = await readJson(response)
        const token = await recover({ force: true })
        if (token) {
          response = await nativeFetch(retryWithToken(prepared, token).clone())
          if (response.status === 401) {
            const retryPayload = await readJson(response)
            if (['TOKEN_REVOKED', 'SESSION_REVOKED', 'LEGACY_TOKEN_RETIRED', 'IDENTITY_REAUTH_REQUIRED'].includes(retryPayload?.code)) clearAccessToken()
          }
        } else if (['TOKEN_REVOKED', 'SESSION_REVOKED', 'LEGACY_TOKEN_RETIRED', 'IDENTITY_REAUTH_REQUIRED'].includes(payload?.code)) {
          clearAccessToken()
        }
      }

      if (response.status === 428 && prepared.headers.get('X-Peter-Step-Up-Retry') !== '1') {
        const payload = await readJson(response)
        if (payload?.code === 'STEP_UP_REQUIRED' && payload?.step_up_action) {
          const grant = await requestStepUp(payload.step_up_action)
          if (grant) {
            response = await nativeFetch(retryWithToken(prepared, getAccessToken(), {
              'X-Peter-Step-Up': grant,
              'X-Peter-Step-Up-Retry': '1',
            }).clone())
          }
        }
      }

      return response
    }
  }

  const apiJson = async (path, options = {}) => {
    const requestHeaders = headers(options.headers)
    if (options.json !== undefined) requestHeaders.set('Content-Type', 'application/json')
    const response = await window.fetch(`${state.apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: requestHeaders,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    })
    const payload = await readJson(response)
    if (!response.ok) {
      const error = new Error(payload?.message || `Peter Identity request failed (${response.status})`)
      error.code = payload?.code
      error.status = response.status
      error.payload = payload
      throw error
    }
    return payload?.data ?? payload
  }

  const b64url = buffer => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach(byte => { binary += String.fromCharCode(byte) })
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  const fromB64url = value => {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
    const binary = atob(padded)
    return Uint8Array.from(binary, char => char.charCodeAt(0))
  }

  const passkeyStepUp = async action => {
    if (!navigator.credentials?.get) return null
    const response = await requestInternal('/account/identity/passkeys/options', {
      method: 'POST', token: null, json: { application: state.appSlug },
    })
    if (!response.ok) return null
    const payload = await response.json()
    const publicKey = payload?.publicKey
    if (!publicKey?.challenge) return null
    const challengeToken = publicKey.challenge
    const credential = await navigator.credentials.get({
      publicKey: {
        ...publicKey,
        challenge: fromB64url(publicKey.challenge),
        allowCredentials: (publicKey.allowCredentials || []).map(item => ({ ...item, id: fromB64url(item.id) })),
      },
    })
    if (!credential) return null

    const grantResponse = await requestInternal('/account/identity/step-up/passkey', {
      method: 'POST',
      json: {
        action,
        challenge: challengeToken,
        credential_id: b64url(credential.rawId),
        client_data_json: b64url(credential.response.clientDataJSON),
        authenticator_data: b64url(credential.response.authenticatorData),
        signature: b64url(credential.response.signature),
      },
    })
    if (!grantResponse.ok) return null
    return (await grantResponse.json())?.data?.token || null
  }

  const modalStepUp = (action, methods) => new Promise(resolve => {
    document.getElementById('peter-identity-step-up')?.remove()
    const canTotp = Boolean(methods.totp)
    const canPassword = Boolean(methods.password)
    const selected = canTotp ? 'totp' : 'password'
    const root = document.createElement('div')
    root.id = 'peter-identity-step-up'
    root.innerHTML = `
      <div class="pi-backdrop" role="presentation"></div>
      <section class="pi-dialog" role="dialog" aria-modal="true" aria-labelledby="pi-title">
        <button class="pi-close" type="button" aria-label="Fechar">×</button>
        <p class="pi-kicker">PETER IDENTITY</p>
        <h2 id="pi-title">Confirme sua identidade</h2>
        <p class="pi-copy">Esta ação é sensível e precisa de uma confirmação adicional.</p>
        <div class="pi-methods">
          ${canTotp ? '<button type="button" data-method="totp">Código 2FA</button>' : ''}
          ${canPassword ? '<button type="button" data-method="password">Senha</button>' : ''}
        </div>
        <label class="pi-field"><span>${selected === 'totp' ? 'Código de verificação' : 'Senha atual'}</span><input autocomplete="${selected === 'totp' ? 'one-time-code' : 'current-password'}" type="${selected === 'totp' ? 'text' : 'password'}" inputmode="${selected === 'totp' ? 'numeric' : 'text'}"></label>
        <div class="pi-error" role="alert"></div>
        <button class="pi-confirm" type="button">Confirmar</button>
      </section>`
    const style = document.createElement('style')
    style.textContent = `#peter-identity-step-up{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif;color:#eef5ff}.pi-backdrop{position:absolute;inset:0;background:rgba(3,9,18,.72);backdrop-filter:blur(8px)}.pi-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,440px);background:#0b1728;border:1px solid rgba(118,168,238,.24);border-radius:22px;padding:26px;box-shadow:0 30px 100px rgba(0,0,0,.48)}.pi-kicker{margin:0 0 8px;color:#6ea8ff;font-size:12px;font-weight:800;letter-spacing:.14em}.pi-dialog h2{margin:0 0 8px;font-size:24px}.pi-copy{margin:0 0 18px;color:#9eb1c8;line-height:1.5}.pi-close{position:absolute;right:16px;top:12px;border:0;background:transparent;color:#b9c9dc;font-size:28px;cursor:pointer}.pi-methods{display:flex;gap:8px;margin-bottom:14px}.pi-methods button{border:1px solid #294565;background:#10243d;color:#dbeaff;padding:9px 12px;border-radius:10px;cursor:pointer}.pi-methods button.active{border-color:#66a1ff;background:#17345a}.pi-field{display:grid;gap:7px;color:#a9bbce;font-size:13px}.pi-field input{width:100%;box-sizing:border-box;border:1px solid #2b4768;background:#07111f;color:#fff;padding:13px 14px;border-radius:11px;font-size:16px;outline:none}.pi-field input:focus{border-color:#67a3ff}.pi-confirm{width:100%;margin-top:16px;border:0;background:#3e82e8;color:#fff;padding:13px 16px;border-radius:12px;font-weight:800;cursor:pointer}.pi-error{min-height:20px;margin-top:8px;color:#ff9aaa;font-size:13px}`
    root.appendChild(style)
    document.body.appendChild(root)

    let method = selected
    const input = root.querySelector('input')
    const error = root.querySelector('.pi-error')
    const label = root.querySelector('.pi-field span')
    const cleanup = value => { root.remove(); resolve(value) }
    const select = next => {
      method = next
      root.querySelectorAll('[data-method]').forEach(button => button.classList.toggle('active', button.dataset.method === method))
      input.value = ''
      input.type = method === 'password' ? 'password' : 'text'
      input.inputMode = method === 'totp' ? 'numeric' : 'text'
      input.autocomplete = method === 'totp' ? 'one-time-code' : 'current-password'
      label.textContent = method === 'totp' ? 'Código de verificação' : 'Senha atual'
      input.focus()
    }
    root.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', () => select(button.dataset.method)))
    root.querySelector('.pi-close').addEventListener('click', () => cleanup(null))
    root.querySelector('.pi-backdrop').addEventListener('click', () => cleanup(null))
    root.querySelector('.pi-confirm').addEventListener('click', async () => {
      const value = input.value.trim()
      if (!value) return input.focus()
      error.textContent = ''
      try {
        const path = method === 'totp' ? '/account/identity/step-up/totp' : '/account/identity/step-up/password'
        const body = method === 'totp' ? { action, code: value } : { action, current_password: value }
        const response = await requestInternal(path, { method: 'POST', json: body })
        const payload = await readJson(response)
        if (!response.ok || !payload?.data?.token) throw new Error(payload?.message || 'Não foi possível confirmar sua identidade.')
        cleanup(payload.data.token)
      } catch (e) {
        error.textContent = e?.message || 'Confirmação recusada.'
        input.select()
      }
    })
    select(selected)
  })

  const requestStepUp = async action => {
    const optionsResponse = await requestInternal('/account/identity/step-up/options', { method: 'GET' })
    if (!optionsResponse.ok) return null
    const methods = (await optionsResponse.json())?.data?.methods || {}
    if (methods.passkey && navigator.credentials?.get) {
      try {
        const grant = await passkeyStepUp(action)
        if (grant) return grant
      } catch (error) {
        if (error?.name !== 'NotAllowedError') console.warn('[Peter Identity] passkey step-up failed', error)
      }
    }
    if (!methods.password && !methods.totp) return null
    return modalStepUp(action, methods)
  }

  const authorizedFetch = async (url, options = {}) => window.fetch(url, options)

  const logoutCurrentApp = async () => {
    try { await apiJson('/account/identity/logout', { method: 'POST', json: {} }) } catch {}
    clearAccessToken()
    pauseSsoForCurrentApp()
    dispatchState('logout-current-app')
    return true
  }

  const logoutEverywhere = async () => {
    const grant = await requestStepUp('logout_everywhere')
    if (!grant) return false
    try {
      await apiJson('/account/identity/logout-everywhere', { method: 'POST', headers: { 'X-Peter-Step-Up': grant }, json: {} })
    } finally {
      clearAccessToken()
      pauseSsoForCurrentApp()
    }
    dispatchState('logout-everywhere')
    return true
  }

  const sessions = () => apiJson('/account/identity/sessions', { method: 'GET' })
  const devices = () => apiJson('/account/identity/devices', { method: 'GET' })
  const security = () => apiJson('/account/identity/security', { method: 'GET' })
  const observability = minutes => apiJson(`/account/identity/operations/observability?minutes=${encodeURIComponent(minutes || 60)}`, { method: 'GET' })
  const rollout = () => apiJson('/account/identity/operations/rollout', { method: 'GET' })
  const renameDevice = (id, name) => apiJson(`/account/identity/devices/${encodeURIComponent(id)}`, { method: 'PATCH', json: { name } })

  const trustDevice = async (id, trusted = true) => {
    const grant = await requestStepUp('trust_device')
    if (!grant) return null
    return apiJson(`/account/identity/devices/${encodeURIComponent(id)}/trust`, { method: 'POST', headers: { 'X-Peter-Step-Up': grant }, json: { trusted } })
  }

  const revokeDevice = async id => {
    const grant = await requestStepUp('revoke_device')
    if (!grant) return null
    return apiJson(`/account/identity/devices/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Peter-Step-Up': grant } })
  }

  const updateRollout = async value => {
    const grant = await requestStepUp('identity_rollout')
    if (!grant) return null
    return apiJson('/account/identity/operations/rollout', { method: 'PUT', headers: { 'X-Peter-Step-Up': grant }, json: value })
  }

  const revokeAllSessions = async () => {
    const grant = await requestStepUp('revoke_all_sessions')
    if (!grant) return null
    return apiJson('/account/identity/sessions', { method: 'DELETE', headers: { 'X-Peter-Step-Up': grant } })
  }

  const revokeSession = id => apiJson(`/account/identity/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  const revokeOtherSessions = () => apiJson('/account/identity/sessions/revoke-others', { method: 'POST', json: {} })

  const changePassword = async (password, passwordConfirmation = password) => {
    const grant = await requestStepUp('change_password')
    if (!grant) return null
    try {
      return await apiJson('/account/identity/password/change', {
        method: 'POST', headers: { 'X-Peter-Step-Up': grant },
        json: { password, password_confirmation: passwordConfirmation },
      })
    } finally {
      clearAccessToken()
      pauseSsoForCurrentApp()
    }
  }

  const interceptAxios = instance => {
    if (!instance?.interceptors || instance.__peterIdentityV3) return instance
    instance.__peterIdentityV3 = true
    instance.interceptors.request.use(config => {
      const token = getAccessToken()
      config.headers = config.headers || {}
      if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
      config.headers['X-Peter-Identity-SDK'] = VERSION
      config.headers['X-Peter-Device'] = getDeviceId()
      config.headers['X-Peter-Device-Name'] = getDeviceName()
      if (state.appSlug) config.headers['X-Peter-App'] = state.appSlug
      config.withCredentials = true
      return config
    })
    instance.interceptors.response.use(response => response, async error => {
      const config = error?.config
      const status = error?.response?.status
      if (!config) throw error

      if (status === 401 && !config.__peterIdentityRetry) {
        config.__peterIdentityRetry = true
        const token = await recover({ force: true })
        if (token) {
          config.headers = config.headers || {}
          config.headers.Authorization = `Bearer ${token}`
          return instance.request(config)
        }
      }

      if (status === 428 && !config.__peterStepUpRetry && error?.response?.data?.code === 'STEP_UP_REQUIRED') {
        config.__peterStepUpRetry = true
        const grant = await requestStepUp(error.response.data.step_up_action)
        if (grant) {
          config.headers = config.headers || {}
          config.headers['X-Peter-Step-Up'] = grant
          return instance.request(config)
        }
      }
      throw error
    })
    return instance
  }

  const setDeviceName = name => {
    const normalized = String(name || '').trim().slice(0, 180)
    if (normalized) localStorage.setItem(DEVICE_NAME_KEY, normalized)
    else localStorage.removeItem(DEVICE_NAME_KEY)
    return getDeviceName()
  }

  const acceptAccessToken = async token => {
    persistAccessToken(token)
    resumeSso()
    const established = await establish()
    if (established) await recover({ force: true })
    return getAccessToken()
  }

  const PeterIdentity = {
    version: VERSION,
    protocolVersion: PROTOCOL,
    configure,
    initialize,
    sync,
    recover,
    establish,
    protocol,
    getAccessToken,
    acceptAccessToken,
    clearAccessToken,
    getDeviceId,
    getDeviceName,
    setDeviceName,
    isSsoPaused: isOptedOut,
    resumeSso,
    authorizedFetch,
    interceptAxios,
    requestStepUp,
    sessions,
    devices,
    security,
    observability,
    rollout,
    updateRollout,
    renameDevice,
    trustDevice,
    revokeDevice,
    revokeSession,
    revokeOtherSessions,
    revokeAllSessions,
    changePassword,
    logoutCurrentApp,
    logoutEverywhere,
    circuit: {
      isOpen: circuitOpen,
      state: getCircuit,
      reset: circuitSuccess,
    },
  }

  window.PeterIdentity = PeterIdentity
  // Temporary compatibility alias while v2 consumers migrate.
  window.PeterTecnetAuthSession = PeterIdentity
  dispatchState('sdk-loaded')
})()
