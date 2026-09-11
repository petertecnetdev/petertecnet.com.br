import { useEffect, useMemo, useState } from 'react'
import './AdminProspectInvitation.css'

const CUTINAPP_PERSONAS = [
  { value: 'participant', label: 'Participante', hint: 'Descobrir eventos, comprar ingressos e itens, interagir e acompanhar movimentações.' },
  { value: 'producer', label: 'Produtor', hint: 'Divulgar eventos, vender ingressos e itens e se relacionar com participantes.' },
  { value: 'artist', label: 'Artista', hint: 'Ganhar destaque, presença nos eventos e conexão com produtores e público.' },
  { value: 'promoter', label: 'Promoter', hint: 'Divulgar eventos, conectar público e reduzir o caminho até a compra.' },
]

const GENERIC_PERSONAS = [
  { value: 'client', label: 'Cliente', hint: 'Apresentação dos benefícios da plataforma para uso direto.' },
  { value: 'professional', label: 'Profissional', hint: 'Foco em operação, produtividade, automação e integração.' },
  { value: 'partner', label: 'Parceiro', hint: 'Foco em parceria comercial e integração com o ecossistema.' },
]

const STATUS_LABELS = {
  pending: 'Pendente',
  accepted: 'Aceito',
  expired: 'Expirado',
  revoked: 'Revogado',
}

const DELIVERY_LABELS = {
  queued: 'Na fila',
  sent: 'Enviado',
  delivered: 'Entregue',
  read: 'Lido',
  failed: 'Falhou',
}

const CUTINAPP_SLUGS = new Set(['cutinapp', 'cutin-app', 'catchnap', 'catinapp'])

