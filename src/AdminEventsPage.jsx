import { useMemo, useState } from 'react'
import './AdminEventsPage.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'

const emptyForm = {
  title: '',
  description: '',
  category: '',
  event_format: 'in_person',
  start_date: '',
  end_date: '',
  venue: '',
  address: '',
  city: '',
  uf: '',
  country: 'Brasil',
  online_platform: '',
  online_url: '',
  online_instructions: '',
  max_attendees: '',
  contact_email: '',
  contact_phone: '',
  is_published: false,
  is_approved: true,
  is_private: false,
  requires_approval: false,
  approval_message: '',
}

const fullName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const data = response.status === 204 ? null : await response.json().catch(() => ({}))

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
      throw new Error('Sua sessão expirou. Entre novamente.')
    }

    if (!response.ok) {
      const validation = Object.values(data?.errors || {}).flat()?.[0]
      throw new Error(validation || data?.message || data?.error || 'Não foi possível concluir a operação.')
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function Step({ number, label, active, complete }) {
  return <div className={`admin-event-step${active ? ' active' : ''}${complete ? ' complete' : ''}`}>
    <span>{complete ? '✓' : number}</span>
    <strong>{label}</strong>
  </div>
}

function UserCard({ user, selected, onSelect }) {
  return <button type="button" className={`admin-event-user${selected ? ' selected' : ''}`} onClick={() => onSelect(user)}>
    <div className="admin-event-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : fullName(user).slice(0, 1).toUpperCase()}</div>
    <div>
      <strong>{fullName(user)}</strong>
      <span>{user.email}</span>
      <small>{user.cpf_masked ? `CPF ${user.cpf_masked}` : 'CPF não informado'} · {user.productions_count || 0} produção(ões)</small>
    </div>
    <i>{selected ? 'Selecionado' : 'Selecionar'}</i>
  </button>
}

function ProductionCard({ production, selected, onSelect }) {
  const location = [production.city, production.uf].filter(Boolean).join(' · ') || 'Localização não informada'
  return <button type="button" className={`admin-event-production${selected ? ' selected' : ''}`} onClick={() => onSelect(production)} disabled={!production.can_create_events}>
    <div className="admin-event-production__head">
      <div>
        <small>Produção #{production.id}</small>
        <strong>{production.fantasy || production.name}</strong>
      </div>
      <span className={production.can_create_events ? 'ready' : 'blocked'}>{production.can_create_events ? 'Aceita eventos' : 'Indisponível'}</span>
    </div>
    <p>{location}</p>
    <div className="admin-event-production__meta">
      <span>{production.is_approved ? 'Aprovada' : 'Aguardando aprovação'}</span>
      <span>{production.is_published ? 'Publicada' : 'Oculta'}</span>
    </div>
  </button>
}

export default function AdminEventsPage() {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [productions, setProductions] = useState([])
  const [selectedProduction, setSelectedProduction] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [searching, setSearching] = useState(false)
  const [loadingProductions, setLoadingProductions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [createdEvent, setCreatedEvent] = useState(null)

  const physical = ['in_person', 'hybrid'].includes(form.event_format)
  const online = ['online', 'hybrid'].includes(form.event_format)
  const activeStep = selectedProduction ? 3 : selectedUser ? 2 : 1

  const selectedLabel = useMemo(() => selectedProduction?.fantasy || selectedProduction?.name || '', [selectedProduction])

  async function searchUsers(event) {
    event?.preventDefault()
    const term = search.trim()
    if (term.length < 2) {
      setError('Digite pelo menos 2 caracteres para pesquisar por nome, e-mail ou CPF.')
      return
    }

    setSearching(true)
    setError('')
    setMessage('')
    setCreatedEvent(null)
    try {
      const payload = await request(`/admin/ecosystem/event-management/users?search=${encodeURIComponent(term)}`)
      setUsers(payload?.users || [])
      setSearched(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function selectUser(user) {
    setSelectedUser(user)
    setSelectedProduction(null)
    setProductions([])
    setForm(emptyForm)
    setMessage('')
    setCreatedEvent(null)
    setLoadingProductions(true)
    setError('')

    try {
      const payload = await request(`/admin/ecosystem/event-management/users/${user.id}/productions`)
      setProductions(payload?.productions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingProductions(false)
    }
  }

  function selectProduction(production) {
    setSelectedProduction(production)
    setCreatedEvent(null)
    setMessage('')
    setForm(current => ({
      ...emptyForm,
      title: current.title,
      description: current.description,
      category: current.category,
      event_format: current.event_format || 'in_person',
      address: production.address || '',
      city: production.city || '',
      uf: production.uf || '',
      country: production.country || 'Brasil',
      venue: production.fantasy || production.name || '',
      contact_email: production.email || selectedUser?.email || '',
      contact_phone: production.phone || '',
    }))
  }

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!selectedUser || !selectedProduction) {
      setError('Selecione o usuário e uma produção antes de cadastrar o evento.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    setCreatedEvent(null)

    try {
      const payload = {
        ...form,
        user_id: selectedUser.id,
        production_id: selectedProduction.id,
        max_attendees: form.max_attendees === '' ? null : Number(form.max_attendees),
      }
      const result = await request('/admin/ecosystem/event-management/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setCreatedEvent(result?.event || null)
      setMessage(result?.message || 'Evento cadastrado com sucesso.')
      setForm(current => ({
        ...emptyForm,
        event_format: current.event_format,
        address: selectedProduction.address || '',
        city: selectedProduction.city || '',
        uf: selectedProduction.uf || '',
        country: selectedProduction.country || 'Brasil',
        venue: selectedProduction.fantasy || selectedProduction.name || '',
        contact_email: selectedProduction.email || selectedUser.email || '',
        contact_phone: selectedProduction.phone || '',
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="admin-events-page">
    <header className="admin-events-hero">
      <div>
        <p>Admin Center · Cutinapp</p>
        <h1>Cadastrar evento</h1>
        <span>Encontre o usuário correto, escolha uma produção vinculada a ele e cadastre o evento diretamente no estabelecimento.</span>
      </div>
      <a href="/admin/establishments">Ver estabelecimentos</a>
    </header>

    <div className="admin-event-steps" aria-label="Etapas do cadastro">
      <Step number="1" label="Usuário" active={activeStep === 1} complete={activeStep > 1} />
      <Step number="2" label="Produção" active={activeStep === 2} complete={activeStep > 2} />
      <Step number="3" label="Evento" active={activeStep === 3} complete={Boolean(createdEvent)} />
    </div>

    {error && <div className="admin-event-notice error" role="alert">{error}</div>}
    {message && <div className="admin-event-notice success" role="status">{message}{createdEvent?.id ? <span> ID do evento: #{createdEvent.id}</span> : null}</div>}

    <section className="admin-event-section">
      <div className="admin-event-section__head">
        <div><span>Etapa 1</span><h2>Pesquisar usuário</h2><p>Pesquise por nome, e-mail ou CPF. O resultado mostra quantas produções cada usuário possui.</p></div>
      </div>
      <form className="admin-event-search" onSubmit={searchUsers}>
        <label>
          <span>Nome, e-mail ou CPF</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ex.: cliente@email.com, 123.456.789-00 ou nome do usuário" autoComplete="off" />
        </label>
        <button disabled={searching}>{searching ? 'Pesquisando…' : 'Pesquisar usuário'}</button>
      </form>

      {searched && !searching && users.length === 0 && <div className="admin-event-empty"><strong>Nenhum usuário encontrado.</strong><span>Confira o nome, e-mail ou CPF informado.</span></div>}
      {users.length > 0 && <div className="admin-event-users">{users.map(user => <UserCard key={user.id} user={user} selected={selectedUser?.id === user.id} onSelect={selectUser} />)}</div>}
    </section>

    {selectedUser && <section className="admin-event-section">
      <div className="admin-event-section__head">
        <div><span>Etapa 2</span><h2>Produções de {fullName(selectedUser)}</h2><p>Somente estabelecimentos do tipo <b>production</b> que permitem cadastrar eventos aparecem aqui.</p></div>
        <button type="button" className="admin-event-link-button" onClick={() => selectUser(selectedUser)} disabled={loadingProductions}>Atualizar produções</button>
      </div>
      {loadingProductions && <div className="admin-event-loading">Carregando produções…</div>}
      {!loadingProductions && productions.length === 0 && <div className="admin-event-empty"><strong>Esse usuário não possui uma produção disponível.</strong><span>Cadastre ou transfira um estabelecimento do tipo production para esse usuário antes de criar o evento.</span></div>}
      {productions.length > 0 && <div className="admin-event-productions">{productions.map(production => <ProductionCard key={production.id} production={production} selected={selectedProduction?.id === production.id} onSelect={selectProduction} />)}</div>}
    </section>}

    {selectedUser && selectedProduction && <section className="admin-event-section admin-event-form-section">
      <div className="admin-event-section__head">
        <div><span>Etapa 3</span><h2>Novo evento para {selectedLabel}</h2><p>O evento ficará vinculado à produção #{selectedProduction.id} e ao usuário {fullName(selectedUser)}.</p></div>
      </div>

      <form className="admin-event-form" onSubmit={submit}>
        <div className="admin-event-form__main">
          <fieldset>
            <legend>Informações principais</legend>
            <div className="admin-event-grid two">
              <label><span>Nome do evento *</span><input required value={form.title} onChange={event => change('title', event.target.value)} placeholder="Nome que aparecerá na Cutinapp" /></label>
              <label><span>Categoria</span><input value={form.category} onChange={event => change('category', event.target.value)} placeholder="Ex.: festa, show, eletrônico" /></label>
            </div>
            <label><span>Descrição *</span><textarea required rows="6" value={form.description} onChange={event => change('description', event.target.value)} placeholder="Descreva o evento, atrações, experiência e informações importantes." /></label>
          </fieldset>

          <fieldset>
            <legend>Data, horário e formato</legend>
            <div className="admin-event-grid three">
              <label><span>Formato *</span><select value={form.event_format} onChange={event => change('event_format', event.target.value)}><option value="in_person">Presencial</option><option value="online">Online</option><option value="hybrid">Híbrido</option></select></label>
              <label><span>Início *</span><input required type="datetime-local" value={form.start_date} onChange={event => change('start_date', event.target.value)} /></label>
              <label><span>Término *</span><input required type="datetime-local" value={form.end_date} onChange={event => change('end_date', event.target.value)} /></label>
            </div>
            <div className="admin-event-grid two">
              <label><span>Local / casa</span><input value={form.venue} onChange={event => change('venue', event.target.value)} /></label>
              <label><span>Capacidade</span><input type="number" min="0" value={form.max_attendees} onChange={event => change('max_attendees', event.target.value)} placeholder="Sem limite se vazio" /></label>
            </div>
          </fieldset>

          {physical && <fieldset>
            <legend>Localização presencial</legend>
            <label><span>Endereço *</span><input required value={form.address} onChange={event => change('address', event.target.value)} /></label>
            <div className="admin-event-grid three">
              <label><span>Cidade *</span><input required value={form.city} onChange={event => change('city', event.target.value)} /></label>
              <label><span>UF *</span><input required maxLength="2" value={form.uf} onChange={event => change('uf', event.target.value.toUpperCase())} /></label>
              <label><span>País</span><input value={form.country} onChange={event => change('country', event.target.value)} /></label>
            </div>
          </fieldset>}

          {online && <fieldset>
            <legend>Acesso online</legend>
            <div className="admin-event-grid two">
              <label><span>Plataforma</span><input value={form.online_platform} onChange={event => change('online_platform', event.target.value)} placeholder="Ex.: YouTube, Meet, Zoom" /></label>
              <label><span>URL de acesso *</span><input required type="url" value={form.online_url} onChange={event => change('online_url', event.target.value)} placeholder="https://" /></label>
            </div>
            <label><span>Instruções de acesso</span><textarea rows="3" value={form.online_instructions} onChange={event => change('online_instructions', event.target.value)} /></label>
          </fieldset>}

          <fieldset>
            <legend>Contato e publicação</legend>
            <div className="admin-event-grid two">
              <label><span>E-mail de contato</span><input type="email" value={form.contact_email} onChange={event => change('contact_email', event.target.value)} /></label>
              <label><span>Telefone de contato</span><input value={form.contact_phone} onChange={event => change('contact_phone', event.target.value)} /></label>
            </div>
            <div className="admin-event-options">
              <label><input type="checkbox" checked={form.is_approved} onChange={event => change('is_approved', event.target.checked)} /><span><b>Aprovar evento</b><small>Marca o evento como aprovado pelo Admin Center.</small></span></label>
              <label><input type="checkbox" checked={form.is_published} onChange={event => change('is_published', event.target.checked)} /><span><b>Publicar imediatamente</b><small>Deixa o evento disponível na experiência pública.</small></span></label>
              <label><input type="checkbox" checked={form.is_private} onChange={event => change('is_private', event.target.checked)} /><span><b>Evento privado</b><small>Restringe a visualização pública do evento.</small></span></label>
              <label><input type="checkbox" checked={form.requires_approval} onChange={event => change('requires_approval', event.target.checked)} /><span><b>Exigir aprovação</b><small>Participações podem depender de aprovação.</small></span></label>
            </div>
            {form.requires_approval && <label><span>Mensagem de aprovação</span><textarea rows="3" value={form.approval_message} onChange={event => change('approval_message', event.target.value)} /></label>}
          </fieldset>
        </div>

        <aside className="admin-event-summary">
          <span>Revisão do vínculo</span>
          <h3>{form.title || 'Novo evento'}</h3>
          <dl>
            <div><dt>Usuário</dt><dd>{fullName(selectedUser)}</dd></div>
            <div><dt>E-mail</dt><dd>{selectedUser.email}</dd></div>
            <div><dt>Produção</dt><dd>{selectedLabel}</dd></div>
            <div><dt>ID produção</dt><dd>#{selectedProduction.id}</dd></div>
            <div><dt>Formato</dt><dd>{form.event_format === 'in_person' ? 'Presencial' : form.event_format === 'online' ? 'Online' : 'Híbrido'}</dd></div>
            <div><dt>Status inicial</dt><dd>{form.is_published ? 'Publicado' : 'Rascunho'} · {form.is_approved ? 'Aprovado' : 'Pendente'}</dd></div>
          </dl>
          <p>O backend confirma novamente que a produção pertence ao usuário selecionado antes de criar o evento.</p>
          <button disabled={saving}>{saving ? 'Cadastrando evento…' : 'Cadastrar evento'}</button>
        </aside>
      </form>
    </section>}
  </div>
}
