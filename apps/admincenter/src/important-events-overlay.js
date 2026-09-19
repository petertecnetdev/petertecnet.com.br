const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'
const POLL_MS = 120000

const state = { open: false, loading: false, unread: 0, events: [], summary: {}, severity: '', unreadOnly: false, search: '', selectedId: null, detailById: {}, detailLoading: {}, detailErrors: {} }

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))
const fmtDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
const fmtMoney = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

function token() { return localStorage.getItem(TOKEN_KEY) || '' }

async function api(path, options = {}) {
  const auth = token()
  if (!auth) throw Object.assign(new Error('Sessão não encontrada.'), { status: 401 })
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth}`, ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload?.message || payload?.error || 'Falha ao carregar eventos importantes.'), { status: response.status })
  return payload
}

function ensureUi() {
  if (document.getElementById('pt-important-events-root')) return
  const root = document.createElement('div')
  root.id = 'pt-important-events-root'
  root.innerHTML = `
    <button id="pt-important-events-globe" class="pt-ie-globe" type="button" aria-label="Eventos importantes" title="Eventos importantes">
      <span class="pt-ie-globe-icon" aria-hidden="true">🌐</span><span id="pt-ie-badge" class="pt-ie-badge" hidden>0</span>
    </button>
    <div id="pt-ie-backdrop" class="pt-ie-backdrop" hidden></div>
    <aside id="pt-ie-drawer" class="pt-ie-drawer" aria-hidden="true" aria-label="Eventos importantes">
      <header><div><small>ECOSSISTEMA / TEMPO REAL</small><h2>Eventos importantes</h2><p>Vendas, pagamentos e sinais relevantes dos aplicativos Peter Tecnet.</p></div><button id="pt-ie-close" type="button" aria-label="Fechar">×</button></header>
      <section class="pt-ie-summary" id="pt-ie-summary"></section>
      <section class="pt-ie-tools">
        <input id="pt-ie-search" type="search" placeholder="Buscar evento, pedido ou aplicação…" aria-label="Buscar eventos importantes" />
        <select id="pt-ie-severity" aria-label="Filtrar severidade"><option value="">Todas as severidades</option><option value="success">Sucesso</option><option value="warning">Atenção</option><option value="critical">Crítico</option><option value="info">Informação</option></select>
        <label><input id="pt-ie-unread" type="checkbox" /> Só não lidos</label>
        <button id="pt-ie-read-all" type="button">Marcar tudo como lido</button>
      </section>
      <main id="pt-ie-list" class="pt-ie-list"><div class="pt-ie-empty">Carregando eventos…</div></main>
    </aside>`
  document.body.appendChild(root)

  const style = document.createElement('style')
  style.textContent = `
    .pt-ie-globe{position:fixed;z-index:10030;top:18px;right:270px;width:42px;height:42px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(8,18,26,.92);color:#fff;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.28);backdrop-filter:blur(18px);transition:.2s transform,.2s border-color}.pt-ie-globe:hover{transform:translateY(-1px);border-color:rgba(91,220,255,.55)}.pt-ie-globe-icon{font-size:20px}.pt-ie-badge{position:absolute;top:-6px;right:-6px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#ff4664;color:#fff;border:2px solid #071018;font:700 10px/15px system-ui;text-align:center}.pt-ie-backdrop{position:fixed;inset:0;z-index:10040;background:rgba(1,5,9,.64);backdrop-filter:blur(6px)}.pt-ie-drawer{position:fixed;z-index:10050;top:0;right:0;width:min(620px,100vw);height:100dvh;background:linear-gradient(180deg,#071018,#08141c);color:#eff9ff;box-shadow:-28px 0 80px rgba(0,0,0,.55);transform:translateX(102%);transition:transform .26s ease;display:flex;flex-direction:column;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.pt-ie-drawer.open{transform:translateX(0)}.pt-ie-drawer>header{display:flex;justify-content:space-between;gap:20px;padding:26px 26px 18px;border-bottom:1px solid rgba(255,255,255,.08)}.pt-ie-drawer header small{color:#61d7ff;font-weight:800;letter-spacing:.12em}.pt-ie-drawer h2{font-size:27px;margin:4px 0}.pt-ie-drawer header p{color:#8fa8b7;margin:0;max-width:470px}.pt-ie-drawer header button{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#101e27;color:#fff;font-size:23px;cursor:pointer}.pt-ie-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:16px 20px 8px}.pt-ie-summary div{padding:11px 12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.035)}.pt-ie-summary small{display:block;color:#8098a6;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.pt-ie-summary b{display:block;margin-top:3px;font-size:20px}.pt-ie-tools{display:grid;grid-template-columns:1fr 160px;gap:8px;padding:12px 20px 14px;border-bottom:1px solid rgba(255,255,255,.07)}.pt-ie-tools input[type=search],.pt-ie-tools select{min-height:40px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#0b1a24;color:#eaf8ff;padding:0 11px}.pt-ie-tools label{display:flex;align-items:center;gap:7px;color:#9fb2be;font-size:13px}.pt-ie-tools button{justify-self:end;border:0;background:transparent;color:#60d8ff;font-weight:700;cursor:pointer}.pt-ie-list{overflow:auto;padding:12px 20px 28px;flex:1}.pt-ie-event{display:grid;grid-template-columns:11px 1fr auto;gap:12px;padding:15px 12px;border-radius:14px;border:1px solid transparent;cursor:pointer}.pt-ie-event:hover{background:rgba(255,255,255,.035)}.pt-ie-event.unread{background:rgba(77,207,255,.055);border-color:rgba(77,207,255,.13)}.pt-ie-dot{width:9px;height:9px;margin-top:7px;border-radius:50%;background:#70dbff;box-shadow:0 0 0 4px rgba(112,219,255,.08)}.pt-ie-event[data-severity=success] .pt-ie-dot{background:#63e6a6}.pt-ie-event[data-severity=warning] .pt-ie-dot{background:#ffcc66}.pt-ie-event[data-severity=critical] .pt-ie-dot{background:#ff5c74}.pt-ie-body h3{margin:0 0 4px;font-size:15px}.pt-ie-body p{margin:0;color:#9bb0bd;font-size:13px;line-height:1.45}.pt-ie-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;color:#708c9d;font-size:11px}.pt-ie-meta span{padding:3px 7px;border-radius:8px;background:rgba(255,255,255,.045)}.pt-ie-time{color:#738c9b;font-size:11px;white-space:nowrap;padding-top:3px}.pt-ie-empty{padding:48px 18px;text-align:center;color:#75909f}.pt-ie-error{color:#ff8698}.pt-ie-money{color:#75e7b3!important;font-weight:700}.pt-ie-loading{opacity:.6;pointer-events:none}@media(max-width:980px){.pt-ie-globe{top:auto;right:18px;bottom:82px;width:50px;height:50px;border-radius:16px}.pt-ie-summary{grid-template-columns:repeat(2,1fr)}.pt-ie-tools{grid-template-columns:1fr}.pt-ie-tools button{justify-self:start}.pt-ie-event{grid-template-columns:10px 1fr}.pt-ie-time{grid-column:2}}`
  document.head.appendChild(style)

  const detailStyle = document.createElement('style')
  detailStyle.textContent = `
    .pt-ie-event.expanded{background:rgba(77,207,255,.075);border-color:rgba(77,207,255,.22)}
    .pt-ie-expand-label{display:inline-flex;align-items:center;gap:5px;margin-top:9px;color:#62d9ff;font-size:11px;font-weight:800;letter-spacing:.02em}
    .pt-ie-details{grid-column:2/-1;margin-top:12px;padding:14px;border:1px solid rgba(96,216,255,.16);border-radius:14px;background:linear-gradient(180deg,rgba(10,28,39,.95),rgba(8,21,30,.95));cursor:default}
    .pt-ie-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
    .pt-ie-detail-head h4{margin:0;color:#f3fbff;font-size:15px}.pt-ie-detail-head p{margin:3px 0 0;color:#7f9aa9;font-size:11px}
    .pt-ie-detail-status{display:inline-flex;align-items:center;min-height:25px;padding:0 9px;border-radius:999px;background:rgba(99,230,166,.11);color:#79edb5;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
    .pt-ie-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .pt-ie-detail-card{min-width:0;padding:12px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.028)}
    .pt-ie-detail-card.wide{grid-column:1/-1}.pt-ie-detail-card h5{margin:0 0 9px;color:#7edfff;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
    .pt-ie-person{display:flex;gap:10px;align-items:center}.pt-ie-avatar{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,rgba(96,216,255,.18),rgba(164,103,255,.18));border:1px solid rgba(255,255,255,.08);color:#ecfbff;font-size:12px;font-weight:900}
    .pt-ie-person b{display:block;color:#f7fcff;font-size:13px}.pt-ie-person small{display:block;margin-top:2px;color:#83a0af;font-size:11px;overflow-wrap:anywhere}
    .pt-ie-kv{display:grid;grid-template-columns:minmax(90px,.8fr) minmax(0,1.2fr);gap:7px 10px;font-size:11px}.pt-ie-kv span{color:#7893a2}.pt-ie-kv b{color:#dceaf1;font-weight:650;text-align:right;overflow-wrap:anywhere}
    .pt-ie-detail-money{color:#7aebb7!important}.pt-ie-detail-warn{color:#ffd27b!important}
    .pt-ie-detail-list{display:grid;gap:7px}.pt-ie-detail-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:8px 9px;border-radius:9px;background:rgba(255,255,255,.025);font-size:11px}.pt-ie-detail-row strong{color:#dfeef5;font-weight:650}.pt-ie-detail-row span{color:#8ba3b0;text-align:right}
    .pt-ie-detail-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.pt-ie-detail-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 11px;border-radius:10px;border:1px solid rgba(96,216,255,.2);background:rgba(96,216,255,.07);color:#82e5ff;text-decoration:none;font-size:11px;font-weight:800}.pt-ie-detail-actions a:hover{background:rgba(96,216,255,.13)}
    .pt-ie-detail-loading,.pt-ie-detail-error{padding:16px;text-align:center;color:#7895a5;font-size:12px}.pt-ie-detail-error{color:#ff8da0}
    @media(max-width:620px){.pt-ie-details{grid-column:1/-1;padding:12px}.pt-ie-detail-grid{grid-template-columns:1fr}.pt-ie-detail-card.wide{grid-column:auto}.pt-ie-kv{grid-template-columns:1fr}.pt-ie-kv b{text-align:left}.pt-ie-detail-actions a{flex:1 1 140px}}
  `
  document.head.appendChild(detailStyle)

  document.getElementById('pt-important-events-globe').addEventListener('click', openDrawer)
  document.getElementById('pt-ie-close').addEventListener('click', closeDrawer)
  document.getElementById('pt-ie-backdrop').addEventListener('click', closeDrawer)
  document.getElementById('pt-ie-severity').addEventListener('change', event => { state.severity = event.target.value; void loadEvents() })
  document.getElementById('pt-ie-unread').addEventListener('change', event => { state.unreadOnly = event.target.checked; void loadEvents() })
  document.getElementById('pt-ie-read-all').addEventListener('click', markAllRead)
  let searchTimer
  document.getElementById('pt-ie-search').addEventListener('input', event => {
    state.search = event.target.value
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => void loadEvents(), 260)
  })
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.open) closeDrawer() })
}

