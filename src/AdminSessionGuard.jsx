import { useCallback, useEffect, useRef, useState } from 'react'
import AdminAppNavigation from './AdminAppNavigation.jsx'
import AdminGlobalSearch from './AdminGlobalSearch.jsx'
import AdminEstablishmentsIntegration from './AdminEstablishmentsIntegration.jsx'
import AdminItemsIntegration from './AdminItemsIntegration.jsx'
import './AdminSessionGuard.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const OWNER_EMAIL = 'petertecnet@gmail.com'

const ECOSYSTEM_LINKS = [
  { name: 'Cutinapp', description: 'Eventos, produtores e participantes', url: 'https://cutinapp.petertecnet.com.br/' },
  { name: 'Nexus', description: 'Empresas, itens e catálogos', url: 'https://nexus.petertecnet.com.br/' },
  { name: 'Rasoio', description: 'Agenda e serviços', url: 'https://rasoio.petertecnet.com.br/' },
  { name: 'PayFlow', description: 'Vendas, propostas e cobranças', url: 'https://payflow.petertecnet.com.br/' },
  { name: 'Laora', description: 'Conexões e relacionamento', url: 'https://laora.petertecnet.com.br/' },
  { name: 'Peter Tecnet', description: 'Portal do ecossistema', url: 'https://petertecnet.com.br/' },
]

function getCurrentUser(payload) {
  return payload?.user || payload?.token?.user || payload || null
}

function userDisplayName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.name || ''
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
  const [blockedAccount, setBlockedAccount] = useState(null)
  const [leavingSession, setLeavingSession] = useState(false)
  const authorizedRef = useRef(false)
  const validatedTokenRef = useRef('')
  const rejectedTokenRef = useRef('')
  const validationSequenceRef = useRef(0)

  const setAuthorization = useCallback(value => {
    authorizedRef.current = value
    setAuthorized(value)
  }, [])

  const invalidateSession = useCallback(async (token, message, currentUser = null) => {
    validationSequenceRef.current += 1
    validatedTokenRef.current = ''
    rejectedTokenRef.current = token || rejectedTokenRef.current
    localStorage.removeItem(TOKEN_KEY)
    setAuthorization(false)
    setBlockedAccount(currentUser ? {
      email: String(currentUser?.email || '').trim().toLowerCase(),
      name: userDisplayName(currentUser),
    } : {})
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
        await invalidateSession(
          token,
          'A sessão encontrada não pode acessar o Admin Center. Faça logout e entre novamente com a conta administrativa correta.',
        )
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
          `Você está conectado como ${email || 'outro usuário'}. O Admin Center aceita somente ${OWNER_EMAIL}.`,
          currentUser,
        )
        return
      }

      rejectedTokenRef.current = ''
      validatedTokenRef.current = token
      setBlockedAccount(null)
      setNotice('')
      setAuthorization(true)
    } catch {
      if (sequence === validationSequenceRef.current) setAuthorization(false)
    }
  }, [invalidateSession, setAuthorization])

  const continueToCorrectLogin = useCallback(async () => {
    if (leavingSession) return
    setLeavingSession(true)

    const token = localStorage.getItem(TOKEN_KEY) || rejectedTokenRef.current
    localStorage.removeItem(TOKEN_KEY)
    validatedTokenRef.current = ''
    rejectedTokenRef.current = ''
    setAuthorization(false)

    await revokeSession(token)

    setBlockedAccount(null)
    setNotice('')
    setLeavingSession(false)

    window.setTimeout(() => {
      document.querySelector('.login-card input[type="password"]')?.focus()
    }, 0)
  }, [leavingSession, setAuthorization])

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
      setBlockedAccount(current => current || {})
      setNotice(current => current || `Sua sessão administrativa expirou. Entre novamente com ${OWNER_EMAIL}.`)
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

  const showBlockedState = !authorized && Boolean(notice) && blockedAccount !== null

  return <>
    {showBlockedState && (
      <div className="admin-access-blocked" role="dialog" aria-modal="true" aria-labelledby="admin-access-title">
        <div className="admin-access-aura admin-access-aura-one" aria-hidden="true" />
        <div className="admin-access-aura admin-access-aura-two" aria-hidden="true" />

        <section className="admin-access-card">
          <header className="admin-access-brand">
            <span className="admin-access-logo"><img src="/petertecnetlogo.png" alt="" /></span>
            <span><strong>Peter Tecnet</strong><small>Admin Center</small></span>
          </header>

          <div className="admin-access-status"><span /> Acesso administrativo protegido</div>
          <h1 id="admin-access-title">Você precisa trocar de conta.</h1>
          <p className="admin-access-message">{notice}</p>

          {blockedAccount?.email && (
            <div className="admin-access-account" aria-label="Conta detectada">
              <span className="admin-access-avatar">{(blockedAccount.name || blockedAccount.email).slice(0, 1).toUpperCase()}</span>
              <span><small>Conta detectada</small><strong>{blockedAccount.name || blockedAccount.email}</strong><em>{blockedAccount.email}</em></span>
            </div>
          )}

          <div className="admin-access-guidance">
            <strong>Para entrar no Admin Center</strong>
            <span>Faça logout desta sessão e autentique novamente com <b>{OWNER_EMAIL}</b>.</span>
          </div>

          <button className="admin-access-primary" type="button" onClick={continueToCorrectLogin} disabled={leavingSession}>
            {leavingSession ? 'Encerrando sessão…' : 'Fazer logout e entrar com a conta correta'} <span>↗</span>
          </button>

          <div className="admin-access-divider"><span>ou continue no ecossistema</span></div>

          <nav className="admin-access-apps" aria-label="Aplicações Peter Tecnet">
            {ECOSYSTEM_LINKS.map(app => (
              <a key={app.name} href={app.url}>
                <span><strong>{app.name}</strong><small>{app.description}</small></span>
                <i>↗</i>
              </a>
            ))}
          </nav>

          <p className="admin-access-footnote">Nenhuma área administrativa é carregada enquanto a conta não autorizada estiver ativa.</p>
        </section>
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
