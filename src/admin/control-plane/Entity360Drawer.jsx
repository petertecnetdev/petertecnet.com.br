import { useEffect, useMemo, useState } from 'react'
import { controlApi } from './api.js'

const formatValue = value => {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const fmtDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR')
}

const labelFor = key => String(key).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export default function Entity360Drawer({ target, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('summary')

  useEffect(() => {
    if (!target) { setData(null); return }
    let active = true
    setLoading(true); setError(''); setTab('summary')
    controlApi(`/admin/ecosystem/control-plane/entities/${target.type}/${target.id}`)
      .then(result => { if (active) setData(result) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [target])

  const fields = useMemo(() => Object.entries(data?.entity || {}).filter(([key, value]) => !['password', 'remember_token', 'two_factor_secret'].includes(key) && value != null && (typeof value !== 'object' || Array.isArray(value))), [data])

  if (!target) return null

  return <div className="cp-drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="cp-drawer cp-entity-drawer" role="dialog" aria-modal="true" aria-label="Visão 360 da entidade">
      <header className="cp-drawer-header"><div><p>VISÃO 360°</p><h2>{data?.entity?.name || data?.entity?.title || data?.entity?.email || `${target.type} #${target.id}`}</h2><span>{target.type} · ID {target.id}</span></div><button type="button" onClick={onClose}>×</button></header>
      <nav className="cp-drawer-tabs">{[['summary','Resumo'],['activity','Atividade'],['audit','Auditoria & diff']].map(([key,label]) => <button type="button" key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>
      <div className="cp-drawer-content">
        {loading && <div className="cp-loading">Sincronizando contexto 360°…</div>}
        {error && <div className="cp-error">{error}</div>}
        {!loading && !error && tab === 'summary' && <>
          <section className="cp-related-counts">{Object.entries(data?.related_counts || {}).map(([key,value]) => <article key={key}><span>{labelFor(key)}</span><strong>{value}</strong></article>)}</section>
          <section className="cp-detail-grid">{fields.map(([key,value]) => <div key={key}><span>{labelFor(key)}</span><b>{formatValue(value)}</b></div>)}</section>
        </>}
        {!loading && !error && tab === 'activity' && <section className="cp-timeline">{(data?.activity || []).length ? data.activity.map(row => <article key={row.id}><i className={`severity-${row.severity || 'normal'}`}/><div><b>{row.name || row.interaction_type || 'Interação'}</b><span>{row.app?.name || 'Ecossistema'} · {row.outcome || '—'} · {row.http_status || '—'}</span><small>{fmtDate(row.created_at)}</small></div></article>) : <p className="cp-empty">Nenhuma atividade relacionada encontrada.</p>}</section>}
        {!loading && !error && tab === 'audit' && <section className="cp-diff-list">{(data?.diffs || []).length ? data.diffs.map(diff => <article key={diff.id}><header><div><b>{diff.action}</b><small>{fmtDate(diff.created_at)} · {diff.user?.email || 'sistema'}</small></div><span>{diff.changed_fields?.length || 0} mudança(s)</span></header>{diff.changed_fields?.length ? <div>{diff.changed_fields.map(change => <div className="cp-diff-row" key={change.field}><b>{labelFor(change.field)}</b><span className="before">{formatValue(change.before)}</span><em>→</em><span className="after">{formatValue(change.after)}</span></div>)}</div> : <p className="cp-empty">Registro sem alteração de campos.</p>}</article>) : <p className="cp-empty">Nenhuma alteração auditada para esta entidade.</p>}</section>}
      </div>
    </aside>
  </div>
}