function renderVisibility() {
  const globe = document.getElementById('pt-important-events-globe')
  if (!globe) return
  globe.style.display = token() ? 'flex' : 'none'
  const badge = document.getElementById('pt-ie-badge')
  badge.hidden = state.unread <= 0
  badge.textContent = state.unread > 99 ? '99+' : String(state.unread)
}

function renderSummary() {
  const el = document.getElementById('pt-ie-summary')
  if (!el) return
  const s = state.summary || {}
  el.innerHTML = `<div><small>Não lidos</small><b>${Number(s.unread ?? state.unread) || 0}</b></div><div><small>Sucesso</small><b>${Number(s.success) || 0}</b></div><div><small>Atenção</small><b>${Number(s.warning) || 0}</b></div><div><small>Críticos</small><b>${Number(s.critical) || 0}</b></div>`
}

function detailInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return esc((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] || '' : ''))
}

function statusLabel(value) {
  const key = String(value || '').toLowerCase()
  return ({ paid: 'Pago', approved: 'Aprovado', pending: 'Pendente', processing: 'Processando', failed: 'Falhou', cancelled: 'Cancelado', refunded: 'Reembolsado', charged_back: 'Chargeback', active: 'Ativo', checked_in: 'Check-in realizado' })[key] || (value ? String(value) : '—')
}

