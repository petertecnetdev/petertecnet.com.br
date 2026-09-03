import './adminReports.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'
const NAV_ID = 'admin-report-center-nav'
const QUICK_ID = 'admin-report-quick-action'
const MODAL_ID = 'admin-report-center'

const contextReport = {
  'Visão geral': 'overview',
  'Atividade': 'activity',
  'Financeiro': 'financial',
  'Aplicações': 'applications',
  'Usuários': 'users',
  'Estabelecimentos': 'establishments',
  'Itens': 'items',
  'Auditoria': 'audit',
}

const reportFilters = {
  overview: ['period', 'app_id'],
  activity: ['period', 'app_id', 'search', 'type', 'outcome'],
  financial: ['period', 'app_id', 'provider', 'method', 'financial_status'],
  applications: ['period', 'search', 'application_status'],
  users: ['period', 'app_id', 'profile_id', 'search'],
  establishments: ['period', 'app_id', 'search', 'establishment_status', 'city', 'uf'],
  items: ['period', 'app_id', 'search', 'item_type', 'item_status'],
  audit: ['period', 'search', 'action'],
}

let metadata = null
let metadataPromise = null
let observerTimer = null

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function lastDays(days) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: isoDate(from), to: isoDate(to) }
}

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const { accept = 'application/json', headers = {}, ...fetchOptions } = options
  const response = await fetch(`${API}${path}`, {
    ...fetchOptions,
    headers: {
      Accept: accept,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    window.location.href = '/login'
    throw new Error('Sessão expirada.')
  }

  return response
}

async function loadMetadata() {
  if (metadata) return metadata
  if (!metadataPromise) {
    metadataPromise = api('/admin/ecosystem/reports')
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.message || data?.error || 'Não foi possível carregar os relatórios.')
        metadata = data
        return data
      })
      .finally(() => { metadataPromise = null })
  }
  return metadataPromise
}

function currentReport() {
  const title = document.querySelector('.ecosystem-top h1')?.textContent?.trim()
  return contextReport[title] || null
}

function optionList(rows, value = 'id', label = 'name') {
  return (rows || []).map(row => `<option value="${esc(row[value])}">${esc(row[label])}</option>`).join('')
}

function field(name, label, body) {
  return `<label class="admin-report-field" data-filter="${esc(name)}"><span>${esc(label)}</span>${body}</label>`
}

function renderFields(reportKey) {
  const enabled = new Set(reportFilters[reportKey] || ['period'])
  const activityTypes = (metadata?.activity_types || []).map(type => `<option value="${esc(type)}">${esc(String(type).replaceAll('_', ' '))}</option>`).join('')
  const auditActions = (metadata?.audit_actions || []).map(action => `<option value="${esc(action)}">${esc(String(action).replaceAll('.', ' '))}</option>`).join('')
  const itemTypes = (metadata?.item_types || []).map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('')
  const parts = []

  if (enabled.has('period')) {
    parts.push(field('from', 'De', '<input name="from" type="date" />'))
    parts.push(field('to', 'Até', '<input name="to" type="date" />'))
  }
  if (enabled.has('app_id')) parts.push(field('app_id', 'Aplicação', `<select name="app_id"><option value="">Todas</option>${optionList(metadata?.applications)}</select>`))
  if (enabled.has('profile_id')) parts.push(field('profile_id', 'Perfil', `<select name="profile_id"><option value="">Todos</option>${optionList(metadata?.profiles)}</select>`))
  if (enabled.has('search')) parts.push(field('search', 'Busca', '<input name="search" type="search" placeholder="Nome, e-mail, entidade, referência..." />'))
  if (enabled.has('type')) parts.push(field('type', 'Tipo de atividade', `<select name="type"><option value="">Todos</option>${activityTypes}</select>`))
  if (enabled.has('outcome')) parts.push(field('outcome', 'Resultado', '<select name="outcome"><option value="">Todos</option><option value="success">Sucesso</option><option value="denied">Negado</option><option value="error">Erro</option></select>'))
  if (enabled.has('provider')) parts.push(field('provider', 'Gateway', '<input name="provider" placeholder="Ex.: mercadopago" />'))
  if (enabled.has('method')) parts.push(field('method', 'Método', '<select name="method"><option value="">Todos</option><option value="pix">PIX</option><option value="card">Cartão</option></select>'))
  if (enabled.has('financial_status')) parts.push(field('status', 'Status financeiro', '<select name="status"><option value="">Todos</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="in_process">Processando</option><option value="failed">Falhou</option><option value="rejected">Rejeitado</option><option value="cancelled">Cancelado</option><option value="refunded">Estornado</option><option value="charged_back">Chargeback</option></select>'))
  if (enabled.has('application_status')) parts.push(field('status', 'Status', '<select name="status"><option value="">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select>'))
  if (enabled.has('establishment_status')) parts.push(field('status', 'Estado', '<select name="status"><option value="">Todos</option><option value="approved">Aprovados</option><option value="pending">Pendentes</option><option value="published">Publicados</option><option value="hidden">Ocultos</option></select>'))
  if (enabled.has('city')) parts.push(field('city', 'Cidade', '<input name="city" />'))
  if (enabled.has('uf')) parts.push(field('uf', 'UF', '<input name="uf" maxlength="2" placeholder="SP" />'))
  if (enabled.has('item_type')) parts.push(field('type', 'Tipo de item', `<select name="type"><option value="">Todos</option>${itemTypes}</select>`))
  if (enabled.has('item_status')) parts.push(field('status', 'Status', '<select name="status"><option value="">Todos</option><option value="active">Ativos</option><option value="archived">Arquivados</option></select>'))
  if (enabled.has('action')) parts.push(field('action', 'Ação administrativa', `<select name="action"><option value="">Todas</option>${auditActions}</select>`))

  return parts.join('')
}

