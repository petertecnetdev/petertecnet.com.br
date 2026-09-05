import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './SupportPublicApp.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const SESSION_KEY = 'petertecnet_support_session'

const categories = [
  ['general', 'Dúvida geral'],
  ['access', 'Acesso e login'],
  ['account', 'Minha conta'],
  ['technical', 'Problema técnico'],
  ['billing', 'Pagamento e cobrança'],
  ['bug', 'Erro na plataforma'],
  ['suggestion', 'Sugestão'],
  ['security', 'Segurança'],
]

const statusLabel = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_customer: 'Aguardando você',
  resolved: 'Resolvido',
  closed: 'Encerrado',
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || Object.values(payload?.errors || {}).flat()?.[0] || 'Não foi possível concluir a operação.')
  }
  return payload
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

function saveSession(value) {
  if (!value) localStorage.removeItem(SESSION_KEY)
  else localStorage.setItem(SESSION_KEY, JSON.stringify(value))
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function Header() {
  return <header className="support-nav">
    <a className="support-brand" href="/"><img src="/petertecnetlogo.png" alt=""/><span><b>Peter Tecnet</b><small>Support Center</small></span></a>
    <nav><a href="/">Início</a><a href="/#ecossistema">Ecossistema</a><a className="support-nav-cta" href="#abrir-chamado">Abrir chamado</a></nav>
  </header>
}

function TicketConversation({ ticket, session, onRefresh, onNewTicket }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function reply(event) {
    event.preventDefault()
    if (!message.trim() || sending) return
    setSending(true); setError('')
    try {
      await api(`/support/tickets/${encodeURIComponent(session.publicId)}/messages`, {
        method: 'POST',
        headers: { 'X-Support-Token': session.token, 'X-Peter-App': session.appSlug || 'peter-tecnet' },
        body: JSON.stringify({ message: message.trim() }),
      })
      setMessage('')
      await onRefresh()
    } catch (err) { setError(err.message) }
    finally { setSending(false) }
  }

  return <section className="support-card conversation-card">
    <div className="ticket-topline">
      <div><span className={`ticket-status status-${ticket.status}`}>{statusLabel[ticket.status] || ticket.status}</span><small>#{ticket.public_id.slice(0, 8).toUpperCase()}</small></div>
      <button type="button" className="ghost-button" onClick={onNewTicket}>Novo chamado</button>
    </div>
    <h2>{ticket.subject}</h2>
    <div className="ticket-meta">
      <span><small>Aplicação</small><b>{ticket.application?.name || 'Peter Tecnet'}</b></span>
      <span><small>Categoria</small><b>{categories.find(([value]) => value === ticket.category)?.[1] || ticket.category}</b></span>
      <span><small>Última atividade</small><b>{formatDate(ticket.last_message_at || ticket.updated_at)}</b></span>
    </div>
    <div className="conversation-list">
      {(ticket.messages || []).map(item => <article key={item.id} className={`message-row message-${item.author_type}`}>
        <div><b>{item.author_name || (item.author_type === 'agent' ? 'Equipe Peter Tecnet' : ticket.requester_name)}</b><time>{formatDate(item.created_at)}</time></div>
        <p>{item.body}</p>
      </article>)}
    </div>
    <form className="reply-form" onSubmit={reply}>
      <label><span>Responder ao suporte</span><textarea value={message} onChange={event => setMessage(event.target.value)} rows="4" maxLength="12000" placeholder="Escreva sua mensagem…" required/></label>
      {error && <p className="support-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={sending}>{sending ? 'Enviando…' : 'Enviar resposta'}<span>↗</span></button>
    </form>
  </section>
}

function SupportApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [applications, setApplications] = useState([])
  const [form, setForm] = useState({
    name: '', email: '', phone: '', application_slug: params.get('app') || '', category: 'general', subject: '', message: '',
  })
  const [session, setSession] = useState(() => {
    const fromUrl = params.get('ticket') && params.get('token') ? { publicId: params.get('ticket'), token: params.get('token'), appSlug: params.get('app') || '' } : null
    return fromUrl || loadSession()
  })
  const [ticket, setTicket] = useState(null)
  const [loadingTicket, setLoadingTicket] = useState(Boolean(session))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api('/applications').then(payload => {
      const rows = payload?.applications || payload?.data || (Array.isArray(payload) ? payload : [])
      setApplications(rows.filter(app => app?.is_active !== false))
    }).catch(() => {})
  }, [])

  async function refreshTicket(activeSession = session) {
    if (!activeSession?.publicId || !activeSession?.token) return
    setLoadingTicket(true); setError('')
    try {
      const payload = await api(`/support/tickets/${encodeURIComponent(activeSession.publicId)}`, {
        headers: { 'X-Support-Token': activeSession.token, 'X-Peter-App': activeSession.appSlug || 'peter-tecnet' },
      })
      setTicket(payload.ticket)
      saveSession(activeSession)
    } catch (err) {
      setError(err.message)
      setTicket(null)
    } finally { setLoadingTicket(false) }
  }

  useEffect(() => { if (session) void refreshTicket(session) }, [])

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const payload = await api('/support/tickets', {
        method: 'POST',
        headers: { 'X-Peter-App': form.application_slug || 'peter-tecnet' },
        body: JSON.stringify({
          ...form,
          channel: 'web',
          source_url: window.location.href,
          metadata: { viewport: `${window.innerWidth}x${window.innerHeight}`, locale: navigator.language || 'pt-BR' },
        }),
      })
      const nextSession = { publicId: payload.ticket.public_id, token: payload.access_token, appSlug: form.application_slug || 'peter-tecnet' }
      setSession(nextSession)
      saveSession(nextSession)
      setTicket(payload.ticket)
      setSuccess('Chamado aberto. O acompanhamento ficou salvo neste navegador.')
      window.history.replaceState({}, '', '/suporte')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  function newTicket() {
    setSession(null); setTicket(null); setError(''); setSuccess(''); saveSession(null)
    setForm(current => ({ ...current, category: 'general', subject: '', message: '' }))
    setTimeout(() => document.getElementById('abrir-chamado')?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  return <div className="support-shell">
    <Header/>
    <main>
      <section className="support-hero">
        <div className="support-grid-bg" aria-hidden="true"/>
        <div className="support-hero-copy">
          <p className="support-eyebrow"><span/> SUPORTE / ECOSSISTEMA PETER TECNET</p>
          <h1>Um canal de suporte para <em>todas as nossas plataformas.</em></h1>
          <p>Cutinapp, Kryvion, Nexus, Rasoio, PayFlow, Laora e todo o ecossistema compartilham a mesma central. Você abre aqui; nossa equipe recebe o contexto da aplicação e acompanha tudo pelo Admin Center.</p>
          <div className="support-points"><span>Chamados centralizados</span><span>Acompanhamento seguro</span><span>Histórico de conversa</span></div>
        </div>
        <aside className="support-hero-console"><small>SUPPORT / LIVE</small><strong>{ticket ? statusLabel[ticket.status] || ticket.status : 'ONLINE'}</strong><p>{ticket ? `Chamado #${ticket.public_id.slice(0, 8).toUpperCase()}` : 'Conte o que aconteceu e informe em qual plataforma precisa de ajuda.'}</p></aside>
      </section>

      <section className="support-content" id="abrir-chamado">
        {success && <div className="support-success">{success}</div>}
        {session && loadingTicket && <div className="support-card loading-state">Consultando seu chamado…</div>}
        {session && ticket && !loadingTicket ? <TicketConversation ticket={ticket} session={session} onRefresh={() => refreshTicket(session)} onNewTicket={newTicket}/> : !session && <>
          <div className="support-copy"><p className="support-eyebrow">ABRIR CHAMADO</p><h2>Explique o problema. O contexto vai junto.</h2><p>Informe a plataforma para direcionarmos melhor o atendimento. Para problemas de login, você pode abrir o chamado mesmo sem conseguir entrar na sua conta.</p></div>
          <form className="support-card support-form" onSubmit={submit}>
            <div className="form-grid two"><label><span>Nome</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength="160" required/></label><label><span>E-mail</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} maxLength="190" required/></label></div>
            <div className="form-grid two"><label><span>Aplicação</span><select value={form.application_slug} onChange={e => setForm({ ...form, application_slug: e.target.value })}><option value="">Peter Tecnet / Geral</option>{applications.map(app => <option key={app.id || app.slug} value={app.slug}>{app.name}</option>)}</select></label><label><span>Categoria</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
            <label><span>Telefone <small>opcional</small></span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} maxLength="40" placeholder="(00) 00000-0000"/></label>
            <label><span>Assunto</span><input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} maxLength="200" placeholder="Resuma o que aconteceu" required/></label>
            <label><span>Detalhes</span><textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows="7" maxLength="12000" placeholder="Explique o problema, o que você estava tentando fazer e o que apareceu na tela…" required/></label>
            {error && <p className="support-error" role="alert">{error}</p>}
            <button className="primary-button" disabled={submitting}>{submitting ? 'Abrindo chamado…' : 'Abrir chamado'}<span>↗</span></button>
            <p className="privacy-note">Ao abrir o chamado, enviamos apenas os dados informados e contexto técnico básico desta página para facilitar o diagnóstico.</p>
          </form>
        </>}
        {session && !ticket && !loadingTicket && <div className="support-card recovery-card"><h2>Não foi possível abrir o acompanhamento.</h2><p>{error || 'A credencial deste chamado pode ter expirado ou sido removida deste navegador.'}</p><button className="primary-button" onClick={newTicket}>Abrir novo chamado</button></div>}
      </section>
    </main>
    <footer className="support-footer"><a className="support-brand" href="/"><img src="/petertecnetlogo.png" alt=""/><span><b>Peter Tecnet</b><small>Tecnologia em movimento</small></span></a><p>Suporte central do ecossistema Peter Tecnet.</p><a href="/">Voltar ao site</a></footer>
  </div>
}

createRoot(document.getElementById('root')).render(<StrictMode><SupportApp/></StrictMode>)
