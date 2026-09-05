import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminEstablishmentsIntegration.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

const EMPTY_FILTERS = {
  search: '',
  app_id: '',
  user_id: '',
  approval: '',
  publication: '',
  featured: '',
  city: '',
  uf: '',
  type: '',
  category: '',
}

const EMPTY_FORM = {
  name: '',
  fantasy: '',
  slug: '',
  cnpj: '',
  type: '',
  category: '',
  phone: '',
  email: '',
  description: '',
  city: '',
  uf: '',
  cep: '',
  address: '',
  website_url: '',
  instagram_url: '',
  user_id: '',
  app_id: '',
  app_ids: [],
  is_published: false,
  is_approved: false,
  is_featured: false,
  is_cancelled: false,
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 18000)

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }
    if (!response.ok) {
      const validation = Object.values(payload?.errors || {}).flat()?.[0]
      throw new Error(validation || payload?.error || payload?.message || 'Não foi possível concluir a operação.')
    }
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function userName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || `Usuário #${user?.id}`
}

function establishmentName(row) {
  return row?.fantasy || row?.name || `Estabelecimento #${row?.id}`
}

function establishmentLogo(row) {
  const file = (row?.files || []).find(item => ['logo', 'avatar', 'image'].includes(item?.type) && item?.public_url)
  return file?.public_url || ''
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1'
}

function formFromEstablishment(row) {
  const appIds = Array.from(new Set([
    ...(row?.applications || []).map(app => Number(app.id)),
    row?.app_id ? Number(row.app_id) : null,
  ].filter(Boolean)))

  return {
    ...EMPTY_FORM,
    name: row?.name || '',
    fantasy: row?.fantasy || '',
    slug: row?.slug || '',
    cnpj: row?.cnpj || '',
    type: row?.type || '',
    category: row?.category || '',
    phone: row?.phone || '',
    email: row?.email || '',
    description: row?.description || '',
    city: row?.city || '',
    uf: row?.uf || '',
    cep: row?.cep || '',
    address: row?.address || '',
    website_url: row?.website_url || '',
    instagram_url: row?.instagram_url || '',
    user_id: row?.user_id ? String(row.user_id) : '',
    app_id: row?.app_id ? String(row.app_id) : (appIds[0] ? String(appIds[0]) : ''),
    app_ids: appIds.map(String),
    is_published: normalizeBoolean(row?.is_published),
    is_approved: normalizeBoolean(row?.is_approved),
    is_featured: normalizeBoolean(row?.is_featured),
    is_cancelled: normalizeBoolean(row?.is_cancelled),
  }
}

function payloadFromForm(form, editing) {
  const appIds = Array.from(new Set(form.app_ids.map(Number).filter(Boolean)))
  const primaryId = Number(form.app_id || appIds[0])
  const payload = {
    name: form.name.trim(),
    fantasy: form.fantasy.trim() || null,
    slug: form.slug.trim() || null,
    cnpj: form.cnpj.trim() || null,
    type: form.type.trim() || null,
    category: form.category.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    description: form.description.trim() || null,
    city: form.city.trim() || null,
    uf: form.uf.trim().toUpperCase() || null,
    cep: form.cep.trim() || null,
    address: form.address.trim() || null,
    website_url: form.website_url.trim() || null,
    instagram_url: form.instagram_url.trim() || null,
    app_id: primaryId || null,
    app_ids: appIds,
    is_published: Boolean(form.is_published),
    is_approved: Boolean(form.is_approved),
    is_featured: Boolean(form.is_featured),
    is_cancelled: Boolean(form.is_cancelled),
  }
  if (!editing) payload.user_id = Number(form.user_id)
  return payload
}

function StatusBadge({ active, children, tone = 'success' }) {
  return <span className={`est-status ${active ? tone : 'neutral'}`}><i />{children}</span>
}

function SmallMetric({ label, value, detail }) {
  return <div className="est-metric"><span>{label}</span><b>{value}</b><small>{detail}</small></div>
}

function Field({ label, children, className = '' }) {
  return <label className={`est-field ${className}`}><span>{label}</span>{children}</label>
}

