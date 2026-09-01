import './adminActivityChart.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'
const CHART_ID = 'peter-ecosystem-activity-chart'
const REFRESH_MS = 30000

let refreshTimer = null
let inFlight = false

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildPath(points, width, height, maxValue) {
  if (!points.length) return ''
  const usableHeight = height - 24
  const denominator = Math.max(maxValue, 1)
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const y = 12 + usableHeight - (Number(point.total || 0) / denominator) * usableHeight
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function buildAreaPath(points, width, height, maxValue) {
  const line = buildPath(points, width, height, maxValue)
  if (!line || !points.length) return ''
  return `${line} L ${width} ${height} L 0 ${height} Z`
}

function chartTemplate(payload) {
  const series = Array.isArray(payload?.interaction_series) ? payload.interaction_series : []
  const totals = series.map(point => Number(point.total || 0))
  const total = totals.reduce((sum, value) => sum + value, 0)
  const errors = series.reduce((sum, point) => sum + Number(point.errors || 0), 0)
  const peak = Math.max(...totals, 0)
  const peakIndex = totals.indexOf(peak)
  const peakLabel = peakIndex >= 0 ? series[peakIndex]?.label : '—'
  const activeApps = (payload?.applications || []).filter(app => Number(app.activity_count_30d || 0) > 0).length
  const width = 1000
  const height = 250
  const maxValue = Math.max(peak, 1)
  const linePath = buildPath(series, width, height, maxValue)
  const areaPath = buildAreaPath(series, width, height, maxValue)
  const labels = series.filter((_, index) => index === 0 || index === series.length - 1 || index % 4 === 0)

  return `
    <section class="ecosystem-activity-chart" aria-labelledby="ecosystem-activity-title">
      <div class="ecosystem-activity-chart__header">
        <div>
          <p class="ecosystem-activity-chart__eyebrow">Monitoramento em tempo real</p>
          <h2 id="ecosystem-activity-title">Atividade do ecossistema</h2>
          <p>Volume real de interações registradas pela API nas últimas 24 horas.</p>
        </div>
        <div class="ecosystem-activity-chart__live"><span></span> Atualização automática</div>
      </div>

      <div class="ecosystem-activity-chart__metrics">
        <div><span>Interações 24h</span><strong>${formatNumber(total)}</strong></div>
        <div><span>Pico por hora</span><strong>${formatNumber(peak)}</strong><small>${escapeHtml(peakLabel || '—')}</small></div>
        <div><span>Erros registrados</span><strong>${formatNumber(errors)}</strong></div>
        <div><span>Apps ativos 30d</span><strong>${formatNumber(activeApps)}</strong></div>
      </div>

      <div class="ecosystem-activity-chart__canvas">
        ${series.length ? `
          <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de interações por hora nas últimas 24 horas" preserveAspectRatio="none">
            <defs>
              <linearGradient id="activityAreaGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="currentColor" stop-opacity="0.22" />
                <stop offset="100%" stop-color="currentColor" stop-opacity="0.01" />
              </linearGradient>
            </defs>
            <g class="ecosystem-activity-chart__grid">
              <line x1="0" y1="12" x2="${width}" y2="12" />
              <line x1="0" y1="71.5" x2="${width}" y2="71.5" />
              <line x1="0" y1="131" x2="${width}" y2="131" />
              <line x1="0" y1="190.5" x2="${width}" y2="190.5" />
              <line x1="0" y1="250" x2="${width}" y2="250" />
            </g>
            <path class="ecosystem-activity-chart__area" d="${areaPath}" />
            <path class="ecosystem-activity-chart__line" d="${linePath}" />
          </svg>
          <div class="ecosystem-activity-chart__labels">
            ${labels.map(point => `<span>${escapeHtml(point.label)}</span>`).join('')}
          </div>
        ` : '<div class="ecosystem-activity-chart__empty">Ainda não há interações suficientes para desenhar o período.</div>'}
      </div>

      <div class="ecosystem-activity-chart__footer">
        <span>Fonte: telemetria central da Peter Tecnet</span>
        <time data-chart-updated>Atualizado agora</time>
      </div>
    </section>
  `
}

async function loadDashboard() {
  if (inFlight) return null
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null

  inFlight = true
  try {
    const response = await fetch(`${API}/admin/ecosystem/dashboard`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    inFlight = false
  }
}

function dashboardVisible() {
  const title = document.querySelector('.ecosystem-top h1')
  return title?.textContent?.trim() === 'Visão geral'
}

async function renderActivityChart() {
  if (!location.pathname.startsWith('/admin') || !dashboardVisible()) {
    document.getElementById(CHART_ID)?.remove()
    return
  }

  const stack = document.querySelector('.ecosystem-main .admin-stack')
  const metricGrid = stack?.querySelector('.metric-grid')
  if (!stack || !metricGrid) return

  const payload = await loadDashboard()
  if (!payload || !dashboardVisible()) return

  let host = document.getElementById(CHART_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = CHART_ID
    metricGrid.insertAdjacentElement('afterend', host)
  }
  host.innerHTML = chartTemplate(payload)
}

function scheduleRefresh() {
  window.clearInterval(refreshTimer)
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') renderActivityChart()
  }, REFRESH_MS)
}

const observer = new MutationObserver(() => {
  window.clearTimeout(observer._timer)
  observer._timer = window.setTimeout(renderActivityChart, 120)
})

function start() {
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderActivityChart()
  })
  scheduleRefresh()
  renderActivityChart()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
else start()
