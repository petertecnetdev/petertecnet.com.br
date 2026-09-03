import { useCallback, useEffect, useMemo, useState } from 'react'
import './IdentitySecurityCenter.css'

const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const eventLabel = value => ({
  session_created: 'Sessão criada',
  session_exchanged: 'Acesso restaurado por SSO',
  session_revoked: 'Sessão encerrada',
  new_device: 'Novo dispositivo',
  csrf_rejected: 'Proteção CSRF rejeitou a solicitação',
  refresh_rejected: 'Refresh token rejeitado',
  session_risk_detected: 'Contexto de sessão suspeito',
  global_logout: 'Logout global',
  application_logout: 'Logout da aplicação',
  other_sessions_revoked: 'Outras sessões encerradas',
  handoff_exchanged: 'Handoff SSO utilizado',
}[value] || String(value || 'Evento de autenticação').replaceAll('_', ' '))

function sdk() {
  const identity = window.PeterTecnetAuthSession
  if (!identity) throw new Error('Peter Identity ainda não foi carregado.')
  return identity
}

export default function IdentitySecurityCenter() {
  const [sessions, setSessions] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sessionData, authEvents] = await Promise.all([
        sdk().sessions(),
        sdk().authEvents(80),
      ])
      setSessions(sessionData?.sessions || [])
      setCurrentId(sessionData?.current_session_id || null)
      setEvents(authEvents || [])
    } catch (e) {
      setError(e?.message || 'Não foi possível carregar as sessões.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const active = useMemo(() => sessions.filter(row => row.active), [sessions])
  const devices = useMemo(() => new Set(active.map(row => row.device?.id).filter(Boolean)).size, [active])
  const riskyEvents = useMemo(() => events.filter(row => row.type === 'session_risk_detected' || row.outcome === 'failure' || row.outcome === 'challenge_required').length, [events])

  async function revoke(session) {
    if (!window.confirm(`Encerrar a sessão em ${session.device?.name || 'outro dispositivo'}?`)) return
    setWorking(session.id)
    setError('')
    try {
      await sdk().revokeSession(session.id)
      if (session.id === currentId) {
        window.location.href = '/login'
        return
      }
      setNotice('Sessão encerrada com sucesso.')
      await load()
    } catch (e) {
      setError(e?.message || 'Não foi possível encerrar a sessão.')
    } finally {
      setWorking('')
    }
  }

  async function revokeOthers() {
    if (!window.confirm('Encerrar todas as outras sessões da sua Conta Peter Tecnet?')) return
    setWorking('others')
    setError('')
    try {
      const result = await sdk().revokeOtherSessions()
      setNotice(`${result?.revoked_count || 0} sessão(ões) encerrada(s).`)
      await load()
    } catch (e) {
      setError(e?.message || 'Não foi possível encerrar as outras sessões.')
    } finally {
      setWorking('')
    }
  }

  async function logoutCurrent() {
    setWorking('local')
    try {
      await sdk().logoutCurrentApp()
      window.location.href = '/login'
    } catch (e) {
      setError(e?.message || 'Não foi possível sair do Admin Center.')
      setWorking('')
    }
  }

  async function logoutEverywhere() {
    if (!window.confirm('Sair de TODAS as plataformas Peter Tecnet e revogar todas as sessões?')) return
    setWorking('global')
    try {
      await sdk().logoutEverywhere()
      window.location.href = '/login'
    } catch (e) {
      setError(e?.message || 'Não foi possível encerrar todas as sessões.')
      setWorking('')
    }
  }

  return <main className="identity-center">
    <header className="identity-hero">
      <div>
        <a href="/admin/mission-control/security" className="identity-back">← Mission Control</a>
        <p>PETER IDENTITY · SEGURANÇA DA CONTA</p>
        <h1>Sessões e dispositivos</h1>
        <span>Controle onde sua Conta Peter Tecnet está autenticada em todo o ecossistema.</span>
      </div>
      <button className="identity-refresh" onClick={load} disabled={loading}>Atualizar</button>
    </header>

    {error && <div className="identity-alert danger" role="alert">{error}</div>}
    {notice && <div className="identity-alert success">{notice}</div>}

    <section className="identity-kpis">
      <article><span>Sessões ativas</span><strong>{active.length}</strong><small>Em todo o ecossistema</small></article>
      <article><span>Dispositivos ativos</span><strong>{devices}</strong><small>Navegadores identificados</small></article>
      <article><span>Eventos de risco</span><strong>{riskyEvents}</strong><small>Nos últimos {Math.min(events.length, 80)} eventos</small></article>
    </section>

    <section className="identity-panel">
      <header>
        <div><h2>Dispositivos e sessões</h2><p>A sessão atual fica destacada. Sessões revogadas permanecem visíveis para auditoria.</p></div>
        <button onClick={revokeOthers} disabled={working === 'others' || active.length <= 1}>Encerrar outras sessões</button>
      </header>
      {loading ? <div className="identity-loading">Carregando sessões…</div> : sessions.length ? <div className="identity-session-list">
        {sessions.map(session => <article className={`identity-session ${session.id === currentId ? 'current' : ''} ${!session.active ? 'inactive' : ''}`} key={session.id}>
          <div className="identity-device-icon" aria-hidden="true">{session.device?.platform === 'iOS' || session.device?.platform === 'Android' ? '▯' : '▱'}</div>
          <div className="identity-session-main">
            <div className="identity-session-title">
              <strong>{session.device?.name || `${session.device?.browser || 'Navegador'} ${session.device?.platform || ''}`}</strong>
              {session.id === currentId && <span className="identity-badge current">Sessão atual</span>}
              {!session.active && <span className="identity-badge revoked">Encerrada</span>}
            </div>
            <p>{session.device?.browser || 'Navegador'} · {session.device?.platform || 'Dispositivo'} · IP {session.device?.last_ip_address || 'não informado'}</p>
            <div className="identity-session-meta">
              <span>Último app <b>{session.last_application?.name || session.last_application?.slug || '—'}</b></span>
              <span>Última atividade <b>{fmt(session.last_seen_at)}</b></span>
              <span>Expira <b>{fmt(session.refresh_expires_at)}</b></span>
            </div>
          </div>
          {session.active && <button className="identity-danger-outline" onClick={() => revoke(session)} disabled={working === session.id}>{working === session.id ? 'Encerrando…' : 'Encerrar'}</button>}
        </article>)}
      </div> : <div className="identity-empty">Nenhuma sessão encontrada.</div>}
    </section>

    <section className="identity-grid">
      <article className="identity-panel identity-actions">
        <header><div><h2>Saída da conta</h2><p>Escolha o alcance correto do logout.</p></div></header>
        <button onClick={logoutCurrent} disabled={Boolean(working)}><b>Sair somente do Admin Center</b><span>As outras plataformas continuam autenticadas.</span></button>
        <button className="danger" onClick={logoutEverywhere} disabled={Boolean(working)}><b>Sair de todas as plataformas</b><span>Revoga sessões e tokens do ecossistema inteiro.</span></button>
      </article>

      <article className="identity-panel">
        <header><div><h2>Política ativa</h2><p>Controles aplicados pela API central.</p></div></header>
        <ul className="identity-policy">
          <li><b>JWT isolado por aplicação</b><span>Cada plataforma recebe seu próprio token de curta duração.</span></li>
          <li><b>Refresh rotativo</b><span>Segredos de renovação são substituídos e nunca persistidos em texto puro.</span></li>
          <li><b>Origem + CSRF</b><span>A troca silenciosa é vinculada ao aplicativo e à origem HTTPS.</span></li>
          <li><b>Revogação global</b><span>Mudanças de segurança invalidam tokens já emitidos.</span></li>
        </ul>
      </article>
    </section>

    <section className="identity-panel">
      <header><div><h2>Histórico de autenticação</h2><p>Eventos recentes da sua Conta Peter Tecnet.</p></div></header>
      <div className="identity-events">
        {events.length ? events.map(event => <article key={event.id}>
          <span className={`identity-event-dot ${event.outcome}`}/>
          <div><b>{eventLabel(event.type)}</b><small>{event.application?.name || event.application?.slug || 'Ecossistema'} · {event.ip_address || 'IP não informado'}</small></div>
          <time>{fmt(event.occurred_at)}</time>
        </article>) : <div className="identity-empty">Nenhum evento recente.</div>}
      </div>
    </section>
  </main>
}
