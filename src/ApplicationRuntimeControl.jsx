import { useCallback, useEffect, useMemo, useState } from 'react'
import { confirmAction } from './utils/uiDialog.js'
import './ApplicationRuntimeControl.css'

const MODES = [
  ['off', 'Desligado'],
  ['on_demand', 'Sob demanda'],
  ['normal', 'Normal'],
  ['realtime', 'Tempo real'],
]

const FEATURES = [
  ['scheduled_processing_enabled', 'Processamento agendado'],
  ['market_scanner_enabled', 'Scanner de mercado'],
  ['ai_enabled', 'Inteligência artificial'],
  ['notifications_enabled', 'Notificações'],
  ['emails_enabled', 'E-mails'],
  ['reports_enabled', 'Relatórios'],
  ['realtime_enabled', 'Tempo real'],
]

const modeLabel = value => MODES.find(([key]) => key === value)?.[1] || value || '—'

export default function ApplicationRuntimeControl({ applications = [], request }) {
  const manageable = useMemo(() => applications.filter(app => Number(app?.id) > 0), [applications])
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    if (!manageable.length) { setLoading(false); return }
    setLoading(true)
    const results = await Promise.all(manageable.map(async app => {
      try {
        const payload = await request(`/admin/ecosystem/applications/${app.id}/runtime`)
        return [app.id, { ...app, runtime: payload?.runtime || {}, error: '' }]
      } catch (error) {
        return [app.id, { ...app, runtime: null, error: error.message }]
      }
    }))
    setRows(Object.fromEntries(results))
    setLoading(false)
  }, [manageable, request])

  useEffect(() => { void load() }, [load])

  async function update(app, changes) {
    setSaving(current => ({ ...current, [app.id]: true }))
    setFeedback('')
    try {
      const payload = await request(`/admin/ecosystem/applications/${app.id}/runtime`, {
        method: 'PUT',
        body: JSON.stringify(changes),
      })
      setRows(current => ({
        ...current,
        [app.id]: { ...(current[app.id] || app), runtime: payload.runtime, error: '' },
      }))
      setFeedback(`${app.name}: ${payload.message || 'controle operacional atualizado.'}`)
    } catch (error) {
      setRows(current => ({
        ...current,
        [app.id]: { ...(current[app.id] || app), error: error.message },
      }))
    } finally {
      setSaving(current => ({ ...current, [app.id]: false }))
    }
  }

  async function changeMode(app, mode) {
    const isStopping = mode === 'off'
    if (isStopping) {
      const confirmed = await confirmAction({
        tone: 'danger',
        eyebrow: 'CONTROLE OPERACIONAL',
        title: `Suspender ${app.name}?`,
        message: 'O site, login e banco continuarão online. Jobs, scanner, IA, alertas, e-mails, relatórios e realtime controlados por este runtime serão interrompidos.',
        confirmLabel: 'Suspender processamento',
      })
      if (!confirmed) return
    }
    await update(app, {
      mode,
      reason: isStopping ? 'Suspenso manualmente pelo Admin Center para controlar consumo operacional.' : null,
    })
  }

  if (loading) return <div className="arc-loading">Carregando controle operacional das aplicações…</div>

  return <section className="arc-shell" aria-label="Controle operacional das plataformas">
    <header className="arc-header">
      <div><span>CONTROL PLANE</span><h3>Controle operacional das plataformas</h3><p>Suspenda processamento caro sem tirar sites, login ou banco do ar.</p></div>
      <button type="button" onClick={() => void load()}>↻ Atualizar estados</button>
    </header>

    {feedback && <div className="arc-feedback" role="status">{feedback}</div>}

    <div className="arc-grid">
      {manageable.map(app => {
        const row = rows[app.id] || app
        const runtime = row.runtime
        const busy = Boolean(saving[app.id])
        const isOff = runtime?.mode === 'off'
        const isOpen = Boolean(expanded[app.id])
        return <article className={`arc-card ${isOff ? 'is-off' : ''}`} key={app.id}>
          <div className="arc-card-head">
            <div className="arc-app">
              <span className="arc-logo">{app.logo ? <img src={app.logo} alt="" /> : String(app.name || app.slug || 'P').slice(0, 1).toUpperCase()}</span>
              <div><b>{app.name || app.slug}</b><small>{app.slug}</small></div>
            </div>
            {runtime && <span className={`arc-state ${runtime.mode}`}>{modeLabel(runtime.mode)}</span>}
          </div>

          {row.error ? <div className="arc-error">{row.error}</div> : runtime && <>
            <label className="arc-mode">Modo operacional
              <select value={runtime.mode} disabled={busy} onChange={event => void changeMode(app, event.target.value)}>
                {MODES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>

            <div className="arc-summary">
              <span><small>Processamento</small><b>{runtime.processing_enabled ? 'Ativo' : 'Parado'}</b></span>
              <span><small>Scanner</small><b>{runtime.market_scanner_enabled ? 'Ativo' : 'Parado'}</b></span>
              <span><small>Intervalo</small><b>{runtime.scan_interval_minutes || '—'} min</b></span>
            </div>

            {isOff && <div className="arc-off-note">Automação suspensa. Interface, autenticação e dados permanecem disponíveis.</div>}

            <button className="arc-details-button" type="button" onClick={() => setExpanded(current => ({ ...current, [app.id]: !isOpen }))}>{isOpen ? 'Ocultar controles' : 'Controles avançados'}</button>

            {isOpen && <div className="arc-details">
              {FEATURES.map(([key, label]) => <label className="arc-toggle" key={key}>
                <span>{label}</span>
                <input type="checkbox" checked={Boolean(runtime[key])} disabled={busy || isOff} onChange={event => void update(app, { [key]: event.target.checked })} />
              </label>)}
              <label className="arc-number">Intervalo do scanner (min)
                <input type="number" min="1" max="1440" value={runtime.scan_interval_minutes || 5} disabled={busy || isOff} onChange={event => setRows(current => ({ ...current, [app.id]: { ...current[app.id], runtime: { ...runtime, scan_interval_minutes: Number(event.target.value) } } }))} onBlur={event => void update(app, { scan_interval_minutes: Number(event.target.value) || 5 })} />
              </label>
              <label className="arc-number">Idle timeout (min)
                <input type="number" min="1" max="1440" value={runtime.idle_timeout_minutes || 15} disabled={busy || isOff} onChange={event => setRows(current => ({ ...current, [app.id]: { ...current[app.id], runtime: { ...runtime, idle_timeout_minutes: Number(event.target.value) } } }))} onBlur={event => void update(app, { idle_timeout_minutes: Number(event.target.value) || 15 })} />
              </label>
            </div>}
          </>}
        </article>
      })}
    </div>
  </section>
}
