import { useEffect, useState } from 'react'
import { controlApi, normalizeEntityType } from './api.js'

const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'

export default function NotificationCenter({ open, onClose, revision = 0, onOpenEntity, onUnreadChange }) {
  const [data, setData] = useState({ unread_count: 0, notifications: [], operational: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const result = await controlApi('/admin/ecosystem/control-plane/notifications?limit=60')
      setData(result)
      onUnreadChange?.(Number(result?.unread_count || 0))
    } catch (err) {
      setError(err.message)
    } finally { if (!silent) setLoading(false) }
  }

  useEffect(() => { load(true) }, [revision])
  useEffect(() => {
    const id = window.setInterval(() => load(true), 60000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => { if (open) load() }, [open])

  async function markRead(notification) {
    if (notification.read_at) return
    try {
      await controlApi(`/admin/ecosystem/control-plane/notifications/${notification.id}/read`, { method: 'PATCH' })
      await load(true)
    } catch (err) { setError(err.message) }
  }

  async function markAll() {
    try {
      await controlApi('/admin/ecosystem/control-plane/notifications/read-all', { method: 'POST', body: '{}' })
      await load(true)
    } catch (err) { setError(err.message) }
  }

  function openReference(notification) {
    const type = normalizeEntityType(notification.reference_type)
    if (type && notification.reference_id) onOpenEntity?.(type, notification.reference_id)
    if (!notification.source) markRead(notification)
  }

  if (!open) return null

  return <div className="cp-drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="cp-drawer cp-notifications" role="dialog" aria-modal="true" aria-label="Central de notificações">
      <header className="cp-drawer-header"><div><p>SINAIS OPERACIONAIS</p><h2>Central de notificações</h2><span>{data.unread_count || 0} sinal(is) requerendo atenção</span></div><button type="button" onClick={onClose}>×</button></header>
      <div className="cp-notification-actions"><button type="button" onClick={() => load()}>Atualizar</button><button type="button" onClick={markAll}>Marcar pessoais como lidas</button></div>
      <div className="cp-drawer-content">
        {loading && <div className="cp-loading">Atualizando sinais…</div>}
        {error && <div className="cp-error">{error}</div>}
        {!!data.operational?.length && <section className="cp-notification-section"><h3>Operação</h3>{data.operational.map(item => <button type="button" className={`cp-notification severity-${item.type || 'warning'}`} key={item.id} onClick={() => openReference(item)}><i/><span><b>{item.title}</b><small>{item.message}</small><em>{fmt(item.created_at)}</em></span></button>)}</section>}
        <section className="cp-notification-section"><h3>Conta e ecossistema</h3>{data.notifications?.length ? data.notifications.map(item => <button type="button" className={`cp-notification ${item.read_at ? 'read' : 'unread'}`} key={item.id} onClick={() => openReference(item)}><i/><span><b>{item.title}</b><small>{item.message}</small><em>{fmt(item.created_at)}</em></span></button>) : <p className="cp-empty">Nenhuma notificação pessoal.</p>}</section>
      </div>
    </aside>
  </div>
}
