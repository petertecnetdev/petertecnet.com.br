import { useEffect, useMemo, useState } from 'react'
import './Admin.css'
import './Login.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'
const TABS = [
  ['dashboard', 'Visão geral'], ['applications', 'Aplicações'], ['users', 'Usuários'], ['profiles', 'Perfis e permissões'],
  ['establishments', 'Estabelecimentos'], ['site', 'Site institucional'], ['audit', 'Auditoria'],
]
const emptyApp = { name: '', description: '', slug: '', url: '', logo: '', version: '', author: 'Peter Tecnet', release_date: '', is_active: true }
const emptyUser = { first_name: '', last_name: '', user_name: '', email: '', password: '', profile_id: '' }
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
      localStorage.setItem(TOKEN_KEY, token); window.location.href = '/admin'
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return <>{loading && <ProcessingIndicator message="Autenticando acesso..." />}<main className="login-page"><div className="login-effects"><i /><i /><span /></div><div className="login-layout">
    <aside className="login-hero"><div><a className="admin-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></a><p className="admin-kicker">Central de governança</p><h1>Controle todo o<br /><em>ecossistema digital.</em></h1><p>Aplicações, usuários, acessos, perfis, estabelecimentos, conteúdo institucional e auditoria em um único painel.</p></div><small>🔐 Acesso administrativo protegido pela API Peter Tecnet.</small></aside>
    <section className="login-panel"><form className="login-card" onSubmit={submit}><div className="login-logo"><img src="/petertecnetlogo.png" alt="Peter Tecnet" /></div><h2>Acesso administrativo</h2><p>Entre para administrar o ecossistema Peter Tecnet.</p><label>Usuário ou e-mail<div className="login-input"><span>✉</span><input autoFocus autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></div></label><label>Senha<div className="login-input"><span>🔒</span><input type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={loading}>Entrar</button><a className="admin-back" href="/">← Voltar para o site</a></form></section>
  </div></main></>
}

export function AdminPage() {
  const [tab, setTab] = useState('dashboard')
  const [data, setData] = useState({})
  const [processing, setProcessing] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load(target = tab) {
    setProcessing(true); setError('')
    try {
      const paths = {
        dashboard: '/admin/ecosystem/dashboard', applications: '/admin/applications', users: '/admin/ecosystem/users',
        profiles: '/admin/ecosystem/profiles', establishments: '/admin/ecosystem/establishments', site: '/admin/ecosystem/settings', audit: '/admin/ecosystem/audit',
      }
      const result = await request(paths[target])
      setData(prev => ({ ...prev, [target]: result }))
    } catch (err) { setError(err.message) } finally { setProcessing(false) }
  }

  useEffect(() => { if (!localStorage.getItem(TOKEN_KEY)) window.location.href = '/login'; else load('dashboard') }, [])
  useEffect(() => { if (localStorage.getItem(TOKEN_KEY) && !data[tab]) load(tab) }, [tab])

  async function mutate(path, options, success, reload = tab) {
    setProcessing(true); setError(''); setMessage('')
    try { await request(path, options); setMessage(success); await load(reload); if (reload !== 'dashboard') setData(prev => ({ ...prev, dashboard: undefined })) }
    catch (err) { setError(err.message); setProcessing(false) }
  }

  function logout() { localStorage.removeItem(TOKEN_KEY); window.location.href = '/login' }
  const counts = data.dashboard?.summary || {}

  return <>{processing && <ProcessingIndicator message="Atualizando ecossistema..." />}<main className="ecosystem-shell">
    <aside className="ecosystem-sidebar">
      <a className="admin-brand ecosystem-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span><b>Peter Tecnet</b><small>Governança</small></span></a>
      <nav>{TABS.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setMessage(''); setError('') }}>{label}</button>)}</nav>
      <div className="sidebar-foot"><a href="/" target="_blank">Abrir site ↗</a><button onClick={logout}>Sair</button></div>
    </aside>
    <section className="ecosystem-main">
      <header className="ecosystem-top"><div><p className="admin-kicker">Peter Tecnet Control Center</p><h1>{TABS.find(x => x[0] === tab)?.[1]}</h1></div><button onClick={() => load(tab)}>Atualizar</button></header>
      {error && <div className="notice error">{error}</div>}{message && <div className="notice success">{message}</div>}
      {tab === 'dashboard' && <Dashboard summary={counts} payload={data.dashboard} />}
      {tab === 'applications' && <Applications payload={data.applications} mutate={mutate} />}
      {tab === 'users' && <Users payload={data.users} profiles={data.profiles} applications={data.applications} setTab={setTab} load={load} mutate={mutate} />}
      {tab === 'profiles' && <Profiles payload={data.profiles} mutate={mutate} />}
      {tab === 'establishments' && <Establishments payload={data.establishments} applications={data.applications} setTab={setTab} load={load} mutate={mutate} />}
      {tab === 'site' && <SiteSettings payload={data.site} mutate={mutate} />}
      {tab === 'audit' && <Audit payload={data.audit} />}
    </section>
  </main></>
}

