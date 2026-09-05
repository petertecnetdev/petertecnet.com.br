import { useEffect, useMemo, useState } from 'react'
import AdminUserDetailPage from './AdminUserDetailPage.jsx'
import './AdminUsersCenter.css'

const OWNER_EMAIL = 'petertecnet@gmail.com'
const EMPTY_USER = { first_name: '', last_name: '', user_name: '', email: '', password: '', profile_id: '' }
const EMPTY_FILTERS = { search: '', profile_id: '', app_id: '', access_status: '', has_establishment: '', activity_from: '', activity_to: '', sort: 'newest', per_page: '25' }

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function buildQuery(filters, page = 1) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value))
  })
  params.set('page', String(page))
  return params.toString()
}

function detailUserFromUrl() {
  const value = new URLSearchParams(window.location.search).get('user')
  return value && /^\d+$/.test(value) ? Number(value) : null
}

function Stat({ label, value, detail }) {
  return <div className="acu-stat"><span>{label}</span><strong>{value ?? 0}</strong><small>{detail}</small></div>
}

function Notice({ tone = 'info', children }) {
  if (!children) return null
  return <div className={`acu-notice acu-notice--${tone}`}>{children}</div>
}

export default function AdminUsersCenter({ apiRequest, applications = [] }) {
  const [users, setUsers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [form, setForm] = useState({ ...EMPTY_USER })
  const [editingId, setEditingId] = useState(null)
  const [detailUserId, setDetailUserId] = useState(detailUserFromUrl)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadProfiles() {
    try {
      const payload = await apiRequest('/admin/ecosystem/profiles')
      setProfiles(payload?.profiles || [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadUsers(page = 1, nextFilters = filters, { quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users?${buildQuery(nextFilters, page)}`)
      setUsers(payload?.users || [])
      setPagination(payload?.pagination || { current_page: page, last_page: 1, total: payload?.users?.length || 0 })
      return payload
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([loadProfiles(), loadUsers(1, { ...EMPTY_FILTERS })]).catch(() => {})
  }, [])

  useEffect(() => {
    function onPopState() {
      setDetailUserId(detailUserFromUrl())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!detailUserId) return undefined
    const timer = window.setTimeout(() => document.getElementById('users')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    return () => window.clearTimeout(timer)
  }, [detailUserId])

  const pageStats = useMemo(() => {
    const activeAccesses = users.reduce((total, user) => total + (user.applications || []).filter(app => app.pivot?.status === 'active').length, 0)
    return {
      withApplications: users.filter(user => user.applications?.length).length,
      withEstablishments: users.filter(user => Number(user.establishments_count || 0) > 0).length,
      activeAccesses,
    }
  }, [users])

  function openDetail(userId) {
    const url = new URL(window.location.href)
    url.searchParams.set('user', String(userId))
    window.history.pushState({ adminUserId: userId }, '', `${url.pathname}${url.search}${url.hash}`)
    setDetailUserId(Number(userId))
    setError('')
    setMessage('')
  }

  async function closeDetail() {
    const url = new URL(window.location.href)
    url.searchParams.delete('user')
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setDetailUserId(null)
    await loadUsers(pagination.current_page || 1, filters, { quiet: true })
    window.setTimeout(() => document.getElementById('users')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function applyFilters(event) {
    event?.preventDefault()
    setMessage('')
    if (filters.access_status === 'none' && !filters.app_id) {
      setError('Para filtrar usuários sem vínculo, selecione também uma aplicação.')
      return
    }
    await loadUsers(1, filters)
  }

  async function clearFilters() {
    const next = { ...EMPTY_FILTERS }
    setFilters(next)
    setMessage('')
    await loadUsers(1, next)
  }

  function beginEdit(user) {
    setEditingId(user.id)
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      user_name: user.user_name || '',
      email: user.email || '',
      password: '',
      profile_id: user.profile_id || '',
    })
    setMessage('')
    setError('')
    document.getElementById('acu-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function resetEditor() {
    setEditingId(null)
    setForm({ ...EMPTY_USER })
  }

  async function saveUser(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        user_name: form.user_name.trim(),
        email: form.email.trim().toLowerCase(),
        profile_id: form.profile_id ? Number(form.profile_id) : null,
      }
      if (!editingId) payload.password = form.password
      await apiRequest(`/admin/ecosystem/users${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setMessage(editingId ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.')
      const targetPage = editingId ? pagination.current_page || 1 : 1
      resetEditor()
      await loadUsers(targetPage, filters, { quiet: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteUser(user) {
    if (String(user.email || '').toLowerCase() === OWNER_EMAIL) return
    if (!window.confirm(`Excluir definitivamente ${user.email}? Esta ação remove o cadastro central do usuário.`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(`/admin/ecosystem/users/${user.id}`, { method: 'DELETE' })
      setMessage('Usuário excluído.')
      const targetPage = users.length === 1 && (pagination.current_page || 1) > 1 ? pagination.current_page - 1 : pagination.current_page || 1
      await loadUsers(targetPage, filters, { quiet: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (detailUserId) {
    return <AdminUserDetailPage userId={detailUserId} apiRequest={apiRequest} applications={applications} onBack={closeDetail}/>
  }

  return <div className="acu-root">
    <div className="acu-stats">
      <Stat label="Usuários encontrados" value={pagination.total ?? users.length} detail="resultado dos filtros atuais"/>
      <Stat label="Com aplicações" value={pageStats.withApplications} detail="na página atual"/>
      <Stat label="Acessos ativos" value={pageStats.activeAccesses} detail="na página atual"/>
      <Stat label="Com estabelecimento" value={pageStats.withEstablishments} detail="na página atual"/>
    </div>

    <Notice tone="danger">{error}</Notice>
    <Notice tone="success">{message}</Notice>

    <div className="acu-layout">
      <section className="acu-card" id="acu-editor">
        <header><div><span>CADASTRO CENTRAL</span><h3>{editingId ? 'Editar usuário' : 'Novo usuário'}</h3></div>{editingId && <button className="acu-link" onClick={resetEditor}>Cancelar edição</button>}</header>
        <form className="acu-form" onSubmit={saveUser}>
          <label>Nome<input value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} required/></label>
          <label>Sobrenome<input value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })}/></label>
          <label>Usuário<input value={form.user_name} onChange={event => setForm({ ...form, user_name: event.target.value })} required/></label>
          <label>E-mail<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required/></label>
          <label className="acu-wide">Perfil<select value={form.profile_id} onChange={event => setForm({ ...form, profile_id: event.target.value })}><option value="">Sem perfil</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          {!editingId && <label className="acu-wide">Senha inicial<input type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required/><small>Mínimo de 8 caracteres.</small></label>}
          <button className="acu-primary acu-wide" disabled={busy}>{busy ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar usuário'}</button>
        </form>
      </section>

      <section className="acu-card">
        <header><div><span>SEGMENTAÇÃO</span><h3>Filtros globais</h3></div></header>
        <form className="acu-filters" onSubmit={applyFilters}>
          <label className="acu-wide">Buscar<input placeholder="ID, nome, e-mail ou usuário" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })}/></label>
          <label>Perfil<select value={filters.profile_id} onChange={event => setFilters({ ...filters, profile_id: event.target.value })}><option value="">Todos</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          <label>Aplicação<select value={filters.app_id} onChange={event => setFilters({ ...filters, app_id: event.target.value })}><option value="">Todas</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
          <label>Status do acesso<select value={filters.access_status} onChange={event => setFilters({ ...filters, access_status: event.target.value })}><option value="">Qualquer status</option><option value="active">Ativo</option><option value="blocked">Bloqueado</option><option value="suspended">Suspenso</option><option value="pending">Pendente</option><option value="none">Sem vínculo na aplicação</option></select></label>
          <label>Estabelecimento<select value={filters.has_establishment} onChange={event => setFilters({ ...filters, has_establishment: event.target.value })}><option value="">Todos</option><option value="yes">Possui</option><option value="no">Não possui</option></select></label>
          <label>Atividade desde<input type="date" value={filters.activity_from} onChange={event => setFilters({ ...filters, activity_from: event.target.value })}/></label>
          <label>Atividade até<input type="date" value={filters.activity_to} onChange={event => setFilters({ ...filters, activity_to: event.target.value })}/></label>
          <label>Ordenação<select value={filters.sort} onChange={event => setFilters({ ...filters, sort: event.target.value })}><option value="newest">Mais novos</option><option value="oldest">Mais antigos</option><option value="name">Nome</option><option value="email">E-mail</option></select></label>
          <label>Por página<select value={filters.per_page} onChange={event => setFilters({ ...filters, per_page: event.target.value })}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
          <div className="acu-filter-actions acu-wide"><button className="acu-primary">Aplicar filtros</button><button type="button" className="acu-secondary" onClick={clearFilters}>Limpar</button></div>
        </form>
      </section>
    </div>

    <section className="acu-card acu-table-card">
      <header><div><span>ECOSSISTEMA</span><h3>Todos os usuários</h3><p>{pagination.from && pagination.to ? `Exibindo ${pagination.from}–${pagination.to} de ${pagination.total}` : `${pagination.total || 0} usuários encontrados`}</p></div><button className="acu-secondary" onClick={() => loadUsers(pagination.current_page || 1, filters)} disabled={loading}>↻ Atualizar</button></header>
      {loading ? <div className="acu-loading">Carregando usuários…</div> : users.length ? <div className="acu-table-wrap"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Atividade</th><th>Recursos</th><th>Aplicações</th><th>Ações</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><div className="acu-user"><span>{fullName(user).slice(0, 2).toUpperCase()}</span><div><b>{fullName(user)}</b><small>#{user.id} · {user.email}</small></div></div></td><td><span className="acu-badge">{user.profile?.name || 'Sem perfil'}</span></td><td><b>{dateTime(user.last_activity_at)}</b><small>{user.interactions_count || 0} interações</small></td><td><b>{user.establishments_count || 0}</b><small>estabelecimento(s)</small></td><td><b>{user.applications?.length || 0}</b><small>vínculo(s)</small></td><td><div className="acu-actions"><button onClick={() => openDetail(user.id)}>Detalhes</button><button onClick={() => beginEdit(user)}>Editar</button><button className="acu-danger" disabled={String(user.email || '').toLowerCase() === OWNER_EMAIL || busy} onClick={() => deleteUser(user)}>Excluir</button></div></td></tr>)}</tbody></table></div> : <div className="acu-empty">Nenhum usuário encontrado com os filtros atuais.</div>}
      <footer className="acu-pagination"><span>Página {pagination.current_page || 1} de {pagination.last_page || 1}</span><div><button className="acu-secondary" disabled={!pagination.previous_page || loading} onClick={() => loadUsers(pagination.previous_page, filters)}>← Anterior</button><button className="acu-secondary" disabled={!pagination.next_page || loading} onClick={() => loadUsers(pagination.next_page, filters)}>Próxima →</button></div></footer>
    </section>
  </div>
}
