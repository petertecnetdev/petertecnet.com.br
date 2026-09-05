import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminRequest } from './adminApi.js'
import './AdminResourcePages.css'

function displayValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function isJson(column) { return String(column?.type || '').toLowerCase().includes('json') }
function isBoolean(column) { return String(column?.type || '').toLowerCase().includes('bool') }
function isNumber(column) { return /(int|decimal|numeric|float|double|real)/i.test(String(column?.type || '')) }
function isLongText(column) { return isJson(column) || /(text|blob)/i.test(String(column?.type || '')) }

function EditorField({ column, value, onChange }) {
  const readOnly = !column.editable
  const common = { disabled: readOnly, value: value ?? '', onChange: event => onChange(event.target.value) }
  if (isBoolean(column)) return <label className={`arp-field ${readOnly ? 'readonly' : ''}`}><span>{column.name}</span><div className="arp-boolean-field"><input type="checkbox" checked={value === true || value === 1 || value === '1'} disabled={readOnly} onChange={event => onChange(event.target.checked)} /><b>{value === true || value === 1 || value === '1' ? 'Ativo' : 'Inativo'}</b></div></label>
  if (isLongText(column)) return <label className={`arp-field wide ${readOnly ? 'readonly' : ''}`}><span>{column.name} <small>{column.type}</small></span><textarea rows={isJson(column) ? 8 : 5} {...common} /></label>
  return <label className={`arp-field ${readOnly ? 'readonly' : ''}`}><span>{column.name} <small>{column.type}</small></span><input type={isNumber(column) ? 'number' : 'text'} step={isNumber(column) ? 'any' : undefined} {...common} /></label>
}