function Dashboard({ summary, payload }) {
  const cards = [['Aplicações', summary.applications, `${summary.active_applications || 0} ativas`], ['Usuários', summary.users, `${summary.access_links || 0} vínculos de acesso`], ['Perfis', summary.profiles, 'papéis e permissões'], ['Estabelecimentos', summary.establishments, `${summary.approved_establishments || 0} aprovados`]]
  return <div className="admin-stack"><div className="metric-grid">{cards.map(([label, value, sub]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value ?? '—'}</strong><small>{sub}</small></article>)}</div>
    <div className="admin-grid"><Panel title="Saúde das aplicações"><div className="table-wrap"><table><thead><tr><th>Aplicação</th><th>Usuários</th><th>Estabelecimentos</th><th>Itens</th></tr></thead><tbody>{payload?.applications?.map(app => <tr key={app.id}><td><b>{app.name}</b></td><td>{app.users_count}</td><td>{app.establishments_count}</td><td>{app.items_count}</td></tr>)}</tbody></table></div></Panel><Panel title="Atividade administrativa">{payload?.recent_audit?.length ? payload.recent_audit.map(log => <div className="activity" key={log.id}><b>{log.action}</b><span>{log.user?.email || 'Sistema'} · {new Date(log.created_at).toLocaleString('pt-BR')}</span></div>) : <Empty />}</Panel></div>
  </div>
}

function Applications({ payload, mutate }) {
  const [form, setForm] = useState(emptyApp); const [editing, setEditing] = useState(null)
  const apps = payload?.applications || []
  function edit(app) { setEditing(app.id); setForm({ ...emptyApp, ...app, release_date: app.release_date?.slice(0, 10) || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function submit(e) { e.preventDefault(); mutate(`/admin/applications${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) }, editing ? 'Aplicação atualizada.' : 'Aplicação cadastrada.', 'applications'); setEditing(null); setForm(emptyApp) }
  return <div className="admin-grid"><Panel title={editing ? 'Editar aplicação' : 'Nova aplicação'}><form onSubmit={submit} className="form-grid"><Field label="Nome" value={form.name} onChange={v => setForm({ ...form, name: v })} required /><Field label="Slug" value={form.slug} onChange={v => setForm({ ...form, slug: v })} /><Field label="URL" value={form.url} onChange={v => setForm({ ...form, url: v })} wide required /><Field label="Logo" value={form.logo} onChange={v => setForm({ ...form, logo: v })} wide /><Field label="Versão" value={form.version} onChange={v => setForm({ ...form, version: v })} /><Field label="Autor" value={form.author} onChange={v => setForm({ ...form, author: v })} /><label className="wide">Descrição<textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label className="check wide"><input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Aplicação ativa e visível</label><div className="form-actions wide"><button className="primary">Salvar</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyApp) }}>Cancelar</button>}</div></form></Panel>
    <Panel title="Aplicações cadastradas">{apps.map(app => <div className="entity-row" key={app.id}><img src={app.logo || '/petertecnetlogo.png'} alt="" /><div><b>{app.name}</b><span>{app.url}</span></div><i className={app.is_active ? 'status on' : 'status'}>{app.is_active ? 'Ativa' : 'Oculta'}</i><button onClick={() => edit(app)}>Editar</button><button className="danger" onClick={() => window.confirm(`Excluir ${app.name}?`) && mutate(`/admin/applications/${app.id}`, { method: 'DELETE' }, 'Aplicação excluída.', 'applications')}>Excluir</button></div>)}</Panel></div>
}

function Users({ payload, profiles, applications, setTab, load, mutate }) {
  const [form, setForm] = useState(emptyUser); const [editing, setEditing] = useState(null)
  const users = payload?.users || []
  useEffect(() => { if (!profiles) load('profiles'); if (!applications) load('applications') }, [])
  function submit(e) { e.preventDefault(); const body = { ...form, profile_id: form.profile_id || null }; if (editing) delete body.password; mutate(`/admin/ecosystem/users${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) }, editing ? 'Usuário atualizado.' : 'Usuário criado.', 'users'); setEditing(null); setForm(emptyUser) }
  function edit(user) { setEditing(user.id); setForm({ first_name: user.first_name || '', last_name: user.last_name || '', user_name: user.user_name || '', email: user.email || '', password: '', profile_id: user.profile_id || '' }) }
  function access(user, app) { const current = user.applications?.find(a => a.id === app.id); const status = current?.pivot?.status === 'active' ? 'blocked' : 'active'; mutate(`/admin/ecosystem/users/${user.id}/applications/${app.id}`, { method: 'PUT', body: JSON.stringify({ status, role: current?.pivot?.role || 'member' }) }, `${app.name}: acesso ${status === 'active' ? 'liberado' : 'bloqueado'}.`, 'users') }
  return <div className="admin-grid"><Panel title={editing ? 'Editar usuário' : 'Novo usuário'}><form onSubmit={submit} className="form-grid"><Field label="Nome" value={form.first_name} onChange={v => setForm({ ...form, first_name: v })} required /><Field label="Sobrenome" value={form.last_name} onChange={v => setForm({ ...form, last_name: v })} /><Field label="Usuário" value={form.user_name} onChange={v => setForm({ ...form, user_name: v })} required /><Field label="E-mail" value={form.email} onChange={v => setForm({ ...form, email: v })} required /><label className="wide">Perfil<select value={form.profile_id} onChange={e => setForm({ ...form, profile_id: e.target.value })}><option value="">Sem perfil</option>{profiles?.profiles?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{!editing && <Field label="Senha inicial" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} wide required />}<div className="form-actions wide"><button className="primary">Salvar usuário</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyUser) }}>Cancelar</button>}</div></form></Panel><Panel title={`Usuários (${users.length})`}>{users.map(user => <article className="user-card" key={user.id}><div className="user-head"><div><b>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.user_name}</b><span>{user.email} · {user.profile?.name || 'Sem perfil'}</span></div><div><button onClick={() => edit(user)}>Editar</button><button className="danger" onClick={() => window.confirm(`Excluir ${user.email}?`) && mutate(`/admin/ecosystem/users/${user.id}`, { method: 'DELETE' }, 'Usuário excluído.', 'users')}>Excluir</button></div></div><div className="access-grid">{applications?.applications?.map(app => { const link = user.applications?.find(a => a.id === app.id); const active = link?.pivot?.status === 'active'; return <button key={app.id} className={active ? 'access active' : 'access'} onClick={() => access(user, app)}><b>{app.name}</b><small>{link ? (active ? 'Permitido' : link.pivot.status) : 'Sem vínculo'}</small></button> })}</div></article>)}</Panel></div>
}

