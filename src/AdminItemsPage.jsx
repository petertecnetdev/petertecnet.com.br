import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminRequest } from './adminApi.js'
import './AdminResourcePages.css'

const EMPTY_FILTERS = { search: '', app_id: '', establishment_id: '', type: '', status: '', featured: '', category: '' }
const EMPTY_FORM = { name: '', app_id: '', entity_id: '', type: 'item', price: '', discount: '', sku: '', category: '', subcategory: '', brand: '', duration: '', stock: '', image: '', description: '', status: true, is_featured: false }
const TYPE_LABELS = { item: 'Item', product: 'Produto', service: 'Serviço', ticket: 'Ingresso' }

function money(value) { const amount = Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount) : '—' }
function bool(value) { return value === true || value === 1 || value === '1' }
function establishmentName(row) { return row?.fantasy || row?.name || `Estabelecimento #${row?.id || '—'}` }
function linkedApps(row) { return Array.from(new Set([row?.app_id ? Number(row.app_id) : null, ...(row?.applications || []).map(app => Number(app.id))].filter(Boolean))) }
function Field({ label, children, wide = false }) { return <label className={`arp-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label> }
function Status({ active, children }) { return <span className={`arp-status ${active ? 'on' : ''}`}><i />{children}</span> }

function formFrom(item) {
  return { ...EMPTY_FORM, name: item?.name || '', app_id: item?.app_id ? String(item.app_id) : '', entity_id: item?.entity_id ? String(item.entity_id) : '', type: item?.type || 'item', price: item?.price ?? '', discount: item?.discount ?? '', sku: item?.sku || '', category: item?.category || '', subcategory: item?.subcategory || '', brand: item?.brand || '', duration: item?.duration ?? '', stock: item?.stock ?? '', image: item?.image || item?.image_url || '', description: item?.description || '', status: item?.status !== false, is_featured: bool(item?.is_featured) }
}

function payload(form) {
  const text = value => String(value ?? '').trim() || null
  return { name: form.name.trim(), app_id: Number(form.app_id), entity_id: Number(form.entity_id), type: form.type, price: Number(form.price), discount: form.discount === '' ? null : Number(form.discount), sku: text(form.sku), category: text(form.category), subcategory: text(form.subcategory), brand: text(form.brand), duration: form.duration === '' ? null : Number(form.duration), stock: form.stock === '' ? null : Number(form.stock), image: text(form.image), description: text(form.description), status: Boolean(form.status), is_featured: Boolean(form.is_featured) }
}

export default function AdminItemsPage() {
  const [items, setItems] = useState([])
  const [applications, setApplications] = useState([])
  const [establishments, setEstablishments] = useState([])
  const [formEstablishments, setFormEstablishments] = useState([])
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [mode, setMode] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    adminRequest('/admin/applications').then(data => { if (!cancelled) setApplications(data?.applications || data?.data || []) }).catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = filters.app_id ? `?app_id=${encodeURIComponent(filters.app_id)}` : ''
    adminRequest(`/admin/ecosystem/establishments${params}`).then(data => { if (!cancelled) setEstablishments(data?.establishments || []) }).catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [filters.app_id])

  const loadItems = useCallback(async current => {
    setLoading(true); setError('')
    const params = new URLSearchParams()
    Object.entries(current).forEach(([key, value]) => { if (String(value || '').trim()) params.set(key, String(value).trim()) })
    try { const data = await adminRequest(`/admin/ecosystem/items${params.size ? `?${params}` : ''}`); setItems(data?.items || data?.data || []) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => { void loadItems(filters) }, 250); return () => window.clearTimeout(timer) }, [filters, loadItems])

  const visibleEstablishments = useMemo(() => !filters.app_id ? establishments : establishments.filter(row => linkedApps(row).includes(Number(filters.app_id))), [establishments, filters.app_id])
  const metrics = useMemo(() => ({ total: items.length, active: items.filter(item => item.status !== false).length, featured: items.filter(item => bool(item.is_featured)).length, orders: items.reduce((sum, item) => sum + Number(item.order_items_count || 0), 0) }), [items])

  async function loadFormEstablishments(appId, selectedId = '') {
    if (!appId) { setFormEstablishments([]); return }
    try {
      const data = await adminRequest(`/admin/ecosystem/establishments?app_id=${encodeURIComponent(appId)}`)
      let rows = data?.establishments || []
      if (selectedId && !rows.some(row => Number(row.id) === Number(selectedId))) {
        const extra = await adminRequest(`/admin/ecosystem/establishments?search=${encodeURIComponent(selectedId)}`)
        const selected = (extra?.establishments || []).find(row => Number(row.id) === Number(selectedId))
        if (selected) rows = [selected, ...rows]
      }
      setFormEstablishments(rows)
    } catch (err) { setError(err.message); setFormEstablishments([]) }
  }

  function createItem() { setEditing(null); setForm({ ...EMPTY_FORM }); setFormEstablishments([]); setError(''); setNotice(''); setMode('editor'); document.getElementById('items-admin-integration')?.scrollIntoView({ block: 'start' }) }
  async function editItem(item) { const next = formFrom(item); setEditing(item); setForm(next); setError(''); setNotice(''); setMode('editor'); await loadFormEstablishments(next.app_id, next.entity_id); document.getElementById('items-admin-integration')?.scrollIntoView({ block: 'start' }) }
  function back() { setMode('list'); setEditing(null); setError('') }
  async function changeApp(appId) { setForm(current => ({ ...current, app_id: appId, entity_id: '' })); await loadFormEstablishments(appId) }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const id = editing?.id
      await adminRequest(`/admin/ecosystem/items${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload(form)) })
      setMode('list'); setEditing(null); setNotice(id ? 'Item atualizado com sucesso.' : 'Item criado com sucesso.'); await loadItems(filters)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function remove(item) {
    if (!window.confirm(`Excluir ou arquivar ${item.name}? O histórico comercial será preservado quando necessário.`)) return
    setSaving(true); setError('')
    try { const result = await adminRequest(`/admin/ecosystem/items/${item.id}`, { method: 'DELETE' }); setNotice(result?.message || 'Item processado com sucesso.'); await loadItems(filters) }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  if (mode === 'editor') return <div className="arp-page">
    <header className="arp-page-header"><button className="arp-back" type="button" onClick={back}>← Itens</button><div><p className="eyebrow">ITEM / EDITOR</p><h2>{editing ? `Editar ${editing.name}` : 'Novo item'}</h2><p>Editor completo dentro do dashboard, sem modal.</p></div></header>
    {error && <div className="arp-feedback error">{error}</div>}
    <form className="arp-editor" onSubmit={save}>
      <section className="arp-card"><header><span>01</span><div><h3>Identidade</h3><p>Modelo genérico reutilizado pelo ecossistema.</p></div></header><div className="arp-grid">
        <Field label="Nome *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field><Field label="Tipo *"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="item">Item</option><option value="product">Produto</option><option value="service">Serviço</option><option value="ticket">Ingresso</option></select></Field>
        <Field label="SKU"><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></Field><Field label="Marca"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></Field><Field label="Categoria"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></Field><Field label="Subcategoria"><input value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} /></Field><Field label="Descrição" wide><textarea rows="5" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
      </div></section>
      <section className="arp-card"><header><span>02</span><div><h3>Vínculos</h3><p>Aplicação e estabelecimento responsáveis.</p></div></header><div className="arp-grid"><Field label="Aplicação *"><select value={form.app_id} onChange={e => changeApp(e.target.value)} required><option value="">Selecione</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></Field><Field label="Estabelecimento *"><select value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })} disabled={!form.app_id} required><option value="">Selecione</option>{formEstablishments.map(row => <option key={row.id} value={row.id}>{establishmentName(row)}</option>)}</select></Field></div></section>
      <section className="arp-card"><header><span>03</span><div><h3>Comercial e operação</h3><p>Preço, desconto, estoque e duração.</p></div></header><div className="arp-grid"><Field label="Preço *"><input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required /></Field><Field label="Desconto"><input type="number" min="0" step="0.01" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} /></Field><Field label="Estoque"><input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></Field><Field label="Duração (min)"><input type="number" min="0" max="1440" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></Field><Field label="Imagem (URL)" wide><input type="url" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://" /></Field></div></section>
      <section className="arp-card"><header><span>04</span><div><h3>Estado</h3><p>Disponibilidade e destaque.</p></div></header><div className="arp-toggles"><label className={form.status ? 'selected' : ''}><input type="checkbox" checked={form.status} onChange={e => setForm({ ...form, status: e.target.checked })} /><span><b>Ativo</b><small>Disponível para uso</small></span></label><label className={form.is_featured ? 'selected' : ''}><input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} /><span><b>Destaque</b><small>Prioridade de exibição</small></span></label></div></section>
      <footer className="arp-editor-actions"><button type="button" className="arp-secondary" onClick={back}>Cancelar</button><button className="arp-primary" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar item'}</button></footer>
    </form>
  </div>

  return <div className="arp-page">
    <header className="arp-list-header"><div><p className="eyebrow">ITENS</p><h2>Catálogo do ecossistema</h2><p>Produtos, serviços, ingressos e itens genéricos.</p></div><button className="arp-primary" onClick={createItem}>Novo item ＋</button></header>
    <div className="arp-metrics"><div><span>Encontrados</span><b>{metrics.total}</b></div><div><span>Ativos</span><b>{metrics.active}</b></div><div><span>Destaques</span><b>{metrics.featured}</b></div><div><span>Pedidos vinculados</span><b>{metrics.orders}</b></div></div>
    {error && <div className="arp-feedback error">{error}</div>}{notice && <div className="arp-feedback success">{notice}</div>}
    <section className="arp-card"><div className="arp-filter-grid"><Field label="Pesquisar"><input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Nome, SKU ou categoria" /></Field><Field label="Aplicação"><select value={filters.app_id} onChange={e => setFilters({ ...filters, app_id: e.target.value, establishment_id: '' })}><option value="">Todas</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></Field><Field label="Estabelecimento"><select value={filters.establishment_id} onChange={e => setFilters({ ...filters, establishment_id: e.target.value })}><option value="">Todos</option>{visibleEstablishments.map(row => <option key={row.id} value={row.id}>{establishmentName(row)}</option>)}</select></Field><Field label="Tipo"><select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}><option value="">Todos</option>{Object.entries(TYPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Status"><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Todos</option><option value="active">Ativos</option><option value="archived">Arquivados</option></select></Field><button className="arp-secondary arp-filter-button" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Limpar</button></div></section>
    <section className="arp-card arp-table-card"><div className="arp-table-wrap"><table><thead><tr><th>Item</th><th>Tipo</th><th>Aplicação</th><th>Estabelecimento</th><th>Preço</th><th>Estado</th><th /></tr></thead><tbody>{loading && <tr><td colSpan="7" className="arp-empty">Carregando…</td></tr>}{!loading && !items.length && <tr><td colSpan="7" className="arp-empty">Nenhum item encontrado.</td></tr>}{!loading && items.map(item => <tr key={item.id}><td><b>{item.name}</b><small className="arp-block">#{item.id} · {item.sku || item.category || 'sem classificação'}</small></td><td>{TYPE_LABELS[item.type] || item.type}</td><td>{applications.find(app => Number(app.id) === Number(item.app_id))?.name || `#${item.app_id}`}</td><td>{establishmentName(item.establishment || { id: item.entity_id })}</td><td><b>{money(item.price)}</b></td><td><div className="arp-statuses"><Status active={item.status !== false}>Ativo</Status>{bool(item.is_featured) && <Status active>Destaque</Status>}</div></td><td><div className="arp-row-actions"><button onClick={() => editItem(item)}>Editar</button><button className="danger" disabled={saving} onClick={() => remove(item)}>Excluir</button></div></td></tr>)}</tbody></table></div></section>
  </div>
}
