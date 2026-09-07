import { useEffect, useMemo, useState } from 'react'
import './AdminUserDetailPage.css'
import { confirmAction } from './utils/uiDialog.js'

const EMPTY_ACTIVITY_FILTERS = {
  q: '', app_id: '', type: '', outcome: '', severity: '', environment: '', entity_type: '', from: '', to: '', sort: 'newest', per_page: '50',
}

const TABS = [
  ['overview', 'Resumo'],
  ['relationships', 'Relacionamentos'],
  ['financial', 'Financeiro'],
  ['activity', 'Atividades'],
  ['communication', 'Comunicação'],
  ['security', 'Segurança'],
  ['permissions', 'Permissões'],
  ['audit', 'Auditoria'],
]

const PERIODS = [
  ['24h', '24h'], ['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias'], ['1y', '1 ano'], ['all', 'Tudo'],
]

const ROLE_LABELS = {
  producer: 'Produtor', participant: 'Participante', promoter: 'Promoter', barber: 'Barbeiro',
  barbershop_owner: 'Dono de barbearia', partner: 'Parceiro', ticket_seller: 'Vendedor de ingressos',
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
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(parsed) ? parsed : 0)
}

function compact(value) {
  const parsed = Number(value)
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number.isFinite(parsed) ? parsed : 0)
}

function statusLabel(value) {
  const labels = {
    active: 'Ativo', blocked: 'Bloqueado', suspended: 'Suspenso', pending: 'Pendente', success: 'Sucesso', error: 'Erro', failed: 'Falha',
    approved: 'Aprovado', cancelled: 'Cancelado', paid: 'Pago', confirmed: 'Confirmado', attended: 'Atendido', published: 'Publicado',
    read: 'Lida', delivered: 'Entregue', sent: 'Enviado', processing: 'Processando', refunded: 'Reembolsado', review: 'Em revisão',
  }
  return labels[String(value || '').toLowerCase()] || value || '—'
}

function tone(value) {
  const normalized = String(value || '').toLowerCase()
  if (['error', 'failed', 'blocked', 'suspended', 'cancelled', 'critical', 'danger', 'high'].some(item => normalized.includes(item))) return 'danger'
  if (['pending', 'warning', 'attention', 'queued', 'medium', 'review'].some(item => normalized.includes(item))) return 'warning'
  if (['active', 'success', 'approved', 'paid', 'confirmed', 'attended', 'published', 'excellent', 'good', 'low', 'normal'].some(item => normalized.includes(item))) return 'success'
  return 'neutral'
}

function activityQuery(filters, page = 1) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value))
  })
  params.set('page', String(page))
  return params.toString()
}

function scopedDate(period) {
  if (period === 'all') return null
  const date = new Date()
  if (period === '24h') date.setHours(date.getHours() - 24)
  if (period === '7d') date.setDate(date.getDate() - 7)
  if (period === '30d') date.setDate(date.getDate() - 30)
  if (period === '90d') date.setDate(date.getDate() - 90)
  if (period === '1y') date.setFullYear(date.getFullYear() - 1)
  return date
}

function inPeriod(value, period) {
  if (!value || period === 'all') return true
  const date = new Date(value)
  const lower = scopedDate(period)
  return !Number.isNaN(date.getTime()) && (!lower || date >= lower)
}

function Field({ label, value, hint }) {
  return <div className="aud-field"><span>{label}</span><b>{value || '—'}</b>{hint && <small>{hint}</small>}</div>
}

function Empty({ children = 'Nenhum dado disponível neste recorte.' }) {
  return <div className="aud-empty">{children}</div>
}

function ApplicationMark({ application }) {
  return <span className="aud-app-mark">
    {application?.logo ? <img src={application.logo} alt="" onError={event => { event.currentTarget.style.display = 'none' }}/> : <b>{String(application?.name || 'P').slice(0, 1)}</b>}
  </span>
}

