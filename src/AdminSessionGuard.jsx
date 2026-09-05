import { useCallback, useEffect, useRef, useState } from 'react'
import AdminAppNavigation from './AdminAppNavigation.jsx'
import AdminGlobalSearch from './AdminGlobalSearch.jsx'
import AdminEstablishmentsIntegration from './AdminEstablishmentsIntegration.jsx'
import AdminItemsIntegration from './AdminItemsIntegration.jsx'
import './AdminSessionGuard.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const OWNER_EMAIL = 'petertecnet@gmail.com'

function getCurrentUser(payload) {
  return payload?.user || payload?.token?.user || payload || null
}

async function revokeSession(token) {
  if (!token) return

  try {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    // A revogação remota é best-effort. A sessão local é sempre removida.
  }
}

export default function AdminSessionGuard() {
  const [authorized, setAuthorized] = useState(false)
  const [notice, setNotice] = useState('')
  const authorizedRef = useRef(false)
  const validatedTokenRef = useRef('')
  const validationSequenceRef = useRef(0)

  const setAuthorization = useCallback(value => {
    authorizedRef.current = value
    setAuthorized(value)
  }, [])

  const invalidateSession = useCallback(async (token, message) => {
    validationSequenceRef.current += 1
    validatedTokenRef.current = ''
    localStorage.removeItem(TOKEN_KEY)
    setAuthorization(false)
    setNotice(message)
    window.dispatchEvent(new Event('admin-session-expired'))
    await revokeSession(token)
  }, [setAuthorization])

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      validatedTokenRef.current = ''
      setAuthorization(false)
      return
    }

    if (authorizedRef.current && validatedTokenRef.current === token) return

    const sequence = ++validationSequenceRef.current

    try {
      const response = await fetch(`${API}/auth/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (sequence !== validationSequenceRef.current) return

      if (response.status === 401 || response.status === 403) {
        await invalidateSession(token, 'Sua sessão administrativa foi encerrada. Entre novamente com petertecnet@gmail.com.')
        return
      }

      if (!response.ok) {
        setAuthorization(false)
        return
      }

      const payload = await response.json().catch(() => ({}))
      const currentUser = getCurrentUser(payload)
      const email = String(currentUser?.email || '').trim().toLowerCase()

      if (email !== OWNER_EMAIL) {
        await invalidateSession(
          token,
          `A sessão de ${email || 'outro usuário'} foi encerrada. O Admin Center aceita somente petertecnet@gmail.com.`,
        )
        return
      }

      validatedTokenRef.current = token
      setNotice('')
      setAuthorization(true)
    } catch {
      if (sequence === validationSequenceRef.current) setAuthorization(false)
    }
  }, [invalidateSession, setAuthorization])

  useEffect(() => {
    void validateSession()

    const root = document.getElementById('root')
    const observer = new MutationObserver(() => {
      void validateSession()
    })

    if (root) observer.observe(root, { childList: true, subtree: true })

    const handleExpired = () => {
      validatedTokenRef.current = ''
      setAuthorization(false)
      setNotice(current => current || 'Sua sessão administrativa expirou. Entre novamente com petertecnet@gmail.com.')
    }

    const handleStorage = event => {
      if (event.key === TOKEN_KEY) void validateSession()
    }

    window.addEventListener('admin-session-expired', handleExpired)
    window.addEventListener('storage', handleStorage)

    return () => {
      observer.disconnect()
      window.removeEventListener('admin-session-expired', handleExpired)
      window.removeEventListener('storage', handleStorage)
    }
  }, [setAuthorization, validateSession])

  return <>
    {!authorized && notice && (
      <div className="admin-session-notice" role="alert" aria-live="assertive">
        <strong>Acesso ao Admin Center protegido</strong>
        <span>{notice}</span>
      </div>
    )}

    {authorized && <>
      <AdminGlobalSearch />
      <AdminEstablishmentsIntegration />
      <AdminItemsIntegration />
      <AdminAppNavigation />
    </>}
  </>
}
