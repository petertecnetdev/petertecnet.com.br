import './adminActivityChart.css'

const DASHBOARD_PATH = '/admin/ecosystem/dashboard'
const HOST_ID = 'peter-ecosystem-analytics'

let latestPayload = null
let renderTimer = null

const originalFetch = window.fetch.bind(window)

function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function dataAttribute(value) {
  return escapeAttribute(JSON.stringify(value || []))
}

function dashboardVisible() {
  const title = document.querySelector('.ecosystem-top h1')
  return title?.textContent?.trim() === 'Visão geral'
}

function analyticsData(payload) {
  return {
    hourly: Array.isArray(payload?.interaction_series)
      ? payload.interaction_series.map(point => ({ label: point.label, total: Number(point.total || 0), errors: Number(point.errors || 0) }))
      : [],
    applications: Array.isArray(payload?.applications)
      ? payload.applications.slice(0, 10).map(app => ({ label: app.name || app.slug || 'Aplicação', interactions: Number(app.activity_count_30d || 0) }))
      : [],
    usersByApp: Array.isArray(payload?.applications)
      ? payload.applications.slice(0, 10).map(app => ({ label: app.name || app.slug || 'Aplicação', users: Number(app.users_count || 0), active: Number(app.active_users_30d || 0) }))
      : [],
    activityTypes: Array.isArray(payload?.activity_types)
      ? payload.activity_types.slice(0, 8).map(item => ({ label: humanType(item.interaction_type), value: Number(item.total || 0) }))
      : [],
  }
}

function buildAnalytics(data) {
  return `
    <section class="ecosystem-insights" aria-label="Análises visuais do ecossistema">
      <div class="ecosystem-insights__heading">
        <div><span>Leitura visual</span><h2>Inteligência operacional do ecossistema</h2><p>Os gráficos abaixo reutilizam a mesma resposta já carregada pelo Admin Center, sem uma segunda requisição à API.</p></div>
        <small>Dados do dashboard atual</small>
      </div>
      <div class="ecosystem-insights__grid">
        <peter-insight-chart type="line" title="Interações nas últimas 24 horas" subtitle="Volume total por hora comparado aos erros registrados." data="${dataAttribute(data.hourly)}" label-key="label" value-key="total" secondary-key="errors" primary-label="Interações" secondary-label="Erros"></peter-insight-chart>
        <peter-insight-chart type="bar" title="Uso das aplicações" subtitle="Interações registradas por aplicação nos últimos 30 dias." data="${dataAttribute(data.applications)}" label-key="label" value-key="interactions" primary-label="Interações 30d" format="compact"></peter-insight-chart>
        <peter-insight-chart type="bar" title="Alcance e recorrência" subtitle="Usuários vinculados comparados aos usuários ativos nos últimos 30 dias." data="${dataAttribute(data.usersByApp)}" label-key="label" value-key="users" secondary-key="active" primary-label="Usuários" secondary-label="Ativos 30d"></peter-insight-chart>
        <peter-insight-chart type="donut" title="Tipos de interação" subtitle="Distribuição das ações mais frequentes registradas pela telemetria central." data="${dataAttribute(data.activityTypes)}" primary-label="Interações" format="compact"></peter-insight-chart>
      </div>
    </section>
  `
}

function humanType(type) {
  const labels = {
    login: 'Login', logout: 'Logout', view: 'Visualização', create: 'Criação', update: 'Atualização', delete: 'Exclusão',
    click: 'Clique', search: 'Busca', submit: 'Envio', frontend_error: 'Erro no front-end', api_error: 'Erro de API', navigation: 'Navegação',
  }
  return labels[String(type || '').toLowerCase()] || String(type || 'Outro').replaceAll('_', ' ')
}

function renderAnalytics() {
  if (!location.pathname.startsWith('/admin') || !dashboardVisible() || !latestPayload) {
    document.getElementById(HOST_ID)?.remove()
    return
  }

  const stack = document.querySelector('.ecosystem-main .admin-stack')
  const metricGrid = stack?.querySelector('.metric-grid')
  if (!stack || !metricGrid) return

  const data = analyticsData(latestPayload)
  const signature = JSON.stringify(data)
  let host = document.getElementById(HOST_ID)
  if (host?.dataset.analyticsSignature === signature) return

  if (!host) {
    host = document.createElement('div')
    host.id = HOST_ID
    metricGrid.insertAdjacentElement('afterend', host)
  }
  host.dataset.analyticsSignature = signature
  host.innerHTML = buildAnalytics(data)
}

function scheduleRender() {
  window.clearTimeout(renderTimer)
  renderTimer = window.setTimeout(renderAnalytics, 60)
}

window.fetch = async (...args) => {
  const response = await originalFetch(...args)
  try {
    const input = args[0]
    const url = typeof input === 'string' ? input : input?.url || ''
    if (url.includes(DASHBOARD_PATH) && response.ok) {
      response.clone().json().then(payload => {
        latestPayload = payload
        scheduleRender()
      }).catch(() => {})
    }
  } catch {}
  return response
}

const observer = new MutationObserver(scheduleRender)

function start() {
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('popstate', scheduleRender)
  window.addEventListener('peter:auth-changed', scheduleRender)
  scheduleRender()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
else start()