import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ADMIN_API, ADMIN_TOKEN_KEY, AdminAuthContext } from './adminAuth.js'
import { resolveAdminSession } from './adminAuthPolicy.js'

function tokenFrom(payload) {
  return payload?.token?.access_token || payload?.access_token || payload?.token || ''
}

function userFrom(payload) {
  return payload?.token?.user || payload?.user || payload || null
}

async function parseResponse(response) {
  if (response.status === 204) return null
  return response.json().catch(() => ({}))
}

function makeError(payload, response, fallback = 'Não foi possível concluir a operação.') {
  const error = new Error(payload?.error || payload?.message || Object.values(payload?.errors || {}).flat()?.[0] || fallback)
  error.status = response.status
  error.retryAfter = Number(response.headers.get('Retry-After') || payload?.retry_after || 0)
  return error
}

export function AdminAuthProvider({ children }) {
  const initialToken = localStorage.getItem(ADMIN_TOKEN_KEY) || ''
  const [state, setState] = useState({
    status: initialToken ? 'checking' : 'guest',
    user: null,
    error: '',
    bootstrapDashboard: null,
  })
  const sequenceRef = useRef(0)

  const rawRequest = useCallback(async (path, options = {}, explicitToken = null) => {
    const token = explicitToken ?? localStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), options.timeout || 18000)
    try {
      const response = await fetch(`${ADMIN_API}${path}`, {
        ...options,
        cache: options.cache || 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })
      const payload = await parseResponse(response)
      if (!response.ok) throw makeError(payload, response)
      return payload
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('A API demorou para responder.')
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  const invalidate = useCallback((message = '') => {
    sequenceRef.current += 1
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    sessionStorage.removeItem('petertecnet_admin_data_cache_v2')
    setState({ status: 'guest', user: null, error: message, bootstrapDashboard: null })
  }, [])

  const validate = useCallback(async (explicitToken = null) => {
    const token = explicitToken ?? localStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
    const sequence = ++sequenceRef.current
    if (!token) {
      const status = resolveAdminSession({ hasToken: false })
      setState({ status, user: null, error: '', bootstrapDashboard: null })
      return { authorized: false }
    }

    setState(current => ({ ...current, status: 'checking', error: '' }))
    try {
      const [me, dashboard] = await Promise.all([
        rawRequest('/auth/me', { timeout: 10000 }, token),
        rawRequest('/admin/ecosystem/dashboard', { timeout: 12000 }, token),
      ])
      if (sequence !== sequenceRef.current) return { authorized: false }
      const user = userFrom(me)
      setState({ status: 'authenticated', user, error: '', bootstrapDashboard: dashboard })
      return { authorized: true, user, dashboard }
    } catch (error) {
      if (sequence !== sequenceRef.current) return { authorized: false }
      const resolved = resolveAdminSession({ hasToken: true, meStatus: error?.status || 500, adminStatus: error?.status || 500 })
      const forbidden = resolved === 'forbidden'
      if (resolved !== 'retryable') {
        localStorage.removeItem(ADMIN_TOKEN_KEY)
        sessionStorage.removeItem('petertecnet_admin_data_cache_v2')
      }
      setState({
        status: resolved === 'retryable' ? 'unavailable' : resolved,
        user: null,
        error: forbidden ? 'Esta conta não possui acesso ao Admin Center.' : (error?.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível validar sua sessão administrativa agora.'),
        bootstrapDashboard: null,
      })
      return { authorized: false, error }
    }
  }, [rawRequest])

  const login = useCallback(async ({ email, password }) => {
    const payload = await rawRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: email.trim().toLowerCase(), password }),
    }, '')
    const token = tokenFrom(payload)
    if (!token) throw new Error('A API não retornou uma sessão válida.')
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
    const result = await validate(token)
    if (!result.authorized) {
      const error = result.error || new Error('Esta conta não possui acesso ao Admin Center.')
      throw error
    }
    return result.user
  }, [rawRequest, validate])

  const loginWithGoogle = useCallback(async (credential) => {
    const payload = await rawRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token_id: credential }),
    }, '')
    const token = tokenFrom(payload)
    if (!token) throw new Error('A API não retornou uma sessão válida.')
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
    const result = await validate(token)
    if (!result.authorized) throw result.error || new Error('Esta conta não possui acesso ao Admin Center.')
    return result.user
  }, [rawRequest, validate])

  const getIdentityProviders = useCallback(
    () => rawRequest('/account/identity/providers', { timeout: 10000 }, ''),
    [rawRequest],
  )

  const logout = useCallback(async () => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || ''
    sequenceRef.current += 1
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    sessionStorage.removeItem('petertecnet_admin_data_cache_v2')
    setState({ status: 'guest', user: null, error: '', bootstrapDashboard: null })
    if (token) rawRequest('/auth/logout', { method: 'POST', timeout: 5000 }, token).catch(() => {})
  }, [rawRequest])

  const request = useCallback(async (path, options = {}) => {
    try {
      return await rawRequest(path, options)
    } catch (error) {
      if (error?.status === 401) invalidate('Sua sessão expirou. Entre novamente.')
      throw error
    }
  }, [invalidate, rawRequest])

  useEffect(() => {
    if (initialToken) void validate(initialToken)
    const onStorage = event => {
      if (event.key !== ADMIN_TOKEN_KEY) return
      if (event.newValue) void validate(event.newValue)
      else invalidate('')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [initialToken, invalidate, validate])

  const value = useMemo(() => ({
    ...state,
    isAuthenticated: state.status === 'authenticated',
    login,
    loginWithGoogle,
    getIdentityProviders,
    logout,
    validate,
    request,
    invalidate,
  }), [state, login, loginWithGoogle, getIdentityProviders, logout, validate, request, invalidate])

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

