import { useCallback, useEffect, useState } from 'react'
import AdminAppNavigation from './AdminAppNavigation.jsx'
import AdminGlobalSearch from './AdminGlobalSearch.jsx'
import AdminEstablishmentsIntegration from './AdminEstablishmentsIntegration.jsx'
import AdminItemsIntegration from './AdminItemsIntegration.jsx'
import ImportantEventsIntegration from './ImportantEventsIntegration.jsx'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const VALIDATION_TIMEOUT_MS = 10000

export default function AdminSessionGuard() {
  const [authorized, setAuthorized] = useState(false)

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY) || ''
    if (!token) { setAuthorized(false); return }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)
    try {
      const response = await fetch(`${API}/admin/ecosystem/dashboard`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      })

      if (response.ok) { setAuthorized(true); return }

      setAuthorized(false)
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(TOKEN_KEY)
        window.dispatchEvent(new Event('admin-session-expired'))
      }
    } catch {
      setAuthorized(false)
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    void validateSession()
    const authenticated = () => { void validateSession() }
    const expired = () => setAuthorized(false)
    const storage = event => { if (event.key === TOKEN_KEY) void validateSession() }

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
    <ImportantEventsIntegration />
    <AdminAppNavigation />
  </>
}
