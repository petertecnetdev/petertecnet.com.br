import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminRequest, encodeAdminKey } from './adminApi.js'
import './AdminResourcePages.css'

const EMPTY_FILTERS = { search: '', app_id: '', user_id: '', type: '', publication: '' }
const EMPTY_FORM = {
  name: '', fantasy: '', slug: '', cnpj: '', type: '', category: '',
  phone: '', email: '', description: '', additional_info: '',
  city: '', uf: '', cep: '', address: '', location: '',
  website_url: '', facebook_url: '', instagram_url: '', twitter_url: '', youtube_url: '',
  segments: '', user_id: '', app_id: '', app_ids: [],
  is_published: false, is_approved: false, is_featured: false, is_cancelled: false,
}

function bool(value) { return value === true || value === 1 || value === '1' }
function nameOf(row) { return row?.fantasy || row?.name || `Estabelecimento #${row?.id || '—'}` }
function userName(user) { return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || `Usuário #${user?.id}` }
function mediaOf(row, type) { return (row?.files || []).find(file => file?.type === type)?.public_url || '' }

function formFrom(row) {
  const appIds = Array.from(new Set([
    ...(row?.applications || []).map(app => String(app.id)),
    row?.app_id ? String(row.app_id) : null,
  ].filter(Boolean)))
  return {
    ...EMPTY_FORM,
    name: row?.name || '', fantasy: row?.fantasy || '', slug: row?.slug || '', cnpj: row?.cnpj || '',
    type: row?.type || '', category: row?.category || '', phone: row?.phone || '', email: row?.email || '',
    description: row?.description || '', additional_info: row?.additional_info || '', city: row?.city || '', uf: row?.uf || '',
    cep: row?.cep || '', address: row?.address || '', location: row?.location || '', website_url: row?.website_url || '',
    facebook_url: row?.facebook_url || '', instagram_url: row?.instagram_url || '', twitter_url: row?.twitter_url || '',
    youtube_url: row?.youtube_url || '', segments: Array.isArray(row?.segments) ? row.segments.join(', ') : (row?.segments || ''),
    user_id: row?.user_id ? String(row.user_id) : '', app_id: row?.app_id ? String(row.app_id) : (appIds[0] || ''), app_ids: appIds,
    is_published: bool(row?.is_published), is_approved: bool(row?.is_approved), is_featured: bool(row?.is_featured), is_cancelled: bool(row?.is_cancelled),
  }
}

function corePayload(form, editing) {
  const nullable = value => String(value ?? '').trim() || null
  const appIds = Array.from(new Set(form.app_ids.map(Number).filter(Boolean)))
  const payload = {
    name: form.name.trim(), fantasy: nullable(form.fantasy), slug: nullable(form.slug), cnpj: nullable(form.cnpj),
    type: nullable(form.type), category: nullable(form.category), phone: nullable(form.phone), email: nullable(form.email),
    description: nullable(form.description), city: nullable(form.city), uf: nullable(form.uf)?.toUpperCase() || null,
    cep: nullable(form.cep), address: nullable(form.address), website_url: nullable(form.website_url), instagram_url: nullable(form.instagram_url),
    app_id: Number(form.app_id) || null, app_ids: appIds,
    is_published: Boolean(form.is_published), is_approved: Boolean(form.is_approved), is_featured: Boolean(form.is_featured), is_cancelled: Boolean(form.is_cancelled),
  }
  if (!editing) payload.user_id = Number(form.user_id)
  return payload
}

function extraPayload(form) {
  const nullable = value => String(value ?? '').trim() || null
  return {
    additional_info: nullable(form.additional_info),
    location: nullable(form.location),
    facebook_url: nullable(form.facebook_url),
    twitter_url: nullable(form.twitter_url),
    youtube_url: nullable(form.youtube_url),
    segments: String(form.segments || '').split(',').map(value => value.trim()).filter(Boolean),
  }
}