function paymentMethodLabel(value) {
  const key = String(value || '').toLowerCase()
  return ({ pix: 'PIX', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', card: 'Cartão', boleto: 'Boleto', cash: 'Dinheiro' })[key] || (value ? String(value) : '—')
}

function appBaseUrl(slug) {
  const clean = String(slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  return clean ? `https://${clean}.petertecnet.com.br` : ''
}

function appReferenceUrl(item, relativePath) {
  const appSlug = item.application?.slug || item.metadata?.app_slug || ''
  const base = appBaseUrl(appSlug)
  const path = String(relativePath || '')
  if (!base || !path.startsWith('/')) return ''
  return `${base}${path}`
}

function detailValue(value, formatter = null) {
  if (value === null || value === undefined || value === '') return '—'
  return formatter ? formatter(value) : esc(value)
}

function renderDetailPanel(item) {
  const id = Number(item.id)
  const meta = item.metadata || {}
  const full = state.detailById[id] || null
  const details = full?.details || {}
  const buyer = details.buyer || (meta.buyer_name ? { id: meta.buyer_id, name: meta.buyer_name } : null)
  const order = details.order || (meta.order_id ? {
    id: meta.order_id,
    public_id: meta.order_public_id,
    total: meta.total,
    platform_fee: meta.platform_fee,
    processor_fee: meta.processor_fee,
    producer_net: meta.producer_net,
  } : null)
  const event = details.event || (meta.event_id ? { id: meta.event_id, title: meta.event_title } : null)
  const production = details.production || (meta.production_id ? { id: meta.production_id, name: meta.production_name } : null)
  const payment = details.payment || null
  const items = Array.isArray(details.items) ? details.items : []
  const holders = Array.isArray(details.holders) ? details.holders : []
  const loading = !!state.detailLoading[id]
  const error = state.detailErrors[id] || ''

  const buyerLocation = [buyer?.city, buyer?.uf].filter(Boolean).join(' / ')
  const buyerSubtitle = buyer?.user_name ? `@${esc(buyer.user_name)}` : (buyer?.email ? esc(buyer.email) : 'Comprador identificado no pedido')
  const saleUrl = appReferenceUrl(item, item.reference_url || meta.producer_url)
  const eventUrl = event?.slug ? appReferenceUrl(item, `/event/${encodeURIComponent(event.slug)}`) : ''
  const userUrl = buyer?.id ? `/?user=${Number(buyer.id)}` : ''

  const orderRows = order ? `
    <div class="pt-ie-kv">
      <span>Pedido</span><b>${detailValue(order.public_id || order.id)}</b>
      <span>Status</span><b>${esc(statusLabel(order.status || 'paid'))}</b>
      <span>Forma de pagamento</span><b>${esc(paymentMethodLabel(order.payment_method || payment?.method))}</b>
      <span>Subtotal</span><b>${detailValue(order.subtotal, fmtMoney)}</b>
      <span>Desconto</span><b>${detailValue(order.discount_amount, fmtMoney)}</b>
      <span>Total pago</span><b class="pt-ie-detail-money">${detailValue(order.total ?? meta.total, fmtMoney)}</b>
      <span>Taxa plataforma</span><b>${detailValue(order.platform_fee ?? meta.platform_fee, fmtMoney)}</b>
      <span>Taxa processador</span><b>${detailValue(order.processor_fee ?? meta.processor_fee, fmtMoney)}</b>
      <span>Líquido produtor</span><b class="pt-ie-detail-money">${detailValue(order.producer_net ?? meta.producer_net, fmtMoney)}</b>
      <span>Pago em</span><b>${order.paid_at ? fmtDate(order.paid_at) : '—'}</b>
    </div>` : '<p class="pt-ie-detail-loading">Pedido não vinculado a este evento.</p>'

  const paymentRows = payment ? `
    <div class="pt-ie-kv">
      <span>Provedor</span><b>${detailValue(payment.provider)}</b>
      <span>Status</span><b>${esc(statusLabel(payment.status))}</b>
      <span>Método</span><b>${esc(paymentMethodLabel(payment.method))}</b>
      <span>Valor</span><b class="pt-ie-detail-money">${detailValue(payment.amount, fmtMoney)}</b>
      <span>Taxa do provedor</span><b>${detailValue(payment.provider_fee, fmtMoney)}</b>
      <span>ID no provedor</span><b>${detailValue(payment.provider_payment_id || payment.provider_txid)}</b>
    </div>` : '<p class="pt-ie-detail-loading">Detalhes do pagamento ainda não disponíveis.</p>'

  const itemsHtml = items.length
    ? items.map(row => `<div class="pt-ie-detail-row"><strong>${esc(row.name || row.type || 'Item')}</strong><span>${Number(row.quantity) || 0} × ${fmtMoney(row.unit_price)} · ${fmtMoney(row.subtotal)}</span></div>`).join('')
    : `<div class="pt-ie-detail-row"><strong>Ingressos</strong><span>${Number(meta.ticket_count) || 0}</span></div>`

  const holdersHtml = holders.length
    ? holders.map(holder => `<div class="pt-ie-detail-row"><strong>${esc(holder.holder_name || 'Participante')}</strong><span>${holder.holder_email ? esc(holder.holder_email) + ' · ' : ''}${esc(statusLabel(holder.status))}${holder.checked_in_at ? ' · check-in ' + fmtDate(holder.checked_in_at) : ''}</span></div>`).join('')
    : '<div class="pt-ie-detail-row"><strong>Participantes</strong><span>Os dados aparecem quando os ingressos individuais estiverem vinculados.</span></div>'

  return `
    <section class="pt-ie-details" aria-label="Detalhes do evento importante">
      <div class="pt-ie-detail-head">
        <div><h4>Detalhes da venda</h4><p>Informações do comprador, pedido, pagamento e ingressos.</p></div>
        <span class="pt-ie-detail-status">${esc(statusLabel(order?.status || (item.severity === 'success' ? 'paid' : item.severity)))}</span>
      </div>
      ${loading && !full ? '<div class="pt-ie-detail-loading">Carregando todos os detalhes…</div>' : ''}
      ${error ? `<div class="pt-ie-detail-error">${esc(error)}</div>` : ''}
      <div class="pt-ie-detail-grid">
        <div class="pt-ie-detail-card">
          <h5>Quem comprou</h5>
          ${buyer ? `<div class="pt-ie-person"><div class="pt-ie-avatar">${detailInitials(buyer.name)}</div><div><b>${esc(buyer.name || 'Comprador')}</b><small>${buyerSubtitle}</small>${buyer.phone ? `<small>${esc(buyer.phone)}</small>` : ''}${buyerLocation ? `<small>${esc(buyerLocation)}</small>` : ''}</div></div>` : '<p class="pt-ie-detail-loading">Comprador não identificado.</p>'}
        </div>
        <div class="pt-ie-detail-card">
          <h5>Evento / produção</h5>
          <div class="pt-ie-kv">
            <span>Evento</span><b>${detailValue(event?.title || meta.event_title)}</b>
            <span>Produção</span><b>${detailValue(production?.name || meta.production_name)}</b>
            <span>Data</span><b>${event?.start_date ? fmtDate(event.start_date) : '—'}</b>
            <span>Local</span><b>${detailValue([event?.venue, event?.city, event?.uf].filter(Boolean).join(' · '))}</b>
          </div>
        </div>
        <div class="pt-ie-detail-card">
          <h5>Pedido</h5>
          ${orderRows}
        </div>
        <div class="pt-ie-detail-card">
          <h5>Pagamento</h5>
          ${paymentRows}
        </div>
        <div class="pt-ie-detail-card wide">
          <h5>Itens do pedido</h5>
          <div class="pt-ie-detail-list">${itemsHtml}</div>
        </div>
        <div class="pt-ie-detail-card wide">
          <h5>Ingressos / participantes</h5>
          <div class="pt-ie-detail-list">${holdersHtml}</div>
        </div>
      </div>
      <div class="pt-ie-detail-actions">
        ${userUrl ? `<a href="${esc(userUrl)}">Abrir comprador no Admin Center</a>` : ''}
        ${saleUrl ? `<a href="${esc(saleUrl)}" target="_blank" rel="noopener noreferrer">Abrir venda no aplicativo</a>` : ''}
        ${eventUrl ? `<a href="${esc(eventUrl)}" target="_blank" rel="noopener noreferrer">Abrir evento</a>` : ''}
      </div>
    </section>`
}

function renderEvents(error = '') {
  const list = document.getElementById('pt-ie-list')
  if (!list) return
  if (error) { list.innerHTML = `<div class="pt-ie-empty pt-ie-error">${esc(error)}</div>`; return }
  if (state.loading) { list.classList.add('pt-ie-loading') } else { list.classList.remove('pt-ie-loading') }
  if (!state.events.length) { list.innerHTML = '<div class="pt-ie-empty">Nenhum evento importante encontrado neste filtro.</div>'; return }

  list.innerHTML = state.events.map(item => {
    const meta = item.metadata || {}
    const app = item.application?.name || meta.app_slug || 'Ecossistema'
    const total = meta.total !== undefined ? `<span class="pt-ie-money">${fmtMoney(meta.total)}</span>` : ''
    const tickets = meta.ticket_count ? `<span>${esc(meta.ticket_count)} ingresso${Number(meta.ticket_count) === 1 ? '' : 's'}</span>` : ''
    const buyer = meta.buyer_name ? `<span>Comprador: ${esc(meta.buyer_name)}</span>` : ''
    const order = meta.order_public_id ? `<span>Pedido: ${esc(meta.order_public_id)}</span>` : (meta.order_id ? `<span>Pedido #${esc(meta.order_id)}</span>` : '')
    const email = meta.producer_email_status ? `<span>e-mail: ${esc(meta.producer_email_status)}</span>` : ''
    const expanded = Number(state.selectedId) === Number(item.id)
    return `<article class="pt-ie-event ${item.is_read ? '' : 'unread'} ${expanded ? 'expanded' : ''}" data-id="${Number(item.id)}" data-severity="${esc(item.severity || 'info')}" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}"><i class="pt-ie-dot"></i><div class="pt-ie-body"><h3>${esc(item.title)}</h3><p>${esc(item.message || '')}</p><div class="pt-ie-meta"><span>${esc(app)}</span><span>${esc(item.type)}</span>${buyer}${tickets}${order}${total}${email}</div><span class="pt-ie-expand-label">${expanded ? 'Ocultar detalhes ↑' : 'Ver detalhes →'}</span></div><time class="pt-ie-time">${fmtDate(item.occurred_at || item.created_at)}</time>${expanded ? renderDetailPanel(item) : ''}</article>`
  }).join('')

  list.querySelectorAll('.pt-ie-event').forEach(node => {
    const open = () => toggleDetail(Number(node.dataset.id))
    node.addEventListener('click', event => {
      if (event.target.closest('a,button,.pt-ie-details')) return
      open()
    })
    node.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a,button,.pt-ie-details')) {
        event.preventDefault()
        open()
      }
    })
  })
}

