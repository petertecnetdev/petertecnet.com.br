import { useEffect, useMemo, useState } from 'react'
import './ContextualAccessAdminPage.css'

const API = 'https://api.petertecnet.com.br/api'

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token')
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || Object.values(data?.errors || {}).flat()?.[0] || 'Não foi possível concluir a operação.')
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

const nameOf = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || `Usuário #${user?.id}`
const appName = value => value?.name || value?.slug || 'Global'
const establishmentName = value => value?.fantasy || value?.name || value?.slug || '—'
const resourceName = value => value?.label || `${value?.resource_type || 'recurso'} #${value?.resource_id || '?'}`

export default function ContextualAccessAdminPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [relationshipTypes, setRelationshipTypes] = useState([])
  const [applications, setApplications] = useState([])
  const [establishments, setEstablishments] = useState([])
  const [resourcesByApp, setResourcesByApp] = useState({})
  const [selectedUser, setSelectedUser] = useState(null)
  const [access, setAccess] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [roleForm, setRoleForm] = useState({ role_id: '', application_id: '', establishment_id: '', resource_uuid: '' })
  const [membershipEstablishment, setMembershipEstablishment] = useState('')
  const [relationshipForm, setRelationshipForm] = useState({ application_id: '', relationship_type: 'tenant', resource_uuid: '' })

  async function loadFoundation(userSearch = '') {
    setLoading(true)
    setError('')
    try {
      const suffix = userSearch.trim() ? `?search=${encodeURIComponent(userSearch.trim())}` : ''
      const [userData, catalog, appData, establishmentData] = await Promise.all([
        apiRequest(`/admin/ecosystem/users${suffix}`),
        apiRequest('/admin/ecosystem/access/catalog'),
        apiRequest('/admin/applications'),
        apiRequest('/admin/ecosystem/establishments'),
      ])
      setUsers(userData?.users || [])
      setRoles(catalog?.roles || [])
      setRelationshipTypes(catalog?.relationship_types || [])
      setApplications(appData?.applications || appData || [])
      setEstablishments(establishmentData?.establishments || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadResources(applicationId) {
    const appId = Number(applicationId)
    if (!appId || resourcesByApp[appId]) return
    try {
      const page = await apiRequest(`/admin/ecosystem/access/resources?application_id=${appId}&per_page=100`)
      setResourcesByApp(current => ({ ...current, [appId]: page?.data || [] }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function selectUser(user) {
    setSelectedUser(user)
    setAccess(null)
    setError('')
    setMessage('')
    try {
      setAccess(await apiRequest(`/admin/ecosystem/users/${user.id}/access-contexts`))
    } catch (err) {
      setError(err.message)
    }
  }

  async function refreshAccess() {
    if (!selectedUser) return
    setAccess(await apiRequest(`/admin/ecosystem/users/${selectedUser.id}/access-contexts`))
  }

  async function stepUp() {
    const password = window.prompt('Confirme sua senha para concluir esta ação crítica:')
    if (!password) return null
    const result = await apiRequest('/admin/ecosystem/access/step-up', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    return result?.step_up_token || null
  }

  async function mutate(path, options, success, stepUpToken = null) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(path, {
        ...options,
        headers: { ...(options?.headers || {}), ...(stepUpToken ? { 'X-Peter-Step-Up': stepUpToken } : {}) },
      })
      await refreshAccess()
      setMessage(success)
      return true
    } catch (err) {
      if (err.status === 428 && !stepUpToken) {
        try {
          const token = await stepUp()
          if (token) return await mutate(path, options, success, token)
        } catch (stepError) {
          setError(stepError.message)
          return false
        }
      }
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { loadFoundation() }, [])

  const filteredEstablishments = useMemo(() => {
    const appId = Number(roleForm.application_id)
    if (!appId) return []
    return establishments.filter(establishment => {
      if (Number(establishment.app_id) === appId) return true
      return (establishment.applications || []).some(app => Number(app.id) === appId)
    })
  }, [establishments, roleForm.application_id])

  const roleResources = resourcesByApp[Number(roleForm.application_id)] || []
  const relationshipResources = resourcesByApp[Number(relationshipForm.application_id)] || []

  async function submitRole(event) {
    event.preventDefault()
    if (!selectedUser) return
    const body = {
      role_id: Number(roleForm.role_id),
      application_id: roleForm.application_id ? Number(roleForm.application_id) : null,
      establishment_id: roleForm.establishment_id ? Number(roleForm.establishment_id) : null,
      resource_uuid: roleForm.resource_uuid || null,
    }
    const ok = await mutate(`/admin/ecosystem/users/${selectedUser.id}/role-assignments`, { method: 'POST', body: JSON.stringify(body) }, 'Papel contextual atribuído.')
    if (ok) setRoleForm({ role_id: '', application_id: '', establishment_id: '', resource_uuid: '' })
  }

  async function submitMembership(event) {
    event.preventDefault()
    if (!selectedUser || !membershipEstablishment) return
    const ok = await mutate(`/admin/ecosystem/users/${selectedUser.id}/memberships`, {
      method: 'POST', body: JSON.stringify({ establishment_id: Number(membershipEstablishment) }),
    }, 'Vínculo com estabelecimento atualizado.')
    if (ok) setMembershipEstablishment('')
  }

  async function submitRelationship(event) {
    event.preventDefault()
    if (!selectedUser || !relationshipForm.resource_uuid) return
    const body = {
      relationship_type: relationshipForm.relationship_type,
      resource_uuid: relationshipForm.resource_uuid,
    }
    const ok = await mutate(`/admin/ecosystem/users/${selectedUser.id}/relationships`, { method: 'POST', body: JSON.stringify(body) }, 'Relação de domínio registrada.')
    if (ok) setRelationshipForm(current => ({ ...current, resource_uuid: '' }))
  }

  const snapshot = access?.access || {}
  const relationshipTotal = snapshot.relationship_summary?.total ?? snapshot.relationships?.length ?? 0

  return <main className="context-access-page">
    <header className="context-access-hero">
      <div><p>Governança de identidade</p><h1>Acessos, vínculos e permissões</h1><span>Uma identidade global, múltiplos papéis por aplicação, empresa e recurso.</span></div>
      <div className="context-access-principle"><b>Regra central</b><span>Perfil não define a pessoa. O contexto define o que ela pode fazer.</span></div>
    </header>

    {error && <div className="context-notice error">{error}</div>}
    {message && <div className="context-notice success">{message}</div>}

    <section className="context-access-layout">
      <aside className="context-users-card">
        <form onSubmit={event => { event.preventDefault(); loadFoundation(search) }}>
          <label>Localizar usuário</label>
          <div className="context-search"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, e-mail, username ou ID"/><button>Buscar</button></div>
        </form>
        <div className="context-user-list">
          {loading ? <p>Carregando usuários…</p> : users.map(user => <button key={user.id} className={selectedUser?.id === user.id ? 'active' : ''} onClick={() => selectUser(user)}>
            <span className="context-avatar">{(user.first_name?.[0] || user.user_name?.[0] || 'U').toUpperCase()}</span>
            <span><b>{nameOf(user)}</b><small>{user.email}</small></span>
          </button>)}
        </div>
      </aside>

      <section className="context-workspace">
        {!selectedUser ? <div className="context-empty"><b>Selecione um usuário</b><span>Você verá os papéis por aplicação, vínculos com estabelecimentos e relações com contratos ou outros recursos.</span></div> : <>
          <header className="context-person-header"><div><small>Identidade global #{selectedUser.id}</small><h2>{nameOf(selectedUser)}</h2><span>{selectedUser.email}</span></div><span className="context-legacy-chip">Legado: {access?.legacy?.profile?.name || 'sem perfil único'}</span></header>

          <div className="context-summary-grid">
            <article><span>Papéis contextuais</span><b>{snapshot.roles?.length || 0}</b></article>
            <article><span>Vínculos empresariais</span><b>{snapshot.memberships?.length || 0}</b></article>
            <article><span>Relações com recursos</span><b>{relationshipTotal}</b></article>
          </div>

          {snapshot.relationship_summary?.truncated && <div className="context-notice success">Exibindo as relações mais recentes. O total completo permanece paginado na API.</div>}

          <div className="context-grid-two">
            <section className="context-card"><header><div><b>Papéis contextuais</b><span>Autorização por aplicação, estabelecimento ou recurso registrado.</span></div></header>
              <div className="context-record-list">{snapshot.roles?.length ? snapshot.roles.map(item => <article key={item.assignment_id}>
                <div><b>{item.name}</b><span>{appName(item.application)} · {establishmentName(item.establishment)}</span>{item.resource_type && <small>{item.resource?.label || `${item.resource_type} #${item.resource_id}`}</small>}<small>{item.permissions?.join(' · ') || 'Sem permissões'}</small></div>
                <button disabled={saving} onClick={() => mutate(`/admin/ecosystem/users/${selectedUser.id}/role-assignments/${item.assignment_id}`, { method: 'DELETE' }, 'Papel contextual revogado.')}>Revogar</button>
              </article>) : <p>Nenhum papel contextual cadastrado.</p>}</div>
            </section>

            <section className="context-card"><header><div><b>Adicionar papel</b><span>Estabelecimentos e recursos sempre pertencem a uma aplicação explícita.</span></div></header>
              <form className="context-form" onSubmit={submitRole}>
                <label>Papel<select required value={roleForm.role_id} onChange={event => setRoleForm({...roleForm, role_id:event.target.value})}><option value="">Selecione</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                <label>Aplicação<select value={roleForm.application_id} onChange={event => { const application_id = event.target.value; setRoleForm({...roleForm, application_id, establishment_id:'', resource_uuid:''}); loadResources(application_id) }}><option value="">Global — somente sem empresa/recurso</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
                <label>Estabelecimento<select disabled={!roleForm.application_id} value={roleForm.establishment_id} onChange={event => setRoleForm({...roleForm, establishment_id:event.target.value, resource_uuid:''})}><option value="">Nenhum / toda a aplicação</option>{filteredEstablishments.map(item => <option key={item.id} value={item.id}>{establishmentName(item)}</option>)}</select></label>
                <label>Recurso registrado<select disabled={!roleForm.application_id} value={roleForm.resource_uuid} onChange={event => setRoleForm({...roleForm, resource_uuid:event.target.value})}><option value="">Nenhum recurso específico</option>{roleResources.filter(resource => !roleForm.establishment_id || !resource.establishment_id || Number(resource.establishment_id) === Number(roleForm.establishment_id)).map(resource => <option key={resource.uuid} value={resource.uuid}>{resourceName(resource)}</option>)}</select></label>
                <button className="context-primary" disabled={saving}>Atribuir papel</button>
              </form>
            </section>
          </div>

          <div className="context-grid-two">
            <section className="context-card"><header><div><b>Vínculos com estabelecimentos</b><span>Pertencer à empresa é separado do papel exercido nela.</span></div></header>
              <div className="context-record-list">{snapshot.memberships?.length ? snapshot.memberships.map(item => <article key={item.id}><div><b>{establishmentName(item.establishment)}</b><span>{item.status}</span></div><button disabled={saving} onClick={() => mutate(`/admin/ecosystem/users/${selectedUser.id}/memberships/${item.id}`, { method: 'DELETE' }, 'Vínculo revogado.')}>Revogar</button></article>) : <p>Nenhum vínculo empresarial.</p>}</div>
              <form className="context-form compact" onSubmit={submitMembership}><label>Estabelecimento<select required value={membershipEstablishment} onChange={event => setMembershipEstablishment(event.target.value)}><option value="">Selecione</option>{establishments.map(item => <option key={item.id} value={item.id}>{establishmentName(item)}</option>)}</select></label><button className="context-primary" disabled={saving}>Vincular</button></form>
            </section>

            <section className="context-card"><header><div><b>Relações com recursos</b><span>Escolha uma aplicação, um recurso registrado e uma relação canônica.</span></div></header>
              <div className="context-record-list">{snapshot.relationships?.length ? snapshot.relationships.map(item => <article key={item.id}><div><b>{relationshipTypes.find(type => type.code === item.type)?.name || item.type}</b><span>{appName(item.application)} · {item.resource?.label || `${item.resource_type} #${item.resource_id}`}</span></div><button disabled={saving} onClick={() => mutate(`/admin/ecosystem/users/${selectedUser.id}/relationships/${item.id}`, { method: 'DELETE' }, 'Relação revogada.')}>Revogar</button></article>) : <p>Nenhuma relação de domínio.</p>}</div>
              <form className="context-form" onSubmit={submitRelationship}>
                <label>Aplicação<select required value={relationshipForm.application_id} onChange={event => { const application_id = event.target.value; setRelationshipForm({...relationshipForm, application_id, resource_uuid:''}); loadResources(application_id) }}><option value="">Selecione</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
                <label>Relação<select required value={relationshipForm.relationship_type} onChange={event => setRelationshipForm({...relationshipForm,relationship_type:event.target.value})}>{relationshipTypes.map(type => <option key={type.code} value={type.code}>{type.name}</option>)}</select></label>
                <label>Recurso registrado<select required disabled={!relationshipForm.application_id} value={relationshipForm.resource_uuid} onChange={event => setRelationshipForm({...relationshipForm,resource_uuid:event.target.value})}><option value="">Selecione um recurso</option>{relationshipResources.map(resource => <option key={resource.uuid} value={resource.uuid}>{resourceName(resource)}</option>)}</select></label>
                {relationshipForm.application_id && relationshipResources.length === 0 && <small>Nenhum recurso foi registrado por esta aplicação ainda. O domínio deve registrá-lo na API antes de criar relações.</small>}
                <button className="context-primary" disabled={saving || !relationshipForm.resource_uuid}>Registrar relação</button>
              </form>
            </section>
          </div>
        </>}
      </section>
    </section>
  </main>
}
