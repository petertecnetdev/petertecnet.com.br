import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { controlApi } from './api.js'
import { connectAdminRealtime } from './realtime.js'
import ControlPalette from './ControlPalette.jsx'
import Entity360Drawer from './Entity360Drawer.jsx'
import NotificationCenter from './NotificationCenter.jsx'
import SavedViewsPanel from './SavedViewsPanel.jsx'
import BulkOperationsModal from './BulkOperationsModal.jsx'
import TimelineDrawer from './TimelineDrawer.jsx'
import './ControlPlane.css'

const DASHBOARD_PREFS_KEY = 'petertecnet_admin_dashboard_preferences_v1'
const SYNC_RELOAD_KEY = 'petertecnet_admin_dashboard_synced_v2'

function percent(value) {
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function InsightSurface({ mode, insights, realtimeState, onOpenEntity }) {
  const metrics = insights?.metrics || {}
  const anomalies = insights?.anomalies || []
  const labels = { users: 'Novos usuários', establishments: 'Novos estabelecimentos', interactions: 'Interações', orders: 'Pedidos', payments: 'Pagamentos' }

  return <section className={`cp-intelligence-surface ${mode}`}>
    <header><div><p>{mode === 'executive' ? 'EXECUTIVE INTELLIGENCE' : 'OPERATION INTELLIGENCE'}</p><h3>{mode === 'executive' ? 'Pulso do negócio' : 'Sinais que merecem atenção'}</h3></div><span className={`cp-realtime-state ${realtimeState}`}>{realtimeState === 'connected' ? 'Tempo real' : realtimeState === 'degraded' ? 'Fallback ativo' : 'Conectando'}</span></header>
    {mode === 'executive' ? <div className="cp-comparison-grid">{Object.entries(metrics).map(([key, value]) => <article key={key}><span>{labels[key] || key}</span><strong>{value.current ?? 0}</strong><small className={Number(value.change_percent) >= 0 ? 'positive' : 'negative'}>{percent(value.change_percent)} vs período anterior</small></article>)}</div> : <div className="cp-anomaly-grid">{anomalies.length ? anomalies.slice(0, 6).map((item, index) => <button type="button" key={`${item.type}-${index}`} className={`severity-${item.severity || 'warning'}`} onClick={() => item.entity_type && item.entity_id && onOpenEntity(item.entity_type, item.entity_id)}><i/><span><b>{item.title}</b><small>{item.message}</small></span></button>) : <div className="cp-all-clear"><i>✓</i><span><b>Nenhuma anomalia relevante</b><small>Os comparativos automáticos não identificaram desvios importantes neste momento.</small></span></div>}</div>}
  </section>
}

export default function AdminControlPlane() {
  const [actionsTarget, setActionsTarget] = useState(null)
  const [insightsTarget, setInsightsTarget] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [entityTarget, setEntityTarget] = useState(null)
  const [revision, setRevision] = useState(0)
  const [unread, setUnread] = useState(0)
  const [realtimeState, setRealtimeState] = useState('connecting')
  const [insights, setInsights] = useState(null)
  const [mode, setMode] = useState('operations')
  const [history, setHistory] = useState([])
  const [favorites, setFavorites] = useState([])
  const [prefsReady, setPrefsReady] = useState(false)

  const preferenceSnapshot = useMemo(() => ({ mode, history, favorites }), [mode, history, favorites])

  function openEntity(type, id) {
    if (!type || !id) return
    setEntityTarget({ type, id: Number(id) })
  }

  async function savePreference(key, value) {
    try {
      await controlApi(`/v1/me/workspace/preferences/admin-center/${key}`, { method: 'PUT', body: JSON.stringify({ value }) })
    } catch { /* local experience remains usable when preference sync is temporarily unavailable */ }
  }

  async function loadInsights() {
    try { setInsights(await controlApi('/admin/ecosystem/control-plane/insights')) } catch { /* operational UI degrades gracefully */ }
  }

  useEffect(() => {
    let disposed = false
    let host = null
    let scheduled = 0
    const connectTargets = () => {
      window.clearTimeout(scheduled)
      scheduled = window.setTimeout(() => {
        if (disposed) return
        setActionsTarget(document.querySelector('.ecosystem-top .top-actions'))
        const main = document.querySelector('.ecosystem-main')
        const header = document.querySelector('.ecosystem-top')
        if (main && header) {
          host = main.querySelector(':scope > .cp-intelligence-host')
          if (!host) {
            host = document.createElement('div')
            host.className = 'cp-intelligence-host'
            header.insertAdjacentElement('afterend', host)
          }
          setInsightsTarget(host)
        }
      }, 20)
    }
    connectTargets()
    const observer = new MutationObserver(connectTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { disposed = true; window.clearTimeout(scheduled); observer.disconnect(); host?.remove() }
  }, [])

  useEffect(() => {
    let active = true
    controlApi('/v1/me/workspace/preferences/admin-center').then(result => {
      if (!active) return
      const prefs = result?.preferences || {}
      if (prefs.workspace_mode === 'executive' || prefs.workspace_mode === 'operations') setMode(prefs.workspace_mode)
      if (Array.isArray(prefs.command_history)) setHistory(prefs.command_history)
      if (Array.isArray(prefs.command_favorites)) setFavorites(prefs.command_favorites)
      if (prefs.dashboard && typeof prefs.dashboard === 'object') {
        const remote = JSON.stringify(prefs.dashboard)
        const local = localStorage.getItem(DASHBOARD_PREFS_KEY)
        if (local !== remote) {
          localStorage.setItem(DASHBOARD_PREFS_KEY, remote)
          if (!sessionStorage.getItem(SYNC_RELOAD_KEY)) {
            sessionStorage.setItem(SYNC_RELOAD_KEY, '1')
            window.location.reload()
            return
          }
        }
      }
      setPrefsReady(true)
    }).catch(() => setPrefsReady(true))
    return () => { active = false }
  }, [])

  useEffect(() => {
    document.querySelector('.ecosystem-shell')?.setAttribute('data-admin-workspace', mode)
    if (prefsReady) savePreference('workspace_mode', mode)
  }, [mode, prefsReady])

  useEffect(() => { if (prefsReady) savePreference('command_history', history) }, [history, prefsReady])
  useEffect(() => { if (prefsReady) savePreference('command_favorites', favorites) }, [favorites, prefsReady])

  useEffect(() => {
    if (!prefsReady) return
    let previous = localStorage.getItem(DASHBOARD_PREFS_KEY)
    const id = window.setInterval(() => {
      const current = localStorage.getItem(DASHBOARD_PREFS_KEY)
      if (current === previous || !current) return
      previous = current
      try { savePreference('dashboard', JSON.parse(current)) } catch { /* invalid local preference is ignored */ }
    }, 1200)
    return () => window.clearInterval(id)
  }, [prefsReady])

  useEffect(() => {
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setPaletteOpen(true)
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false); setNotificationsOpen(false); setViewsOpen(false); setBulkOpen(false); setTimelineOpen(false); setEntityTarget(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    let stop = null
    let active = true
    connectAdminRealtime({
      onEcosystem: () => { if (active) { setRevision(value => value + 1); loadInsights() } },
      onNotification: () => { if (active) { setRevision(value => value + 1); setUnread(value => value + 1) } },
      onState: state => { if (active) setRealtimeState(state) },
    }).then(disconnect => { stop = disconnect })
    return () => { active = false; stop?.() }
  }, [])

  useEffect(() => {
    loadInsights()
    const id = window.setInterval(loadInsights, 60000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!prefsReady) return
    const defaultViews = ['users', 'establishments', 'activity', 'financial']
    Promise.all(defaultViews.map(scope => controlApi(`/v1/me/workspace/views/admin.${scope}`).catch(() => null))).then(results => {
      const defaultView = results.flatMap(result => result?.views || []).find(view => view.is_default)
      if (!defaultView?.configuration?.path || sessionStorage.getItem('petertecnet_default_view_applied')) return
      if (window.location.pathname === '/admin' || window.location.pathname === '/admin/mission-control') {
        sessionStorage.setItem('petertecnet_default_view_applied', '1')
      }
    })
  }, [prefsReady])

  const actions = actionsTarget ? createPortal(<div className="cp-top-actions">
    <button type="button" className="cp-mode-toggle" onClick={() => setMode(value => value === 'operations' ? 'executive' : 'operations')} title="Alternar workspace"><span>{mode === 'executive' ? 'EXEC' : 'OPS'}</span><i>{mode === 'executive' ? 'Executivo' : 'Operação'}</i></button>
    <button type="button" onClick={() => setViewsOpen(true)} title="Visualizações salvas">Visões</button>
    <button type="button" onClick={() => setTimelineOpen(true)} title="Linha do tempo unificada">Timeline</button>
    <button type="button" onClick={() => setBulkOpen(true)} title="Operações em lote auditadas">Lote</button>
    <button type="button" className="cp-notification-trigger" onClick={() => setNotificationsOpen(true)} title="Central de notificações">◌{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</button>
    <button type="button" className="cp-search-trigger" onClick={() => setPaletteOpen(true)}><span>⌕</span> Buscar <kbd>Ctrl K</kbd></button>
  </div>, actionsTarget) : null

  return <>
    {actions}
    {insightsTarget && createPortal(<InsightSurface mode={mode} insights={insights} realtimeState={realtimeState} onOpenEntity={openEntity} />, insightsTarget)}
    <ControlPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onOpenEntity={openEntity} history={history} favorites={favorites} onHistory={setHistory} onFavorites={setFavorites} />
    <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} revision={revision} onOpenEntity={openEntity} onUnreadChange={setUnread} />
    <SavedViewsPanel open={viewsOpen} onClose={() => setViewsOpen(false)} revision={revision} />
    <BulkOperationsModal open={bulkOpen} onClose={() => setBulkOpen(false)} onDone={() => setRevision(value => value + 1)} />
    <TimelineDrawer open={timelineOpen} onClose={() => setTimelineOpen(false)} revision={revision} onOpenEntity={openEntity} />
    <Entity360Drawer target={entityTarget} onClose={() => setEntityTarget(null)} />
  </>
}