function Profiles({ payload, mutate }) {
  const [selected, setSelected] = useState(null); const [name, setName] = useState(''); const [permissions, setPermissions] = useState([])
  const profiles = payload?.profiles || []; const available = payload?.permissions || []
  function choose(p) { setSelected(p.id); setName(p.name); setPermissions(p.permissions || []) }
  function create() { setSelected('new'); setName(''); setPermissions([]) }
  function save(e) { e.preventDefault(); mutate(`/admin/ecosystem/profiles${selected && selected !== 'new' ? `/${selected}` : ''}`, { method: selected && selected !== 'new' ? 'PUT' : 'POST', body: JSON.stringify({ name, permissions }) }, 'Perfil salvo.', 'profiles') }
  return <div className="admin-grid"><Panel title="Perfis"><button className="primary compact" onClick={create}>+ Novo perfil</button>{profiles.map(p => <button className={`profile-row ${selected === p.id ? 'active' : ''}`} key={p.id} onClick={() => choose(p)}><span><b>{p.name}</b><small>{p.users_count} usuários</small></span><i>{p.permissions?.length || 0} permissões</i></button>)}</Panel><Panel title="Permissões do perfil">{selected ? <form onSubmit={save}><Field label="Nome do perfil" value={name} onChange={setName} required /><div className="permission-list">{available.map(p => <label key={p.key}><input type="checkbox" checked={permissions.includes(p.key)} onChange={e => setPermissions(e.target.checked ? [...permissions, p.key] : permissions.filter(x => x !== p.key))} /><span><b>{p.name}</b><small>{p.category} · {p.description}</small></span></label>)}</div><button className="primary">Salvar perfil e permissões</button></form> : <Empty text="Selecione ou crie um perfil." />}</Panel></div>
}

