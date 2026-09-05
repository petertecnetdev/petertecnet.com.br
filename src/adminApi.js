const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

export async function adminRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 20000)
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }
    if (!response.ok) {
      const validation = Object.values(payload?.errors || {}).flat()?.[0]
      throw new Error(validation || payload?.error || payload?.message || 'Não foi possível concluir a operação.')
    }
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function encodeAdminKey(values) {
  const json = JSON.stringify(values)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