function isCutinapp(application) {
  const slug = String(application?.slug || '').trim().toLowerCase()
  const name = String(application?.name || '').trim().toLowerCase()
  return CUTINAPP_SLUGS.has(slug) || name.includes('cutin') || name.includes('catchnap')
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function channelLabel(channel) {
  return channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'
}

export default function AdminProspectInvitation({ apiRequest, applications = [] }) {
  const activeApplications = useMemo(() => applications.filter(app => app?.is_active !== false), [applications])
  const [form, setForm] = useState({
    channel: 'whatsapp',
    phone: '',
    email: '',
    recipient_name: '',
    application_id: '',
    persona: '',
    whatsapp_consent: false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [invitations, setInvitations] = useState([])
  const [loadingInvitations, setLoadingInvitations] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [actionId, setActionId] = useState(null)

  const selectedApplication = useMemo(
    () => activeApplications.find(app => String(app.id) === String(form.application_id)) || null,
    [activeApplications, form.application_id],
  )

  const personas = useMemo(
    () => selectedApplication && isCutinapp(selectedApplication) ? CUTINAPP_PERSONAS : GENERIC_PERSONAS,
    [selectedApplication],
  )

  const selectedPersona = personas.find(persona => persona.value === form.persona) || null
  const isWhatsApp = form.channel === 'whatsapp'

  async function refreshInvitations({ silent = false } = {}) {
    if (!silent) setLoadingInvitations(true)
    setHistoryError('')

    try {
      const payload = await apiRequest('/admin/ecosystem/invitations?limit=10')
      setInvitations(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setHistoryError(err?.message || 'Não foi possível carregar os convites recentes.')
    } finally {
      if (!silent) setLoadingInvitations(false)
    }
  }

  useEffect(() => {
    let active = true

    async function load() {
      setLoadingInvitations(true)
      try {
        const payload = await apiRequest('/admin/ecosystem/invitations?limit=10')
        if (active) {
          setInvitations(Array.isArray(payload?.data) ? payload.data : [])
          setHistoryError('')
        }
      } catch (err) {
        if (active) setHistoryError(err?.message || 'Não foi possível carregar os convites recentes.')
      } finally {
        if (active) setLoadingInvitations(false)
      }
    }

    void load()
    return () => { active = false }
  }, [apiRequest])

  function change(field, value) {
    setForm(current => {
      if (field === 'application_id') return { ...current, application_id: value, persona: '' }
      if (field === 'channel') return { ...current, channel: value, whatsapp_consent: value === 'whatsapp' ? current.whatsapp_consent : false }
      return { ...current, [field]: value }
    })
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.application_id || !form.persona) {
      setError('Selecione a plataforma e o perfil do destinatário.')
      return
    }

    if (isWhatsApp && !form.phone.trim()) {
      setError('Informe o número do WhatsApp com DDD.')
      return
    }

    if (!isWhatsApp && !form.email.trim()) {
      setError('Informe o e-mail do destinatário.')
      return
    }

    if (isWhatsApp && !form.whatsapp_consent) {
      setError('Confirme que este WhatsApp foi fornecido para contato e onboarding.')
      return
    }

    setBusy(true)
    try {
      const payload = await apiRequest('/admin/ecosystem/invitations/prospect', {
        method: 'POST',
        body: JSON.stringify({
          channel: form.channel,
          phone: form.phone.trim() || null,
          email: form.email.trim().toLowerCase() || null,
          whatsapp_consent: isWhatsApp ? form.whatsapp_consent : null,
          recipient_name: form.recipient_name.trim() || null,
          application_id: Number(form.application_id),
          persona: form.persona,
        }),
      })
      setSuccess(payload?.message || 'Convite enviado com sucesso.')
      setForm(current => ({
        ...current,
        phone: '',
        email: '',
        recipient_name: '',
        whatsapp_consent: false,
      }))
      await refreshInvitations({ silent: true })
    } catch (err) {
      setError(err?.message || 'Não foi possível enviar o convite.')
      await refreshInvitations({ silent: true })
    } finally {
      setBusy(false)
    }
  }

  async function resend(invitation) {
    setActionId(invitation.id)
    setHistoryError('')
    setSuccess('')

    try {
      const payload = await apiRequest(`/admin/ecosystem/invitations/${invitation.id}/resend`, {
        method: 'POST',
      })
      setSuccess(payload?.message || 'Convite reenviado com sucesso.')
      await refreshInvitations({ silent: true })
    } catch (err) {
      setHistoryError(err?.message || 'Não foi possível reenviar o convite.')
    } finally {
      setActionId(null)
    }
  }

  async function revoke(invitation) {
    setActionId(invitation.id)
    setHistoryError('')
    setSuccess('')

    try {
      const payload = await apiRequest(`/admin/ecosystem/invitations/${invitation.id}`, {
        method: 'DELETE',
      })
      setSuccess(payload?.message || 'Convite revogado.')
      await refreshInvitations({ silent: true })
    } catch (err) {
      setHistoryError(err?.message || 'Não foi possível revogar o convite.')
    } finally {
      setActionId(null)
    }
  }

  return <section className="api-card" id="admin-prospect-invitation">
    <header className="api-head">
      <div>
        <span>PROSPECÇÃO E CONVITES</span>
        <h3>Convidar para uma plataforma</h3>
        <p>Cadastre pelo WhatsApp ou e-mail. O usuário recebe um código, confirma o contato e cria a própria senha no primeiro acesso.</p>
      </div>
      <span className="api-badge">WhatsApp + e-mail</span>
    </header>

    <div className="api-grid">
      <form className="api-form" onSubmit={submit}>
        <div className="api-wide api-channel-field">
          <span>Canal do convite</span>
          <div className="api-channel-options">
            <button type="button" className={isWhatsApp ? 'is-active' : ''} onClick={() => change('channel', 'whatsapp')}>
              <strong>WhatsApp</strong>
              <small>Mais rápido para primeiro acesso</small>
            </button>
            <button type="button" className={!isWhatsApp ? 'is-active' : ''} onClick={() => change('channel', 'email')}>
              <strong>E-mail</strong>
              <small>Fluxo tradicional</small>
            </button>
          </div>
        </div>

        <label>Nome <small>opcional</small>
          <input value={form.recipient_name} onChange={event => change('recipient_name', event.target.value)} maxLength={120} placeholder="Nome da pessoa ou contato"/>
        </label>

        {isWhatsApp ? (
          <label>WhatsApp
            <input type="tel" value={form.phone} onChange={event => change('phone', event.target.value)} placeholder="(62) 99999-9999" required/>
          </label>
        ) : (
          <label>E-mail
            <input type="email" value={form.email} onChange={event => change('email', event.target.value)} placeholder="contato@exemplo.com" required/>
          </label>
        )}

        {isWhatsApp && <label className="api-wide">E-mail <small>opcional</small>
          <input type="email" value={form.email} onChange={event => change('email', event.target.value)} placeholder="Pode ser adicionado depois"/>
        </label>}

        <label>Plataforma
          <select value={form.application_id} onChange={event => change('application_id', event.target.value)} required>
            <option value="">Selecione</option>
            {activeApplications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </label>

        <label>Perfil do convite
          <select value={form.persona} onChange={event => change('persona', event.target.value)} disabled={!selectedApplication} required>
            <option value="">{selectedApplication ? 'Selecione o perfil' : 'Escolha primeiro a plataforma'}</option>
            {personas.map(persona => <option key={persona.value} value={persona.value}>{persona.label}</option>)}
          </select>
        </label>

        {isWhatsApp && <label className="api-wide api-consent">
          <input
            type="checkbox"
            checked={form.whatsapp_consent}
            onChange={event => change('whatsapp_consent', event.target.checked)}
          />
          <span>Confirmo que o titular forneceu este número para contato e onboarding pelo WhatsApp.</span>
        </label>}

        {error && <div className="api-feedback api-feedback--error api-wide">{error}</div>}
        {success && <div className="api-feedback api-feedback--success api-wide">{success}</div>}

        <button className="api-submit api-wide" disabled={busy || !selectedApplication || !selectedPersona}>
          {busy ? 'Criando e enviando…' : isWhatsApp ? 'Enviar convite pelo WhatsApp' : 'Enviar convite por e-mail'}
        </button>
      </form>

      <aside className="api-preview">
        <span>COMO O ACESSO SERÁ CRIADO</span>
        <h4>{selectedApplication?.name || 'Selecione uma plataforma'}</h4>
        <strong>{selectedPersona?.label || 'Perfil ainda não selecionado'}</strong>
        <p>{isWhatsApp
          ? 'O usuário receberá no WhatsApp uma mensagem de boas-vindas, o link seguro e um código de 6 dígitos. O número só será marcado como confirmado após validar o código.'
          : selectedPersona?.hint || 'O usuário receberá um link temporário e um código de verificação por e-mail. A senha será definida pelo próprio destinatário.'}</p>
        {selectedApplication?.url && <a href={selectedApplication.url} target="_blank" rel="noreferrer">Abrir plataforma ↗</a>}
        {selectedApplication && isCutinapp(selectedApplication) && <div className="api-context-note">
          <b>Cutinapp</b>
          <small>O perfil selecionado também fica associado ao vínculo inicial com a plataforma.</small>
        </div>}
      </aside>
    </div>

    <div className="api-history">
      <div className="api-history-head">
        <div>
          <span>HISTÓRICO</span>
          <h4>Convites recentes</h4>
        </div>
        <button type="button" className="api-history-refresh" onClick={() => refreshInvitations()} disabled={loadingInvitations}>
          {loadingInvitations ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {historyError && <div className="api-feedback api-feedback--error">{historyError}</div>}

      {loadingInvitations ? (
        <div className="api-history-empty">Carregando convites…</div>
      ) : invitations.length === 0 ? (
        <div className="api-history-empty">Nenhum convite registrado ainda.</div>
      ) : (
        <div className="api-history-list">
          {invitations.map(invitation => {
            const canManage = invitation.status !== 'accepted'
            const processing = actionId === invitation.id
            const destination = invitation.channel === 'whatsapp'
              ? (invitation.phone || invitation.destination)
              : (invitation.email || invitation.destination)

            return <article className="api-history-row" key={invitation.id}>
              <div className="api-history-main">
                <div className="api-history-email">{destination || 'Contato indisponível'}</div>
                <div className="api-history-meta">
                  <span>{channelLabel(invitation.channel)}</span>
                  <span>{invitation.application?.name || 'Plataforma removida'}</span>
                  {invitation.persona && <span>{invitation.persona}</span>}
                  {invitation.delivery_status && <span>{DELIVERY_LABELS[invitation.delivery_status] || invitation.delivery_status}</span>}
                  <span>Enviado em {formatDate(invitation.last_sent_at || invitation.created_at)}</span>
                  {invitation.status === 'pending' && <span>Convite expira em {formatDate(invitation.expires_at)}</span>}
                  {invitation.status === 'pending' && invitation.code_expires_at && <span>Código expira em {formatDate(invitation.code_expires_at)}</span>}
                </div>
              </div>

              <div className="api-history-side">
                <span className={`api-status api-status--${invitation.status}`}>
                  {STATUS_LABELS[invitation.status] || invitation.status}
                </span>
                {canManage && <div className="api-history-actions">
                  <button type="button" onClick={() => resend(invitation)} disabled={processing}>
                    {processing ? 'Processando…' : 'Reenviar'}
                  </button>
                  {invitation.status !== 'revoked' && <button type="button" className="api-history-danger" onClick={() => revoke(invitation)} disabled={processing}>
                    Revogar
                  </button>}
                </div>}
              </div>
            </article>
          })}
        </div>
      )}
    </div>
  </section>
}
