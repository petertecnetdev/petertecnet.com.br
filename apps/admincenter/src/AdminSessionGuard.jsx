import { useCallback, useEffect, useState } from 'react'
import AdminAppNavigation from './AdminAppNavigation.jsx'
import AdminGlobalSearch from './AdminGlobalSearch.jsx'
import AdminEstablishmentsIntegration from './AdminEstablishmentsIntegration.jsx'
import AdminItemsIntegration from './AdminItemsIntegration.jsx'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const VALIDATION_TIMEOUT_MS = 10000

export default function AdminSessionGuard() {
  const [authorized, setAuthorized] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY) || ''
    if (!token) { setAuthorized(false); return }

    // Keep already-authenticated admin modules mounted while the background
    // validation runs. Transient API/network failures must not make privileged
    // navigation entries disappear from an otherwise valid Admin Center session.
    setAuthorized(true)

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)
    try {
      const response = await fetch(`${API}/admin/ecosystem/dashboard`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      })

      if (response.ok) { setAuthorized(true); return }

      if (response.status === 401 || response.status === 403) {
        setAuthorized(false)
        localStorage.removeItem(TOKEN_KEY)
        window.dispatchEvent(new Event('admin-session-expired'))
        return
      }

      // For temporary 5xx/rate-limit responses, preserve the current session UI.
      // Individual admin endpoints still enforce authorization server-side.
      setAuthorized(Boolean(localStorage.getItem(TOKEN_KEY)))
    } catch {
      // A timeout/offline validation must not hide Estabelecimentos/Itens.
      setAuthorized(Boolean(localStorage.getItem(TOKEN_KEY)))
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    void validateSession()
    const authenticated = () => { setAuthorized(Boolean(localStorage.getItem(TOKEN_KEY))); void validateSession() }
    const expired = () => setAuthorized(false)
    const storage = event => {
      if (event.key !== TOKEN_KEY) return
      setAuthorized(Boolean(event.newValue))
      void validateSession()
    }

    window.addEventListener('admin-session-authenticated', authenticated)
    window.addEventListener('admin-session-expired', expired)
    window.addEventListener('storage', storage)

    return () => {
      window.removeEventListener('admin-session-authenticated', authenticated)
      window.removeEventListener('admin-session-expired', expired)
      window.removeEventListener('storage', storage)
    }
  }, [validateSession])

  return authorized && <>
    <AdminGlobalSearch />
    <AdminEstablishmentsIntegration />
    <AdminItemsIntegration />
    <AdminAppNavigation />
  </>
}
