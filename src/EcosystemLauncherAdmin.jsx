import { useEffect, useMemo, useState } from 'react'
import './EcosystemLauncherAdmin.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEYS = ['petertecnet_admin_token', 'token', 'petertecnet_token']
const STATUS_OPTIONS = [
  ['operational', 'Operacional'],
  ['degraded', 'Instável'],
  ['maintenance', 'Manutenção'],
  ['down', 'Indisponível'],
]

const token = () => TOKEN_KEYS.map(key => localStorage.getItem(key)).find(Boolean) || ''

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...options.headers,
    },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || Object.values(data?.errors || {}).flat()?.[0] || 'Não foi possível concluir a operação.')
  return data
}

const normalize = application => ({
  ...application,
  launcher_order: Number(application.launcher_order ?? 100),
  category: application.category || '',
  is_visible: application.is_visible !== false,
  is_default: Boolean(application.is_default),
  self_service_access: Boolean(application.self_service_access),
  operational_status: application.operational_status || 'operational',
  maintenance_message: application.maintenance_message || '',
  ecosystem_sdk_version: application.ecosystem_sdk_version || '2.0.0',
})

const sortApplications = rows => [...rows].sort((a, b) =>
  Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) ||
  Number(a.launcher_order || 0) - Number(b.launcher_order || 0) ||
  String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
)