function Metric({ label, value, detail, delta, icon, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return <Tag type={onClick ? 'button' : undefined} className={`aud-metric ${onClick ? 'is-clickable' : ''}`} onClick={onClick}>
    <div className="aud-metric-top"><span>{label}</span>{icon && <i aria-hidden="true">{icon}</i>}</div>
    <strong>{value ?? 0}</strong>
    <div className="aud-metric-foot"><small>{detail}</small>{delta !== undefined && delta !== null && <em className={Number(delta) >= 0 ? 'up' : 'down'}>{Number(delta) >= 0 ? '+' : ''}{delta}%</em>}</div>
  </Tag>
}

function Sparkline({ points = [] }) {
  const values = points.map(item => Number(item.total || 0))
  const max = Math.max(...values, 1)
  const width = 260
  const height = 54
  const path = values.map((value, index) => `${index ? 'L' : 'M'} ${(index / Math.max(values.length - 1, 1)) * width} ${height - (value / max) * (height - 8) - 4}`).join(' ')
  return <svg className="aud-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Atividade nos últimos 30 dias"><path d={path || `M0 ${height - 4} L${width} ${height - 4}`}/></svg>
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

function safeJson(value) {
  if (!value) return '—'
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

export default function AdminUserDetailPage({ userId, apiRequest, applications = [], onBack }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [scope, setScope] = useState({ app_id: '', period: '30d', q: '' })
  const [resourceFilters, setResourceFilters] = useState({ q: '', app_id: '', resource: 'all' })
  const [activityFilters, setActivityFilters] = useState({ ...EMPTY_ACTIVITY_FILTERS })
  const [activityRows, setActivityRows] = useState([])
  const [activityPagination, setActivityPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [emailDeferralState, setEmailDeferralState] = useState(null)
  const [emailDeferralBusy, setEmailDeferralBusy] = useState(false)
  const [emailDeferralNotice, setEmailDeferralNotice] = useState('')
  const [busyAppId, setBusyAppId] = useState(null)
  const [actionBusy, setActionBusy] = useState('')
  const [actionMenu, setActionMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const [noteText, setNoteText] = useState('')
  const [notePinned, setNotePinned] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

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

  async function loadEmailDeferralState() {
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}/email-verification-deferrals`)
      setEmailDeferralState(payload?.email_verification || null)
    } catch {
      setEmailDeferralState(null)
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
      void loadEmailDeferralState()
      void loadActivity(1, { ...EMPTY_ACTIVITY_FILTERS })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [userId])

  const user = detail?.user
  const summary = detail?.summary || {}
  const platforms = detail?.platforms || []
  const resources = detail?.resources || {}
  const facets = detail?.activity_facets || {}
  const financial = detail?.financial || {}
  const behavior = detail?.behavior || {}
  const health = detail?.account_health || { score: 0, level: 'neutral', factors: [] }
  const risk = detail?.risk || { score: 0, level: 'low', alerts: [] }
  const completeness = detail?.profile_completeness || { score: 0, missing: [], complete: [] }
  const annotations = detail?.annotations || { notes: [], tags: [] }
  const operational = detail?.operational_state || { code: 'active', label: 'Operação normal', tone: 'success' }

  const applicationOptions = useMemo(() => {
    const all = [...applications]
    platforms.forEach(platform => {
      const app = platform.application
      if (app?.id && !all.some(candidate => Number(candidate.id) === Number(app.id))) all.push(app)
    })
    return all.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  }, [applications, platforms])

  const resourceGroups = useMemo(() => Object.entries(resources)
    .filter(([, group]) => Number(group?.total || 0) > 0)
    .map(([key, group]) => ({ key, ...group })), [resources])

  const filteredResources = useMemo(() => {
    const localQuery = `${scope.q} ${resourceFilters.q}`.trim().toLocaleLowerCase('pt-BR')
    const appId = resourceFilters.app_id || scope.app_id
    const groups = resourceFilters.resource === 'all' ? resourceGroups : resourceGroups.filter(group => group.key === resourceFilters.resource)
    return groups.map(group => ({
      ...group,
      data: (group.data || []).filter(row => {
        if (appId && Number(row.app_id) !== Number(appId)) return false
        if (!inPeriod(row.created_at || row.start_date || row.order_datetime, scope.period)) return false
        if (!localQuery) return true
        const haystack = [row.name, row.title, row.slug, row.type, row.category, row.role, row.status, row.application?.name, row.establishment?.name, row.production?.name, row.event?.title, row.user?.name, row.user?.email, ...(row.link_types || [])].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR')
        return haystack.includes(localQuery)
      }),
    })).filter(group => group.data.length > 0)
  }, [resourceFilters, resourceGroups, scope])

  const selectedPlatform = useMemo(() => scope.app_id ? platforms.find(item => Number(item.application?.id) === Number(scope.app_id)) : null, [scope.app_id, platforms])
  const scopedMetrics = useMemo(() => {
    if (!selectedPlatform) return summary
    const counts = selectedPlatform.resources || {}
    return {
      total_interactions: selectedPlatform.usage?.total || 0,
      applications: 1,
      establishments: counts.establishments || 0,
      productions: counts.productions || 0,
      items: counts.items || 0,
      employments: counts.employments || 0,
      events: counts.events || 0,
      orders: counts.orders || 0,
      event_passes: counts.event_passes || 0,
    }
  }, [selectedPlatform, summary])

  const scopedTimeline = useMemo(() => (detail?.timeline || []).filter(row => {
    if (scope.app_id && Number(row.application?.id) !== Number(scope.app_id)) return false
    if (!inPeriod(row.created_at, scope.period)) return false
    const q = scope.q.trim().toLocaleLowerCase('pt-BR')
    if (!q) return true
    return [row.name, row.type, row.route, row.entity_type, row.application?.name].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(q)
  }), [detail, scope])

  const scopedCommunications = useMemo(() => (detail?.communications || []).filter(row => {
    if (scope.app_id && row.app_id && Number(row.app_id) !== Number(scope.app_id)) return false
    if (!inPeriod(row.created_at, scope.period)) return false
    const q = scope.q.trim().toLocaleLowerCase('pt-BR')
    return !q || [row.channel, row.subject, row.message, row.status].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(q)
  }), [detail, scope])

  const scopedAudit = useMemo(() => (detail?.audit || []).filter(row => inPeriod(row.created_at, scope.period) && (!scope.q || [row.action, row.actor, row.ip].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(scope.q.toLocaleLowerCase('pt-BR')))), [detail, scope])

  const activeRoles = Object.entries(user?.roles || {}).filter(([, active]) => active).map(([key]) => ROLE_LABELS[key] || key)
  const allAppsBlocked = platforms.length > 0 && platforms.every(platform => platform.access?.status === 'blocked')

  function switchTab(event, nextTab) {
    event?.preventDefault?.()
    setTab(nextTab)
  }

  function showResource(resource) {
    setResourceFilters(current => ({ ...current, resource }))
    setTab('relationships')
  }

  async function toggleAccess(application) {
    const platform = platforms.find(item => Number(item.application?.id) === Number(application.id))
    const nextStatus = platform?.access?.status === 'active' ? 'blocked' : 'active'
    setBusyAppId(application.id)
    setError('')
    try {
      await apiRequest(`/admin/ecosystem/users/${userId}/applications/${application.id}`, { method: 'PUT', body: JSON.stringify({ status: nextStatus, role: platform?.access?.role || 'member' }) })
      await loadDetail({ quiet: true })
    } catch (err) { setError(err.message) } finally { setBusyAppId(null) }
  }

  async function submitActivityFilters(event) {
    event.preventDefault()
    const next = { ...activityFilters, app_id: activityFilters.app_id || scope.app_id }
    await loadActivity(1, next)
  }

  async function clearActivityFilters() {
    const next = { ...EMPTY_ACTIVITY_FILTERS }
    setActivityFilters(next)
    await loadActivity(1, next)
  }

  async function resetEmailVerificationDeferrals() {
    const confirmed = await confirmAction({ tone: 'warning', eyebrow: 'SUPORTE DE CONTA', title: 'Resetar adiamentos de e-mail?', message: `O usuário já utilizou ${Number(emailDeferralState?.deferrals_used || 0)} adiamento(s). Ao resetar, ele poderá adiar a confirmação novamente.`, confirmLabel: 'Resetar adiamentos', cancelLabel: 'Cancelar' })
    if (!confirmed) return
    setEmailDeferralBusy(true)
    setEmailDeferralNotice('')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}/email-verification-deferrals/reset`, { method: 'POST' })
      setEmailDeferralState(payload?.email_verification || null)
      setEmailDeferralNotice(payload?.message || 'Adiamentos resetados com sucesso.')
    } catch (err) { setError(err.message) } finally { setEmailDeferralBusy(false) }
  }

  async function saveNote(event) {
    event.preventDefault()
    if (!noteText.trim()) return
    setActionBusy('note')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}/notes`, { method: 'POST', body: JSON.stringify({ message: noteText.trim(), is_pinned: notePinned }) })
      setNoteText('')
      setNotePinned(false)
      setNotice(payload?.message || 'Nota registrada.')
      await loadDetail({ quiet: true })
    } catch (err) { setError(err.message) } finally { setActionBusy('') }
  }

  async function removeNote(note) {
    const confirmed = await confirmAction({ tone: 'danger', eyebrow: 'NOTA INTERNA', title: 'Excluir nota administrativa?', message: 'A exclusão será registrada na auditoria.', confirmLabel: 'Excluir nota', cancelLabel: 'Cancelar' })
    if (!confirmed) return
    setActionBusy(`note-${note.id}`)
    try {
      await apiRequest(`/admin/ecosystem/users/${userId}/notes/${note.id}`, { method: 'DELETE' })
      await loadDetail({ quiet: true })
    } catch (err) { setError(err.message) } finally { setActionBusy('') }
  }

  async function saveTags(tags) {
    setActionBusy('tags')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}/tags`, { method: 'PUT', body: JSON.stringify({ tags }) })
      setNotice(payload?.message || 'Tags atualizadas.')
      await loadDetail({ quiet: true })
    } catch (err) { setError(err.message) } finally { setActionBusy('') }
  }

  async function addTag(event) {
    event.preventDefault()
    const tag = tagDraft.trim()
    if (!tag) return
    setTagDraft('')
    await saveTags([...new Set([...(annotations.tags || []), tag])])
  }

  async function revokeSessions() {
    const confirmed = await confirmAction({ tone: 'warning', eyebrow: 'SEGURANÇA', title: 'Encerrar todas as sessões?', message: 'Todos os JWTs emitidos anteriormente para este usuário serão invalidados. Ele precisará autenticar novamente.', confirmLabel: 'Encerrar sessões', cancelLabel: 'Cancelar' })
    if (!confirmed) return
    setActionBusy('sessions')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}/security/revoke-sessions`, { method: 'POST' })
      setNotice(payload?.message || 'Sessões invalidadas.')
      await loadDetail({ quiet: true })
    } catch (err) { setError(err.message) } finally { setActionBusy('') }
  }

  async function setAccountAccess(status) {
    const blocking = status === 'blocked'
    const confirmed = await confirmAction({ tone: blocking ? 'danger' : 'warning', eyebrow: 'ACESSO DA CONTA', title: blocking ? 'Bloquear o usuário em todas as aplicações?' : 'Liberar acessos do usuário?', message: blocking ? 'Os vínculos serão bloqueados e as sessões atuais invalidadas.' : 'Os vínculos existentes voltarão ao estado ativo.', confirmLabel: blocking ? 'Bloquear conta' : 'Liberar acessos', cancelLabel: 'Cancelar' })
    if (!confirmed) return
    setActionBusy('account')
    try {
      const payload = await apiRequest(`/admin/ecosystem/users/${userId}/account-access`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setNotice(payload?.message || 'Acesso atualizado.')
      setActionMenu(false)
      await loadDetail({ quiet: true })
    } catch (err) { setError(err.message) } finally { setActionBusy('') }
  }

  async function shareUser() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNotice('Link administrativo copiado.')
    } catch { setNotice('Não foi possível copiar automaticamente o link.') }
  }

  if (loading) return <div className="aud-page aud-loading"><div className="aud-loader"/><p>Montando a Central 360° do usuário…</p></div>
  if (!user) return <div className="aud-page"><button type="button" className="aud-back" onClick={onBack}>← Voltar para usuários</button><div className="aud-error">{error || 'Não foi possível carregar este usuário.'}</div></div>

  return <div className="aud-page">
    <div className="aud-page-head">
      <div><p className="aud-page-eyebrow">USUÁRIOS / CENTRAL 360°</p><button type="button" className="aud-back" onClick={onBack}>← Voltar para usuários</button></div>
      <div className="aud-head-actions">
        <button type="button" className="aud-icon-action" onClick={shareUser} title="Copiar link desta ficha">↗</button>
        <button type="button" className="aud-secondary" onClick={() => { void loadDetail(); void loadEmailDeferralState() }}>↻ Atualizar</button>
        <div className="aud-action-menu-wrap">
          <button type="button" className="aud-primary" onClick={() => setActionMenu(value => !value)}>Ações ▾</button>
          {actionMenu && <div className="aud-action-menu">
            <button type="button" onClick={revokeSessions}>Encerrar sessões</button>
            <button type="button" onClick={() => setTab('permissions')}>Gerenciar acessos</button>
            <button type="button" onClick={() => setTab('communication')}>Abrir comunicação</button>
            <button type="button" className={allAppsBlocked ? '' : 'danger'} onClick={() => setAccountAccess(allAppsBlocked ? 'active' : 'blocked')}>{allAppsBlocked ? 'Liberar conta' : 'Bloquear conta'}</button>
          </div>}
        </div>
      </div>
    </div>

    {error && <div className="aud-error">{error}</div>}
    {notice && <div className="aud-notice"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>×</button></div>}

    <div className={`aud-operational ${tone(operational.tone || operational.code)}`}><span className="aud-pulse"/><b>{operational.label}</b><small>Saúde {health.score}/100 · risco {risk.score}/100 · perfil {completeness.score}% completo</small></div>

    <section className="aud-hero">
      <div className="aud-identity">
        <div className="aud-avatar">{user.avatar ? <img src={user.avatar} alt=""/> : fullName(user).slice(0, 2).toUpperCase()}</div>
        <div className="aud-identity-copy">
          <p className="aud-kicker">USUÁRIO #{user.id}</p>
          <h1>{fullName(user)}</h1>
          <p>{user.email} <span>·</span> @{user.user_name || 'sem-usuario'}</p>
          <div className="aud-chips">
            <span>{user.profile?.name || 'Sem perfil'}</span>
            <span className={user.email_verified_at ? 'is-success' : 'is-warning'}>{user.email_verified_at ? 'E-mail verificado' : 'E-mail pendente'}</span>
            {activeRoles.slice(0, 4).map(role => <span key={role}>{role}</span>)}
            {(annotations.tags || []).slice(0, 4).map(tag => <span className="is-tag" key={tag}>#{tag}</span>)}
          </div>
        </div>
      </div>
      <div className="aud-hero-intelligence">
        <div className={`aud-score aud-score--${tone(health.level)}`} style={{ '--score': `${Math.max(0, Math.min(100, health.score)) * 3.6}deg` }}><div><strong>{health.score}</strong><span>saúde</span></div></div>
        <div className="aud-hero-meta">
          <Field label="Criado" value={dateTime(user.created_at)}/>
          <Field label="Última atividade" value={dateTime(summary.last_activity_at)}/>
          <Field label="Último login" value={dateTime(summary.last_login_at)}/>
          <Field label="Perfil" value={`${completeness.score}%`} hint={(completeness.missing || []).length ? `Falta: ${(completeness.missing || []).slice(0, 2).join(', ')}` : 'Cadastro completo'}/>
        </div>
      </div>
    </section>

    <section className="aud-commandbar" aria-label="Filtros globais da ficha">
      <label className="aud-search-user"><span>⌕</span><input value={scope.q} onChange={event => setScope({ ...scope, q: event.target.value })} placeholder="Buscar nesta ficha: evento, pedido, ação, mensagem…"/></label>
      <select value={scope.app_id} onChange={event => setScope({ ...scope, app_id: event.target.value })} aria-label="Filtrar por aplicação"><option value="">Todos os apps</option>{applicationOptions.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select>
      <div className="aud-periods">{PERIODS.map(([key, label]) => <button type="button" key={key} className={scope.period === key ? 'active' : ''} onClick={() => setScope({ ...scope, period: key })}>{label}</button>)}</div>
    </section>

    <div className="aud-metrics aud-metrics-main">
      <Metric label="Interações" icon="↯" value={compact(scope.app_id ? scopedMetrics.total_interactions : (scope.period === '7d' ? summary.interactions_7d : scope.period === '30d' ? summary.interactions_30d : scope.period === '90d' ? summary.interactions_90d : summary.total_interactions))} detail={scope.app_id ? selectedPlatform?.application?.name : `recorte: ${PERIODS.find(([key]) => key === scope.period)?.[1]}`} delta={!scope.app_id && scope.period === '30d' ? behavior.trend_percent : null} onClick={() => setTab('activity')}/>
      <Metric label="Estabelecimentos" icon="⌂" value={scopedMetrics.establishments || 0} detail={`${scopedMetrics.productions || 0} produção(ões)`} onClick={() => showResource('establishments')}/>
      <Metric label="Eventos" icon="◇" value={scopedMetrics.events || 0} detail="eventos relacionados" onClick={() => showResource('events')}/>
      <Metric label="Itens" icon="▦" value={scopedMetrics.items || 0} detail="itens no contexto" onClick={() => showResource('items')}/>
      <Metric label="Pedidos" icon="□" value={scopedMetrics.orders || 0} detail="compras e vendas" onClick={() => showResource('orders')}/>
      <Metric label="Ingressos" icon="▣" value={scopedMetrics.event_passes || 0} detail="passes do usuário" onClick={() => showResource('event_passes')}/>
      <Metric label="GMV associado" icon="R$" value={money(financial.gross_amount)} detail={`${financial.paid_count || 0} pagamento(s) aprovado(s)`} onClick={() => setTab('financial')}/>
      <Metric label="Risco" icon="!" value={`${risk.score || 0}/100`} detail={`${(risk.alerts || []).length} sinal(is) ativo(s)`} onClick={() => setTab('security')}/>
    </div>

    <nav className="aud-tabs" aria-label="Seções do usuário">{TABS.map(([key, label]) => <button type="button" key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={event => switchTab(event, key)}>{label}</button>)}</nav>

    {tab === 'overview' && <div className="aud-section-stack">
      <section className="aud-insights">
        <div className="aud-section-title"><span>LEITURA EXECUTIVA</span><h2>O que precisamos saber agora</h2></div>
        <div className="aud-insight-grid">{(detail.insights || []).length ? detail.insights.map((insight, index) => <article key={index}><span>{index + 1}</span><p>{insight}</p></article>) : <Empty/>}</div>
      </section>

      <div className="aud-overview-grid">
        <section className="aud-card aud-behavior-card"><header><div><span>COMPORTAMENTO</span><h3>Ritmo de uso</h3></div><em className={Number(behavior.trend_percent) >= 0 ? 'trend-up' : 'trend-down'}>{Number(behavior.trend_percent || 0) >= 0 ? '+' : ''}{behavior.trend_percent || 0}%</em></header><Sparkline points={behavior.activity_series_30d || []}/><div className="aud-mini-stats"><div><b>{behavior.active_days_30d || 0}</b><span>dias ativos / 30d</span></div><div><b>{behavior.sessions_30d || 0}</b><span>sessões / 30d</span></div><div><b>{compact(behavior.interactions_30d || 0)}</b><span>interações / 30d</span></div></div></section>
        <section className="aud-card"><header><div><span>ALERTAS</span><h3>O que exige atenção</h3></div><span className={`aud-status ${tone(risk.level)}`}>{risk.level === 'low' ? 'Risco baixo' : risk.level === 'medium' ? 'Risco médio' : 'Risco alto'}</span></header><div className="aud-alert-list">{(risk.alerts || []).length ? risk.alerts.slice(0, 6).map((alert, index) => <div className={tone(alert.level)} key={index}><i>!</i><span><b>{alert.type || 'Sinal'}</b><small>{alert.message}</small></span></div>) : <div className="success"><i>✓</i><span><b>Sem alertas relevantes</b><small>Nenhum sinal de risco exige ação imediata.</small></span></div>}</div></section>
      </div>

      <section className="aud-card"><header><div><span>IDENTIDADE</span><h3>Dados e completude</h3><p>Dados essenciais para suporte, relacionamento e operação.</p></div><div className="aud-completeness"><b>{completeness.score}%</b><span>completo</span></div></header><div className="aud-fields-grid">
        <Field label="ID" value={`#${user.id}`}/><Field label="Nome" value={fullName(user)}/><Field label="E-mail" value={user.email}/><Field label="Usuário" value={user.user_name ? `@${user.user_name}` : '—'}/>
        <Field label="Telefone" value={user.phone}/><Field label="CPF" value={user.cpf_masked}/><Field label="Nascimento" value={dateOnly(user.birthdate)}/><Field label="Ocupação" value={user.occupation}/>
        <Field label="Cidade/UF" value={[user.city, user.uf].filter(Boolean).join('/')}/><Field label="CEP" value={user.postal_code}/><Field label="Endereço" value={user.address}/><Field label="Perfil" value={user.profile?.name}/>
      </div>{user.about && <div className="aud-about"><span>Sobre</span><p>{user.about}</p></div>}{(completeness.missing || []).length > 0 && <div className="aud-missing"><b>Falta completar</b><div>{completeness.missing.map(item => <span key={item}>{item}</span>)}</div></div>}</section>

      <div className="aud-overview-grid">
        <section className="aud-card"><header><div><span>PAPÉIS E IDENTIDADES</span><h3>Quem é este usuário?</h3><p>Papéis globais, por aplicação e por estabelecimento.</p></div></header><div className="aud-role-list">{(detail.roles_and_identities || []).length ? detail.roles_and_identities.map((row, index) => <div key={`${row.role}-${row.context}-${index}`}><span className={`aud-role-icon ${row.scope}`}>{row.scope === 'global' ? 'G' : row.scope === 'application' ? 'A' : 'E'}</span><span><b>{row.role}</b><small>{row.context} · {row.scope === 'global' ? 'global' : row.scope === 'application' ? 'aplicação' : 'estabelecimento'}</small></span></div>) : <Empty>Nenhum papel adicional detectado.</Empty>}</div></section>
        <section className="aud-card"><header><div><span>SEGMENTAÇÃO</span><h3>Tags administrativas</h3><p>Use para suporte, CRM e priorização.</p></div></header><div className="aud-tag-cloud">{(annotations.tags || []).map(tag => <button type="button" key={tag} onClick={() => saveTags((annotations.tags || []).filter(item => item !== tag))}>#{tag}<span>×</span></button>)}</div><form className="aud-inline-form" onSubmit={addTag}><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} maxLength={80} placeholder="Adicionar tag…"/><button className="aud-primary" disabled={actionBusy === 'tags'}>{actionBusy === 'tags' ? 'Salvando…' : 'Adicionar'}</button></form></section>
      </div>

      <section className="aud-card"><header><div><span>NOTAS INTERNAS</span><h3>Contexto administrativo</h3><p>Visível somente no Admin Center. Toda alteração fica auditada.</p></div></header><form className="aud-note-form" onSubmit={saveNote}><textarea rows={3} value={noteText} onChange={event => setNoteText(event.target.value)} maxLength={5000} placeholder="Ex.: produtor entrou em contato sobre pagamento, conta verificada manualmente…"/><label><input type="checkbox" checked={notePinned} onChange={event => setNotePinned(event.target.checked)}/> Fixar como importante</label><button className="aud-primary" disabled={actionBusy === 'note'}>{actionBusy === 'note' ? 'Registrando…' : 'Registrar nota'}</button></form><div className="aud-note-list">{(annotations.notes || []).length ? annotations.notes.map(note => <article className={note.is_pinned ? 'pinned' : ''} key={note.id}><div><span>{note.is_pinned ? '★ FIXADA' : 'NOTA'}</span><small>{dateTime(note.created_at)} · {note.actor?.name || 'Sistema'}</small></div><p>{note.value}</p><button type="button" onClick={() => removeNote(note)} disabled={actionBusy === `note-${note.id}`}>Excluir</button></article>) : <Empty>Nenhuma nota administrativa registrada.</Empty>}</div></section>

      <div className="aud-overview-grid">
        <section className="aud-card"><header><div><span>ATIVIDADE RECENTE</span><h3>Últimos movimentos</h3></div><button className="aud-link-button" onClick={() => setTab('activity')}>Ver tudo →</button></header><div className="aud-compact-timeline">{scopedTimeline.length ? scopedTimeline.slice(0, 8).map(row => <div key={row.id}><i className={tone(row.outcome || row.severity)}/><span><b>{row.name || row.type || 'Interação'}</b><small>{row.application?.name || 'Peter Tecnet'} · {dateTime(row.created_at)}</small></span></div>) : <Empty/>}</div></section>
        <section className="aud-card"><header><div><span>ROTAS MAIS USADAS</span><h3>Onde ele mais atua</h3></div></header><div className="aud-ranked-list">{(behavior.top_routes || []).length ? behavior.top_routes.map(row => <div key={row.label}><code>{row.label}</code><b>{compact(row.total)}×</b></div>) : <Empty/>}</div></section>
      </div>
    </div>}

    {tab === 'relationships' && <div className="aud-section-stack">
      <section className="aud-card aud-relationship-map"><header><div><span>MAPA DE RELACIONAMENTOS</span><h3>Usuário → apps → recursos</h3><p>Leitura rápida da presença deste usuário no ecossistema.</p></div></header><div className="aud-node-flow">{(detail.relationships || []).map((node, index) => <div key={node.id} className={`aud-node aud-node--${node.type}`}><span>{index === 0 ? '●' : '→'}</span><article><small>{node.type}</small><b>{node.label}</b><em>{node.count}</em></article></div>)}</div></section>
      <section className="aud-card aud-filter-card"><header><div><span>FILTROS</span><h3>Vínculos e recursos</h3></div><button type="button" className="aud-secondary" onClick={() => setResourceFilters({ q: '', app_id: '', resource: 'all' })}>Limpar</button></header><div className="aud-resource-filters"><label className="aud-filter-wide">Buscar<input value={resourceFilters.q} onChange={event => setResourceFilters({ ...resourceFilters, q: event.target.value })} placeholder="Nome, categoria, estabelecimento, evento, função…"/></label><label>Plataforma<select value={resourceFilters.app_id} onChange={event => setResourceFilters({ ...resourceFilters, app_id: event.target.value })}><option value="">Todas</option>{applicationOptions.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><label>Tipo<select value={resourceFilters.resource} onChange={event => setResourceFilters({ ...resourceFilters, resource: event.target.value })}><option value="all">Todos</option>{resourceGroups.map(group => <option key={group.key} value={group.key}>{group.label} ({group.total})</option>)}</select></label></div></section>
      {filteredResources.length ? filteredResources.map(group => <section className="aud-card" key={group.key}><header><div><span>RECURSO</span><h3>{group.label}</h3><p>{group.total} vínculo(s){group.truncated ? ' · registros recentes' : ''}</p></div></header><div className="aud-resource-table"><table><thead><tr><th>Registro</th><th>Plataforma</th><th>Contexto</th><th>Status</th><th>Data/valor</th></tr></thead><tbody>{group.data.map((row, index) => <tr key={row.id || index}><td><b>{row.name || row.title || `#${row.id}`}</b><small>#{row.id}{row.slug ? ` · ${row.slug}` : ''}</small></td><td>{row.application?.name || '—'}</td><td>{resourceContext(row)}</td><td><span className={`aud-status ${tone(resourceStatus(row))}`}>{resourceStatus(row)}</span></td><td>{resourceValue(row)}</td></tr>)}</tbody></table></div></section>) : <section className="aud-card"><Empty>Nenhum vínculo corresponde aos filtros atuais.</Empty></section>}
    </div>}

    {tab === 'financial' && <div className="aud-section-stack">
      <div className="aud-financial-grid"><Metric label="GMV associado" value={money(financial.gross_amount)} detail={`${financial.payment_count || 0} pagamentos`}/><Metric label="Receita plataforma" value={money(financial.platform_fee)} detail={`take rate ${financial.take_rate || 0}%`}/><Metric label="Líquido vendedor" value={money(financial.seller_net)} detail="seller net registrado"/><Metric label="Ticket médio" value={money(financial.average_ticket)} detail={`${financial.paid_count || 0} aprovados`}/><Metric label="Pendentes" value={financial.pending_count || 0} detail="pagamentos em aberto"/><Metric label="Falhas" value={financial.failed_count || 0} detail="rejeitados/cancelados"/><Metric label="Reembolsos" value={financial.refunded_count || 0} detail="movimentos reembolsados"/><Metric label="Taxa provedor" value={money(financial.provider_fee)} detail="custos do gateway"/></div>
      <section className="aud-card"><header><div><span>PAGAMENTOS</span><h3>Movimentação recente associada</h3><p>Inclui pagamentos do usuário e de estabelecimentos diretamente vinculados.</p></div></header>{(financial.recent || []).length ? <div className="aud-resource-table"><table><thead><tr><th>ID</th><th>Status</th><th>Método</th><th>Bruto</th><th>Taxa plataforma</th><th>Líquido</th><th>Data</th></tr></thead><tbody>{financial.recent.map(row => <tr key={row.id}><td><b>{row.public_id || `#${row.id}`}</b></td><td><span className={`aud-status ${tone(row.status)}`}>{statusLabel(row.status)}</span></td><td>{row.method || '—'}</td><td>{money(row.gross_amount)}</td><td>{money(row.platform_fee)}</td><td>{money(row.seller_net)}</td><td>{dateTime(row.paid_at || row.created_at)}</td></tr>)}</tbody></table></div> : <Empty>Nenhum pagamento financeiro associado foi encontrado.</Empty>}</section>
      <div className="aud-overview-grid"><section className="aud-card"><header><div><span>PEDIDOS</span><h3>Compras, vendas e agendamentos</h3></div><button className="aud-link-button" onClick={() => showResource('orders')}>Abrir recursos →</button></header><div className="aud-mini-stats"><div><b>{summary.orders || 0}</b><span>pedidos vinculados</span></div><div><b>{financial.paid_count || 0}</b><span>pagamentos aprovados</span></div><div><b>{financial.pending_count || 0}</b><span>pendências</span></div></div></section><section className="aud-card"><header><div><span>INGRESSOS</span><h3>Participação e check-in</h3></div><button className="aud-link-button" onClick={() => showResource('event_passes')}>Abrir ingressos →</button></header><div className="aud-mini-stats"><div><b>{summary.event_passes || 0}</b><span>passes do usuário</span></div><div><b>{summary.events || 0}</b><span>eventos administrados</span></div><div><b>{resources.tickets?.total || 0}</b><span>lotes dos eventos</span></div></div></section></div>
    </div>}

    {tab === 'activity' && <div className="aud-section-stack">
      <section className="aud-card aud-filter-card"><header><div><span>TELEMETRIA</span><h3>Linha do tempo unificada</h3><p>Login, navegação, operações, erros e alterações registrados pela API central.</p></div></header><form className="aud-activity-filters" onSubmit={submitActivityFilters}><label className="aud-filter-wide">Buscar<input value={activityFilters.q} onChange={event => setActivityFilters({ ...activityFilters, q: event.target.value })} placeholder="Ação, rota, entidade, request ID…"/></label><label>Aplicação<select value={activityFilters.app_id} onChange={event => setActivityFilters({ ...activityFilters, app_id: event.target.value })}><option value="">Todas</option>{applicationOptions.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><label>Tipo<select value={activityFilters.type} onChange={event => setActivityFilters({ ...activityFilters, type: event.target.value })}><option value="">Todos</option>{(facets.types || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Resultado<select value={activityFilters.outcome} onChange={event => setActivityFilters({ ...activityFilters, outcome: event.target.value })}><option value="">Todos</option>{(facets.outcomes || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Severidade<select value={activityFilters.severity} onChange={event => setActivityFilters({ ...activityFilters, severity: event.target.value })}><option value="">Todas</option>{(facets.severities || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Ambiente<select value={activityFilters.environment} onChange={event => setActivityFilters({ ...activityFilters, environment: event.target.value })}><option value="">Todos</option>{(facets.environments || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Entidade<select value={activityFilters.entity_type} onChange={event => setActivityFilters({ ...activityFilters, entity_type: event.target.value })}><option value="">Todas</option>{(facets.entity_types || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>De<input type="date" value={activityFilters.from} onChange={event => setActivityFilters({ ...activityFilters, from: event.target.value })}/></label><label>Até<input type="date" value={activityFilters.to} onChange={event => setActivityFilters({ ...activityFilters, to: event.target.value })}/></label><label>Ordenar<select value={activityFilters.sort} onChange={event => setActivityFilters({ ...activityFilters, sort: event.target.value })}><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option></select></label><label>Por página<select value={activityFilters.per_page} onChange={event => setActivityFilters({ ...activityFilters, per_page: event.target.value })}><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><div className="aud-filter-actions aud-filter-wide"><button type="submit" className="aud-primary" disabled={activityLoading}>{activityLoading ? 'Filtrando…' : 'Aplicar filtros'}</button><button type="button" className="aud-secondary" onClick={clearActivityFilters}>Limpar</button></div></form></section>
      <section className="aud-card"><header><div><span>LINHA DO TEMPO</span><h3>{activityPagination.total || 0} atividade(s)</h3><p>Página {activityPagination.current_page || 1} de {activityPagination.last_page || 1}</p></div></header>{activityError && <div className="aud-error">{activityError}</div>}{activityLoading ? <div className="aud-loading-inline">Carregando atividades…</div> : activityRows.length ? <div className="aud-timeline">{activityRows.map(row => <article key={row.id} className="aud-activity-row"><i className={`aud-activity-dot ${tone(row.outcome || row.severity)}`}/><div className="aud-activity-main"><div className="aud-activity-title"><b>{row.name || row.type || 'Interação'}</b><span className={`aud-status ${tone(row.outcome || row.severity)}`}>{row.outcome || row.severity || 'registrada'}</span></div><p>{row.application?.name || 'Peter Tecnet'} · {dateTime(row.created_at)}</p><div className="aud-activity-meta">{row.route && <span>{row.method || 'GET'} {row.route}</span>}{row.entity_type && <span>{row.entity_type}{row.entity_id ? ` #${row.entity_id}` : ''}</span>}{row.environment && <span>{row.environment}</span>}{row.request_id && <span>req {row.request_id}</span>}</div></div></article>)}</div> : <Empty>Nenhuma atividade corresponde aos filtros.</Empty>}<footer className="aud-pagination"><span>{activityPagination.from && activityPagination.to ? `${activityPagination.from}–${activityPagination.to} de ${activityPagination.total}` : `${activityPagination.total || 0} registros`}</span><div><button type="button" className="aud-secondary" disabled={!activityPagination.previous_page || activityLoading} onClick={() => loadActivity(activityPagination.previous_page, activityFilters)}>← Anterior</button><button type="button" className="aud-secondary" disabled={!activityPagination.next_page || activityLoading} onClick={() => loadActivity(activityPagination.next_page, activityFilters)}>Próxima →</button></div></footer></section>
    </div>}

    {tab === 'communication' && <div className="aud-section-stack">
      <section className="aud-card aud-communication-intro"><div><span>COMUNICAÇÃO 360°</span><h3>Histórico e relacionamento</h3><p>Use os botões E-mail, Notificação ou Comunicar no topo para iniciar um novo contato. O histórico abaixo consolida os canais já registrados.</p></div><div className="aud-mini-stats"><div><b>{scopedCommunications.length}</b><span>comunicações</span></div><div><b>{scopedCommunications.filter(row => row.channel === 'email').length}</b><span>e-mails</span></div><div><b>{scopedCommunications.filter(row => row.channel === 'notification').length}</b><span>notificações</span></div></div></section>
      <section className="aud-card"><header><div><span>HISTÓRICO</span><h3>Comunicações com o usuário</h3></div></header><div className="aud-communication-list">{scopedCommunications.length ? scopedCommunications.map(row => <article key={row.id}><span className={`aud-channel aud-channel--${row.channel}`}>{row.channel === 'email' ? '✉' : '●'}</span><div><div><b>{row.subject || 'Comunicação'}</b><span className={`aud-status ${tone(row.status)}`}>{statusLabel(row.status)}</span></div>{row.message && <p>{row.message}</p>}<small>{row.channel === 'email' ? 'E-mail' : 'Notificação'} · {dateTime(row.created_at)}{row.read_at ? ` · lida ${dateTime(row.read_at)}` : ''}</small></div></article>) : <Empty>Nenhuma comunicação encontrada no recorte selecionado.</Empty>}</div></section>
    </div>}

    {tab === 'security' && <div className="aud-section-stack">
      <div className="aud-security-score-grid"><section className="aud-card aud-health-panel"><div className={`aud-score aud-score--${tone(health.level)}`} style={{ '--score': `${Math.max(0, Math.min(100, health.score)) * 3.6}deg` }}><div><strong>{health.score}</strong><span>saúde</span></div></div><div><span>SAÚDE DA CONTA</span><h3>{health.level === 'excellent' ? 'Excelente' : health.level === 'good' ? 'Boa' : health.level === 'attention' ? 'Requer atenção' : 'Crítica'}</h3><p>A pontuação explica sinais concretos, não uma classificação opaca.</p></div></section><section className="aud-card"><header><div><span>RISCO</span><h3>{risk.score || 0}/100</h3></div><span className={`aud-status ${tone(risk.level)}`}>{risk.level === 'low' ? 'Baixo' : risk.level === 'medium' ? 'Médio' : 'Alto'}</span></header><div className="aud-health-factors">{(health.factors || []).map((factor, index) => <div key={index}><b>{factor.impact}</b><span>{factor.label}</span></div>)}{!(health.factors || []).length && <div className="positive"><b>✓</b><span>Nenhum fator negativo relevante.</span></div>}</div></section></div>
      <section className="aud-card"><header><div><span>SESSÕES</span><h3>Dispositivos e sessões observadas</h3><p>Encerre tudo imediatamente quando houver suspeita de acesso indevido.</p></div><button type="button" className="aud-danger" onClick={revokeSessions} disabled={actionBusy === 'sessions'}>{actionBusy === 'sessions' ? 'Encerrando…' : 'Encerrar todas as sessões'}</button></header><div className="aud-session-list">{(detail.sessions || []).length ? detail.sessions.map((row, index) => <div key={`${row.session_key}-${index}`}><span><b>{row.session_key}</b><small>{row.user_agent || 'Dispositivo não identificado'}</small></span><span><b>{row.ip || 'IP —'}</b><small>{dateTime(row.last_activity_at)} · {row.interactions} ações</small></span></div>) : <Empty>Nenhuma sessão identificável na telemetria recente.</Empty>}</div></section>
      <section className="aud-card"><header><div><span>CONFIRMAÇÃO DE E-MAIL</span><h3>Adiamentos da confirmação</h3></div></header><div className="aud-security-metrics"><Metric label="Adiamentos usados" value={emailDeferralState ? `${emailDeferralState.deferrals_used}/${emailDeferralState.max_deferrals}` : '—'} detail={emailDeferralState?.confirmation_required ? 'confirmação obrigatória' : 'limite atual'}/><Metric label="Restantes" value={emailDeferralState?.deferrals_remaining ?? '—'} detail={emailDeferralState?.can_defer ? 'ainda pode adiar' : 'nenhum disponível'}/><Metric label="Último adiamento" value={dateOnly(emailDeferralState?.last_deferred_at)} detail={dateTime(emailDeferralState?.last_deferred_at)}/><Metric label="Logins 30d" value={summary.logins_30d || 0} detail={`${summary.logins_7d || 0} nos últimos 7d`}/></div>{emailDeferralNotice && <div className="aud-security-alert success">{emailDeferralNotice}</div>}<div className="aud-filter-actions"><button type="button" className="aud-primary" onClick={resetEmailVerificationDeferrals} disabled={emailDeferralBusy || emailDeferralState?.verified || !Number(emailDeferralState?.deferrals_used || 0)}>{emailDeferralBusy ? 'Resetando…' : 'Resetar adiamentos de e-mail'}</button></div></section>
      <div className="aud-security-grid"><section className="aud-card"><header><div><span>REDE</span><h3>IPs recentes</h3></div></header><div className="aud-ranked-list">{detail.security?.ips?.length ? detail.security.ips.map(row => <div key={row.value}><code>{row.value}</code><b>{row.count}×</b></div>) : <Empty/>}</div></section><section className="aud-card"><header><div><span>LOCALIZAÇÃO</span><h3>Locais observados</h3></div></header><div className="aud-ranked-list">{detail.security?.locations?.length ? detail.security.locations.map(row => <div key={row.value}><span>{row.value}</span><b>{row.count}×</b></div>) : <Empty/>}</div></section><section className="aud-card"><header><div><span>DISPOSITIVOS</span><h3>Navegadores e sistemas</h3></div></header><div className="aud-ranked-list">{detail.security?.devices?.length ? detail.security.devices.map(row => <div key={row.value}><span>{row.value}</span><b>{row.count}×</b></div>) : <Empty/>}</div></section></div>
      <section className="aud-card aud-danger-zone"><header><div><span>ESTADO OPERACIONAL</span><h3>Controle amplo de acesso</h3><p>Ação forte para incidentes. Alterações ficam registradas na auditoria.</p></div><button type="button" className={allAppsBlocked ? 'aud-primary' : 'aud-danger'} onClick={() => setAccountAccess(allAppsBlocked ? 'active' : 'blocked')} disabled={actionBusy === 'account'}>{actionBusy === 'account' ? 'Aplicando…' : allAppsBlocked ? 'Liberar conta' : 'Bloquear conta'}</button></header></section>
    </div>}

    {tab === 'permissions' && <div className="aud-section-stack">
      <section className="aud-card"><header><div><span>PERMISSÕES EFETIVAS</span><h3>O que o usuário pode fazer e por quê</h3><p>Separa perfil, papel de aplicação e permissões herdadas de vínculo.</p></div><span className="aud-count-badge">{detail.permissions?.count || 0}</span></header><div className="aud-permission-list">{(detail.permissions?.effective || []).length ? detail.permissions.effective.map((row, index) => <div key={`${row.permission}-${row.source_label}-${index}`}><code>{row.permission}</code><span><b>{row.source_label}</b><small>{row.source === 'profile' ? 'Perfil global' : row.source === 'employment' ? 'Vínculo com estabelecimento' : 'Papel na aplicação'} · escopo {row.scope}</small></span></div>) : <Empty>Nenhuma permissão explícita foi encontrada.</Empty>}</div></section>
      <section className="aud-card"><header><div><span>ACESSO POR APLICAÇÃO</span><h3>Vínculos e estados</h3><p>Controle individual sem alterar o papel global do usuário.</p></div></header><div className="aud-access-list">{applicationOptions.length ? applicationOptions.map(application => { const platform = platforms.find(item => Number(item.application?.id) === Number(application.id)); const access = platform?.access; const isActive = access?.status === 'active'; return <div key={application.id} className="aud-access-row"><div><ApplicationMark application={application}/><span><b>{application.name}</b><small>{access ? `${statusLabel(access.status)} · papel ${access.role || 'member'} · desde ${dateOnly(access.joined_at)}` : 'Sem vínculo atual'}</small></span></div><button type="button" className={isActive ? 'aud-danger' : 'aud-primary'} disabled={busyAppId === application.id} onClick={() => toggleAccess(application)}>{busyAppId === application.id ? 'Salvando…' : isActive ? 'Bloquear' : 'Liberar acesso'}</button></div> }) : <Empty>Nenhuma aplicação cadastrada.</Empty>}</div></section>
    </div>}

    {tab === 'audit' && <div className="aud-section-stack">
      <section className="aud-card"><header><div><span>AUDITORIA IMUTÁVEL</span><h3>Histórico administrativo</h3><p>Quem alterou, quando e qual foi o antes/depois das operações sensíveis.</p></div><span className="aud-count-badge">{scopedAudit.length}</span></header><div className="aud-audit-list">{scopedAudit.length ? scopedAudit.map(row => <article key={row.id}><div className="aud-audit-head"><span><b>{row.action}</b><small>{row.actor || 'Sistema'} · {dateTime(row.created_at)} · {row.ip || 'IP não informado'}</small></span></div>{(row.before || row.after) && <div className="aud-audit-diff"><div><span>ANTES</span><pre>{safeJson(row.before)}</pre></div><div><span>DEPOIS</span><pre>{safeJson(row.after)}</pre></div></div>}</article>) : <Empty>Nenhuma alteração administrativa encontrada no recorte atual.</Empty>}</div></section>
    </div>}
  </div>
}
