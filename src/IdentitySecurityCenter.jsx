import { useCallback, useEffect, useMemo, useState } from 'react'
import './IdentitySecurityCenter.css'

const API = 'https://api.petertecnet.com.br/api'
const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const eventLabel = value => ({
  new_session: 'Nova sessão',
  login_failed: 'Falha de login',
  logout: 'Logout da aplicação',
  logout_everywhere: 'Logout do ecossistema',
  session_revoked: 'Sessão encerrada',
  all_sessions_revoked: 'Sessões encerradas',
  global_session_created: 'Sessão global criada',
  global_session_refreshed: 'Sessão global renovada',
  global_sso_exchanged: 'Login restaurado por SSO',
  global_session_csrf_rejected: 'Proteção CSRF rejeitou a troca',
  global_session_refresh_rejected: 'Refresh global rejeitado',
  global_session_context_rejected: 'Contexto de dispositivo rejeitado',
  global_session_ip_changed: 'Rede da sessão mudou',
  session_context_rejected: 'Contexto da sessão rejeitado',
  session_ip_changed: 'Rede da sessão mudou',
  two_factor_enabled: '2FA ativado',
  two_factor_disabled: '2FA desativado',
  passkey_registered: 'Passkey cadastrada',
  password_changed: 'Senha alterada',
}[value] || String(value || 'Evento de identidade').replaceAll('_', ' '))

function identity() {
  const value = window.PeterTecnetAuthSession
  if (!value) throw new Error('Peter Identity ainda não foi carregado.')
  return value
}