export default function EcosystemLauncherAdmin() {
  const [applications, setApplications] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const payload = await request('/admin/applications')
      const rows = sortApplications((payload?.applications || []).map(normalize))
      setApplications(rows)
      setDrafts(Object.fromEntries(rows.map(app => [app.id, app])))
    } catch (err) {
      if (/401|Unauth|token/i.test(err.message)) window.location.href = '/login'
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token()) {
      window.location.href = '/login'
      return
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const rows = sortApplications(applications.map(app => drafts[app.id] || app))
    if (!query) return rows
    return rows.filter(app => `${app.name} ${app.slug} ${app.category}`.toLocaleLowerCase('pt-BR').includes(query))
  }, [applications, drafts, search])

  function patch(id, field, value) {
    setDrafts(current => {
      const next = { ...current }
      if (field === 'is_default' && value) {
        Object.keys(next).forEach(key => {
          next[key] = { ...next[key], is_default: Number(key) === Number(id) }
        })
      } else {
        next[id] = { ...next[id], [field]: value }
      }
      return next
    })
  }

  async function save(id) {
    const app = drafts[id]
    if (!app) return
    setSaving(id)
    setError('')
    setMessage('')
    try {
      const body = {
        name: app.name,
        description: app.description || null,
        slug: app.slug,
        url: app.url,
        logo: app.logo || null,
        is_active: Boolean(app.is_active),
        self_service_access: Boolean(app.self_service_access),
        launcher_order: Number(app.launcher_order || 0),
        category: app.category || null,
        is_visible: Boolean(app.is_visible),
        is_default: Boolean(app.is_default),
        operational_status: app.operational_status,
        maintenance_message: app.maintenance_message || null,
        ecosystem_sdk_version: app.ecosystem_sdk_version || null,
        version: app.version || null,
        author: app.author || 'Peter Tecnet',
        release_date: app.release_date || null,
      }
      const payload = await request(`/admin/applications/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      const saved = normalize(payload.application)
      const updated = sortApplications(applications.map(item => item.id === id
        ? saved
        : saved.is_default ? { ...item, is_default: false } : item
      ))
      setApplications(updated)
      setDrafts(Object.fromEntries(updated.map(item => [item.id, item])))
      setMessage(`${saved.name} atualizado no ecossistema.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  const operational = applications.filter(app => app.operational_status === 'operational').length
  const visible = applications.filter(app => app.is_visible).length
  const defaultApp = applications.find(app => app.is_default)

  return <main className="ela-shell">
    <header className="ela-header">
      <div>
        <a href="/admin">← Admin Center</a>
        <p>Peter Tecnet · Governança</p>
        <h1>Launcher do ecossistema</h1>
        <span>Uma única configuração para todas as plataformas Peter Tecnet.</span>
      </div>
      <div className="ela-summary">
        <article><strong>{applications.length}</strong><small>ferramentas</small></article>
        <article><strong>{visible}</strong><small>visíveis</small></article>
        <article><strong>{operational}</strong><small>operacionais</small></article>
      </div>
    </header>

    <section className="ela-toolbar">
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar ferramenta, slug ou categoria" />
      <button onClick={load} disabled={loading}>Atualizar</button>
    </section>

    {defaultApp && <div className="ela-notice success">Aplicação padrão atual: <strong>{defaultApp.name}</strong>.</div>}
    {error && <div className="ela-notice error" role="alert">{error}</div>}
    {message && <div className="ela-notice success">{message}</div>}
    {loading && <div className="ela-loading">Carregando configuração do ecossistema…</div>}

    <section className="ela-grid">
      {!loading && filtered.map(app => <article className={`ela-card status-${app.operational_status}`} key={app.id}>
        <div className="ela-card-head">
          <div className="ela-logo">{app.logo ? <img src={app.logo} alt="" onError={event => { event.currentTarget.style.display = 'none' }} /> : <b>{app.name?.[0] || 'P'}</b>}</div>
          <div><h2>{app.name}</h2><code>{app.slug}</code></div>
          <span className="ela-status">{app.is_default ? 'Padrão · ' : ''}{STATUS_OPTIONS.find(([value]) => value === app.operational_status)?.[1] || app.operational_status}</span>
        </div>

        <div className="ela-fields">
          <label>Ordem no launcher<input type="number" min="0" value={app.launcher_order} onChange={event => patch(app.id, 'launcher_order', Number(event.target.value))} disabled={app.is_default} /></label>
          <label>Categoria<input value={app.category} onChange={event => patch(app.id, 'category', event.target.value)} placeholder="Ex.: Negócios, Eventos, Gestão" /></label>
          <label>Status<select value={app.operational_status} onChange={event => patch(app.id, 'operational_status', event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Versão do SDK<input value={app.ecosystem_sdk_version} onChange={event => patch(app.id, 'ecosystem_sdk_version', event.target.value)} placeholder="2.0.0" /></label>
          <label className="wide">URL<input value={app.url || ''} onChange={event => patch(app.id, 'url', event.target.value)} /></label>
          <label className="wide">Logo<input value={app.logo || ''} onChange={event => patch(app.id, 'logo', event.target.value)} placeholder="https://..." /></label>
          <label className="wide">Mensagem operacional<textarea rows="2" value={app.maintenance_message} onChange={event => patch(app.id, 'maintenance_message', event.target.value)} placeholder="Exibida no launcher durante manutenção ou indisponibilidade." /></label>
        </div>

        <div className="ela-switches">
          <label><input type="checkbox" checked={Boolean(app.is_default)} onChange={event => patch(app.id, 'is_default', event.target.checked)} />Aplicação padrão</label>
          <label><input type="checkbox" checked={Boolean(app.is_visible)} onChange={event => patch(app.id, 'is_visible', event.target.checked)} disabled={app.is_default} />Visível no launcher</label>
          <label><input type="checkbox" checked={Boolean(app.is_active)} onChange={event => patch(app.id, 'is_active', event.target.checked)} disabled={app.is_default} />Aplicação ativa</label>
          <label><input type="checkbox" checked={Boolean(app.self_service_access)} onChange={event => patch(app.id, 'self_service_access', event.target.checked)} />Acesso autoatendido</label>
        </div>

        <footer>
          <span>Alterações são consumidas dinamicamente pelo SDK central.</span>
          <button onClick={() => save(app.id)} disabled={saving === app.id}>{saving === app.id ? 'Salvando…' : 'Salvar configuração'}</button>
        </footer>
      </article>)}
    </section>
  </main>
}
