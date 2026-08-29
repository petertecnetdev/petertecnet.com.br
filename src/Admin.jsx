import { useEffect, useMemo, useState } from 'react'
import './Admin.css'
import './AdminCentral.css'
import './Login.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'
const emptyApp = { name: '', description: '', slug: '', url: '', logo: '', version: '', author: 'Peter Tecnet', release_date: '', is_active: true }
const emptyUser = { first_name: '', last_name: '', user_name: '', email: '', password: '', profile_id: '', status: 'active' }

const tokenFrom = (data) => data?.token?.access_token || data?.token?.original?.access_token || data?.access_token || data?.token

function ProcessingIndicator({ message = 'Carregando...' }) {
  return <div className="peter-processing" role="status" aria-live="polite"><div className="peter-processing__visual"><i /><i /><img src="/petertecnetlogo.png" alt="" /></div><strong>{message}</strong></div>
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    })
    const data = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (response.status === 401 && path !== '/auth/login') { localStorage.removeItem(TOKEN_KEY); window.location.href = '/login' }
    if (!response.ok) throw new Error(data?.error || data?.message || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a operação.')
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    throw error
  } finally { window.clearTimeout(timeout) }
}

export function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username: form.username.trim(), password: form.password }) })
      const token = tokenFrom(data)
      if (!token) throw new Error('A API não retornou um token de acesso.')
      localStorage.setItem(TOKEN_KEY, token)
      window.location.href = '/admin'
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return <>{loading && <ProcessingIndicator message="Autenticando acesso..." />}<main className="login-page"><div className="login-effects"><i /><i /><span /></div><div className="login-layout">
    <aside className="login-hero"><div><a className="admin-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></a><p className="admin-kicker">Central de administração</p><h1>Controle todo o<br /><em>ecossistema Peter Tecnet.</em></h1><p>Usuários, aplicativos, acessos, perfis, segurança, auditoria e indicadores em um único painel.</p></div>
      <ul><li><b>✓</b><span><strong>Gestão central</strong>Administre usuários e produtos digitais.</span></li><li><b>✓</b><span><strong>Acesso por aplicativo</strong>Autorize ou bloqueie cada usuário individualmente.</span></li><li><b>✓</b><span><strong>Controle e auditoria</strong>Acompanhe ações administrativas e saúde da API.</span></li></ul><small>🔐 Área restrita à administração Peter Tecnet.</small></aside>
    <section className="login-panel"><form className="login-card" onSubmit={submit}><div className="login-logo"><img src="/petertecnetlogo.png" alt="Peter Tecnet" /></div><h2>Painel administrativo</h2><p>Entre com uma conta autorizada.</p>
      <label>Usuário ou e-mail<div className="login-input"><span>✉</span><input autoFocus autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={loading} required /></div></label>
      <label>Senha<div className="login-input"><span>🔒</span><input type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} disabled={loading} required /></div></label>
      {error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button><a className="admin-back" href="/">← Voltar para o site</a>
    </form></section></div></main></>
}

function Metric({ label, value, hint }) {
  return <article className="central-metric"><span>{label}</span><strong>{value ?? '—'}</strong><small>{hint}</small></article>
}

