import { useEffect, useMemo, useState } from 'react'
import '../Admin.css'
import { apiRequest, clearToken, getToken } from './api'

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'

const statusName = status => ({
  paid: 'Pago', approved: 'Aprovado', pending: 'Pendente', in_process: 'Em processamento', authorized: 'Autorizado',
  rejected: 'Recusado', cancelled: 'Cancelado', refunded: 'Reembolsado', charged_back: 'Contestado',
}[status] || status || '—')

export default function FinanceCenter() {
  const [overview, setOverview] = useState(null)
  const [payments, setPayments] = useState([])
  const [pagination, setPagination] = useState(null)
  const [filters, setFilters] = useState({ app: '', status: '', method: '', provider: '', search: '', from: '', to: '' })
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) { window.location.href = '/login'; return }
    loadAll()
  }, [])

  const query = useMemo(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    params.set('per_page', '50')
    return params.toString()
  }, [filters])

  async function loadAll() {
    setLoading(true); setError('')
    try {
      const [summary, list] = await Promise.all([
        apiRequest('/admin/finance/overview'),
        apiRequest('/admin/finance/payments?per_page=50'),
      ])
      setOverview(summary)
      setPayments(list.payments || [])
      setPagination(list.pagination || null)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function apply(event) {
    event?.preventDefault()
    setLoading(true); setError(''); setDetail(null)
    try {
      const list = await apiRequest(`/admin/finance/payments?${query}`)
      setPayments(list.payments || [])
      setPagination(list.pagination || null)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function openPayment(payment) {
    setLoading(true); setError('')
    try { setDetail(await apiRequest(`/admin/finance/payments/${payment.id}`)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function logout() { clearToken(); window.location.href = '/login' }

  const summary = overview?.summary || {}
  const cards = [
    ['Volume aprovado', money(summary.gross_volume), `${summary.approved_payments || 0} pagamentos`],
    ['Receita Peter Tecnet', money(summary.platform_revenue), 'comissões da plataforma'],
    ['Líquido dos recebedores', money(summary.producer_net), 'split dos vendedores'],
    ['Taxas do provedor', money(summary.provider_fees), 'processamento'],
    ['Pendente', money(summary.pending_amount), 'aguardando confirmação'],
    ['Reembolsado/contestado', money(summary.refunded_amount), 'valores revertidos'],
  ]

  return <main className="ecosystem-shell">
    {loading && <div className="peter-processing" role="status"><div className="peter-processing__visual"><i /><i /><img src="/petertecnetlogo.png" alt="" /></div><strong>Atualizando financeiro...</strong></div>}
    <aside className="ecosystem-sidebar">
      <a className="admin-brand ecosystem-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span><b>Peter Tecnet</b><small>Governança</small></span></a>
      <nav>
        <a href="/admin" style={{ display: 'block', padding: '12px 16px', color: 'inherit', textDecoration: 'none' }}>Visão geral</a>
        <a href="/admin/finance" className="active" style={{ display: 'block', padding: '12px 16px', color: 'inherit', textDecoration: 'none' }}>Financeiro</a>
      </nav>
      <div className="sidebar-foot"><a href="/" target="_blank">Abrir site ↗</a><button onClick={logout}>Sair</button></div>
    </aside>

    <section className="ecosystem-main">
      <header className="ecosystem-top">
        <div><p className="admin-kicker">Peter Tecnet Control Center</p><h1>Financeiro do ecossistema</h1></div>
        <div className="top-actions"><button onClick={loadAll}>Atualizar</button></div>
      </header>

      {error && <div className="notice error">{error}</div>}
      {overview?.notice && <div className="notice">{overview.notice}</div>}

      {!detail && <div className="admin-stack">
        <div className="metric-grid">{cards.map(([label, value, sub]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>)}</div>

        <section className="admin-panel">
          <div className="panel-title"><h2>Filtrar pagamentos</h2></div>
          <form className="filter-grid" onSubmit={apply}>
            <label>Aplicação<select value={filters.app} onChange={e => setFilters({ ...filters, app: e.target.value })}><option value="">Todas</option><option value="cutinapp">Cutinapp</option></select></label>
            <label>Status<select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Todos</option>{(overview?.statuses || []).map(status => <option key={status} value={status}>{statusName(status)}</option>)}</select></label>
            <label>Método<select value={filters.method} onChange={e => setFilters({ ...filters, method: e.target.value })}><option value="">Todos</option>{(overview?.methods || []).map(method => <option key={method} value={method}>{method.toUpperCase()}</option>)}</select></label>
            <label>Provedor<select value={filters.provider} onChange={e => setFilters({ ...filters, provider: e.target.value })}><option value="">Todos</option>{(overview?.providers || []).map(provider => <option key={provider} value={provider}>{provider}</option>)}</select></label>
            <label>Busca<input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Pedido, pagamento, evento, produção ou e-mail" /></label>
            <label>De<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
            <label>Até<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
            <div className="form-actions"><button className="primary">Aplicar filtros</button><button type="button" onClick={() => setFilters({ app: '', status: '', method: '', provider: '', search: '', from: '', to: '' })}>Limpar</button></div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-title"><h2>Pagamentos</h2><small>{pagination?.total || payments.length} registros</small></div>
          <div className="table-wrap"><table><thead><tr><th>Aplicação</th><th>Pedido</th><th>Cliente</th><th>Produção / origem</th><th>Método</th><th>Status</th><th>Bruto</th><th>Peter Tecnet</th><th>Recebedor</th><th>Data</th></tr></thead><tbody>
            {payments.map(payment => <tr key={payment.id} onClick={() => openPayment(payment)} style={{ cursor: 'pointer' }}>
              <td><b>{payment.app_slug}</b></td><td>{payment.order_public_id}</td><td><b>{payment.customer?.name || '—'}</b><br /><small>{payment.customer?.email}</small></td>
              <td><b>{payment.production?.name || '—'}</b><br /><small>{payment.event?.title || '—'}</small></td><td>{String(payment.method || '').toUpperCase()}</td>
              <td>{statusName(payment.status)}</td><td>{money(payment.amount)}</td><td>{money(payment.platform_fee)}</td><td>{money(payment.seller_net)}</td><td>{fmt(payment.created_at)}</td>
            </tr>)}
            {!payments.length && <tr><td colSpan="10">Nenhum pagamento encontrado.</td></tr>}
          </tbody></table></div>
        </section>
      </div>}

      {detail && <PaymentDetail payload={detail} onBack={() => setDetail(null)} />}
    </section>
  </main>
}

function PaymentDetail({ payload, onBack }) {
  const payment = payload?.payment || {}
  return <div className="admin-stack">
    <div className="top-actions"><button onClick={onBack}>← Voltar aos pagamentos</button></div>
    <div className="metric-grid">
      <article className="metric-card"><span>Valor bruto</span><strong>{money(payment.amount)}</strong><small>{payment.order_public_id}</small></article>
      <article className="metric-card"><span>Receita Peter Tecnet</span><strong>{money(payment.platform_fee)}</strong><small>comissão</small></article>
      <article className="metric-card"><span>Taxa do provedor</span><strong>{money(payment.provider_fee)}</strong><small>{payment.provider}</small></article>
      <article className="metric-card"><span>Líquido do recebedor</span><strong>{money(payment.seller_net)}</strong><small>{payment.production?.name || '—'}</small></article>
    </div>
    <section className="admin-panel"><div className="panel-title"><h2>Pagamento #{payment.id}</h2></div><div className="table-wrap"><table><tbody>
      <tr><th>Status</th><td>{statusName(payment.status)}</td><th>Método</th><td>{String(payment.method || '').toUpperCase()}</td></tr>
      <tr><th>Mercado Pago ID</th><td>{payment.provider_payment_id || '—'}</td><th>Aplicação</th><td>{payment.app_slug}</td></tr>
      <tr><th>Cliente</th><td>{payment.customer?.name || '—'} · {payment.customer?.email || '—'}</td><th>Evento</th><td>{payment.event?.title || '—'}</td></tr>
      <tr><th>Criado</th><td>{fmt(payment.created_at)}</td><th>Pago</th><td>{fmt(payment.paid_at)}</td></tr>
    </tbody></table></div></section>
    <section className="admin-panel"><div className="panel-title"><h2>Itens do pedido</h2></div><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Item</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>{(payload?.items || []).map(item => <tr key={item.id}><td>{item.type}</td><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td>{money(item.subtotal)}</td></tr>)}</tbody></table></div></section>
    <section className="admin-panel"><div className="panel-title"><h2>Razão financeira</h2></div><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead><tbody>{(payload?.ledger || []).map(entry => <tr key={entry.id}><td>{entry.type}</td><td>{entry.description}</td><td>{entry.status}</td><td>{money(entry.amount)}</td><td>{fmt(entry.created_at)}</td></tr>)}</tbody></table></div></section>
  </div>
}