function reportOptions(selected) {
  return (metadata?.reports || []).map(report => `<option value="${esc(report.key)}" ${report.key === selected ? 'selected' : ''}>${esc(report.label)}</option>`).join('')
}

function modalTemplate(selectedReport) {
  return `
    <div class="admin-report-backdrop" data-report-close></div>
    <section class="admin-report-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-report-title">
      <header>
        <div>
          <p>Peter Tecnet Admin Center</p>
          <h2 id="admin-report-title">Central de relatórios PDF</h2>
          <span>Gere documentos filtrados diretamente pela API, com dados do ecossistema e período definido.</span>
        </div>
        <button type="button" class="admin-report-close" data-report-close aria-label="Fechar">×</button>
      </header>
      <form class="admin-report-form">
        <label class="admin-report-field admin-report-type"><span>Relatório</span><select name="report">${reportOptions(selectedReport)}</select></label>
        <div class="admin-report-presets" aria-label="Períodos rápidos">
          <button type="button" data-days="7">7 dias</button>
          <button type="button" data-days="30" class="active">30 dias</button>
          <button type="button" data-days="90">90 dias</button>
          <button type="button" data-days="all">Todo período</button>
        </div>
        <div class="admin-report-fields">${renderFields(selectedReport)}</div>
        <div class="admin-report-status" aria-live="polite"></div>
        <footer>
          <button type="button" data-report-close>Cancelar</button>
          <button type="submit" class="admin-report-download">Gerar PDF</button>
        </footer>
      </form>
    </section>
  `
}

function closeModal() {
  const modal = document.getElementById(MODAL_ID)
  if (!modal) return
  modal.remove()
  document.body.classList.remove('admin-report-open')
}

function applyPeriod(form, days) {
  const from = form.elements.from
  const to = form.elements.to
  if (!from || !to) return
  if (days === 'all') {
    from.value = '2000-01-01'
    to.value = isoDate(new Date())
    return
  }
  const range = lastDays(Number(days))
  from.value = range.from
  to.value = range.to
}

function statusMessage(form, message, type = '') {
  const node = form.querySelector('.admin-report-status')
  if (!node) return
  node.className = `admin-report-status ${type}`.trim()
  node.textContent = message
}

function rebuildFields(form, reportKey) {
  const host = form.querySelector('.admin-report-fields')
  if (!host) return
  host.innerHTML = renderFields(reportKey)
  applyPeriod(form, 30)
}

