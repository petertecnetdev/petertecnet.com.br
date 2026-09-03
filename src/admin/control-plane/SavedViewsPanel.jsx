import { useEffect, useState } from 'react'
import { controlApi, navigateAdmin } from './api.js'

const scopeFromPath = () => (window.location.pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'mission-control').replace(/[^a-z0-9-]/gi, '-')

function controlIdentity(control, index) {
  const label = control.closest('label')?.childNodes?.[0]?.textContent?.trim()
  return control.name || control.id || label || control.placeholder || `${control.tagName.toLowerCase()}-${index}`
}

function collectConfiguration() {
  const controls = [...document.querySelectorAll('.ecosystem-main input, .ecosystem-main select, .ecosystem-main textarea')]
    .filter(control => !control.closest('.cp-overlay, .cp-drawer, .cp-modal'))
  return {
    path: window.location.pathname,
    controls: controls.map((control, index) => ({
      identity: controlIdentity(control, index),
      type: control.type || control.tagName.toLowerCase(),
      value: control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value,
    })),
  }
}

function applyConfiguration(configuration) {
  const path = configuration?.path
  if (path?.startsWith('/admin/')) {
    const key = {
      '/admin/mission-control': 'command', '/admin/overview': 'dashboard', '/admin/activity': 'activity', '/admin/financial': 'financial',
      '/admin/applications': 'applications', '/admin/users': 'users', '/admin/profiles': 'profiles', '/admin/establishments': 'establishments',
      '/admin/items': 'items', '/admin/site': 'site', '/admin/audit': 'audit',
    }[path]
    if (key) navigateAdmin(key)
  }
  window.setTimeout(() => {
    const controls = [...document.querySelectorAll('.ecosystem-main input, .ecosystem-main select, .ecosystem-main textarea')]
      .filter(control => !control.closest('.cp-overlay, .cp-drawer, .cp-modal'))
    for (const saved of configuration?.controls || []) {
      const control = controls.find((candidate, index) => controlIdentity(candidate, index) === saved.identity)
      if (!control) continue
      if (control.type === 'checkbox' || control.type === 'radio') control.checked = Boolean(saved.value)
      else control.value = saved.value ?? ''
      control.dispatchEvent(new Event('input', { bubbles: true }))
      control.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, 180)
}

export default function SavedViewsPanel({ open, onClose, revision = 0 }) {
  const [scope, setScope] = useState(scopeFromPath)
  const [views, setViews] = useState([])
  const [name, setName] = useState('')
  const [asDefault, setAsDefault] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(nextScope = scope) {
    setLoading(true); setError('')
    try {
      const result = await controlApi(`/v1/me/workspace/views/admin.${encodeURIComponent(nextScope)}`)
      setViews(result?.views || [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!open) return
    const nextScope = scopeFromPath()
    setScope(nextScope)
    load(nextScope)
  }, [open, revision])

  async function save(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true); setError('')
    try {
      await controlApi(`/v1/me/workspace/views/admin.${encodeURIComponent(scope)}`, {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, configuration: collectConfiguration(), is_default: asDefault }),
      })
      setName(''); setAsDefault(false); await load(scope)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function remove(view) {
    if (!window.confirm(`Excluir a visualização “${view.name}”?`)) return
    setLoading(true); setError('')
    try { await controlApi(`/v1/me/workspace/views/${view.id}`, { method: 'DELETE' }); await load(scope) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  if (!open) return null

  return <div className="cp-drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="cp-drawer cp-saved-views" role="dialog" aria-modal="true" aria-label="Visualizações salvas">
      <header className="cp-drawer-header"><div><p>WORKSPACE PERSISTENTE</p><h2>Visualizações salvas</h2><span>Filtros e contexto sincronizados para esta conta.</span></div><button type="button" onClick={onClose}>×</button></header>
      <div className="cp-drawer-content">
        {error && <div className="cp-error">{error}</div>}
        <form className="cp-save-view-form" onSubmit={save}><label>Nome da visão<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Usuários inativos 30d" maxLength="160" /></label><label className="cp-check"><input type="checkbox" checked={asDefault} onChange={event => setAsDefault(event.target.checked)} /><span>Tornar padrão para esta área</span></label><button type="submit" className="primary" disabled={loading}>Salvar estado atual</button></form>
        <section className="cp-view-list"><h3>{scope}</h3>{loading && !views.length && <div className="cp-loading">Carregando visualizações…</div>}{views.length ? views.map(view => <article key={view.id}><div><b>{view.name}</b><small>{view.is_default ? 'Padrão · ' : ''}{new Date(view.updated_at).toLocaleString('pt-BR')}</small></div><div><button type="button" onClick={() => { applyConfiguration(view.configuration); onClose() }}>Aplicar</button><button type="button" className="danger" onClick={() => remove(view)}>Excluir</button></div></article>) : !loading && <p className="cp-empty">Nenhuma visualização salva nesta área.</p>}</section>
      </div>
    </aside>
  </div>
}
