import { useMemo, useState } from 'react'
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

const CUTINAPP_SLUGS = new Set(['cutinapp', 'cutin-app', 'catchnap', 'catinapp'])

function isCutinapp(application) {
  const slug = String(application?.slug || '').trim().toLowerCase()
  const name = String(application?.name || '').trim().toLowerCase()
  return CUTINAPP_SLUGS.has(slug) || name.includes('cutin') || name.includes('catchnap')
}

export default function AdminProspectInvitation({ apiRequest, applications = [] }) {
  const activeApplications = useMemo(() => applications.filter(app => app?.is_active !== false), [applications])
  const [form, setForm] = useState({ email: '', recipient_name: '', application_id: '', persona: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedApplication = useMemo(
    () => activeApplications.find(app => String(app.id) === String(form.application_id)) || null,
    [activeApplications, form.application_id],
  )

  const personas = useMemo(
    () => selectedApplication && isCutinapp(selectedApplication) ? CUTINAPP_PERSONAS : GENERIC_PERSONAS,
    [selectedApplication],
  )

  const selectedPersona = personas.find(persona => persona.value === form.persona) || null

  function change(field, value) {
    setForm(current => {
      if (field === 'application_id') return { ...current, application_id: value, persona: '' }
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

    setBusy(true)
    try {
      const payload = await apiRequest('/admin/ecosystem/invitations/prospect', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          recipient_name: form.recipient_name.trim() || null,
          application_id: Number(form.application_id),
          persona: form.persona,
        }),
      })
      setSuccess(payload?.message || 'Convite enviado com sucesso.')
      setForm(current => ({ ...current, email: '', recipient_name: '' }))
    } catch (err) {
      setError(err?.message || 'Não foi possível enviar o convite.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="api-card" id="admin-prospect-invitation">
    <header className="api-head">
      <div>
        <span>PROSPECÇÃO E CONVITES</span>
        <h3>Convidar para uma plataforma</h3>
        <p>Envie um e-mail comercial específico para a plataforma e para o tipo de pessoa que você quer atrair.</p>
      </div>
      <span className="api-badge">E-mail direcionado</span>
    </header>

    <div className="api-grid">
      <form className="api-form" onSubmit={submit}>
        <label className="api-wide">E-mail do destinatário
          <input type="email" value={form.email} onChange={event => change('email', event.target.value)} placeholder="contato@exemplo.com" required/>
        </label>

        <label>Nome <small>opcional</small>
          <input value={form.recipient_name} onChange={event => change('recipient_name', event.target.value)} maxLength={120} placeholder="Nome da pessoa ou contato"/>
        </label>

        <label>Plataforma
          <select value={form.application_id} onChange={event => change('application_id', event.target.value)} required>
            <option value="">Selecione</option>
            {activeApplications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </label>

        <label className="api-wide">Perfil do convite
          <select value={form.persona} onChange={event => change('persona', event.target.value)} disabled={!selectedApplication} required>
            <option value="">{selectedApplication ? 'Selecione o perfil' : 'Escolha primeiro a plataforma'}</option>
            {personas.map(persona => <option key={persona.value} value={persona.value}>{persona.label}</option>)}
          </select>
        </label>

        {error && <div className="api-feedback api-feedback--error api-wide">{error}</div>}
        {success && <div className="api-feedback api-feedback--success api-wide">{success}</div>}

        <button className="api-submit api-wide" disabled={busy || !selectedApplication || !selectedPersona}>
          {busy ? 'Enviando…' : 'Enviar convite por e-mail'}
        </button>
      </form>

      <aside className="api-preview">
        <span>PRÉVIA DO DIRECIONAMENTO</span>
        <h4>{selectedApplication?.name || 'Selecione uma plataforma'}</h4>
        <strong>{selectedPersona?.label || 'Perfil ainda não selecionado'}</strong>
        <p>{selectedPersona?.hint || 'Ao escolher a plataforma e o perfil, o e-mail será montado com argumentos e benefícios adequados para esse público.'}</p>
        {selectedApplication?.url && <a href={selectedApplication.url} target="_blank" rel="noreferrer">Abrir plataforma ↗</a>}
        {selectedApplication && isCutinapp(selectedApplication) && <div className="api-context-note">
          <b>Cutinapp</b>
          <small>Templates específicos para participante, produtor, artista e promoter.</small>
        </div>}
      </aside>
    </div>
  </section>
}
