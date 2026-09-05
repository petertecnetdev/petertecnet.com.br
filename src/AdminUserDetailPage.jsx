import { useEffect, useMemo, useState } from 'react'
import './AdminUserDetailPage.css'
import './AdminUserDetailPage.actions.css'

const EMPTY_ACTIVITY_FILTERS = {
  q: '', app_id: '', type: '', outcome: '', severity: '', environment: '', entity_type: '', from: '', to: '', sort: 'newest', per_page: '50',
}

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function dateOnly(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR')
}

function money(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsed)
}

function compact(value) {
  const parsed = Number(value)
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number.isFinite(parsed) ? parsed : 0)
}

function statusLabel(value) {
  const labels = {
    active: 'Ativo', blocked: 'Bloqueado', suspended: 'Suspenso', pending: 'Pendente',
    success: 'Sucesso', error: 'Erro', failed: 'Falha', approved: 'Aprovado', cancelled: 'Cancelado',
    paid: 'Pago', confirmed: 'Confirmado', attended: 'Atendido', published: 'Publicado',
  }
  return labels[String(value || '').toLowerCase()] || value || '—'
}

function tone(value) {
  const normalized = String(value || '').toLowerCase()
  if (['error', 'failed', 'blocked', 'suspended', 'cancelled', 'critical', 'danger'].some(item => normalized.includes(item))) return 'danger'
  if (['pending', 'warning', 'attention', 'queued'].some(item => normalized.includes(item))) return 'warning'
  if (['active', 'success', 'approved', 'paid', 'confirmed', 'attended', 'published'].some(item => normalized.includes(item))) return 'success'
  return 'neutral'
}

function normalizeResourceToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function activityQuery(filters, page = 1) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value))
  })
  params.set('page', String(page))
  return params.toString()
}

function Metric({ label, value, detail, onClick }) {
  const content = <>
    <span>{label}</span>
    <strong>{value ?? 0}</strong>
    <small>{detail}</small>
    {onClick && <span className="aud-metric-link">Ver detalhes →</span>}
  </>

  if (onClick) {
    return <button type="button" className="aud-metric aud-metric-button" onClick={onClick} aria-label={`Ver detalhes de ${label}`}>{content}</button>
  }

  return <div className="aud-metric">{content}</div>
}

function Empty({ children = 'Nenhum dado disponível neste recorte.' }) {
  return <div className="aud-empty">{children}</div>
}

function Field({ label, value }) {
  return <div className="aud-field"><span>{label}</span><b>{value || '—'}</b></div>
}

function ApplicationMark({ application }) {
  return <span className="aud-app-mark">
    {application?.logo ? <img src={application.logo} alt="" onError={event => { event.currentTarget.style.display = 'none' }}/> : <b>{String(application?.name || 'P').slice(0, 1)}</b>}
  </span>
}

function resourceContext(row) {
  if (row.establishment?.name) return row.establishment.name
  if (row.production?.name) return row.production.name
  if (row.event?.title) return row.event.title
  if (row.ticket?.name) return row.ticket.name
  if (row.link_types?.length) return row.link_types.join(' · ')
  if (row.city || row.uf) return [row.city, row.uf].filter(Boolean).join('/')
  return row.category || row.type || '—'
}

function resourceStatus(row) {
  if (row.is_cancelled) return 'Cancelado'
  if (row.status !== undefined && typeof row.status !== 'boolean') return statusLabel(row.status)
  if (row.appointment_status) return statusLabel(row.appointment_status)
  if (row.payment_status) return statusLabel(row.payment_status)
  if (row.is_published !== undefined) return row.is_published ? 'Publicado' : 'Oculto'
  if (typeof row.status === 'boolean') return row.status ? 'Ativo' : 'Inativo'
  if (row.is_approved !== undefined) return row.is_approved ? 'Aprovado' : 'Pendente'
  return '—'
}

function resourceValue(row) {
  if (row.total_price !== undefined && row.total_price !== null) return money(row.total_price)
  if (row.price !== undefined && row.price !== null) return money(row.price)
  if (row.start_date) return dateTime(row.start_date)
  if (row.order_datetime) return dateTime(row.order_datetime)
  if (row.checked_in_at) return `Check-in ${dateTime(row.checked_in_at)}`
  return dateTime(row.created_at)
}