function EstablishmentForm({ open, editing, form, setForm, applications, users, saving, onClose, onSubmit, onTransfer }) {
  if (!open) return null

  const toggleApplication = id => {
    const value = String(id)
    const selected = form.app_ids.includes(value)
    const next = selected ? form.app_ids.filter(item => item !== value) : [...form.app_ids, value]
    const nextPrimary = next.includes(String(form.app_id)) ? form.app_id : (next[0] || '')
    setForm(current => ({ ...current, app_ids: next, app_id: nextPrimary }))
  }

  return <div className="est-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="est-modal" role="dialog" aria-modal="true" aria-labelledby="establishment-form-title">
      <header className="est-modal-head">
        <div><p className="eyebrow">ESTABLISHMENT / ECOSYSTEM</p><h3 id="establishment-form-title">{editing ? 'Editar estabelecimento' : 'Novo estabelecimento'}</h3><p>{editing ? 'Atualize dados, aplicações e estado operacional.' : 'Cadastre uma empresa e vincule-a ao usuário e às aplicações corretas.'}</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar">×</button>
      </header>

      <form onSubmit={onSubmit} className="est-form">
        <div className="est-form-section">
          <div className="est-form-section-title"><span>01</span><div><b>Identidade</b><small>Dados principais do estabelecimento</small></div></div>
          <div className="est-form-grid">
            <Field label="Nome *"><input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required /></Field>
            <Field label="Nome fantasia"><input value={form.fantasy} onChange={event => setForm(current => ({ ...current, fantasy: event.target.value }))} /></Field>
            <Field label="Slug"><input value={form.slug} onChange={event => setForm(current => ({ ...current, slug: event.target.value }))} placeholder="gerado automaticamente se vazio" /></Field>
            <Field label="CNPJ"><input value={form.cnpj} onChange={event => setForm(current => ({ ...current, cnpj: event.target.value }))} /></Field>
            <Field label="Tipo"><input value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))} placeholder="production, company, barbershop..." /></Field>
            <Field label="Categoria"><input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} /></Field>
          </div>
        </div>

        <div className="est-form-section">
          <div className="est-form-section-title"><span>02</span><div><b>Responsável</b><small>Usuário proprietário dentro do ecossistema</small></div></div>
          <div className="est-owner-row">
            <Field label={editing ? 'Proprietário atual' : 'Usuário responsável *'}>
              <select value={form.user_id} onChange={event => setForm(current => ({ ...current, user_id: event.target.value }))} disabled={editing} required={!editing}>
                <option value="">Selecione um usuário</option>
                {users.map(item => <option key={item.id} value={item.id}>{userName(item)} · {item.email}</option>)}
              </select>
            </Field>
            {editing && <button className="est-secondary-button owner-transfer-button" type="button" onClick={onTransfer}>Transferir proprietário</button>}
          </div>
        </div>

        <div className="est-form-section">
          <div className="est-form-section-title"><span>03</span><div><b>Aplicações</b><small>Um estabelecimento pode participar de mais de um produto</small></div></div>
          <div className="est-app-selector">
            {applications.map(app => <label key={app.id} className={form.app_ids.includes(String(app.id)) ? 'selected' : ''}>
              <input type="checkbox" checked={form.app_ids.includes(String(app.id))} onChange={() => toggleApplication(app.id)} />
              <span className="est-app-avatar">{app.logo ? <img src={app.logo} alt="" /> : String(app.name || 'P')[0]}</span>
              <span><b>{app.name}</b><small>{app.slug || `ID ${app.id}`}</small></span>
            </label>)}
          </div>
          <Field label="Aplicação principal *" className="est-primary-app-field">
            <select value={form.app_id} onChange={event => setForm(current => ({ ...current, app_id: event.target.value }))} required>
              <option value="">Selecione</option>
              {applications.filter(app => form.app_ids.includes(String(app.id))).map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="est-form-section">
          <div className="est-form-section-title"><span>04</span><div><b>Contato e localização</b><small>Informações operacionais e públicas</small></div></div>
          <div className="est-form-grid">
            <Field label="Telefone"><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} /></Field>
            <Field label="E-mail"><input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></Field>
            <Field label="CEP"><input value={form.cep} onChange={event => setForm(current => ({ ...current, cep: event.target.value }))} /></Field>
            <Field label="Cidade"><input value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} /></Field>
            <Field label="UF"><input maxLength="2" value={form.uf} onChange={event => setForm(current => ({ ...current, uf: event.target.value.toUpperCase() }))} /></Field>
            <Field label="Endereço"><input value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} /></Field>
            <Field label="Site"><input type="url" value={form.website_url} onChange={event => setForm(current => ({ ...current, website_url: event.target.value }))} placeholder="https://" /></Field>
            <Field label="Instagram"><input type="url" value={form.instagram_url} onChange={event => setForm(current => ({ ...current, instagram_url: event.target.value }))} placeholder="https://" /></Field>
            <Field label="Descrição" className="wide"><textarea rows="4" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></Field>
          </div>
        </div>

        <div className="est-form-section">
          <div className="est-form-section-title"><span>05</span><div><b>Estado</b><small>Controle de publicação e destaque</small></div></div>
          <div className="est-toggle-grid">
            <label><input type="checkbox" checked={form.is_approved} onChange={event => setForm(current => ({ ...current, is_approved: event.target.checked }))} /><span><b>Aprovado</b><small>Liberado administrativamente</small></span></label>
            <label><input type="checkbox" checked={form.is_published} onChange={event => setForm(current => ({ ...current, is_published: event.target.checked }))} /><span><b>Publicado</b><small>Visível nas experiências públicas</small></span></label>
            <label><input type="checkbox" checked={form.is_featured} onChange={event => setForm(current => ({ ...current, is_featured: event.target.checked }))} /><span><b>Destaque</b><small>Prioridade em superfícies compatíveis</small></span></label>
          </div>
        </div>

        <footer className="est-modal-actions">
          <button className="est-secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="est-primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar estabelecimento'}<span>↗</span></button>
        </footer>
      </form>
    </section>
  </div>
}