async function toggleDetail(id) {
  if (!id) return
  if (Number(state.selectedId) === Number(id)) {
    state.selectedId = null
    renderEvents()
    return
  }

  state.selectedId = id
  renderEvents()
  void markRead(id)

  if (state.detailById[id] || state.detailLoading[id]) return
  state.detailLoading[id] = true
  state.detailErrors[id] = ''
  renderEvents()

  try {
    const payload = await api(`/admin/ecosystem/important-events/${id}`)
    if (payload?.event) state.detailById[id] = payload.event
  } catch (error) {
    state.detailErrors[id] = error.message || 'Não foi possível carregar todos os detalhes desta venda.'
  } finally {
    state.detailLoading[id] = false
    renderEvents()
  }
}

async function refreshUnread() {
  if (!token()) { state.unread = 0; renderVisibility(); return }
  try {
    const payload = await api('/admin/ecosystem/important-events/unread-count')
    state.unread = Number(payload?.unread) || 0
  } catch (error) {
    if (error.status === 401) state.unread = 0
  }
  renderVisibility()
}

async function loadEvents() {
  if (!token()) return
  state.loading = true
  renderEvents()
  const params = new URLSearchParams({ per_page: '50' })
  if (state.severity) params.set('severity', state.severity)
  if (state.unreadOnly) params.set('unread', '1')
  if (state.search.trim()) params.set('search', state.search.trim())
  try {
    const payload = await api(`/admin/ecosystem/important-events?${params.toString()}`)
    state.events = payload?.events?.data || []
    state.summary = payload?.summary || {}
    state.unread = Number(payload?.summary?.unread ?? state.unread) || 0
    renderSummary(); renderVisibility(); renderEvents()
  } catch (error) { renderEvents(error.message) }
  finally { state.loading = false; renderEvents() }
}

