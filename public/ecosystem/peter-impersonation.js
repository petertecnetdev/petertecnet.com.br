(() => {
  'use strict'

  const VERSION = '1.0.0'
  const API_FALLBACK = 'https://api.petertecnet.com.br/api'
  const ADMIN_URL = 'https://admincenter.petertecnet.com.br/'
  const TOKEN_KEYS = ['token', 'petertecnet_token', 'access_token', 'auth_token', 'petertecnet_admin_token']
  const PARAM = 'pt_impersonation'

  if (window.PeterTecnetImpersonation?.version === VERSION) return

  const script = document.currentScript
  const cleanSlug = value => String(value || '').trim().toLowerCase()
  const appSlug = cleanSlug(
    script?.dataset?.appSlug
      || document.querySelector('meta[name="peter-app-slug"]')?.content
      || (location.hostname.endsWith('.petertecnet.com.br') ? location.hostname.split('.')[0] : 'petertecnet')
  )
  const api = String(script?.dataset?.apiBase || API_FALLBACK).replace(/\/+$/, '')
  const STATE_KEY = 'peter.impersonation.state.v1.' + appSlug
  const BACKUP_KEY = 'peter.impersonation.backup.v1.' + appSlug
  const RESTORE_GUARD = 'peter.impersonation.restore.v1.' + appSlug
  let host = null
  let countdownTimer = null
  let syncTimer = null
  let currentSession = null
  let ending = false

  const readJson = (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
  }

  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }

  const getToken = () => {
    for (const key of TOKEN_KEYS) {
      try {
        const value = localStorage.getItem(key)
        if (value) return value
      } catch {}
    }
    return null
  }

  const captureBackup = () => {
    if (localStorage.getItem(BACKUP_KEY)) return
    const tokens = {}
    for (const key of TOKEN_KEYS) {
      try { tokens[key] = localStorage.getItem(key) } catch { tokens[key] = null }
    }
    let user = null
    try { user = localStorage.getItem('user') } catch {}
    writeJson(BACKUP_KEY, { tokens, user, captured_at: new Date().toISOString() })
  }

  const writeImpersonationSession = data => {
    for (const key of TOKEN_KEYS) {
      try { localStorage.setItem(key, data.access_token) } catch {}
    }
    if (data.user) {
      try { localStorage.setItem('user', JSON.stringify(data.user)) } catch {}
    }
    writeJson(STATE_KEY, data.impersonation)
  }

  const clearRuntimeState = () => {
    try { localStorage.removeItem(STATE_KEY) } catch {}
    currentSession = null
    if (countdownTimer) clearInterval(countdownTimer)
    countdownTimer = null
    if (host) host.remove()
    host = null
  }

  const restorePreviousSession = () => {
    const backup = readJson(BACKUP_KEY, null)
    for (const key of TOKEN_KEYS) {
      try {
        const previous = backup?.tokens?.[key]
        if (previous) localStorage.setItem(key, previous)
        else localStorage.removeItem(key)
      } catch {}
    }
    try {
      if (backup?.user) localStorage.setItem('user', backup.user)
      else localStorage.removeItem('user')
      localStorage.removeItem(BACKUP_KEY)
    } catch {}
    clearRuntimeState()
    window.dispatchEvent(new Event('authChanged'))
    window.dispatchEvent(new CustomEvent('peter:auth-changed', { detail: { source: 'impersonation-ended' } }))
  }

  const responseMessage = (payload, fallback) => payload?.message || payload?.error || fallback

  const apiRequest = async (path, options = {}) => {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Peter-App': appSlug,
      ...(options.headers || {}),
    }
    const token = options.auth === false ? null : getToken()
    if (token) headers.Authorization = 'Bearer ' + token
    const response = await fetch(api + path, { ...options, headers })
    const payload = await response.json().catch(() => ({}))
    return { response, payload }
  }

  const removeIncomingCode = () => {
    const url = new URL(location.href)
    const code = url.searchParams.get(PARAM)
    if (!code) return null
    url.searchParams.delete(PARAM)
    url.searchParams.delete('peter_from')
    history.replaceState({}, document.title, url.pathname + url.search + url.hash)
    return code
  }

  const formatRemaining = expiresAt => {
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now())
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
  }

  const redirectAdmin = () => {
    try { location.assign(ADMIN_URL) } catch { location.href = ADMIN_URL }
  }

  const expireLocally = () => {
    if (sessionStorage.getItem(RESTORE_GUARD)) return
    try { sessionStorage.setItem(RESTORE_GUARD, '1') } catch {}
    restorePreviousSession()
    redirectAdmin()
  }

  const render = session => {
    currentSession = session
    writeJson(STATE_KEY, session)
    if (!document.body) return

    if (!host) {
      host = document.createElement('div')
      host.id = 'peter-impersonation-banner'
      host.style.position = 'fixed'
      host.style.inset = '0 0 auto 0'
      host.style.zIndex = '2147483647'
      host.style.pointerEvents = 'none'
      const shadow = host.attachShadow({ mode: 'open' })
      shadow.innerHTML = '<style>' +
        ':host{all:initial;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
        '.bar{pointer-events:auto;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:58px;padding:9px 16px;background:linear-gradient(90deg,#32100f,#5b1b14 52%,#271010);color:#fff;border-bottom:1px solid rgba(255,194,159,.35);box-shadow:0 10px 28px rgba(0,0,0,.32)}' +
        '.main{display:flex;align-items:center;gap:11px;min-width:0}.dot{width:10px;height:10px;border-radius:50%;background:#fb923c;box-shadow:0 0 0 5px rgba(251,146,60,.15);flex:0 0 auto}' +
        '.copy{min-width:0}.eyebrow{display:block;font-size:10px;letter-spacing:.13em;font-weight:900;color:#fdba74}.title{display:block;margin-top:2px;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{display:block;margin-top:2px;font-size:11px;color:#fed7aa}' +
        '.actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}.time{font:800 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#ffedd5;padding:7px 9px;border-radius:9px;background:rgba(0,0,0,.18)}' +
        'button,a{appearance:none;border:1px solid rgba(255,255,255,.18);border-radius:9px;padding:8px 11px;background:rgba(255,255,255,.08);color:#fff;font:700 12px inherit;text-decoration:none;cursor:pointer}button:hover,a:hover{background:rgba(255,255,255,.15)}button.end{background:#fff;color:#431407;border-color:#fff}button:disabled{opacity:.55;cursor:wait}' +
        '.error{display:none;padding:7px 14px;background:#7f1d1d;color:#fee2e2;font-size:12px}.error.show{display:block}' +
        '@media(max-width:720px){.bar{align-items:flex-start;flex-direction:column;padding:10px 12px}.actions{width:100%;display:grid;grid-template-columns:auto 1fr 1fr}.time{text-align:center}.title{white-space:normal}.actions a,.actions button{text-align:center}}' +
        '</style><div class="bar"><div class="main"><span class="dot"></span><div class="copy"><span class="eyebrow">MODO ADMINISTRATIVO TEMPORÁRIO</span><strong class="title"></strong><span class="meta"></span></div></div><div class="actions"><span class="time"></span><a class="admin" href="' + ADMIN_URL + '">Admin Center</a><button class="end" type="button">Encerrar</button></div></div><div class="error"></div>'
      document.body.appendChild(host)
      shadow.querySelector('.end').addEventListener('click', endImpersonation)
    }

    const shadow = host.shadowRoot
    const actor = session?.actor?.name || session?.actor?.email || 'Super Admin'
    const effective = session?.effective_user?.name || session?.effective_user?.email || 'Usuário'
    const application = session?.application?.name || appSlug
    shadow.querySelector('.title').textContent = 'Você está acessando como ' + effective + ' · ' + application
    shadow.querySelector('.meta').textContent = 'Operador real: ' + actor + ' · motivo: ' + (session?.reason || 'suporte administrativo')

    const tick = () => {
      const time = shadow.querySelector('.time')
      if (!session?.expires_at) {
        time.textContent = 'temporário'
        return
      }
      const remaining = new Date(session.expires_at).getTime() - Date.now()
      time.textContent = formatRemaining(session.expires_at)
      if (remaining <= 0) expireLocally()
    }
    tick()
    if (countdownTimer) clearInterval(countdownTimer)
    countdownTimer = setInterval(tick, 1000)
  }

  const showError = message => {
    if (!host?.shadowRoot) return
    const element = host.shadowRoot.querySelector('.error')
    element.textContent = message
    element.classList.add('show')
  }

  async function endImpersonation() {
    if (ending) return
    ending = true
    const button = host?.shadowRoot?.querySelector('.end')
    if (button) {
      button.disabled = true
      button.textContent = 'Encerrando…'
    }

    try {
      const { response, payload } = await apiRequest('/auth/impersonation/end', { method: 'POST', body: '{}' })
      if (!response.ok && response.status !== 401) {
        throw new Error(responseMessage(payload, 'Não foi possível encerrar o acesso temporário.'))
      }
      restorePreviousSession()
      redirectAdmin()
    } catch (error) {
      ending = false
      if (button) {
        button.disabled = false
        button.textContent = 'Encerrar'
      }
      showError(error?.message || 'Não foi possível encerrar o acesso temporário.')
    }
  }

  async function exchange(code) {
    captureBackup()
    const { response, payload } = await apiRequest('/auth/impersonation/exchange', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ handoff: code, application_slug: appSlug }),
    })

    if (!response.ok || !payload?.access_token || !payload?.impersonation) {
      restorePreviousSession()
      throw new Error(responseMessage(payload, 'Acesso temporário inválido ou expirado.'))
    }

    writeImpersonationSession(payload)
    try { sessionStorage.removeItem(RESTORE_GUARD) } catch {}
    window.dispatchEvent(new Event('authChanged'))
    window.dispatchEvent(new CustomEvent('peter:auth-changed', { detail: { source: 'impersonation-started' } }))
    location.reload()
  }

  async function sync() {
    const stored = readJson(STATE_KEY, null)
    const token = getToken()

    if (!token) {
      if (stored) expireLocally()
      else clearRuntimeState()
      return
    }

    try {
      const { response, payload } = await apiRequest('/auth/impersonation/current', { method: 'GET' })
      if (response.ok && payload?.impersonation?.active) {
        try { sessionStorage.removeItem(RESTORE_GUARD) } catch {}
        render(payload.impersonation)
        return
      }

      if (stored && (response.status === 401 || !payload?.impersonation)) {
        expireLocally()
        return
      }

      if (!payload?.impersonation) clearRuntimeState()
    } catch {
      if (stored && currentSession) showError('Não foi possível validar a sessão temporária agora. O acesso continua limitado pela API.')
    }
  }

  async function boot() {
    const code = removeIncomingCode()
    if (code) {
      try {
        await exchange(code)
      } catch (error) {
        console.error('[Peter Tecnet Impersonation]', error)
        alert(error?.message || 'Não foi possível iniciar o acesso temporário.')
        redirectAdmin()
      }
      return
    }

    await sync()
    syncTimer = setInterval(sync, 30000)
    window.addEventListener('focus', sync)
    window.addEventListener('storage', event => {
      if (TOKEN_KEYS.includes(event.key) || event.key === STATE_KEY) sync()
    })
  }

  window.PeterTecnetImpersonation = {
    version: VERSION,
    sync,
    end: endImpersonation,
    get current() { return currentSession },
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
  else boot()
})()