function TransferOwnerModal({ establishment, users, saving, onClose, onConfirm }) {
  const [userId, setUserId] = useState('')
  if (!establishment) return null
  const eligible = users.filter(user => Number(user.id) !== Number(establishment.user_id))

  return <div className="est-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="est-confirm-modal" role="dialog" aria-modal="true">
      <p className="eyebrow">TRANSFERÊNCIA DE PROPRIEDADE</p>
      <h3>Transferir {establishmentName(establishment)}</h3>
      <p>O novo usuário passará a ser o responsável pelo estabelecimento e os itens vinculados também serão reatribuídos pela API.</p>
      <Field label="Novo proprietário">
        <select value={userId} onChange={event => setUserId(event.target.value)}>
          <option value="">Selecione um usuário</option>
          {eligible.map(user => <option key={user.id} value={user.id}>{userName(user)} · {user.email}</option>)}
        </select>
      </Field>
      <div className="est-modal-actions"><button className="est-secondary-button" onClick={onClose}>Cancelar</button><button className="est-primary-button" disabled={!userId || saving} onClick={() => onConfirm(userId)}>{saving ? 'Transferindo…' : 'Confirmar transferência'}</button></div>
    </section>
  </div>
}

function DeleteModal({ establishment, saving, onClose, onConfirm }) {
  if (!establishment) return null
  return <div className="est-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="est-confirm-modal danger" role="dialog" aria-modal="true">
      <p className="eyebrow">AÇÃO DESTRUTIVA</p>
      <h3>Excluir {establishmentName(establishment)}?</h3>
      <p>O estabelecimento será removido das consultas administrativas e públicas. O backend preserva a trilha de auditoria da exclusão.</p>
      <div className="est-modal-actions"><button className="est-secondary-button" onClick={onClose}>Cancelar</button><button className="est-danger-button" disabled={saving} onClick={onConfirm}>{saving ? 'Excluindo…' : 'Excluir estabelecimento'}</button></div>
    </section>
  </div>
}