export function AdminPage() {
  const [tab, setTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [apps, setApps] = useState([])
  const [users, setUsers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [audit, setAudit] = useState([])
  const [appForm, setAppForm] = useState(emptyApp)
  const [userForm, setUserForm] = useState(emptyUser)
  const [editingApp, setEditingApp] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [accessApps, setAccessApps] = useState([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(true)

  const metrics = dashboard?.metrics || {}
  const filteredUsers = useMemo(() => users.filter(u => `${u.first_name || ''} ${u.last_name || ''} ${u.user_name || ''} ${u.email || ''}`.toLowerCase().includes(search.toLowerCase())), [users, search])

  async function loadAll() {
    setProcessing(true); setError('')
    try {
      const [dash, appData, userData, profileData, auditData] = await Promise.all([
        request('/admin/dashboard'), request('/admin/applications'), request('/admin/users?per_page=100'), request('/admin/profiles'), request('/admin/audit-logs?per_page=50'),
      ])
      setDashboard(dash); setApps(appData?.applications || []); setUsers(userData?.data || []); setProfiles(profileData?.profiles || []); setAudit(auditData?.data || [])
    } catch (err) { setError(err.message) } finally { setProcessing(false) }
  }

  useEffect(() => { if (!localStorage.getItem(TOKEN_KEY)) window.location.href = '/login'; else loadAll() }, [])

  function notify(text) { setMessage(text); setError(''); window.setTimeout(() => setMessage(''), 3500) }
  function fail(err) { setError(err.message); setProcessing(false) }
  function logout() { localStorage.removeItem(TOKEN_KEY); window.location.href = '/login' }

  async function saveApp(event) {
    event.preventDefault(); setProcessing(true)
    try {
      await request(`/admin/applications${editingApp ? `/${editingApp}` : ''}`, { method: editingApp ? 'PUT' : 'POST', body: JSON.stringify(appForm) })
      setAppForm(emptyApp); setEditingApp(null); notify(editingApp ? 'Aplicativo atualizado.' : 'Aplicativo cadastrado.'); await loadAll()
    } catch (err) { fail(err) }
  }

  function editApp(app) {
    setEditingApp(app.id); setAppForm({ ...emptyApp, ...app, release_date: app.release_date?.slice(0,10) || '' }); setTab('applications'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteApp(app) {
    if (!window.confirm(`Excluir o aplicativo ${app.name}?`)) return
    setProcessing(true); try { await request(`/admin/applications/${app.id}`, { method: 'DELETE' }); notify('Aplicativo excluído.'); await loadAll() } catch (err) { fail(err) }
  }

  async function createUser(event) {
    event.preventDefault(); setProcessing(true)
    try {
      const payload = { ...userForm, profile_id: userForm.profile_id || null }
      await request('/admin/users', { method: 'POST', body: JSON.stringify(payload) })
      setUserForm(emptyUser); notify('Usuário criado com sucesso.'); await loadAll()
    } catch (err) { fail(err) }
  }

  async function changeUserStatus(user, status) {
    const reason = status === 'blocked' ? (window.prompt('Motivo do bloqueio (opcional):') || '') : ''
    setProcessing(true)
    try { await request(`/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }); notify(`Usuário ${status === 'active' ? 'ativado' : 'bloqueado'}.`); await loadAll() } catch (err) { fail(err) }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Excluir definitivamente ${user.first_name || user.user_name}?`)) return
    setProcessing(true); try { await request(`/admin/users/${user.id}`, { method: 'DELETE' }); notify('Usuário excluído.'); await loadAll() } catch (err) { fail(err) }
  }

  async function openAccess(user) {
    setProcessing(true)
    try { const data = await request(`/admin/users/${user.id}/applications`); setSelectedUser(user); setAccessApps(data.applications || []); setTab('access') } catch (err) { fail(err) } finally { setProcessing(false) }
  }

  async function toggleAccess(app, granted) {
    setProcessing(true)
    try {
      await request(`/admin/users/${selectedUser.id}/applications/${app.id}`, { method: 'PUT', body: JSON.stringify({ granted, status: granted ? 'active' : 'blocked', role: app.role || 'user' }) })
      const data = await request(`/admin/users/${selectedUser.id}/applications`); setAccessApps(data.applications || []); notify('Permissão de aplicativo atualizada.')
    } catch (err) { fail(err) } finally { setProcessing(false) }
  }

  const nav = [
    ['dashboard','▦','Visão geral'], ['users','♙','Usuários'], ['applications','◫','Aplicativos'], ['access','⌁','Acessos'], ['profiles','◉','Perfis'], ['audit','≡','Auditoria'], ['system','◌','API & sistema'],
  ]

  return <>{processing && <ProcessingIndicator message="Atualizando central administrativa..." />}<main className="central-shell">
    <aside className="central-sidebar"><a className="central-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><div><strong>Peter Tecnet</strong><span>Admin Center</span></div></a><nav>{nav.map(([id,icon,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><b>{icon}</b>{label}</button>)}</nav><div className="central-sidebar-foot"><a href="/" target="_blank">Abrir site ↗</a><button onClick={logout}>Sair</button></div></aside>

    <section className="central-main"><header className="central-top"><div><p>Peter Tecnet / Administração</p><h1>{nav.find(n => n[0] === tab)?.[2]}</h1></div><div className="central-status"><i /> API conectada</div></header>
      {error && <div className="central-alert error">{error}<button onClick={() => setError('')}>×</button></div>}{message && <div className="central-alert success">{message}</div>}

      {tab === 'dashboard' && <><div className="central-metrics"><Metric label="Usuários" value={metrics.users_total} hint={`${metrics.new_users_30d || 0} novos nos últimos 30 dias`} /><Metric label="Usuários ativos" value={metrics.users_active} hint={`${metrics.users_blocked || 0} bloqueados`} /><Metric label="Aplicativos" value={metrics.applications_total} hint={`${metrics.applications_active || 0} publicados`} /><Metric label="Vínculos de acesso" value={metrics.access_links} hint="usuário × aplicativo" /></div>
        <div className="central-grid"><section className="central-card"><div className="central-card-head"><div><span>Ecossistema</span><h2>Aplicativos</h2></div><button onClick={() => setTab('applications')}>Gerenciar</button></div><div className="central-app-health">{(dashboard?.applications || []).map(app => <article key={app.id}><div><strong>{app.name}</strong><span>{app.url}</span></div><b className={app.is_active ? 'ok' : 'off'}>{app.is_active ? 'Ativo' : 'Oculto'}</b><small>{app.users_count || 0} usuários · {app.establishments_count || 0} empresas · {app.items_count || 0} itens</small></article>)}</div></section>
        <section className="central-card"><div className="central-card-head"><div><span>Atividade</span><h2>Usuários recentes</h2></div><button onClick={() => setTab('users')}>Ver todos</button></div>{(dashboard?.recent_users || []).map(u => <div className="central-person" key={u.id}><div className="avatar">{(u.first_name || u.user_name || '?')[0].toUpperCase()}</div><div><strong>{u.first_name} {u.last_name}</strong><span>{u.email}</span></div><small>{u.profile?.name || 'Sem perfil'}</small></div>)}</section></div></>}

      {tab === 'users' && <div className="central-grid users-grid"><section className="central-card"><div className="central-card-head"><div><span>Cadastro</span><h2>Novo usuário</h2></div></div><form className="central-form" onSubmit={createUser}><input placeholder="Nome" value={userForm.first_name} onChange={e=>setUserForm({...userForm,first_name:e.target.value})} required/><input placeholder="Sobrenome" value={userForm.last_name} onChange={e=>setUserForm({...userForm,last_name:e.target.value})}/><input placeholder="Usuário" value={userForm.user_name} onChange={e=>setUserForm({...userForm,user_name:e.target.value})} required/><input type="email" placeholder="E-mail" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} required/><input type="password" placeholder="Senha inicial" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} required/><select value={userForm.profile_id} onChange={e=>setUserForm({...userForm,profile_id:e.target.value})}><option value="">Sem perfil</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="admin-primary">Criar usuário</button></form></section>
        <section className="central-card central-wide"><div className="central-card-head"><div><span>Diretório</span><h2>Usuários cadastrados</h2></div><input className="central-search" placeholder="Buscar usuário..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="central-table-wrap"><table className="central-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Aplicativos</th><th>Ações</th></tr></thead><tbody>{filteredUsers.map(u=><tr key={u.id}><td><strong>{u.first_name} {u.last_name}</strong><span>{u.email}<br/>@{u.user_name}</span></td><td>{u.profile?.name || '—'}</td><td><b className={`pill ${u.status === 'blocked' ? 'danger' : 'ok'}`}>{u.status || 'active'}</b></td><td>{u.applications?.length || 0}</td><td><div className="table-actions"><button onClick={()=>openAccess(u)}>Acessos</button>{u.status === 'blocked' ? <button onClick={()=>changeUserStatus(u,'active')}>Ativar</button> : <button onClick={()=>changeUserStatus(u,'blocked')}>Bloquear</button>}<button className="danger" onClick={()=>deleteUser(u)}>Excluir</button></div></td></tr>)}</tbody></table></div></section></div>}

      {tab === 'applications' && <div className="central-grid"><section className="central-card"><div className="central-card-head"><div><span>Aplicativos</span><h2>{editingApp ? 'Editar aplicativo' : 'Novo aplicativo'}</h2></div></div><form className="central-form" onSubmit={saveApp}><input placeholder="Nome" value={appForm.name} onChange={e=>setAppForm({...appForm,name:e.target.value})} required/><input placeholder="Slug" value={appForm.slug} onChange={e=>setAppForm({...appForm,slug:e.target.value})}/><input type="url" placeholder="URL" value={appForm.url} onChange={e=>setAppForm({...appForm,url:e.target.value})} required/><input type="url" placeholder="URL da logo" value={appForm.logo} onChange={e=>setAppForm({...appForm,logo:e.target.value})}/><input placeholder="Versão" value={appForm.version} onChange={e=>setAppForm({...appForm,version:e.target.value})}/><input type="date" value={appForm.release_date} onChange={e=>setAppForm({...appForm,release_date:e.target.value})}/><textarea rows="4" placeholder="Descrição" value={appForm.description} onChange={e=>setAppForm({...appForm,description:e.target.value})}/><label className="central-check"><input type="checkbox" checked={appForm.is_active} onChange={e=>setAppForm({...appForm,is_active:e.target.checked})}/> Publicado e ativo</label><div className="table-actions"><button className="admin-primary">{editingApp ? 'Salvar alterações' : 'Cadastrar'}</button>{editingApp && <button type="button" onClick={()=>{setEditingApp(null);setAppForm(emptyApp)}}>Cancelar</button>}</div></form></section><section className="central-card"><div className="central-card-head"><div><span>Portfólio</span><h2>Aplicativos cadastrados</h2></div></div><div className="central-app-list">{apps.map(app=><article key={app.id}><img src={app.logo || `${app.url.replace(/\/$/,'')}/logo`} alt=""/><div><strong>{app.name}</strong><span>{app.url}</span><small>v{app.version || '—'} · {app.is_active ? 'Ativo' : 'Oculto'}</small></div><button onClick={()=>editApp(app)}>Editar</button><button className="danger" onClick={()=>deleteApp(app)}>Excluir</button></article>)}</div></section></div>}

      {tab === 'access' && <section className="central-card"><div className="central-card-head"><div><span>Controle de acesso</span><h2>{selectedUser ? `Aplicativos de ${selectedUser.first_name || selectedUser.user_name}` : 'Selecione um usuário'}</h2></div><button onClick={()=>setTab('users')}>Escolher usuário</button></div>{!selectedUser ? <div className="central-empty">Abra a aba Usuários e clique em “Acessos”.</div> : <div className="access-grid">{accessApps.map(app=><article key={app.id}><div><strong>{app.name}</strong><span>{app.url}</span></div><b className={`pill ${app.granted && app.status === 'active' ? 'ok' : 'danger'}`}>{app.granted ? app.status : 'sem acesso'}</b><button className={app.granted ? 'danger' : 'admin-primary'} onClick={()=>toggleAccess(app,!app.granted)}>{app.granted ? 'Revogar acesso' : 'Liberar acesso'}</button></article>)}</div>}</section>}

      {tab === 'profiles' && <section className="central-card"><div className="central-card-head"><div><span>RBAC</span><h2>Perfis e permissões</h2></div></div><div className="profile-grid">{profiles.map(p=><article key={p.id}><strong>{p.name}</strong><span>{p.users_count || 0} usuários</span><div>{(p.permissions || []).length ? p.permissions.map(x=><small key={x}>{x}</small>) : <small>Sem permissões configuradas</small>}</div></article>)}</div></section>}

      {tab === 'audit' && <section className="central-card"><div className="central-card-head"><div><span>Governança</span><h2>Auditoria administrativa</h2></div></div><div className="central-table-wrap"><table className="central-table"><thead><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>Administrador</th><th>IP</th></tr></thead><tbody>{audit.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('pt-BR')}</td><td><strong>{row.action}</strong></td><td>{row.entity_type || '—'} #{row.entity_id || '—'}</td><td>#{row.actor_user_id || '—'}</td><td>{row.ip || '—'}</td></tr>)}</tbody></table></div></section>}

      {tab === 'system' && <div className="central-metrics"><Metric label="API" value={dashboard?.api?.status || '—'} hint="api.petertecnet.com.br"/><Metric label="Banco de dados" value={dashboard?.api?.database || '—'} hint="conexão principal"/><Metric label="Ambiente" value={dashboard?.api?.environment || '—'} hint={`Laravel ${dashboard?.api?.laravel || ''}`}/><Metric label="Servidor" value={dashboard?.api?.server_time ? new Date(dashboard.api.server_time).toLocaleTimeString('pt-BR') : '—'} hint="horário reportado pela API"/></div>}
    </section>
  </main></>
}