function Establishments({ payload, applications, load, mutate }) {
  const rows = payload?.establishments || []
  useEffect(() => { if (!applications) load('applications') }, [])
  function patch(item, changes) { mutate(`/admin/ecosystem/establishments/${item.id}`, { method: 'PUT', body: JSON.stringify(changes) }, 'Estabelecimento atualizado.', 'establishments') }
  return <Panel title={`Estabelecimentos (${rows.length})`}><div className="table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Aplicação</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><b>{item.fantasy || item.name}</b><small>{item.city}{item.uf ? `/${item.uf}` : ''}</small></td><td><select value={item.app_id || ''} onChange={e => patch(item, { app_id: e.target.value ? Number(e.target.value) : null })}><option value="">Sem aplicação</option>{applications?.applications?.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></td><td>{item.user?.email || '—'}</td><td><span className={item.is_approved ? 'status on' : 'status'}>{item.is_approved ? 'Aprovado' : 'Pendente'}</span></td><td className="row-actions"><button onClick={() => patch(item, { is_approved: !item.is_approved })}>{item.is_approved ? 'Retirar aprovação' : 'Aprovar'}</button><button onClick={() => patch(item, { is_published: !item.is_published })}>{item.is_published ? 'Ocultar' : 'Publicar'}</button></td></tr>)}</tbody></table></div></Panel>
}

function SiteSettings({ payload, mutate }) {
  const [site, setSite] = useState(payload?.site || {})
  useEffect(() => { if (payload?.site) setSite(payload.site) }, [payload])
  const hero = site.hero || {}; const contact = site.contact || {}; const navigation = site.navigation || []
  function save(e) { e.preventDefault(); mutate('/admin/ecosystem/settings', { method: 'PUT', body: JSON.stringify({ site }) }, 'Site institucional atualizado.', 'site') }
  return <form onSubmit={save} className="admin-stack"><Panel title="Menu principal"><div className="menu-editor">{navigation.map((item, index) => <div key={index}><input value={item.label || ''} onChange={e => { const n = [...navigation]; n[index] = { ...item, label: e.target.value }; setSite({ ...site, navigation: n }) }} /><input value={item.href || ''} onChange={e => { const n = [...navigation]; n[index] = { ...item, href: e.target.value }; setSite({ ...site, navigation: n }) }} /><button type="button" className="danger" onClick={() => setSite({ ...site, navigation: navigation.filter((_, i) => i !== index) })}>×</button></div>)}<button type="button" onClick={() => setSite({ ...site, navigation: [...navigation, { label: 'Novo item', href: '#' }] })}>+ Adicionar item</button></div></Panel><div className="admin-grid"><Panel title="Hero / abertura"><div className="form-grid"><Field label="Chamada" value={hero.eyebrow || ''} onChange={v => setSite({ ...site, hero: { ...hero, eyebrow: v } })} wide /><Field label="Título" value={hero.title || ''} onChange={v => setSite({ ...site, hero: { ...hero, title: v } })} wide /><label className="wide">Descrição<textarea rows="4" value={hero.description || ''} onChange={e => setSite({ ...site, hero: { ...hero, description: e.target.value } })} /></label><Field label="Botão principal" value={hero.primary_label || ''} onChange={v => setSite({ ...site, hero: { ...hero, primary_label: v } })} /><Field label="Destino" value={hero.primary_href || ''} onChange={v => setSite({ ...site, hero: { ...hero, primary_href: v } })} /></div></Panel><Panel title="Contato"><div className="form-grid"><Field label="Chamada" value={contact.kicker || ''} onChange={v => setSite({ ...site, contact: { ...contact, kicker: v } })} wide /><Field label="Título" value={contact.title || ''} onChange={v => setSite({ ...site, contact: { ...contact, title: v } })} wide /><label className="wide">Descrição<textarea rows="4" value={contact.description || ''} onChange={e => setSite({ ...site, contact: { ...contact, description: e.target.value } })} /></label><Field label="E-mail" value={contact.email || ''} onChange={v => setSite({ ...site, contact: { ...contact, email: v } })} /><Field label="Instagram" value={contact.instagram || ''} onChange={v => setSite({ ...site, contact: { ...contact, instagram: v } })} /></div></Panel></div><button className="primary save-site">Publicar alterações do site</button></form>
}

function Audit({ payload }) {
  const logs = payload?.logs || []
  return <Panel title={`Histórico administrativo (${logs.length})`}><div className="table-wrap"><table><thead><tr><th>Data</th><th>Administrador</th><th>Ação</th><th>Entidade</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString('pt-BR')}</td><td>{log.user?.email || 'Sistema'}</td><td><b>{log.action}</b></td><td>{log.entity_type?.split('\\').pop() || '—'} {log.entity_id || ''}</td></tr>)}</tbody></table></div></Panel>
}

function Panel({ title, children }) { return <section className="admin-panel"><div className="panel-title"><h2>{title}</h2></div>{children}</section> }
function Field({ label, value, onChange, wide, type = 'text', required }) { return <label className={wide ? 'wide' : ''}>{label}<input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} /></label> }
function Empty({ text = 'Nenhum registro encontrado.' }) { return <p className="admin-empty">{text}</p> }
