import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminOverviewIntelligence.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const SLOT_ID = 'admin-overview-intelligence-slot'

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compactNumber(value) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(number(value))
}

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(number(value))
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toneOf(value) {
  const text = String(value || '').toLowerCase()
  if (['critical', 'crítico', 'critico', 'down', 'failed', 'failure', 'error', 'unhealthy', 'danger'].some(key => text.includes(key))) return 'danger'
  if (['warning', 'degraded', 'pending', 'attention', 'atenção', 'atencao'].some(key => text.includes(key))) return 'warning'
  return 'success'
}

function timeAgo(value) {
  if (!value) return 'agora'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 45) return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days} d`
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

async function request(path) {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) throw new Error('Sessão administrativa indisponível.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${API}${path}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || payload?.error || `Falha ao carregar ${path}`)
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function goTo(section) {
  document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function priorityFromIssue(issue, index) {
  const severity = issue?.severity || issue?.status || issue?.level || 'warning'
  return {
    id: `issue-${issue?.id || issue?.public_id || index}`,
    tone: toneOf(severity),
    eyebrow: toneOf(severity) === 'danger' ? 'CRÍTICO' : 'ATENÇÃO',
    title: issue?.title || issue?.name || issue?.message || 'Sinal operacional detectado',
    detail: issue?.description || issue?.message || String(severity),
    section: 'operations',
    action: 'Abrir operações',
  }
}

function PriorityCard({ item }) {
  return <article className={`aoi-priority aoi-${item.tone}`}>
    <span className="aoi-priority-signal" aria-hidden="true" />
    <div className="aoi-priority-copy">
      <small>{item.eyebrow}</small>
      <b>{item.title}</b>
      <p>{item.detail}</p>
    </div>
    {item.section && <button type="button" onClick={() => goTo(item.section)}>{item.action || 'Ver detalhes'} <span>↗</span></button>}
  </article>
}

function QuickAction({ icon, title, detail, section }) {
  return <button className="aoi-quick-action" type="button" onClick={() => goTo(section)}>
    <span className="aoi-quick-icon" aria-hidden="true">{icon}</span>
    <span><b>{title}</b><small>{detail}</small></span>
    <i aria-hidden="true">↗</i>
  </button>
}

function ApplicationRow({ app }) {
  const activity = number(app?.activity_count_30d ?? app?.interactions_30d ?? app?.users_count)
  const status = app?.is_active === false ? 'warning' : toneOf(app?.health_status || app?.status || 'healthy')
  return <div className="aoi-app-row">
    <div className="aoi-app-identity">
      <span className={`aoi-app-dot aoi-${status}`} />
      <span><b>{app?.name || app?.application_name || app?.slug || 'Aplicação'}</b><small>{app?.slug || app?.description || 'Peter Tecnet'}</small></span>
    </div>
    <div className="aoi-app-number"><b>{compactNumber(activity)}</b><small>atividade 30d</small></div>
  </div>
}

function ActivityRow({ row, index }) {
  const app = row?.application_name || row?.app_name || row?.app_slug || row?.application || 'Ecossistema'
  const message = row?.description || row?.message || row?.action || row?.event || row?.type || 'Atividade registrada'
  const actor = row?.user_name || row?.user_email || row?.user?.email || row?.actor_name || row?.actor_email || 'Sistema'
  const timestamp = row?.created_at || row?.occurred_at || row?.timestamp || row?.date
  return <div className="aoi-activity-row" key={row?.id || row?.public_id || `${timestamp}-${index}`}>
    <span className="aoi-activity-mark" aria-hidden="true" />
    <div><b>{message}</b><p>{app} · {actor}</p></div>
    <small>{timeAgo(timestamp)}</small>
  </div>
}

function OverviewPanel() {
  const [state, setState] = useState({ dashboard: null, activity: null, financial: null, command: null, applications: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const requestSequence = useRef(0)

  const load = useCallback(async (quiet = false) => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    const sequence = ++requestSequence.current
    if (quiet) setRefreshing(true)
    else setLoading(true)

    const endpoints = [
      ['dashboard', '/admin/ecosystem/dashboard'],
      ['activity', '/admin/ecosystem/activity'],
      ['financial', '/admin/ecosystem/financial/dashboard'],
      ['command', '/admin/ecosystem/command/overview'],
      ['applications', '/admin/applications'],
    ]

    const settled = await Promise.allSettled(endpoints.map(([, path]) => request(path)))
    if (sequence !== requestSequence.current) return

    const next = {}
    let failures = 0
    settled.forEach((result, index) => {
      const [key] = endpoints[index]
      if (result.status === 'fulfilled') {
        if (key === 'applications') {
          const payload = result.value
          next.applications = payload?.applications || payload?.data || (Array.isArray(payload) ? payload : [])
        } else {
          next[key] = result.value
        }
      } else {
        failures += 1
      }
    })

    setState(current => ({ ...current, ...next }))
    setError(failures === endpoints.length
      ? 'As fontes de inteligência não responderam. A visão detalhada abaixo continua disponível.'
      : failures
        ? `${failures} fonte${failures > 1 ? 's' : ''} não respondeu nesta atualização. Os dados disponíveis foram preservados.`
        : '')
    setUpdatedAt(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load(false)
    const interval = window.setInterval(() => { void load(true) }, 90000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      requestSequence.current += 1
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  const view = useMemo(() => {
    const summary = state.dashboard?.summary || {}
    const financialSummary = state.financial?.summary || {}
    const totals = financialSummary?.totals || {}
    const failed = financialSummary?.failed || {}
    const pending = financialSummary?.pending || {}
    const commandIssues = asArray(state.command?.issues?.data || state.command?.issues)
    const financialAlerts = asArray(state.financial?.alerts)
    const applications = asArray(state.dashboard?.applications).length ? asArray(state.dashboard?.applications) : asArray(state.applications)
    const activities = asArray(state.activity?.activity).length ? asArray(state.activity?.activity) : asArray(state.dashboard?.recent_activity)
    const activeApps = summary?.active_applications ?? applications.filter(app => app?.is_active !== false).length
    const inactiveApps = applications.filter(app => app?.is_active === false)
    const paymentAttention = number(failed?.count) + number(pending?.count)

    const rawIssues = [...commandIssues, ...financialAlerts]
    const dangerIssues = rawIssues.filter(issue => toneOf(issue?.severity || issue?.status || issue?.level) === 'danger')
    const warningIssues = rawIssues.filter(issue => toneOf(issue?.severity || issue?.status || issue?.level) === 'warning')
    const priorities = dangerIssues.slice(0, 3).map(priorityFromIssue)

    if (number(failed?.count) > 0) priorities.push({
      id: 'failed-payments', tone: 'danger', eyebrow: 'FINANCEIRO',
      title: `${compactNumber(failed.count)} pagamento${number(failed.count) === 1 ? '' : 's'} com falha`,
      detail: `${currency(failed.amount)} em transações que precisam de investigação.`,
      section: 'financial', action: 'Revisar financeiro',
    })
    if (number(pending?.count) > 0) priorities.push({
      id: 'pending-payments', tone: 'warning', eyebrow: 'PENDÊNCIAS',
      title: `${compactNumber(pending.count)} pagamento${number(pending.count) === 1 ? '' : 's'} pendente${number(pending.count) === 1 ? '' : 's'}`,
      detail: `${currency(pending.amount)} aguardando conclusão ou conciliação.`,
      section: 'financial', action: 'Ver pendências',
    })
    if (inactiveApps.length > 0) priorities.push({
      id: 'inactive-apps', tone: 'warning', eyebrow: 'APLICAÇÕES',
      title: `${inactiveApps.length} aplicação${inactiveApps.length === 1 ? '' : 'ões'} inativa${inactiveApps.length === 1 ? '' : 's'}`,
      detail: inactiveApps.slice(0, 3).map(app => app?.name || app?.slug).filter(Boolean).join(', ') || 'Há aplicações fora da operação ativa.',
      section: 'applications', action: 'Revisar aplicações',
    })
    warningIssues.slice(0, Math.max(0, 6 - priorities.length)).forEach((issue, index) => priorities.push(priorityFromIssue(issue, index + 20)))

    const uniquePriorities = priorities.filter((item, index, list) => list.findIndex(candidate => candidate.title === item.title) === index).slice(0, 6)
    if (!uniquePriorities.length) uniquePriorities.push({
      id: 'all-clear', tone: 'success', eyebrow: 'SOB CONTROLE',
      title: 'Nenhuma prioridade crítica aberta',
      detail: 'Os sinais operacionais disponíveis não indicam bloqueios imediatos. Continue acompanhando atividade, receita e adoção.',
      section: 'activity', action: 'Ver atividade',
    })

    const dangerCount = uniquePriorities.filter(item => item.tone === 'danger').length
    const attentionCount = uniquePriorities.filter(item => item.tone === 'warning').length
    let headline = 'Operação sob controle.'
    let headlineDetail = 'Nenhum bloqueio crítico foi detectado nas fontes disponíveis.'
    if (dangerCount) {
      headline = `${dangerCount} prioridade${dangerCount > 1 ? 's' : ''} crítica${dangerCount > 1 ? 's' : ''} exige${dangerCount > 1 ? 'm' : ''} ação.`
      headlineDetail = 'A fila abaixo está ordenada para você começar pelo que pode afetar operação ou receita.'
    } else if (attentionCount || paymentAttention) {
      headline = `${attentionCount || paymentAttention} ponto${(attentionCount || paymentAttention) > 1 ? 's' : ''} merece${(attentionCount || paymentAttention) > 1 ? 'm' : ''} acompanhamento.`
      headlineDetail = 'A operação continua disponível, mas há itens que valem revisão antes de virarem incidentes.'
    }

    return {
      summary, totals, failed, pending, applications, activities,
      activeApps, paymentAttention, priorities: uniquePriorities,
      headline, headlineDetail,
    }
  }, [state])

  const rankedApps = useMemo(() => [...view.applications]
    .sort((a, b) => number(b?.activity_count_30d ?? b?.interactions_30d ?? b?.users_count) - number(a?.activity_count_30d ?? a?.interactions_30d ?? a?.users_count))
    .slice(0, 6), [view.applications])

  return <section className="aoi-shell" aria-label="Visão geral inteligente do ecossistema">
    <header className="aoi-header">
      <div>
        <p className="aoi-kicker"><span /> VISÃO GERAL OPERACIONAL</p>
        <h2>{loading ? 'Construindo seu panorama…' : view.headline}</h2>
        <p>{loading ? 'Consolidando operação, finanças, aplicações e atividade.' : view.headlineDetail}</p>
      </div>
      <div className="aoi-sync">
        <small>{updatedAt ? `Atualizado ${timeAgo(updatedAt)}` : 'Sincronizando'}</small>
        <button type="button" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Atualizar agora'} <span>↻</span></button>
      </div>
    </header>

    {error && <div className="aoi-notice" role="status"><span>!</span><p>{error}</p></div>}

    {loading ? <div className="aoi-loading-grid" aria-hidden="true"><i/><i/><i/></div> : <>
      <div className="aoi-command-grid">
        <div className="aoi-priority-panel">
          <div className="aoi-section-head">
            <div><small>O QUE FAZER AGORA</small><h3>Fila de decisões</h3></div>
            <span>{view.priorities.filter(item => item.tone !== 'success').length} pendência{view.priorities.filter(item => item.tone !== 'success').length === 1 ? '' : 's'}</span>
          </div>
          <div className="aoi-priority-list">{view.priorities.map(item => <PriorityCard item={item} key={item.id} />)}</div>
        </div>

        <aside className="aoi-pulse-panel">
          <div className="aoi-section-head"><div><small>AGORA</small><h3>Pulso do ecossistema</h3></div></div>
          <div className="aoi-pulse-grid">
            <div><small>Usuários ativos hoje</small><b>{compactNumber(view.summary?.active_users_today)}</b><span>{compactNumber(view.summary?.interactions_today)} interações</span></div>
            <div><small>Aplicações ativas</small><b>{compactNumber(view.activeApps)}</b><span>de {compactNumber(view.summary?.applications ?? view.applications.length)} cadastradas</span></div>
            <div className={view.paymentAttention ? 'is-attention' : ''}><small>Pagamentos em atenção</small><b>{compactNumber(view.paymentAttention)}</b><span>{compactNumber(view.failed?.count)} falhas · {compactNumber(view.pending?.count)} pendentes</span></div>
            <div><small>Receita bruta</small><b>{currency(view.totals?.gross)}</b><span>{currency(view.totals?.platform_fees)} Peter Tecnet</span></div>
          </div>
        </aside>
      </div>

      <div className="aoi-quick-grid">
        <QuickAction icon="◈" title="Operações" detail="Alertas e saúde" section="operations" />
        <QuickAction icon="◒" title="Financeiro" detail="Receita e pagamentos" section="financial" />
        <QuickAction icon="◇" title="Aplicações" detail="Status e adoção" section="applications" />
        <QuickAction icon="◎" title="Usuários" detail="Gestão e acessos" section="users" />
        <QuickAction icon="↯" title="Atividade" detail="Eventos recentes" section="activity" />
        <QuickAction icon="✦" title="Notificações" detail="Central de avisos" section="notifications" />
      </div>

      <div className="aoi-context-grid">
        <article className="aoi-context-panel">
          <div className="aoi-section-head">
            <div><small>ADOÇÃO</small><h3>Aplicações que estão puxando o ecossistema</h3></div>
            <button type="button" onClick={() => goTo('applications')}>Ver todas ↗</button>
          </div>
          <div className="aoi-app-list">{rankedApps.length ? rankedApps.map((app, index) => <ApplicationRow app={app} key={app?.id || app?.slug || index} />) : <div className="aoi-empty">Ainda não há atividade suficiente para ranquear aplicações.</div>}</div>
        </article>

        <article className="aoi-context-panel">
          <div className="aoi-section-head">
            <div><small>ÚLTIMOS MOVIMENTOS</small><h3>Atividade recente</h3></div>
            <button type="button" onClick={() => goTo('activity')}>Abrir atividade ↗</button>
          </div>
          <div className="aoi-activity-list">{view.activities.length ? view.activities.slice(0, 6).map((row, index) => <ActivityRow row={row} index={index} key={row?.id || row?.public_id || index} />) : <div className="aoi-empty">Nenhuma atividade recente disponível nesta atualização.</div>}</div>
        </article>
      </div>
    </>}
  </section>
}

export default function AdminOverviewIntelligence() {
  const [slot, setSlot] = useState(null)

  useEffect(() => {
    let disposed = false
    const sync = () => {
      if (disposed) return
      const hero = document.querySelector('.hero-section#dashboard')
      if (!hero) {
        setSlot(current => current ? null : current)
        return
      }
      let node = document.getElementById(SLOT_ID)
      if (!node) {
        node = document.createElement('div')
        node.id = SLOT_ID
        node.className = 'admin-overview-intelligence-slot'
        node.dataset.owner = 'admin-overview-intelligence'
        hero.insertAdjacentElement('afterend', node)
      }
      setSlot(current => current === node ? current : node)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      disposed = true
      observer.disconnect()
      const node = document.getElementById(SLOT_ID)
      if (node?.dataset?.owner === 'admin-overview-intelligence') node.remove()
    }
  }, [])

  return slot ? createPortal(<OverviewPanel />, slot) : null
}
