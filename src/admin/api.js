const API_URL = (import.meta.env?.VITE_API_URL || 'https://api.petertecnet.com.br/api').replace(/\/$/, '')
const TOKEN_KEY = 'peter_admin_token'
const LEGACY_TOKEN_KEY = 'token'

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function getToken() {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
  if (token && !sessionStorage.getItem(TOKEN_KEY)) {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }
  return token
}

export function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function tokenFrom(data) {
  return data?.token?.access_token || data?.token?.original?.access_token || data?.access_token || data?.token
}

export function errorMessage(data) {
  return data?.error || data?.message || Object.values(data?.errors || {}).flat()[0] || 'Não foi possível concluir a operação.'
}

export async function apiRequest(path, options = {}) {
  const token = getToken()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 20000)

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const data = response.status === 204 ? null : await response.json().catch(() => ({}))

    if (response.status === 401 && path !== '/auth/login') {
      clearToken()
      window.location.assign('/login?reason=session')
      throw new ApiError('Sua sessão expirou. Entre novamente.', 401)
    }
    if (response.status === 403) throw new ApiError('Sua conta não possui permissão para esta operação.', 403, data)
    if (!response.ok) throw new ApiError(errorMessage(data), response.status, data)
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('A API demorou para responder. Tente novamente.', 408)
    if (error instanceof ApiError) throw error
    throw new ApiError('Não foi possível conectar à API. Verifique sua conexão e tente novamente.')
  } finally {
    window.clearTimeout(timeout)
  }
}