function fileNameFrom(response, reportKey) {
  const header = response.headers.get('content-disposition') || ''
  const match = header.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)
  if (match?.[1]) return decodeURIComponent(match[1].replaceAll('"', '').trim())
  return `peter-tecnet-${reportKey}-${isoDate(new Date())}.pdf`
}

async function downloadReport(form) {
  const submit = form.querySelector('.admin-report-download')
  const reportKey = form.elements.report.value
  const params = new URLSearchParams()
  new FormData(form).forEach((value, key) => {
    if (key !== 'report' && String(value).trim()) params.set(key, String(value).trim())
  })

  submit.disabled = true
  submit.textContent = 'Gerando PDF...'
  statusMessage(form, 'Consultando os dados e montando o documento...')

  try {
    const response = await api(`/admin/ecosystem/reports/${encodeURIComponent(reportKey)}/pdf?${params.toString()}`, { accept: 'application/pdf' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.message || data?.error || 'Não foi possível gerar o PDF.')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileNameFrom(response, reportKey)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
    statusMessage(form, 'PDF gerado com sucesso.', 'success')
  } catch (error) {
    statusMessage(form, error.message || 'Falha ao gerar o relatório.', 'error')
  } finally {
    submit.disabled = false
    submit.textContent = 'Gerar PDF'
  }
}

async function openModal(initialReport = currentReport() || 'overview') {
  if (document.getElementById(MODAL_ID)) return
  try {
    await loadMetadata()
  } catch (error) {
    window.alert(error.message)
    return
  }

  const available = new Set((metadata?.reports || []).map(item => item.key))
  const selectedReport = available.has(initialReport) ? initialReport : 'overview'
  const modal = document.createElement('div')
  modal.id = MODAL_ID
  modal.className = 'admin-report-center'
  modal.innerHTML = modalTemplate(selectedReport)
  document.body.appendChild(modal)
  document.body.classList.add('admin-report-open')

  const form = modal.querySelector('.admin-report-form')
  applyPeriod(form, 30)

  modal.addEventListener('click', event => {
    const closer = event.target.closest('[data-report-close]')
    if (closer) closeModal()

    const preset = event.target.closest('[data-days]')
    if (preset) {
      modal.querySelectorAll('[data-days]').forEach(button => button.classList.toggle('active', button === preset))
      applyPeriod(form, preset.dataset.days)
    }
  })

  form.elements.report.addEventListener('change', event => {
    rebuildFields(form, event.target.value)
    modal.querySelectorAll('[data-days]').forEach(button => button.classList.toggle('active', button.dataset.days === '30'))
  })

  form.addEventListener('submit', event => {
    event.preventDefault()
    downloadReport(form)
  })
}

function installNavButton() {
  if (!location.pathname.startsWith('/admin')) return
  const nav = document.querySelector('.ecosystem-sidebar nav')
  if (!nav || document.getElementById(NAV_ID)) return
  const button = document.createElement('button')
  button.id = NAV_ID
  button.type = 'button'
  button.className = 'admin-report-nav'
  button.textContent = 'Relatórios PDF'
  button.addEventListener('click', () => openModal(currentReport() || 'overview'))
  nav.appendChild(button)
}

function installQuickAction() {
  if (!location.pathname.startsWith('/admin')) return
  const actions = document.querySelector('.ecosystem-top .top-actions')
  const supported = currentReport()
  const existing = document.getElementById(QUICK_ID)
  if (!actions || !supported) {
    existing?.remove()
    return
  }
  if (existing) {
    existing.dataset.report = supported
    return
  }
  const button = document.createElement('button')
  button.id = QUICK_ID
  button.type = 'button'
  button.className = 'admin-report-quick'
  button.dataset.report = supported
  button.textContent = 'Gerar PDF'
  button.addEventListener('click', () => openModal(button.dataset.report))
  actions.prepend(button)
}

function syncEnhancements() {
  if (!location.pathname.startsWith('/admin')) return
  installNavButton()
  installQuickAction()
}

function start() {
  if (!location.pathname.startsWith('/admin')) return
  syncEnhancements()

  const observer = new MutationObserver(() => {
    window.clearTimeout(observerTimer)
    observerTimer = window.setTimeout(syncEnhancements, 80)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal()
  })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
else start()