function Field({ label, children, wide = false }) {
  return <label className={`arp-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>
}

function Status({ active, children }) { return <span className={`arp-status ${active ? 'on' : ''}`}><i />{children}</span> }

export default function AdminEstablishmentsPage() {
  const [rows, setRows] = useState([])
  const [applications, setApplications] = useState([])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [mode, setMode] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [logo, setLogo] = useState(null)
  const [background, setBackground] = useState(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [removeBackground, setRemoveBackground] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadOptions = useCallback(async () => {
    const [appsResult, usersResult] = await Promise.allSettled([
      adminRequest('/admin/applications'),
      adminRequest('/admin/ecosystem/users'),
    ])
    if (appsResult.status === 'fulfilled') setApplications(appsResult.value?.applications || appsResult.value?.data || [])
    if (usersResult.status === 'fulfilled') setUsers(usersResult.value?.users || [])
  }, [])

  const loadRows = useCallback(async current => {
    setLoading(true); setError('')
    const params = new URLSearchParams()
    Object.entries(current).forEach(([key, value]) => { if (String(value || '').trim()) params.set(key, String(value).trim()) })
    try {
      const payload = await adminRequest(`/admin/ecosystem/establishments${params.size ? `?${params}` : ''}`)
      setRows(payload?.establishments || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadOptions() }, [loadOptions])
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRows(filters) }, 250)
    return () => window.clearTimeout(timer)
  }, [filters, loadRows])

  const metrics = useMemo(() => ({
    total: rows.length,
    approved: rows.filter(row => bool(row.is_approved)).length,
    published: rows.filter(row => bool(row.is_published)).length,
    featured: rows.filter(row => bool(row.is_featured)).length,
  }), [rows])

  function startCreate() {
    const app = applications[0]?.id ? String(applications[0].id) : ''
    setEditing(null)
    setForm({ ...EMPTY_FORM, app_id: app, app_ids: app ? [app] : [] })
    setLogo(null); setBackground(null); setRemoveLogo(false); setRemoveBackground(false); setError(''); setNotice(''); setMode('editor')
    document.getElementById('establishments-admin-integration')?.scrollIntoView({ block: 'start' })
  }

  function startEdit(row) {
    setEditing(row); setForm(formFrom(row)); setLogo(null); setBackground(null); setRemoveLogo(false); setRemoveBackground(false)
    setError(''); setNotice(''); setMode('editor')
    document.getElementById('establishments-admin-integration')?.scrollIntoView({ block: 'start' })
  }

  function backToList() {
    setMode('list'); setEditing(null); setLogo(null); setBackground(null); setRemoveLogo(false); setRemoveBackground(false); setError('')
  }

  function toggleApp(id) {
    const value = String(id)
    setForm(current => {
      const selected = current.app_ids.includes(value)
      const appIds = selected ? current.app_ids.filter(item => item !== value) : [...current.app_ids, value]
      return { ...current, app_ids: appIds, app_id: appIds.includes(String(current.app_id)) ? current.app_id : (appIds[0] || '') }
    })
  }

  async function save(event) {
    event.preventDefault(); setError(''); setNotice('')
    if (!form.app_ids.length || !form.app_ids.includes(String(form.app_id))) { setError('Selecione ao menos uma aplicação e defina a principal.'); return }
    if (!form.user_id) { setError('Selecione o proprietário do estabelecimento.'); return }
    setSaving(true)
    try {
      const editingId = editing?.id
      const main = await adminRequest(`/admin/ecosystem/establishments${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST', body: JSON.stringify(corePayload(form, Boolean(editingId))),
      })
      const establishment = main?.establishment
      const id = editingId || establishment?.id
      if (!id) throw new Error('A API não retornou o estabelecimento salvo.')

      await adminRequest(`/admin/ecosystem/control/data/establishments/${encodeAdminKey({ id: Number(id) })}`, {
        method: 'PUT', body: JSON.stringify({ data: extraPayload(form) }),
      })

      if (editingId && Number(form.user_id) !== Number(editing.user_id)) {
        await adminRequest(`/admin/ecosystem/establishments/${id}/owner`, { method: 'PUT', body: JSON.stringify({ user_id: Number(form.user_id) }) })
      }

      if (logo || background || removeLogo || removeBackground) {
        const media = new FormData()
        if (logo) media.append('logo', logo)
        if (background) media.append('background', background)
        if (removeLogo) media.append('remove_logo', '1')
        if (removeBackground) media.append('remove_background', '1')
        await adminRequest(`/admin/ecosystem/establishments/${id}/media`, { method: 'POST', body: media })
      }

      setMode('list'); setEditing(null); setNotice(editingId ? 'Estabelecimento atualizado por completo.' : 'Estabelecimento criado com sucesso.')
      await loadRows(filters)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function remove(row) {
    if (!window.confirm(`Excluir ${nameOf(row)}? A trilha de auditoria será preservada.`)) return
    setSaving(true); setError('')
    try {
      await adminRequest(`/admin/ecosystem/establishments/${row.id}`, { method: 'DELETE' })
      setNotice('Estabelecimento excluído.'); await loadRows(filters)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  if (mode === 'editor') {
    const currentLogo = mediaOf(editing, 'logo')
    const currentBackground = mediaOf(editing, 'background')
    return <div className="arp-page">
      <header className="arp-page-header">
        <button className="arp-back" type="button" onClick={backToList}>← Estabelecimentos</button>
        <div><p className="eyebrow">ESTABLISHMENT / EDITOR</p><h2>{editing ? `Editar ${nameOf(editing)}` : 'Novo estabelecimento'}</h2><p>Editor completo dentro do Admin Center, sem modal.</p></div>
      </header>
      {error && <div className="arp-feedback error">{error}</div>}
      <form className="arp-editor" onSubmit={save}>
        <section className="arp-card"><header><span>01</span><div><h3>Identidade</h3><p>Dados centrais e classificação.</p></div></header><div className="arp-grid">
          <Field label="Nome *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Nome fantasia"><input value={form.fantasy} onChange={e => setForm({ ...form, fantasy: e.target.value })} /></Field>
          <Field label="Slug"><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></Field>
          <Field label="CNPJ"><input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} /></Field>
          <Field label="Tipo"><input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="production, company, collective..." /></Field>
          <Field label="Categoria"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Descrição" wide><textarea rows="5" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Informações adicionais" wide><textarea rows="4" value={form.additional_info} onChange={e => setForm({ ...form, additional_info: e.target.value })} /></Field>
          <Field label="Segmentos" wide><input value={form.segments} onChange={e => setForm({ ...form, segments: e.target.value })} placeholder="eventos, cultura, música — separados por vírgula" /></Field>
        </div></section>

        <section className="arp-card"><header><span>02</span><div><h3>Proprietário e aplicações</h3><p>Vínculos administrativos do ecossistema.</p></div></header>
          <div className="arp-grid"><Field label="Proprietário *" wide><select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} required><option value="">Selecione</option>{users.map(user => <option key={user.id} value={user.id}>{userName(user)} · {user.email}</option>)}</select></Field></div>
          <div className="arp-apps">{applications.map(app => <label key={app.id} className={form.app_ids.includes(String(app.id)) ? 'selected' : ''}><input type="checkbox" checked={form.app_ids.includes(String(app.id))} onChange={() => toggleApp(app.id)} /><span><b>{app.name}</b><small>{app.slug || `#${app.id}`}</small></span></label>)}</div>
          <div className="arp-grid"><Field label="Aplicação principal *" wide><select value={form.app_id} onChange={e => setForm({ ...form, app_id: e.target.value })} required><option value="">Selecione</option>{applications.filter(app => form.app_ids.includes(String(app.id))).map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></Field></div>
        </section>

        <section className="arp-card"><header><span>03</span><div><h3>Localização e contato</h3><p>Todos os campos públicos do estabelecimento.</p></div></header><div className="arp-grid">
          <Field label="Telefone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field><Field label="E-mail"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="CEP"><input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} /></Field><Field label="Cidade"><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="UF"><input maxLength="2" value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></Field><Field label="Endereço"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Localização / referência" wide><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Site"><input type="url" value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })} placeholder="https://" /></Field><Field label="Instagram"><input type="url" value={form.instagram_url} onChange={e => setForm({ ...form, instagram_url: e.target.value })} placeholder="https://" /></Field>
          <Field label="Facebook"><input type="url" value={form.facebook_url} onChange={e => setForm({ ...form, facebook_url: e.target.value })} placeholder="https://" /></Field><Field label="X / Twitter"><input type="url" value={form.twitter_url} onChange={e => setForm({ ...form, twitter_url: e.target.value })} placeholder="https://" /></Field>
          <Field label="YouTube" wide><input type="url" value={form.youtube_url} onChange={e => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://" /></Field>
        </div></section>

        <section className="arp-card"><header><span>04</span><div><h3>Logo e background</h3><p>Substituição real dos arquivos vinculados ao estabelecimento.</p></div></header><div className="arp-media-grid">
          <div className="arp-media-box"><div className="arp-media-preview">{currentLogo && !removeLogo ? <img src={currentLogo} alt="Logo atual" /> : <span>LOGO</span>}</div><Field label="Nova logo"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setLogo(e.target.files?.[0] || null); setRemoveLogo(false) }} /></Field>{editing && currentLogo && <label className="arp-check"><input type="checkbox" checked={removeLogo} onChange={e => { setRemoveLogo(e.target.checked); if (e.target.checked) setLogo(null) }} /> Remover logo atual</label>}</div>
          <div className="arp-media-box"><div className="arp-media-preview wide-preview">{currentBackground && !removeBackground ? <img src={currentBackground} alt="Background atual" /> : <span>BACKGROUND</span>}</div><Field label="Novo background"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setBackground(e.target.files?.[0] || null); setRemoveBackground(false) }} /></Field>{editing && currentBackground && <label className="arp-check"><input type="checkbox" checked={removeBackground} onChange={e => { setRemoveBackground(e.target.checked); if (e.target.checked) setBackground(null) }} /> Remover background atual</label>}</div>
        </div></section>

        <section className="arp-card"><header><span>05</span><div><h3>Estado administrativo</h3><p>Publicação, aprovação, destaque e cancelamento.</p></div></header><div className="arp-toggles">
          {[['is_approved','Aprovado'],['is_published','Publicado'],['is_featured','Destaque'],['is_cancelled','Cancelado']].map(([key,label]) => <label key={key} className={form[key] ? 'selected' : ''}><input type="checkbox" checked={Boolean(form[key])} onChange={e => setForm({ ...form, [key]: e.target.checked })} /><span><b>{label}</b><small>{form[key] ? 'Ativo' : 'Inativo'}</small></span></label>)}
        </div></section>

        <footer className="arp-editor-actions"><button type="button" className="arp-secondary" onClick={backToList}>Cancelar</button><button className="arp-primary" disabled={saving}>{saving ? 'Salvando tudo…' : editing ? 'Salvar alterações' : 'Criar estabelecimento'}</button></footer>
      </form>
    </div>
  }

  return <div className="arp-page">
    <header className="arp-list-header"><div><p className="eyebrow">ESTABELECIMENTOS</p><h2>Gestão de establishments</h2><p>Empresas, produtoras, casas, coletivos e demais estabelecimentos do ecossistema.</p></div><button className="arp-primary" onClick={startCreate}>Novo estabelecimento ＋</button></header>
    <div className="arp-metrics"><div><span>Encontrados</span><b>{metrics.total}</b></div><div><span>Aprovados</span><b>{metrics.approved}</b></div><div><span>Publicados</span><b>{metrics.published}</b></div><div><span>Destaques</span><b>{metrics.featured}</b></div></div>
    {error && <div className="arp-feedback error">{error}</div>}{notice && <div className="arp-feedback success">{notice}</div>}
    <section className="arp-card"><div className="arp-filter-grid">
      <Field label="Pesquisar"><input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Nome, CNPJ, e-mail, telefone ou ID" /></Field>
      <Field label="Aplicação"><select value={filters.app_id} onChange={e => setFilters({ ...filters, app_id: e.target.value })}><option value="">Todas</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></Field>
      <Field label="Proprietário"><select value={filters.user_id} onChange={e => setFilters({ ...filters, user_id: e.target.value })}><option value="">Todos</option>{users.map(user => <option key={user.id} value={user.id}>{userName(user)}</option>)}</select></Field>
      <Field label="Tipo"><input value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })} /></Field>
      <Field label="Publicação"><select value={filters.publication} onChange={e => setFilters({ ...filters, publication: e.target.value })}><option value="">Todos</option><option value="published">Publicados</option><option value="hidden">Ocultos</option></select></Field>
      <button className="arp-secondary arp-filter-button" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Limpar</button>
    </div></section>
    <section className="arp-card arp-table-card"><div className="arp-table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Proprietário</th><th>Aplicações</th><th>Localização</th><th>Estado</th><th /></tr></thead><tbody>
      {loading && <tr><td colSpan="6" className="arp-empty">Carregando…</td></tr>}
      {!loading && !rows.length && <tr><td colSpan="6" className="arp-empty">Nenhum estabelecimento encontrado.</td></tr>}
      {!loading && rows.map(row => <tr key={row.id}><td><div className="arp-identity">{mediaOf(row,'logo') ? <img src={mediaOf(row,'logo')} alt="" /> : <span>{nameOf(row)[0]}</span>}<div><b>{nameOf(row)}</b><small>#{row.id} · {row.type || row.category || 'sem classificação'}</small></div></div></td><td><b>{row.user ? userName(row.user) : `#${row.user_id || '—'}`}</b><small className="arp-block">{row.user?.email || ''}</small></td><td><div className="arp-tags">{(row.applications || []).map(app => <span key={app.id}>{app.name}</span>)}</div></td><td><b>{[row.city,row.uf].filter(Boolean).join(' / ') || '—'}</b><small className="arp-block">{row.address || row.cep || ''}</small></td><td><div className="arp-statuses"><Status active={bool(row.is_approved)}>Aprovado</Status><Status active={bool(row.is_published)}>Publicado</Status></div></td><td><div className="arp-row-actions"><button onClick={() => startEdit(row)}>Editar</button><button className="danger" disabled={saving} onClick={() => remove(row)}>Excluir</button></div></td></tr>)}
    </tbody></table></div></section>
  </div>
}
