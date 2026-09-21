import { useEffect, useRef, useState } from 'react'
import { readAdminSessionState, writeAdminSessionState } from './adminPersistence.js'
import AdminUserDetailPage from './AdminUserDetailExperience.jsx'
import AdminProspectInvitation from './AdminProspectInvitation.jsx'
import { AdminImpersonationDialog, canImpersonate } from './AdminImpersonation.jsx'

const DEFAULT_LIST_SETTINGS = { sort: 'newest', per_page: '50' }

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
}

function initials(user) {
  const name = fullName(user).trim()
  if (!name) return 'U'
  const parts = name.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase()
}

function dateTime(value) {
  if (!value) return 'Sem atividade'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sem atividade'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function detailUserFromUrl() {
  const value = new URLSearchParams(window.location.search).get('user')
  return value && /^\d+$/.test(value) ? Number(value) : null
}

function applicationNames(user) {
  const applications = Array.isArray(user?.applications) ? user.applications : []
  if (!applications.length) return 'Nenhuma'
  const names = applications.map(app => app?.name).filter(Boolean)
  if (!names.length) return `${applications.length} acesso(s)`
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

export default function AdminUsersCenter({ apiRequest, applications = [] }) {
  const [users, setUsers] = useState([])
  const [filters] = useState(() => readAdminSessionState('users-filters', DEFAULT_LIST_SETTINGS))
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [detailUserId, setDetailUserId] = useState(detailUserFromUrl)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [impersonationUser, setImpersonationUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadedOnceRef = useRef(false)
  const usersSequenceRef = useRef(0)

  async function loadUsers(page = 1, { quiet = false } = {}) {
    const sequence = ++usersSequenceRef.current
    if (!quiet && !loadedOnceRef.current) setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(filters?.per_page || DEFAULT_LIST_SETTINGS.per_page),
        sort: String(filters?.sort || DEFAULT_LIST_SETTINGS.sort),
      })
      const payload = await apiRequest(`/admin/ecosystem/users?${params.toString()}`)
      if (sequence !== usersSequenceRef.current) return

      setUsers(payload?.users || [])
      setPagination(payload?.pagination || {
        current_page: page,
        last_page: 1,
        total: payload?.users?.length || 0,
      })
    } catch (err) {
      if (sequence === usersSequenceRef.current) setError(err?.message || 'Não foi possível carregar os usuários.')
    } finally {
      if (sequence === usersSequenceRef.current) {
        loadedOnceRef.current = true
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    writeAdminSessionState('users-filters', filters)
  }, [filters])

  useEffect(() => {
    void loadUsers(1)
  }, [])

  useEffect(() => {
    function onPopState() {
      setDetailUserId(detailUserFromUrl())
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!inviteOpen) return undefined

    function closeOnEscape(event) {
      if (event.key === 'Escape') setInviteOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [inviteOpen])

  function openDetail(userId) {
    const url = new URL(window.location.href)
    url.searchParams.set('user', String(userId))
    window.history.pushState({ adminUserId: userId }, '', `${url.pathname}${url.search}${url.hash}`)
    setDetailUserId(Number(userId))
    setError('')
  }

  function closeDetail() {
    if (window.history.state?.adminUserId) {
      window.history.back()
      return
    }

    const url = new URL(window.location.href)
    url.searchParams.delete('user')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setDetailUserId(null)
  }

  if (detailUserId) {
    return <AdminUserDetailPage userId={detailUserId} apiRequest={apiRequest} applications={applications} onBack={closeDetail}/>
  }

  return <div className="acu-root acu-root--simple">
    {error && <div className="acu-notice acu-notice--danger">{error}</div>}

    <section className="acu-card acu-users-simple">
      <header className="acu-users-simple__head">
        <div>
          <span>USUÁRIOS</span>
          <h3>Lista de usuários</h3>
          <p>{pagination.total || users.length || 0} cadastrado(s) no ecossistema</p>
        </div>
        <button type="button" className="acu-invite-button" onClick={() => setInviteOpen(true)}>
          + Convidar usuário
        </button>
      </header>

      {loading ? (
        <div className="acu-loading">Carregando usuários…</div>
      ) : users.length ? (
        <div className="acu-simple-list">
          {users.map(user => (
            <div className="acu-simple-user" key={user.id}>
              <button type="button" className="acu-simple-user__details" onClick={() => openDetail(user.id)}>
                <span className="acu-simple-user__avatar">{initials(user)}</span>
                <span className="acu-simple-user__identity">
                  <strong>{fullName(user)}</strong>
                  <small>{user.email}</small>
                </span>
                <span className="acu-simple-user__meta">
                  <small>Perfil</small>
                  <strong>{user.profile?.name || 'Sem perfil'}</strong>
                </span>
                <span className="acu-simple-user__meta">
                  <small>Plataformas</small>
                  <strong>{applicationNames(user)}</strong>
                </span>
                <span className="acu-simple-user__meta acu-simple-user__activity">
                  <small>Última atividade</small>
                  <strong>{dateTime(user.last_activity_at)}</strong>
                </span>
                <span className="acu-simple-user__open" aria-hidden="true">›</span>
              </button>
              <button
                type="button"
                className="acu-simple-user__impersonate"
                disabled={!canImpersonate(user)}
                onClick={event => {
                  event.stopPropagation()
                  setError('')
                  setImpersonationUser(user)
                }}
                aria-label={`Entrar como ${fullName(user)}`}
                title={canImpersonate(user) ? 'Entrar temporariamente como este usuário' : 'Este usuário não pode ser assumido'}
              >
                Entrar como usuário
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="acu-empty">
          <strong>Nenhum usuário encontrado.</strong>
          <span>Convide o primeiro usuário para começar.</span>
        </div>
      )}

      {(pagination.last_page || 1) > 1 && (
        <footer className="acu-pagination">
          <span>Página {pagination.current_page || 1} de {pagination.last_page || 1}</span>
          <div>
            <button className="acu-secondary" disabled={!pagination.previous_page || loading} onClick={() => loadUsers(pagination.previous_page)}>
              ← Anterior
            </button>
            <button className="acu-secondary" disabled={!pagination.next_page || loading} onClick={() => loadUsers(pagination.next_page)}>
              Próxima →
            </button>
          </div>
        </footer>
      )}
    </section>

    {inviteOpen && (
      <div className="acu-invite-modal" role="dialog" aria-modal="true" aria-label="Convidar usuário" onMouseDown={event => {
        if (event.target === event.currentTarget) setInviteOpen(false)
      }}>
        <div className="acu-invite-modal__panel">
          <button type="button" className="acu-invite-modal__close" aria-label="Fechar" onClick={() => setInviteOpen(false)}>×</button>
          <AdminProspectInvitation
            apiRequest={apiRequest}
            applications={applications}
            compact
            onSuccess={() => loadUsers(1, { quiet: true })}
          />
        </div>
      </div>
    )}

    {impersonationUser && (
      <AdminImpersonationDialog
        user={impersonationUser}
        applications={applications}
        apiRequest={apiRequest}
        onClose={() => setImpersonationUser(null)}
        onStarted={() => setImpersonationUser(null)}
      />
    )}
  </div>
}
