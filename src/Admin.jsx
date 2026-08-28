import { useEffect, useState } from 'react'
import './Admin.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'
const emptyForm = { name: '', description: '', slug: '', url: '', logo: '', version: '', author: 'Peter Tecnet', release_date: '', is_active: true }

const tokenFrom = (data) => data?.token?.access_token || data?.token?.original?.access_token || data?.access_token || data?.token

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (response.status === 401) { localStorage.removeItem(TOKEN_KEY); window.location.href = '/login' }
  if (!response.ok) throw new Error(data?.message || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a operação.')
  return data
}

export function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(form) })
      const token = tokenFrom(data)
      if (!token) throw new Error('A API não retornou um token de acesso.')
      localStorage.setItem(TOKEN_KEY, token)
      window.location.href = '/admin'
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return <main className="admin-auth"><form className="admin-card login-card" onSubmit={submit}>
    <a className="admin-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></a>
    <p className="admin-kicker">Área administrativa</p><h1>Entrar no painel</h1>
    <label>Usuário ou e-mail<input autoFocus value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></label>
    <label>Senha<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
    {error && <p className="admin-error">{error}</p>}
    <button className="admin-primary" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
    <a className="admin-back" href="/">← Voltar para o site</a>
  </form></main>
}

export function AdminPage() {
  const [apps, setApps] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try { const data = await request('/admin/applications'); setApps(data.applications || []) }
    catch (err) { setError(err.message) }
  }
  useEffect(() => { if (!localStorage.getItem(TOKEN_KEY)) window.location.href = '/login'; else load() }, [])

  function edit(app) {
    setEditing(app.id); setForm({ ...emptyForm, ...app, release_date: app.release_date?.slice(0, 10) || '', logo: app.logo || '' }); setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function reset() { setEditing(null); setForm(emptyForm) }
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      await request(`/admin/applications${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) })
      setMessage(editing ? 'Aplicação atualizada.' : 'Aplicação cadastrada.'); reset(); await load()
    } catch (err) { setError(err.message) }
  }
  async function remove(app) {
    if (!window.confirm(`Excluir ${app.name}?`)) return
    try { await request(`/admin/applications/${app.id}`, { method: 'DELETE' }); await load() } catch (err) { setError(err.message) }
  }
  function logout() { localStorage.removeItem(TOKEN_KEY); window.location.href = '/login' }

  return <main className="admin-shell"><header className="admin-header"><a className="admin-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></a><div><a href="/" target="_blank">Ver site ↗</a><button onClick={logout}>Sair</button></div></header>
    <div className="admin-layout"><section className="admin-card admin-form"><p className="admin-kicker">Aplicações</p><h1>{editing ? 'Editar aplicação' : 'Nova aplicação'}</h1>
      <form onSubmit={submit}><div className="admin-fields"><label>Nome<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label><label>Slug<input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="Gerado pelo nome" /></label>
      <label className="wide">Endereço da aplicação<input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://app.petertecnet.com.br" required /></label>
      <label className="wide">URL da logo<input type="url" value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} placeholder="Vazio usa o endereço da aplicação + /logo" /></label>
      <label>Versão<input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} /></label><label>Data de lançamento<input type="date" value={form.release_date} onChange={e => setForm({ ...form, release_date: e.target.value })} /></label>
      <label>Autor<input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} /></label><label className="check"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Exibir na landing page</label>
      <label className="wide">Descrição<textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div>
      {error && <p className="admin-error">{error}</p>}{message && <p className="admin-success">{message}</p>}<div className="admin-actions"><button className="admin-primary">{editing ? 'Salvar alterações' : 'Cadastrar aplicação'}</button>{editing && <button type="button" onClick={reset}>Cancelar</button>}</div></form>
    </section>
    <section className="admin-card admin-list"><div><p className="admin-kicker">Catálogo</p><h2>Aplicações cadastradas</h2></div>{apps.length === 0 ? <p className="admin-empty">Nenhuma aplicação cadastrada.</p> : apps.map(app => <article key={app.id}><img src={app.logo || `${app.url.replace(/\/$/, '')}/logo`} alt="" /><div><strong>{app.name}</strong><span>{app.is_active ? 'Visível' : 'Oculta'} · {app.url}</span></div><button onClick={() => edit(app)}>Editar</button><button className="danger" onClick={() => remove(app)}>Excluir</button></article>)}</section></div>
  </main>
}