export default function AdminUserDetailPage({ userId, apiRequest, applications = [], onBack }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyAppId, setBusyAppId] = useState(null)
  const [tab, setTab] = useState('overview')
  const [resourceFilters, setResourceFilters] = useState({ q: '', app_id: '', resource: 'all' })
  const [activityFilters, setActivityFilters] = useState({ ...EMPTY_ACTIVITY_FILTERS })
  const [activityRows, setActivityRows] = useState([])
  const [activityPagination, setActivityPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState('')

  async function loadDetail({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}`)
      setDetail(payload)
    } catch (err) {
      setError(err.message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  async function loadActivity(page = 1, filters = activityFilters) {
    setActivityLoading(true)
    setActivityError('')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}/activity?${activityQuery(filters, page)}`)
      setActivityRows(payload?.activity || [])
      setActivityPagination(payload?.pagination || { current_page: page, last_page: 1, total: payload?.activity?.length || 0 })
    } catch (err) {
      setActivityError(err.message)
    } finally {
      setActivityLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDetail()
      void loadActivity(1, { ...EMPTY_ACTIVITY_FILTERS })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [userId])

  const user = detail?.user
  const summary = detail?.summary || {}
  const platforms = detail?.platforms || []
  const resources = detail?.resources || {}
  const facets = detail?.activity_facets || {}

  const applicationOptions = useMemo(() => {
    const all = [...applications]
    platforms.forEach(platform => {
      const app = platform.application
      if (app?.id && !all.some(candidate => Number(candidate.id) === Number(app.id))) all.push(app)
    })
    return all.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  }, [applications, platforms])

  const resourceFilterGroups = useMemo(() => Object.entries(resources)
    .map(([key, group]) => ({ key, ...group })), [resources])

  const resourceGroups = useMemo(() => resourceFilterGroups
    .filter(group => Number(group?.total || 0) > 0), [resourceFilterGroups])

  const filteredResources = useMemo(() => {
    const query = resourceFilters.q.trim().toLocaleLowerCase('pt-BR')
    const groups = resourceFilters.resource === 'all'
      ? resourceGroups
      : resourceFilterGroups.filter(group => group.key === resourceFilters.resource)

    return groups.map(group => ({
      ...group,
      data: (group.data || []).filter(row => {
        if (resourceFilters.app_id && Number(row.app_id) !== Number(resourceFilters.app_id)) return false
        if (!query) return true
        const haystack = [
          row.name, row.title, row.slug, row.type, row.category, row.role, row.status,
          row.application?.name, row.establishment?.name, row.production?.name, row.event?.title,
          row.user?.name, row.user?.email, ...(row.link_types || []),
        ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR')
        return haystack.includes(query)
      }),
    })).filter(group => group.data.length > 0)
  }, [resourceFilters, resourceFilterGroups, resourceGroups])

  async function toggleAccess(application) {
    const platform = platforms.find(item => Number(item.application?.id) === Number(application.id))
    const currentStatus = platform?.access?.status
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active'
    setBusyAppId(application.id)
    setError('')
    try {
      await apiRequest(`/admin/ecosystem/users/${userId}/applications/${application.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus, role: platform?.access?.role || 'member' }),
      })
      await loadDetail({ quiet: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyAppId(null)
    }
  }

  async function submitActivityFilters(event) {
    event.preventDefault()
    await loadActivity(1, activityFilters)
  }

  async function clearActivityFilters() {
    const next = { ...EMPTY_ACTIVITY_FILTERS }
    setActivityFilters(next)
    await loadActivity(1, next)
  }

  function scrollToDetail(sectionId) {
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function openTabDetail(nextTab, sectionId) {
    setTab(nextTab)
    scrollToDetail(sectionId)
  }

  function resolveResourceKey(candidates) {
    const candidateTokens = (Array.isArray(candidates) ? candidates : [candidates]).map(normalizeResourceToken)

    const exact = resourceFilterGroups.find(group => candidateTokens.includes(normalizeResourceToken(group.key)))
    if (exact) return exact.key

    const byLabel = resourceFilterGroups.find(group => {
      const labelToken = normalizeResourceToken(group.label)
      return candidateTokens.some(candidate => labelToken === candidate || labelToken.includes(candidate) || candidate.includes(labelToken))
    })

    return byLabel?.key || (Array.isArray(candidates) ? candidates[0] : candidates)
  }

  function openResourceDetail(candidates) {
    const resource = resolveResourceKey(candidates)
    setResourceFilters({ q: '', app_id: '', resource })
    setTab('resources')
    scrollToDetail('aud-resources')
  }

  if (loading) return <div className="aud-page aud-loading"><div className="aud-loader"/><p>Montando a visão 360° do usuário…</p></div>

  if (!user) return <div className="aud-page"><button className="aud-back" onClick={onBack}>← Voltar para usuários</button><div className="aud-error">{error || 'Não foi possível carregar este usuário.'}</div></div>

  const roleLabels = {
    producer: 'Produtor', participant: 'Participante', promoter: 'Promoter', barber: 'Barbeiro',
    barbershop_owner: 'Dono de barbearia', partner: 'Parceiro', ticket_seller: 'Vendedor de ingressos',
  }
  const activeRoles = Object.entries(user.roles || {}).filter(([, active]) => active).map(([key]) => roleLabels[key] || key)

  return <div className="aud-page">
    <div className="aud-page-head">
      <button className="aud-back" onClick={onBack}>← Voltar para usuários</button>
      <div className="aud-head-actions"><button className="aud-secondary" onClick={() => loadDetail()} disabled={loading}>↻ Atualizar ficha</button></div>
    </div>

    {error && <div className="aud-error">{error}</div>}

    <section className="aud-hero">
      <div className="aud-identity">
        <div className="aud-avatar">{user.avatar ? <img src={user.avatar} alt=""/> : fullName(user).slice(0, 2).toUpperCase()}</div>
        <div>
          <p className="aud-kicker">USUÁRIO #{user.id} / VISÃO 360°</p>
          <h2>{fullName(user)}</h2>
          <p>{user.email} <span>·</span> @{user.user_name || 'sem-usuario'}</p>
          <div className="aud-chips">
            <span>{user.profile?.name || 'Sem perfil'}</span>
            <span className={user.email_verified_at ? 'is-success' : 'is-warning'}>{user.email_verified_at ? 'E-mail verificado' : 'E-mail não verificado'}</span>
            {activeRoles.map(role => <span key={role}>{role}</span>)}
          </div>
        </div>
      </div>
      <div className="aud-hero-meta">
        <Field label="Criado em" value={dateTime(user.created_at)}/>
        <Field label="Última atividade" value={dateTime(summary.last_activity_at)}/>
        <Field label="Último login" value={dateTime(summary.last_login_at)}/>
      </div>
    </section>

    <div className="aud-metrics">
      <Metric label="Interações" value={compact(summary.total_interactions)} detail={`${compact(summary.interactions_30d)} nos últimos 30 dias`} onClick={() => openTabDetail('activity', 'aud-activity')}/>
      <Metric label="Aplicações" value={summary.applications || 0} detail="vínculos de acesso" onClick={() => openTabDetail('overview', 'aud-applications')}/>
      <Metric label="Estabelecimentos" value={summary.establishments || 0} detail={`${summary.productions || 0} produção(ões)`} onClick={() => openResourceDetail(['establishments', 'establishment', 'estabelecimentos', 'estabelecimento'])}/>
      <Metric label="Itens" value={summary.items || 0} detail="diretos ou dos estabelecimentos" onClick={() => openResourceDetail(['items', 'item', 'itens'])}/>
      <Metric label="Employers" value={summary.employments || 0} detail={`${summary.team_members || 0} membros na equipe`} onClick={() => openResourceDetail(['employments', 'employers', 'employer', 'equipe', 'membros'])}/>
      <Metric label="Eventos" value={summary.events || 0} detail="das produções vinculadas" onClick={() => openResourceDetail(['events', 'event', 'eventos', 'evento'])}/>
      <Metric label="Pedidos" value={summary.orders || 0} detail="compras, vendas e agendamentos" onClick={() => openResourceDetail(['orders', 'order', 'pedidos', 'pedido', 'agendamentos', 'vendas', 'compras'])}/>
      <Metric label="Ingressos" value={summary.event_passes || 0} detail="participações do usuário" onClick={() => openResourceDetail(['event_passes', 'passes', 'tickets', 'ingressos', 'participacoes'])}/>
    </div>

    <nav className="aud-tabs" aria-label="Seções do usuário">
      {[
        ['overview', 'Visão geral'], ['resources', 'Vínculos e recursos'], ['activity', 'Atividades'], ['security', 'Segurança'],
      ].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </nav>

    {tab === 'overview' && <div className="aud-section-stack">
      <section className="aud-card">
        <header><div><span>IDENTIDADE</span><h3>Dados do usuário</h3></div></header>
        <div className="aud-fields-grid">
          <Field label="ID" value={`#${user.id}`}/><Field label="Nome" value={fullName(user)}/><Field label="E-mail" value={user.email}/><Field label="Usuário" value={user.user_name ? `@${user.user_name}` : '—'}/>
          <Field label="Telefone" value={user.phone}/><Field label="CPF" value={user.cpf_masked}/><Field label="Nascimento" value={dateOnly(user.birthdate)}/><Field label="Ocupação" value={user.occupation}/>
          <Field label="Cidade/UF" value={[user.city, user.uf].filter(Boolean).join('/')}/><Field label="CEP" value={user.postal_code}/><Field label="Endereço" value={user.address}/><Field label="Perfil" value={user.profile?.name}/>
        </div>
        {user.about && <div className="aud-about"><span>Sobre</span><p>{user.about}</p></div>}
      </section>

      <section className="aud-card" id="aud-applications">
        <header><div><span>PLATAFORMAS</span><h3>Uso e acesso por aplicação</h3><p>A mesma ficha acompanha o usuário em todo o ecossistema.</p></div></header>
        <div className="aud-platform-grid">
          {platforms.length ? platforms.map(platform => {
            const application = platform.application || {}
            const accessStatus = platform.access?.status || 'none'
            return <article className="aud-platform" key={application.id || application.name}>
              <div className="aud-platform-head"><ApplicationMark application={application}/><div><b>{application.name || `Aplicação #${application.id}`}</b><small>{application.slug || 'Peter Tecnet'}</small></div><span className={`aud-status ${tone(accessStatus)}`}>{accessStatus === 'none' ? 'Sem acesso' : statusLabel(accessStatus)}</span></div>
              <div className="aud-platform-stats"><div><span>Interações</span><b>{compact(platform.usage?.total)}</b></div><div><span>Último uso</span><b>{dateTime(platform.usage?.last_activity_at)}</b></div><div><span>Função</span><b>{platform.access?.role || '—'}</b></div></div>
              <div className="aud-resource-pills">{Object.entries(platform.resources || {}).map(([key, count]) => <span key={key}>{resources[key]?.label || key}: <b>{count}</b></span>)}</div>
            </article>
          }) : <Empty>Nenhuma aplicação possui atividade ou vínculo registrado.</Empty>}
        </div>
      </section>

      <section className="aud-card">
        <header><div><span>CONTROLE DE ACESSO</span><h3>Aplicações disponíveis</h3><p>Gerencie o vínculo sem sair da ficha do usuário.</p></div></header>
        <div className="aud-access-list">
          {applicationOptions.length ? applicationOptions.map(application => {
            const platform = platforms.find(item => Number(item.application?.id) === Number(application.id))
            const access = platform?.access
            const isActive = access?.status === 'active'
            return <div key={application.id} className="aud-access-row"><div><ApplicationMark application={application}/><span><b>{application.name}</b><small>{access ? `${statusLabel(access.status)} · ${access.role || 'member'} · desde ${dateOnly(access.joined_at)}` : 'Sem vínculo atual'}</small></span></div><button className={isActive ? 'aud-danger' : 'aud-primary'} disabled={busyAppId === application.id} onClick={() => toggleAccess(application)}>{busyAppId === application.id ? 'Salvando…' : isActive ? 'Bloquear' : 'Liberar acesso'}</button></div>
          }) : <Empty>Nenhuma aplicação cadastrada.</Empty>}
        </div>
      </section>
    </div>}

    {tab === 'resources' && <div className="aud-section-stack" id="aud-resources">
      <section className="aud-card aud-filter-card">
        <header><div><span>FILTROS</span><h3>Vínculos e recursos do ecossistema</h3></div><button className="aud-secondary" onClick={() => setResourceFilters({ q: '', app_id: '', resource: 'all' })}>Limpar</button></header>
        <div className="aud-resource-filters">
          <label className="aud-filter-wide">Buscar<input value={resourceFilters.q} onChange={event => setResourceFilters({ ...resourceFilters, q: event.target.value })} placeholder="Nome, categoria, estabelecimento, evento, função…"/></label>
          <label>Plataforma<select value={resourceFilters.app_id} onChange={event => setResourceFilters({ ...resourceFilters, app_id: event.target.value })}><option value="">Todas</option>{applicationOptions.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
          <label>Tipo de vínculo<select value={resourceFilters.resource} onChange={event => setResourceFilters({ ...resourceFilters, resource: event.target.value })}><option value="all">Todos</option>{resourceFilterGroups.map(group => <option key={group.key} value={group.key}>{group.label} ({group.total})</option>)}</select></label>
        </div>
      </section>

      {filteredResources.length ? filteredResources.map(group => <section className="aud-card" key={group.key}>
        <header><div><span>RECURSO</span><h3>{group.label}</h3><p>{group.total} vínculo(s) encontrado(s){group.truncated ? ' · exibindo os registros mais recentes' : ''}</p></div></header>
        <div className="aud-resource-table"><table><thead><tr><th>Registro</th><th>Plataforma</th><th>Contexto</th><th>Status</th><th>Data/valor</th></tr></thead><tbody>{group.data.map((row, index) => <tr key={row.id || index}><td><b>{row.name || row.title || `#${row.id}`}</b><small>#{row.id}{row.slug ? ` · ${row.slug}` : ''}</small></td><td>{row.application?.name || '—'}</td><td>{resourceContext(row)}</td><td><span className={`aud-status ${tone(resourceStatus(row))}`}>{resourceStatus(row)}</span></td><td>{resourceValue(row)}</td></tr>)}</tbody></table></div>
      </section>) : <section className="aud-card"><Empty>Nenhum vínculo corresponde aos filtros atuais.</Empty></section>}
    </div>}

    {tab === 'activity' && <div className="aud-section-stack" id="aud-activity">
      <section className="aud-card aud-filter-card">
        <header><div><span>TELEMETRIA</span><h3>Filtros avançados de atividade</h3><p>Consulte a linha do tempo do usuário diretamente na API central.</p></div></header>
        <form className="aud-activity-filters" onSubmit={submitActivityFilters}>
          <label className="aud-filter-wide">Buscar<input value={activityFilters.q} onChange={event => setActivityFilters({ ...activityFilters, q: event.target.value })} placeholder="Ação, rota, entidade, request ID…"/></label>
          <label>Aplicação<select value={activityFilters.app_id} onChange={event => setActivityFilters({ ...activityFilters, app_id: event.target.value })}><option value="">Todas</option>{applicationOptions.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
          <label>Tipo<select value={activityFilters.type} onChange={event => setActivityFilters({ ...activityFilters, type: event.target.value })}><option value="">Todos</option>{(facets.types || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Resultado<select value={activityFilters.outcome} onChange={event => setActivityFilters({ ...activityFilters, outcome: event.target.value })}><option value="">Todos</option>{(facets.outcomes || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Severidade<select value={activityFilters.severity} onChange={event => setActivityFilters({ ...activityFilters, severity: event.target.value })}><option value="">Todas</option>{(facets.severities || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Ambiente<select value={activityFilters.environment} onChange={event => setActivityFilters({ ...activityFilters, environment: event.target.value })}><option value="">Todos</option>{(facets.environments || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Entidade<select value={activityFilters.entity_type} onChange={event => setActivityFilters({ ...activityFilters, entity_type: event.target.value })}><option value="">Todas</option>{(facets.entity_types || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>De<input type="date" value={activityFilters.from} onChange={event => setActivityFilters({ ...activityFilters, from: event.target.value })}/></label>
          <label>Até<input type="date" value={activityFilters.to} onChange={event => setActivityFilters({ ...activityFilters, to: event.target.value })}/></label>
          <label>Ordenar<select value={activityFilters.sort} onChange={event => setActivityFilters({ ...activityFilters, sort: event.target.value })}><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option></select></label>
          <label>Por página<select value={activityFilters.per_page} onChange={event => setActivityFilters({ ...activityFilters, per_page: event.target.value })}><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
          <div className="aud-filter-actions aud-filter-wide"><button className="aud-primary" disabled={activityLoading}>{activityLoading ? 'Filtrando…' : 'Aplicar filtros'}</button><button type="button" className="aud-secondary" onClick={clearActivityFilters}>Limpar</button></div>
        </form>
      </section>

      <section className="aud-card">
        <header><div><span>LINHA DO TEMPO</span><h3>{activityPagination.total || 0} atividade(s)</h3><p>Página {activityPagination.current_page || 1} de {activityPagination.last_page || 1}</p></div></header>
        {activityError && <div className="aud-error">{activityError}</div>}
        {activityLoading ? <div className="aud-loading-inline">Carregando atividades…</div> : activityRows.length ? <div className="aud-timeline">{activityRows.map(row => <article key={row.id} className="aud-activity-row">
          <i className={`aud-activity-dot ${tone(row.outcome || row.severity)}`}/>
          <div className="aud-activity-main"><div className="aud-activity-title"><b>{row.name || row.type || 'Interação'}</b><span className={`aud-status ${tone(row.outcome || row.severity)}`}>{row.outcome || row.severity || 'registrada'}</span></div><p>{row.application?.name || 'Peter Tecnet'} · {dateTime(row.created_at)}</p><div className="aud-activity-meta">{row.route && <span>{row.method || 'GET'} {row.route}</span>}{row.entity_type && <span>{row.entity_type}{row.entity_id ? ` #${row.entity_id}` : ''}</span>}{row.environment && <span>{row.environment}</span>}{row.request_id && <span>req {row.request_id}</span>}</div></div>
        </article>)}</div> : <Empty>Nenhuma atividade corresponde aos filtros atuais.</Empty>}
        <footer className="aud-pagination"><span>{activityPagination.from && activityPagination.to ? `${activityPagination.from}–${activityPagination.to} de ${activityPagination.total}` : `${activityPagination.total || 0} registros`}</span><div><button className="aud-secondary" disabled={!activityPagination.previous_page || activityLoading} onClick={() => loadActivity(activityPagination.previous_page, activityFilters)}>← Anterior</button><button className="aud-secondary" disabled={!activityPagination.next_page || activityLoading} onClick={() => loadActivity(activityPagination.next_page, activityFilters)}>Próxima →</button></div></footer>
      </section>
    </div>}

    {tab === 'security' && <div className="aud-section-stack">
      <section className="aud-card">
        <header><div><span>SEGURANÇA</span><h3>Sinais da conta</h3><p>Leitura baseada na telemetria recente.</p></div></header>
        <div className="aud-security-alerts">{detail.security?.alerts?.length ? detail.security.alerts.map((alert, index) => <div key={index} className={`aud-security-alert ${tone(alert.level)}`}>{alert.message}</div>) : <div className="aud-security-alert success">Nenhum alerta de segurança detectado no recorte recente.</div>}</div>
        <div className="aud-security-metrics"><Metric label="Logins · 7d" value={summary.logins_7d || 0} detail="últimos 7 dias"/><Metric label="Logins · 30d" value={summary.logins_30d || 0} detail="últimos 30 dias"/><Metric label="Logins · 90d" value={summary.logins_90d || 0} detail="últimos 90 dias"/><Metric label="Primeira atividade" value={dateOnly(summary.first_activity_at)} detail={dateTime(summary.first_activity_at)}/></div>
      </section>
      <div className="aud-security-grid">
        <section className="aud-card"><header><div><span>REDE</span><h3>IPs recentes</h3></div></header><div className="aud-ranked-list">{detail.security?.ips?.length ? detail.security.ips.map(row => <div key={row.value}><code>{row.value}</code><b>{row.count}×</b></div>) : <Empty/>}</div></section>
        <section className="aud-card"><header><div><span>LOCALIZAÇÃO</span><h3>Locais observados</h3></div></header><div className="aud-ranked-list">{detail.security?.locations?.length ? detail.security.locations.map(row => <div key={row.value}><span>{row.value}</span><b>{row.count}×</b></div>) : <Empty/>}</div></section>
        <section className="aud-card"><header><div><span>DISPOSITIVOS</span><h3>Navegadores e sistemas</h3></div></header><div className="aud-ranked-list">{detail.security?.devices?.length ? detail.security.devices.map(row => <div key={row.value}><span>{row.value}</span><b>{row.count}×</b></div>) : <Empty/>}</div></section>
      </div>
    </div>}
  </div>
}
