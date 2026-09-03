import { useCallback, useEffect, useMemo, useState } from 'react'
import './IdentitySecurityCenter.css'

const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const pct = value => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

function identity() {
  if (!window.PeterIdentity) throw new Error('Peter Identity não foi carregado.')
  return window.PeterIdentity
}

function metricCard(label, value, detail) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

export default function IdentitySecurityCenter() {
  const [sessions, setSessions] = useState([])
  const [devices, setDevices] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [rollout, setRollout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const sdk = identity()
      const [sessionRows, deviceRows, obs, rolloutData] = await Promise.all([
        sdk.sessions(),
        sdk.devices(),
        sdk.observability(60).catch(() => null),
        sdk.rollout().catch(() => null),
      ])
      setSessions(Array.isArray(sessionRows) ? sessionRows : [])
      setDevices(Array.isArray(deviceRows) ? deviceRows : [])
      setMetrics(obs)
      setRollout(rolloutData)
    } catch (e) {
      setError(e?.message || 'Não foi possível carregar a segurança da conta.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const trusted = useMemo(() => devices.filter(device => device.trusted), [devices])
  const auth = metrics?.authentication || {}
  const sessionMetrics = metrics?.sessions || {}
  const legacy = metrics?.legacy || {}
  const infrastructure = metrics?.infrastructure || {}

  async function revokeSession(row) {
    if (!window.confirm(`Encerrar a sessão de ${row.application?.name || row.application?.slug || 'esta aplicação'}?`)) return
    setWorking(`session:${row.id}`)
    try {
      await identity().revokeSession(row.id)
      setNotice('Sessão encerrada.')
      await load()
    } catch (e) { setError(e?.message || 'Falha ao encerrar sessão.') }
    finally { setWorking('') }
  }

  async function revokeOthers() {
    if (!window.confirm('Encerrar todas as outras sessões e a continuidade SSO dos outros dispositivos?')) return
    setWorking('others')
    try {
      await identity().revokeOtherSessions()
      setNotice('Outras sessões encerradas.')
      await load()
    } catch (e) { setError(e?.message || 'Falha ao encerrar outras sessões.') }
    finally { setWorking('') }
  }

  async function renameDevice(device) {
    const name = window.prompt('Nome deste dispositivo', device.name || '')
    if (!name?.trim()) return
    setWorking(`device:${device.device_id}`)
    try {
      await identity().renameDevice(device.device_id, name.trim())
      setNotice('Dispositivo renomeado.')
      await load()
    } catch (e) { setError(e?.message || 'Falha ao renomear dispositivo.') }
    finally { setWorking('') }
  }

  async function toggleTrust(device) {
    setWorking(`trust:${device.device_id}`)
    try {
      await identity().trustDevice(device.device_id, !device.trusted)
      setNotice(device.trusted ? 'Dispositivo removido dos confiáveis.' : 'Dispositivo marcado como confiável.')
      await load()
    } catch (e) { setError(e?.message || 'Falha ao atualizar confiança do dispositivo.') }
    finally { setWorking('') }
  }

  async function revokeDevice(device) {
    if (!window.confirm(`Revogar ${device.name || 'este dispositivo'} e todas as sessões relacionadas?`)) return
    setWorking(`revoke:${device.device_id}`)
    try {
      await identity().revokeDevice(device.device_id)
      setNotice('Dispositivo revogado.')
      await load()
    } catch (e) { setError(e?.message || 'Falha ao revogar dispositivo.') }
    finally { setWorking('') }
  }

  async function saveRollout() {
    if (!rollout) return
    setWorking('rollout')
    try {
      const next = await identity().updateRollout(rollout)
      setRollout(next)
      setNotice('Rollout do Peter Identity atualizado.')
    } catch (e) { setError(e?.message || 'Falha ao atualizar rollout.') }
    finally { setWorking('') }
  }

  async function logoutLocal() {
    setWorking('logout-local')
    await identity().logoutCurrentApp()
    window.location.href = '/login'
  }

  async function logoutGlobal() {
    if (!window.confirm('Sair de todas as plataformas Peter Tecnet?')) return
    setWorking('logout-global')
    const ok = await identity().logoutEverywhere()
    if (ok) window.location.href = '/login'
    else setWorking('')
  }

  return <main className="identity-center">
    <header className="identity-hero">
      <div>
        <a href="/admin/mission-control/security" className="identity-back">← Mission Control</a>
        <p>PETER IDENTITY · GOVERNANÇA DE ACESSO</p>
        <h1>Identidade e sessões</h1>
        <span>Controle tokens, sessões, dispositivos confiáveis, rollout do SSO e saúde da autenticação em todo o ecossistema.</span>
      </div>
      <button className="identity-refresh" onClick={load} disabled={loading}>Atualizar</button>
    </header>

    {error && <div className="identity-alert danger" role="alert">{error}</div>}
    {notice && <div className="identity-alert success">{notice}</div>}

    <section className="identity-kpis">
      {metricCard('Sessões por aplicação', sessionMetrics.application_active ?? sessions.length, 'JWTs ativos no Identity')}
      {metricCard('Sessões globais', sessionMetrics.global_active ?? '—', 'Continuidade SSO do navegador')}
      {metricCard('Dispositivos confiáveis', sessionMetrics.trusted_devices ?? trusted.length, `${sessionMetrics.known_devices ?? devices.length} conhecidos`)}
      {metricCard('Sucesso de autenticação', metrics ? pct(auth.success_rate) : '—', `${auth.failed ?? 0} falha(s) na janela`)}
      {metricCard('Restaurações SSO', auth.sso_restores ?? '—', 'Últimos 60 minutos')}
      {metricCard('JWT legado detectado', legacy.tokens_seen ?? '—', legacy.ready_to_enforce ? 'Pronto para modo enforce' : `Modo ${legacy.mode || 'observe'}`)}
      {metricCard('Redis', infrastructure.redis_available === true ? 'OK' : infrastructure.redis_available === false ? 'Fallback DB' : '—', infrastructure.redis_latency_ms != null ? `${infrastructure.redis_latency_ms} ms` : 'Latência não disponível')}
      {metricCard('Step-up', (auth.step_up_granted ?? 0) + (auth.step_up_failed ?? 0), `${auth.step_up_failed ?? 0} recusado(s)`)}
    </section>

    <section className="identity-panel">
      <header><div><h2>Sessões por aplicação</h2><p>Cada plataforma recebe um JWT isolado e revogável.</p></div><button onClick={revokeOthers} disabled={working === 'others'}>Encerrar outras sessões</button></header>
      {loading ? <div className="identity-empty">Carregando…</div> : sessions.length ? <div className="identity-session-list">
        {sessions.map(row => <article className="identity-session" key={row.id}>
          <div><strong>{row.application?.name || row.application?.slug || 'Ecossistema'}</strong><p>{row.device?.name || 'Dispositivo'} · {row.auth_method || 'autenticação'}</p></div>
          <div className="identity-session-meta"><span>IP <b>{row.ip || '—'}</b></span><span>Última atividade <b>{fmt(row.last_seen_at)}</b></span><span>Expira <b>{fmt(row.expires_at)}</b></span></div>
          <button className="identity-danger-outline" onClick={() => revokeSession(row)} disabled={working === `session:${row.id}`}>Encerrar</button>
        </article>)}
      </div> : <div className="identity-empty">Nenhuma sessão ativa.</div>}
    </section>

    <section className="identity-panel">
      <header><div><h2>Dispositivos</h2><p>Confiança é explícita e alterações sensíveis exigem step-up.</p></div></header>
      {devices.length ? <div className="identity-device-grid">
        {devices.map(device => <article key={device.device_id}>
          <div className="identity-device-title"><strong>{device.name || 'Dispositivo'}</strong>{device.trusted && <span>Confiável</span>}</div>
          <p>{device.browser || 'Navegador'} · {device.platform || 'Plataforma'} · IP {device.last_ip_address || '—'}</p>
          <small>Primeiro acesso {fmt(device.first_seen_at)} · último acesso {fmt(device.last_seen_at)}</small>
          <div className="identity-device-actions"><button onClick={() => renameDevice(device)}>Renomear</button><button onClick={() => toggleTrust(device)}>{device.trusted ? 'Remover confiança' : 'Confiar'}</button><button className="danger" onClick={() => revokeDevice(device)}>Revogar</button></div>
        </article>)}
      </div> : <div className="identity-empty">Nenhum dispositivo identificado.</div>}
    </section>

    {rollout && <section className="identity-panel">
      <header><div><h2>Rollout do SSO global</h2><p>Liberação determinística por aplicação. Alterações exigem confirmação forte.</p></div></header>
      <div className="identity-rollout">
        <label><span>SSO global</span><input type="checkbox" checked={Boolean(rollout.enabled)} onChange={event => setRollout(current => ({ ...current, enabled: event.target.checked }))}/></label>
        <label><span>Percentual padrão</span><input type="number" min="0" max="100" value={rollout.default_percentage ?? 0} onChange={event => setRollout(current => ({ ...current, default_percentage: Number(event.target.value) }))}/></label>
        {Object.entries(rollout.applications || {}).map(([slug, value]) => <label key={slug}><span>{slug}</span><input type="number" min="0" max="100" value={value?.percentage ?? rollout.default_percentage ?? 0} onChange={event => setRollout(current => ({ ...current, applications: { ...(current.applications || {}), [slug]: { ...(value || {}), percentage: Number(event.target.value) } } }))}/></label>)}
      </div>
      <button onClick={saveRollout} disabled={working === 'rollout'}>{working === 'rollout' ? 'Salvando…' : 'Salvar rollout'}</button>
    </section>}

    <section className="identity-grid">
      <article className="identity-panel identity-actions"><header><div><h2>Logout</h2><p>Escolha o alcance da revogação.</p></div></header><button onClick={logoutLocal} disabled={Boolean(working)}><b>Sair somente do Admin Center</b><span>As demais plataformas continuam autenticadas.</span></button><button className="danger" onClick={logoutGlobal} disabled={Boolean(working)}><b>Sair de todo o ecossistema</b><span>Revoga sessões locais, globais e tokens existentes.</span></button></article>
      <article className="identity-panel"><header><div><h2>Política de migração</h2><p>Retirada controlada do JWT legado.</p></div></header><ul className="identity-policy"><li><b>Modo atual</b><span>{legacy.mode || 'observe'}</span></li><li><b>Sunset</b><span>{legacy.sunset_at ? fmt(legacy.sunset_at) : '—'}</span></li><li><b>Pronto para enforce</b><span>{legacy.ready_to_enforce ? 'Sim — nenhum token legado observado na janela' : 'Ainda não'}</span></li><li><b>Fail-safe</b><span>JWT local válido continua operando se o SSO central estiver temporariamente indisponível.</span></li></ul></article>
    </section>
  </main>
}
