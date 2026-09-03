import { useEffect, useState } from 'react'
import { controlApi, normalizeEntityType } from './api.js'

const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'

export default function TimelineDrawer({ open, onClose, revision = 0, onOpenEntity }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState('all')

  async function load() {
    setLoading(true); setError('')
    try { setRows((await controlApi('/admin/ecosystem/control-plane/timeline?limit=120'))?.timeline || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open, revision])
  if (!open) return null

  const visible = source === 'all' ? rows : rows.filter(row => row.source === source)

  function openEntity(row) {
    const type = normalizeEntityType(row.entity_type)
    if (type && row.entity_id) onOpenEntity?.(type, row.entity_id)
  }

  return <div className="cp-drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="cp-drawer cp-timeline-drawer" role="dialog" aria-modal="true" aria-label="Linha do tempo operacional">
      <header className="cp-drawer-header"><div><p>OBSERVABILIDADE 360°</p><h2>Linha do tempo do ecossistema</h2><span>Interações e alterações administrativas em uma sequência única.</span></div><button type="button" onClick={onClose}>×</button></header>
      <div className="cp-timeline-filter"><button type="button" className={source==='all'?'active':''} onClick={()=>setSource('all')}>Tudo</button><button type="button" className={source==='interaction'?'active':''} onClick={()=>setSource('interaction')}>Interações</button><button type="button" className={source==='audit'?'active':''} onClick={()=>setSource('audit')}>Auditoria</button><button type="button" onClick={load}>Atualizar</button></div>
      <div className="cp-drawer-content">
        {loading && <div className="cp-loading">Montando linha do tempo…</div>}
        {error && <div className="cp-error">{error}</div>}
        <section className="cp-timeline">{visible.length ? visible.map(row => <button type="button" className="cp-timeline-entry" key={`${row.source}-${row.id}`} onClick={() => openEntity(row)}><i className={`severity-${row.severity || 'normal'}`}/><span><b>{row.title || row.type}</b><small>{row.application?.name || row.source} · {row.user?.email || 'sistema'}{row.outcome ? ` · ${row.outcome}` : ''}</small><em>{fmt(row.at)}</em>{row.changed_fields?.length ? <strong>{row.changed_fields.length} campo(s) alterado(s)</strong> : null}</span></button>) : !loading && <p className="cp-empty">Nenhum evento encontrado.</p>}</section>
      </div>
    </aside>
  </div>
}