function EstablishmentsManager() {
  const [establishments, setEstablishments] = useState([])
  const [applications, setApplications] = useState([])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [transferTarget, setTransferTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const refreshParentDashboard = useCallback(() => {
    document.querySelector('.top-actions .icon-button')?.click()
  }, [])

  const loadOptions = useCallback(async () => {
    const [appsResult, usersResult] = await Promise.allSettled([
      apiRequest('/admin/applications'),
      apiRequest('/admin/ecosystem/users'),
    ])
    if (appsResult.status === 'fulfilled') {
      const payload = appsResult.value
      setApplications(payload?.applications || payload?.data || (Array.isArray(payload) ? payload : []))
    }
    if (usersResult.status === 'fulfilled') setUsers(usersResult.value?.users || [])
  }, [])

  const loadEstablishments = useCallback(async currentFilters => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (String(value).trim()) params.set(key, String(value).trim())
    })
    try {
      const payload = await apiRequest(`/admin/ecosystem/establishments${params.size ? `?${params.toString()}` : ''}`)
      setEstablishments(payload?.establishments || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOptions() }, [loadOptions])
  useEffect(() => {
    const timer = window.setTimeout(() => loadEstablishments(filters), 300)
    return () => window.clearTimeout(timer)
  }, [filters, reloadKey, loadEstablishments])

  const metrics = useMemo(() => ({
    total: establishments.length,
    approved: establishments.filter(item => normalizeBoolean(item.is_approved)).length,
    published: establishments.filter(item => normalizeBoolean(item.is_published)).length,
    featured: establishments.filter(item => normalizeBoolean(item.is_featured)).length,
    multiApp: establishments.filter(item => (item.applications || []).length > 1).length,
    owners: new Set(establishments.map(item => item.user_id).filter(Boolean)).size,
  }), [establishments])

  function openCreate() {
    const firstApp = applications[0]?.id ? String(applications[0].id) : ''
    setEditing(null)
    setForm({ ...EMPTY_FORM, app_id: firstApp, app_ids: firstApp ? [firstApp] : [] })
    setFormOpen(true)
    setNotice('')
    setError('')
  }

  function openEdit(row) {
    setEditing(row)
    setForm(formFromEstablishment(row))
    setFormOpen(true)
    setNotice('')
    setError('')
  }

  async function submitForm(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!form.app_ids.length) { setError('Selecione pelo menos uma aplicação.'); return }
    if (!form.app_ids.includes(String(form.app_id))) { setError('A aplicação principal precisa estar entre as aplicações vinculadas.'); return }
    if (!editing && !form.user_id) { setError('Selecione o usuário responsável.'); return }

    setSaving(true)
    try {
      const payload = payloadFromForm(form, Boolean(editing))
      if (editing) {
        await apiRequest(`/admin/ecosystem/establishments/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setNotice('Estabelecimento atualizado com sucesso.')
      } else {
        await apiRequest('/admin/ecosystem/establishments', { method: 'POST', body: JSON.stringify(payload) })
        setNotice('Estabelecimento criado e vinculado ao ecossistema com sucesso.')
      }
      setFormOpen(false)
      setEditing(null)
      setReloadKey(value => value + 1)
      refreshParentDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function quickUpdate(row, patch) {
    setError('')
    setNotice('')
    try {
      await apiRequest(`/admin/ecosystem/establishments/${row.id}`, { method: 'PUT', body: JSON.stringify(patch) })
      setNotice('Estado do estabelecimento atualizado.')
      setReloadKey(value => value + 1)
      refreshParentDashboard()
    } catch (err) {
      setError(err.message)
    }
  }

  async function transferOwner(userId) {
    if (!transferTarget) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/admin/ecosystem/establishments/${transferTarget.id}/owner`, { method: 'PUT', body: JSON.stringify({ user_id: Number(userId) }) })
      setTransferTarget(null)
      setFormOpen(false)
      setEditing(null)
      setNotice('Proprietário transferido com sucesso; itens vinculados foram reatribuídos.')
      setReloadKey(value => value + 1)
      refreshParentDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteEstablishment() {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/admin/ecosystem/establishments/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      setNotice('Estabelecimento excluído com sucesso.')
      setReloadKey(value => value + 1)
      refreshParentDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <>
    <div className="est-heading">
      <div><p className="eyebrow">ESTABELECIMENTOS</p><h2>Gestão de establishments</h2><p>Gerencie empresas, produções e demais estabelecimentos do ecossistema, seus proprietários e as aplicações em que operam.</p></div>
      <button className="est-primary-button" type="button" onClick={openCreate}>Novo estabelecimento <span>＋</span></button>
    </div>

    <div className="est-metrics-grid">
      <SmallMetric label="Encontrados" value={metrics.total} detail="no filtro atual" />
      <SmallMetric label="Aprovados" value={metrics.approved} detail="liberados pela gestão" />
      <SmallMetric label="Publicados" value={metrics.published} detail="visíveis ao público" />
      <SmallMetric label="Em destaque" value={metrics.featured} detail="prioridade ativa" />
      <SmallMetric label="Multi-app" value={metrics.multiApp} detail="2+ aplicações" />
      <SmallMetric label="Proprietários" value={metrics.owners} detail="usuários distintos" />
    </div>

    <section className="est-panel">
      <header className="est-panel-head"><div><h3>Base do ecossistema</h3><p>Filtros consultam diretamente a API administrativa.</p></div><button className="est-secondary-button" onClick={() => setReloadKey(value => value + 1)}>Atualizar ↻</button></header>

      <div className="est-filter-grid">
        <Field label="Pesquisar"><input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Nome, CNPJ, e-mail, telefone ou ID" /></Field>
        <Field label="Aplicação"><select value={filters.app_id} onChange={event => setFilters(current => ({ ...current, app_id: event.target.value }))}><option value="">Todas</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></Field>
        <Field label="Proprietário"><select value={filters.user_id} onChange={event => setFilters(current => ({ ...current, user_id: event.target.value }))}><option value="">Todos</option>{users.map(user => <option key={user.id} value={user.id}>{userName(user)}</option>)}</select></Field>
        <Field label="Aprovação"><select value={filters.approval} onChange={event => setFilters(current => ({ ...current, approval: event.target.value }))}><option value="">Todos</option><option value="approved">Aprovados</option><option value="pending">Pendentes</option></select></Field>
        <Field label="Publicação"><select value={filters.publication} onChange={event => setFilters(current => ({ ...current, publication: event.target.value }))}><option value="">Todos</option><option value="published">Publicados</option><option value="hidden">Ocultos</option></select></Field>
        <Field label="Destaque"><select value={filters.featured} onChange={event => setFilters(current => ({ ...current, featured: event.target.value }))}><option value="">Todos</option><option value="yes">Em destaque</option><option value="no">Sem destaque</option></select></Field>
        <Field label="Cidade"><input value={filters.city} onChange={event => setFilters(current => ({ ...current, city: event.target.value }))} /></Field>
        <Field label="UF"><input maxLength="2" value={filters.uf} onChange={event => setFilters(current => ({ ...current, uf: event.target.value.toUpperCase() }))} /></Field>
        <Field label="Tipo"><input value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value }))} /></Field>
        <Field label="Categoria"><input value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))} /></Field>
        <button className="est-clear-filters" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>Limpar filtros</button>
      </div>

      {error && <div className="est-feedback error" role="alert">{error}</div>}
      {notice && <div className="est-feedback success">{notice}<button onClick={() => setNotice('')}>×</button></div>}

      <div className="est-table-wrap">
        <table className="est-table">
          <thead><tr><th>Estabelecimento</th><th>Proprietário</th><th>Aplicações</th><th>Localização</th><th>Estado</th><th aria-label="Ações" /></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="6"><div className="est-loading"><span />Carregando estabelecimentos…</div></td></tr>}
            {!loading && !establishments.length && <tr><td colSpan="6"><div className="empty-state">Nenhum estabelecimento encontrado com esses filtros.</div></td></tr>}
            {!loading && establishments.map(row => {
              const logo = establishmentLogo(row)
              const linkedApps = row.applications?.length ? row.applications : (row.app ? [row.app] : [])
              return <tr key={row.id}>
                <td data-label="Estabelecimento"><div className="est-identity"><span className="est-logo">{logo ? <img src={logo} alt="" /> : String(establishmentName(row))[0]}</span><div><b>{establishmentName(row)}</b><small>#{row.id} · {row.type || row.category || 'sem classificação'}{row.cnpj ? ` · ${row.cnpj}` : ''}</small></div></div></td>
                <td data-label="Proprietário"><div className="est-owner"><b>{row.user ? userName(row.user) : `Usuário #${row.user_id || '—'}`}</b><small>{row.user?.email || 'Sem e-mail carregado'}</small></div></td>
                <td data-label="Aplicações"><div className="est-app-tags">{linkedApps.length ? linkedApps.map(app => <span key={app.id}>{app.name || app.slug}</span>) : <span className="muted-tag">Sem vínculo</span>}</div></td>
                <td data-label="Localização"><div className="est-location"><b>{[row.city, row.uf].filter(Boolean).join(' / ') || '—'}</b><small>{row.address || row.cep || 'Sem endereço'}</small></div></td>
                <td data-label="Estado"><div className="est-status-stack"><StatusBadge active={normalizeBoolean(row.is_approved)}>{normalizeBoolean(row.is_approved) ? 'Aprovado' : 'Pendente'}</StatusBadge><StatusBadge active={normalizeBoolean(row.is_published)} tone="cyan">{normalizeBoolean(row.is_published) ? 'Publicado' : 'Oculto'}</StatusBadge>{normalizeBoolean(row.is_featured) && <StatusBadge active tone="warning">Destaque</StatusBadge>}</div></td>
                <td className="est-actions" data-label="Ações"><div className="est-action-menu">
                  <button type="button" onClick={() => openEdit(row)}>Editar</button>
                  <button type="button" onClick={() => quickUpdate(row, { is_approved: !normalizeBoolean(row.is_approved) })}>{normalizeBoolean(row.is_approved) ? 'Revogar aprovação' : 'Aprovar'}</button>
                  <button type="button" onClick={() => quickUpdate(row, { is_published: !normalizeBoolean(row.is_published) })}>{normalizeBoolean(row.is_published) ? 'Ocultar' : 'Publicar'}</button>
                  <button type="button" onClick={() => setTransferTarget(row)}>Transferir</button>
                  <button type="button" className="danger" onClick={() => setDeleteTarget(row)}>Excluir</button>
                </div></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      {!loading && <footer className="est-panel-footer"><span>{establishments.length} estabelecimento(s) retornado(s)</span><span>Limite administrativo atual: 300 registros por consulta</span></footer>}
    </section>

    <EstablishmentForm open={formOpen} editing={editing} form={form} setForm={setForm} applications={applications} users={users} saving={saving} onClose={() => { setFormOpen(false); setEditing(null) }} onSubmit={submitForm} onTransfer={() => setTransferTarget(editing)} />
    <TransferOwnerModal establishment={transferTarget} users={users} saving={saving} onClose={() => setTransferTarget(null)} onConfirm={transferOwner} />
    <DeleteModal establishment={deleteTarget} saving={saving} onClose={() => setDeleteTarget(null)} onConfirm={deleteEstablishment} />
  </>
}

export default function AdminEstablishmentsIntegration() {
  const [host, setHost] = useState(null)

  useEffect(() => {
    let navButton = null
    let sectionHost = null
    let observer = null

    const mount = () => {
      const activitySection = document.getElementById('activity')
      const sidebarNav = document.querySelector('.sidebar nav')
      if (!activitySection || !sidebarNav) return false

      sectionHost = document.getElementById('establishments-admin-integration')
      if (!sectionHost) {
        sectionHost = document.createElement('section')
        sectionHost.id = 'establishments-admin-integration'
        sectionHost.className = 'section-anchor establishments-admin-integration'
        activitySection.parentNode?.insertBefore(sectionHost, activitySection)
      }

      navButton = sidebarNav.querySelector('[data-establishments-admin-nav]')
      if (!navButton) {
        navButton = document.createElement('button')
        navButton.type = 'button'
        navButton.dataset.establishmentsAdminNav = 'true'
        navButton.innerHTML = '<span>▰</span>Estabelecimentos<i>↗</i>'
        navButton.addEventListener('click', () => {
          document.querySelector('.sidebar')?.classList.remove('open')
          document.querySelector('.sidebar-backdrop')?.classList.remove('visible')
          sectionHost?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        const activityButton = Array.from(sidebarNav.querySelectorAll('button')).find(button => button.textContent?.includes('Atividade'))
        sidebarNav.insertBefore(navButton, activityButton || null)
      }

      setHost(sectionHost)
      return true
    }

    if (!mount()) {
      observer = new MutationObserver(() => {
        if (mount()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      observer?.disconnect()
      navButton?.remove()
      sectionHost?.remove()
      setHost(null)
    }
  }, [])

  return host ? createPortal(<EstablishmentsManager />, host) : null
}