export default function AdminDataPage() {
  const [tables, setTables] = useState([])
  const [selected, setSelected] = useState('')
  const [meta, setMeta] = useState(null)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    adminRequest('/admin/ecosystem/control/data/tables').then(payload => {
      if (cancelled) return
      const list = payload?.tables || []
      setTables(list)
      setSelected(current => current || list.find(table => table.name === 'establishments')?.name || list[0]?.name || '')
    }).catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  const loadRows = useCallback(async (table, page = 1, q = '') => {
    if (!table) return
    setLoading(true); setError('')
    const params = new URLSearchParams({ page: String(page), per_page: '30' })
    if (q.trim()) params.set('q', q.trim())
    try {
      const payload = await adminRequest(`/admin/ecosystem/control/data/${encodeURIComponent(table)}?${params}`)
      setMeta(payload?.table || null); setRows(payload?.rows || []); setPagination(payload?.pagination || { current_page: 1, last_page: 1, total: 0 })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!selected || mode !== 'list') return undefined
    const timer = window.setTimeout(() => { void loadRows(selected, 1, query) }, 220)
    return () => window.clearTimeout(timer)
  }, [selected, query, mode, loadRows])

  const selectedTable = useMemo(() => tables.find(table => table.name === selected) || meta, [tables, selected, meta])
  const visibleColumns = useMemo(() => (meta?.columns || selectedTable?.columns || []).filter(column => column.visible), [meta, selectedTable])
  const previewColumns = visibleColumns.slice(0, 7)

  function chooseTable(table) { setSelected(table); setQuery(''); setMode('list'); setEditing(null); setNotice('') }
  function editRow(row) {
    setEditing(row)
    const values = {}
    visibleColumns.forEach(column => { values[column.name] = isJson(column) ? displayValue(row[column.name]) : (row[column.name] ?? '') })
    setForm(values); setError(''); setNotice(''); setMode('editor')
    document.getElementById('data-admin-integration')?.scrollIntoView({ block: 'start' })
  }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const data = {}
      visibleColumns.filter(column => column.editable).forEach(column => {
        let value = form[column.name]
        if (column.nullable && value === '') value = null
        data[column.name] = value
      })
      const payload = await adminRequest(`/admin/ecosystem/control/data/${encodeURIComponent(selected)}/${editing._admin_key}`, { method: 'PUT', body: JSON.stringify({ data }) })
      setEditing(payload?.row || editing); setNotice('Registro atualizado com sucesso e auditado.')
      const updated = payload?.row || editing
      const values = {}
      visibleColumns.forEach(column => { values[column.name] = isJson(column) ? displayValue(updated[column.name]) : (updated[column.name] ?? '') })
      setForm(values)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  if (mode === 'editor' && editing) return <div className="arp-page">
    <header className="arp-page-header"><button className="arp-back" onClick={() => { setMode('list'); setEditing(null); setNotice(''); void loadRows(selected, pagination.current_page || 1, query) }}>← {selectedTable?.label || selected}</button><div><p className="eyebrow">DATA MANAGER / {selected.toUpperCase()}</p><h2>Editar registro</h2><p>Todos os campos administrativos visíveis da tabela. Credenciais e campos de sistema permanecem protegidos.</p></div></header>
    {error && <div className="arp-feedback error">{error}</div>}{notice && <div className="arp-feedback success">{notice}</div>}
    <form className="arp-editor" onSubmit={save}><section className="arp-card"><header><span>DB</span><div><h3>{selectedTable?.label || selected}</h3><p>Chave: {(selectedTable?.key_columns || []).join(', ') || 'somente leitura'}</p></div></header><div className="arp-grid">{visibleColumns.map(column => <EditorField key={column.name} column={column} value={form[column.name]} onChange={value => setForm(current => ({ ...current, [column.name]: value }))} />)}</div></section><footer className="arp-editor-actions"><button type="button" className="arp-secondary" onClick={() => { setMode('list'); setEditing(null); setNotice('') }}>Voltar</button><button className="arp-primary" disabled={saving || !selectedTable?.editable}>{saving ? 'Salvando…' : selectedTable?.editable ? 'Salvar registro' : 'Tabela somente leitura'}</button></footer></form>
  </div>

  return <div className="arp-page data-page">
    <header className="arp-list-header"><div><p className="eyebrow">DADOS DO ECOSSISTEMA</p><h2>Data Manager</h2><p>Administração central das tabelas da API, com campos sensíveis protegidos e auditoria das alterações.</p></div></header>
    {error && <div className="arp-feedback error">{error}</div>}{notice && <div className="arp-feedback success">{notice}</div>}
    <div className="arp-data-layout"><aside className="arp-table-nav"><div className="arp-table-nav-head"><b>Tabelas</b><span>{tables.length}</span></div><div className="arp-table-nav-list">{tables.map(table => <button key={table.name} className={selected === table.name ? 'active' : ''} onClick={() => chooseTable(table.name)}><span>{table.label}</span><small>{table.editable ? 'editável' : 'somente leitura'}</small></button>)}</div></aside>
      <section className="arp-card arp-data-content"><header className="arp-data-head"><div><p className="eyebrow">{selectedTable?.editable ? 'EDIÇÃO ADMINISTRATIVA' : 'CONSULTA PROTEGIDA'}</p><h3>{selectedTable?.label || 'Selecione uma tabela'}</h3><p>{pagination.total || 0} registro(s)</p></div><label className="arp-data-search"><span>Pesquisar</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar nesta tabela…" /></label></header>
        <div className="arp-table-wrap"><table><thead><tr>{previewColumns.map(column => <th key={column.name}>{column.name}</th>)}<th /></tr></thead><tbody>{loading && <tr><td colSpan={previewColumns.length + 1} className="arp-empty">Carregando dados…</td></tr>}{!loading && !rows.length && <tr><td colSpan={previewColumns.length + 1} className="arp-empty">Nenhum registro encontrado.</td></tr>}{!loading && rows.map((row, index) => <tr key={row._admin_key || index}>{previewColumns.map(column => <td key={column.name} title={displayValue(row[column.name])}><span className="arp-cell-value">{displayValue(row[column.name]) || '—'}</span></td>)}<td><div className="arp-row-actions">{selectedTable?.editable && row._admin_key ? <button onClick={() => editRow(row)}>Editar</button> : <span className="arp-readonly-tag">Leitura</span>}</div></td></tr>)}</tbody></table></div>
        <footer className="arp-pagination"><button className="arp-secondary" disabled={(pagination.current_page || 1) <= 1} onClick={() => loadRows(selected, pagination.current_page - 1, query)}>← Anterior</button><span>Página {pagination.current_page || 1} de {pagination.last_page || 1}</span><button className="arp-secondary" disabled={(pagination.current_page || 1) >= (pagination.last_page || 1)} onClick={() => loadRows(selected, pagination.current_page + 1, query)}>Próxima →</button></footer>
      </section>
    </div>
  </div>
}
