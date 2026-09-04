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
  if (!response.ok) throw new Error(data?.message || data?.error || Object.values(data?.errors || {}).flat()?.[0] || 'Não foi possível concluir a operação.')
  return data
}

const nameOf = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || `Usuário #${user?.id}`
const appName = value => value?.name || value?.slug || 'Global'
const establishmentName = value => value?.fantasy || value?.name || value?.slug || '—'

export default function ContextualAccessAdminPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [applications, setApplications] = useState([])
  const [establishments, setEstablishments] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [access, setAccess] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [roleForm, setRoleForm] = useState({ role_id: '', application_id: '', establishment_id: '', resource_type: '', resource_id: '' })
  const [membershipEstablishment, setMembershipEstablishment] = useState('')
  const [relationshipForm, setRelationshipForm] = useState({ application_id: '', relationship_type: 'tenant', resource_type: 'agreement', resource_id: '' })

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
      setApplications(appData?.applications || appData || [])
      setEstablishments(establishmentData?.establishments || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

  async function mutate(path, options, success) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(path, options)
      await refreshAccess()
      setMessage(success)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { loadFoundation() }, [])

  const filteredEstablishments = useMemo(() => {
    const appId = Number(roleForm.application_id)
    if (!appId) return establishments
    return establishments.filter(establishment => {
      if (Number(establishment.app_id) === appId) return true
      return (establishment.applications || []).some(app => Number(app.id) === appId)
    })
  }, [establishments, roleForm.application_id])

  async function submitRole(event) {
    event.preventDefault()
    if (!selectedUser) return
    const body = {
      role_id: Number(roleForm.role_id),
      application_id: roleForm.application_id ? Number(roleForm.application_id) : null,
      establishment_id: roleForm.establishment_id ? Number(roleForm.establishment_id) : null,
      resource_type: roleForm.resource_type.trim() || null,
      resource_id: roleForm.resource_id ? Number(roleForm.resource_id) : null,
    }
    const ok = await mutate(`/admin/ecosystem/users/${selectedUser.id}/role-assignments`, { method: 'POST', body: JSON.stringify(body) }, 'Papel contextual atribuído.')
    if (ok) setRoleForm({ role_id: '', application_id: '', establishment_id: '', resource_type: '', resource_id: '' })
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
    if (!selectedUser) return
    const body = {
      application_id: relationshipForm.application_id ? Number(relationshipForm.application_id) : null,
      relationship_type: relationshipForm.relationship_type.trim(),
      resource_type: relationshipForm.resource_type.trim(),
      resource_id: Number(relationshipForm.resource_id),
    }
    const ok = await mutate(`/admin/ecosystem/users/${selectedUser.id}/relationships`, { method: 'POST', body: JSON.stringify(body) }, 'Relação de domínio registrada.')
    if (ok) setRelationshipForm(current => ({ ...current, resource_id: '' }))
  }

  const snapshot = access?.access || {}

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
            <article><span>Relações com recursos</span><b>{snapshot.relationships?.length || 0}</b></article>
          </div>

          <div className="context-grid-two">
            <section className="context-card"><header><div><b>Papéis contextuais</b><span>Autorização por aplicação, estabelecimento ou recurso.</span></div></header>
              <div className="context-record-list">{snapshot.roles?.length ? snapshot.roles.map(item => <article key={item.assignment_id}>
                <div><b>{item.name}</b><span>{appName(item.application)} · {establishmentName(item.establishment)}</span>{item.resource_type && <small>{item.resource_type} #{item.resource_id}</small>}<small>{item.permissions?.join(' · ') || 'Sem permissões'}</small></div>
                <button disabled={saving} onClick={() => mutate(`/admin/ecosystem/users/${selectedUser.id}/role-assignments/${item.assignment_id}`, { method: 'DELETE' }, 'Papel contextual revogado.')}>Revogar</button>
              </article>) : <p>Nenhum papel contextual cadastrado.</p>}</div>
            </section>

            <section className="context-card"><header><div><b>Adicionar papel</b><span>O mesmo usuário pode acumular vários papéis.</span></div></header>
              <form className="context-form" onSubmit={submitRole}>
                <label>Papel<select required value={roleForm.role_id} onChange={event => setRoleForm({...roleForm, role_id:event.target.value})}><option value="">Selecione</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                <label>Aplicação<select value={roleForm.application_id} onChange={event => setRoleForm({...roleForm, application_id:event.target.value, establishment_id:''})}><option value="">Global</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
                <label>Estabelecimento<select value={roleForm.establishment_id} onChange={event => setRoleForm({...roleForm, establishment_id:event.target.value})}><option value="">Todos / nenhum</option>{filteredEstablishments.map(item => <option key={item.id} value={item.id}>{establishmentName(item)}</option>)}</select></label>
                <div className="context-inline"><label>Recurso<input value={roleForm.resource_type} onChange={event => setRoleForm({...roleForm, resource_type:event.target.value})} placeholder="agreement"/></label><label>ID<input type="number" min="1" value={roleForm.resource_id} onChange={event => setRoleForm({...roleForm, resource_id:event.target.value})}/></label></div>
                <button className="context-primary" disabled={saving}>Atribuir papel</button>
              </form>
            </section>
          </div>

          <div className="context-grid-two">
            <section className="context-card"><header><div><b>Vínculos com estabelecimentos</b><span>Pertencer à empresa é separado do papel exercido nela.</span></div></header>
              <div className="context-record-list">{snapshot.memberships?.length ? snapshot.memberships.map(item => <article key={item.id}><div><b>{establishmentName(item.establishment)}</b><span>{item.status}</span></div><button disabled={saving} onClick={() => mutate(`/admin/ecosystem/users/${selectedUser.id}/memberships/${item.id}`, { method: 'DELETE' }, 'Vínculo revogado.')}>Revogar</button></article>) : <p>Nenhum vínculo empresarial.</p>}</div>
              <form className="context-form compact" onSubmit={submitMembership}><label>Estabelecimento<select required value={membershipEstablishment} onChange={event => setMembershipEstablishment(event.target.value)}><option value="">Selecione</option>{establishments.map(item => <option key={item.id} value={item.id}>{establishmentName(item)}</option>)}</select></label><button className="context-primary" disabled={saving}>Vincular</button></form>
            </section>

            <section className="context-card"><header><div><b>Relações com recursos</b><span>Locatário, locador, fiador e outras relações de negócio não viram perfil global.</span></div></header>
              <div className="context-record-list">{snapshot.relationships?.length ? snapshot.relationships.map(item => <article key={item.id}><div><b>{item.type}</b><span>{appName(item.application)} · {item.resource_type} #{item.resource_id}</span></div><button disabled={saving} onClick={() => mutate(`/admin/ecosystem/users/${selectedUser.id}/relationships/${item.id}`, { method: 'DELETE' }, 'Relação revogada.')}>Revogar</button></article>) : <p>Nenhuma relação de domínio.</p>}</div>
              <form className="context-form" onSubmit={submitRelationship}><label>Aplicação<select value={relationshipForm.application_id} onChange={event => setRelationshipForm({...relationshipForm,application_id:event.target.value})}><option value="">Sem aplicação específica</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><label>Relação<input required value={relationshipForm.relationship_type} onChange={event => setRelationshipForm({...relationshipForm,relationship_type:event.target.value})} placeholder="tenant, landlord, guarantor"/></label><div className="context-inline"><label>Tipo de recurso<input required value={relationshipForm.resource_type} onChange={event => setRelationshipForm({...relationshipForm,resource_type:event.target.value})}/></label><label>ID<input required type="number" min="1" value={relationshipForm.resource_id} onChange={event => setRelationshipForm({...relationshipForm,resource_id:event.target.value})}/></label></div><button className="context-primary" disabled={saving}>Registrar relação</button></form>
            </section>
          </div>
        </>}
      </section>
    </section>
  </main>
}