async function identityActivity(limit = 80) {
  const response = await identity().authorizedFetch(`${API}/account/identity/activity?limit=${limit}`, {
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Não foi possível carregar o histórico de identidade.')
  return payload?.data || []
}

export default function IdentitySecurityCenter() {
  const [sessions, setSessions] = useState([])
  const [security, setSecurity] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sessionPayload, securityPayload, activity] = await Promise.all([
        identity().sessions(),
        identity().security(),
        identityActivity(),
      ])
      setSessions(sessionPayload?.data || [])
      setSecurity(securityPayload?.data || null)
      setEvents(activity)
    } catch (e) {
      setError(e?.message || 'Não foi possível carregar a segurança da conta.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const current = useMemo(() => sessions.find(row => row.current), [sessions])
  const devices = useMemo(() => new Set(sessions.map(row => `${row.device || 'device'}|${row.ip || ''}`)).size, [sessions])
  const riskyEvents = useMemo(() => events.filter(row => row.outcome === 'failure' || row.outcome === 'challenge_required').length, [events])

  async function revoke(session) {
    if (!window.confirm(`Encerrar a sessão em ${session.device || 'outro dispositivo'}?`)) return
    setWorking(session.id)
    setError('')
    try {
      await identity().revokeSession(session.id)
      if (session.current) {
        await identity().logoutCurrentApp()
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
    if (!window.confirm('Encerrar todas as outras sessões de aplicativos da sua Conta Peter Tecnet?')) return
    setWorking('others')
    setError('')
    try {
      const result = await identity().revokeOtherSessions()
      setNotice(`${result?.revoked || 0} sessão(ões) encerrada(s).`)
      await load()
    } catch (e) {
      setError(e?.message || 'Não foi possível encerrar as outras sessões.')
    } finally {
      setWorking('')
    }
  }

  async function logoutCurrent() {
    setWorking('local')
    setError('')
    try {
      await identity().logoutCurrentApp()
      window.location.href = '/login'
    } catch (e) {
      setError(e?.message || 'Não foi possível sair do Admin Center.')
      setWorking('')
    }
  }

  async function logoutEverywhere() {
    if (!window.confirm('Sair de TODAS as plataformas Peter Tecnet e invalidar todos os acessos existentes?')) return
    setWorking('global')
    setError('')
    try {
      await identity().logoutEverywhere()
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
        <span>Controle onde sua Conta Peter Tecnet está autenticada e qual proteção está ativa.</span>
      </div>
      <button className="identity-refresh" onClick={load} disabled={loading}>Atualizar</button>
    </header>

    {error && <div className="identity-alert danger" role="alert">{error}</div>}
    {notice && <div className="identity-alert success">{notice}</div>}

    <section className="identity-kpis">
      <article><span>Sessões ativas</span><strong>{sessions.length}</strong><small>JWTs revogáveis por aplicação</small></article>
      <article><span>Dispositivos</span><strong>{devices}</strong><small>Contextos identificados</small></article>
      <article><span>Eventos de atenção</span><strong>{riskyEvents}</strong><small>Na atividade recente</small></article>
      <article><span>2FA</span><strong>{security?.two_factor_enabled ? 'ATIVO' : 'OFF'}</strong><small>{security?.passkeys?.length || 0} passkey(s)</small></article>
    </section>

    <section className="identity-panel">
      <header>
        <div><h2>Sessões por aplicação</h2><p>Cada plataforma recebe um JWT próprio. A sessão atual fica destacada.</p></div>
        <button onClick={revokeOthers} disabled={working === 'others' || sessions.length <= 1}>Encerrar outras</button>
      </header>
      {loading ? <div className="identity-loading">Carregando segurança da conta…</div> : sessions.length ? <div className="identity-session-list">
        {sessions.map(session => <article className={`identity-session ${session.current ? 'current' : ''}`} key={session.id}>
          <div className="identity-device-icon" aria-hidden="true">▱</div>
          <div className="identity-session-main">
            <div className="identity-session-title">
              <strong>{session.device || 'Dispositivo'}</strong>
              {session.current && <span className="identity-badge current">Sessão atual</span>}
              {session.application?.name && <span className="identity-badge">{session.application.name}</span>}
            </div>
            <p>{session.auth_method || 'login'} · IP {session.ip || 'não informado'}</p>
            <div className="identity-session-meta">
              <span>Aplicação <b>{session.application?.name || session.application?.slug || 'Conta Peter Tecnet'}</b></span>
              <span>Última atividade <b>{fmt(session.last_seen_at)}</b></span>
              <span>Expira <b>{fmt(session.expires_at)}</b></span>
            </div>
          </div>
          <button className="identity-danger-outline" onClick={() => revoke(session)} disabled={working === session.id}>{working === session.id ? 'Encerrando…' : 'Encerrar'}</button>
        </article>)}
      </div> : <div className="identity-empty">Nenhuma sessão ativa encontrada.</div>}
      {current && <p className="identity-current-note">Esta tela está sendo usada por <b>{current.device}</b>.</p>}
    </section>

    <section className="identity-grid">
      <article className="identity-panel identity-actions">
        <header><div><h2>Saída da conta</h2><p>Escolha o alcance correto.</p></div></header>
        <button onClick={logoutCurrent} disabled={Boolean(working)}><b>Sair somente do Admin Center</b><span>Outras plataformas continuam autenticadas.</span></button>
        <button className="danger" onClick={logoutEverywhere} disabled={Boolean(working)}><b>Sair de todas as plataformas</b><span>Revoga sessões globais, sessões por app e JWTs antigos.</span></button>
      </article>

      <article className="identity-panel">
        <header><div><h2>Proteções ativas</h2><p>Política aplicada pelo Identity Core.</p></div></header>
        <ul className="identity-policy">
          <li><b>JWT curto por aplicação</b><span>Impacto limitado mesmo se um token for copiado.</span></li>
          <li><b>Refresh global rotativo</b><span>Segredos são substituídos e só hashes ficam no servidor.</span></li>
          <li><b>Origem + CSRF</b><span>A troca silenciosa é vinculada ao app e ao domínio HTTPS.</span></li>
          <li><b>2FA e Passkeys</b><span>{security?.two_factor_enabled ? '2FA ativo' : '2FA disponível'} · {security?.passkeys?.length || 0} passkey(s) cadastrada(s).</span></li>
        </ul>
      </article>
    </section>

    <section className="identity-panel">
      <header><div><h2>Histórico de autenticação</h2><p>Somente eventos de Identity pertencentes à sua própria conta.</p></div></header>
      <div className="identity-events">
        {events.length ? events.map(event => <article key={event.id}>
          <span className={`identity-event-dot ${event.outcome}`}/>
          <div><b>{eventLabel(event.type)}</b><small>{event.application?.slug || 'Ecossistema'} · {event.ip_address || 'IP não informado'}</small></div>
          <time>{fmt(event.occurred_at)}</time>
        </article>) : <div className="identity-empty">Nenhum evento recente.</div>}
      </div>
    </section>
  </main>
}