async function markRead(id) {
  const item = state.events.find(event => Number(event.id) === id)
  if (!item || item.is_read) return
  try {
    await api(`/admin/ecosystem/important-events/${id}/read`, { method: 'PATCH' })
    item.is_read = true
    state.unread = Math.max(0, state.unread - 1)
    state.summary.unread = state.unread
    renderSummary(); renderVisibility(); renderEvents()
  } catch (_) {}
}

async function markAllRead() {
  try {
    await api('/admin/ecosystem/important-events/read-all', { method: 'PATCH' })
    state.unread = 0
    state.summary.unread = 0
    state.events.forEach(item => { item.is_read = true })
    renderSummary(); renderVisibility(); renderEvents()
  } catch (error) { renderEvents(error.message) }
}

function openDrawer() {
  state.open = true
  document.getElementById('pt-ie-drawer')?.classList.add('open')
  document.getElementById('pt-ie-drawer')?.setAttribute('aria-hidden', 'false')
  const backdrop = document.getElementById('pt-ie-backdrop'); if (backdrop) backdrop.hidden = false
  void loadEvents()
}

function closeDrawer() {
  state.open = false
  document.getElementById('pt-ie-drawer')?.classList.remove('open')
  document.getElementById('pt-ie-drawer')?.setAttribute('aria-hidden', 'true')
  const backdrop = document.getElementById('pt-ie-backdrop'); if (backdrop) backdrop.hidden = true
}

function boot() {
  ensureUi(); renderVisibility(); void refreshUnread()
  window.setInterval(() => { if (!document.hidden) void refreshUnread() }, POLL_MS)
  window.addEventListener('focus', refreshUnread)
  window.addEventListener('storage', event => { if (event.key === TOKEN_KEY) { renderVisibility(); void refreshUnread() } })
  window.addEventListener('admin-session-expired', () => { state.unread = 0; renderVisibility(); closeDrawer() })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshUnread() })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
