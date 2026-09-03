import { useEffect, useMemo, useState } from 'react'
import './FinancialCenter.css'

const API = 'https://api.petertecnet.com.br/api'
const TABS = [['overview','Visão geral'],['sales','Vendas'],['transactions','Transações'],['closing','Fechamento'],['reconciliation','Conciliação'],['ledger','Ledger'],['payouts','Repasses'],['health','Saúde operacional']]

async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type':'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  })
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) { localStorage.removeItem('token'); window.location.href = '/login' }
  if (!r.ok) throw new Error(d?.message || d?.error || 'Falha ao consultar o centro financeiro.')
  return d
}

async function downloadReport(format, qs) {
  const token = localStorage.getItem('token')
  const r = await fetch(`${API}/admin/ecosystem/financial/reports/${format}?${qs}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  if (r.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return }
  if (!r.ok) throw new Error('Não foi possível gerar o relatório financeiro.')
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financeiro-${new Date().toISOString().slice(0,10)}.${format}`
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (a, b) => b ? `${((Number(a || 0) / Number(b)) * 100).toFixed(1)}%` : '0%'
const fmt = v => v ? new Date(v).toLocaleString('pt-BR') : '—'
const label = s => ({ approved:'Aprovado', paid:'Pago', pending:'Pendente', in_process:'Processando', authorized:'Autorizado', failed:'Falhou', rejected:'Rejeitado', cancelled:'Cancelado', expired:'Expirado', refunded:'Estornado', charged_back:'Chargeback', processing:'Processando', completed:'Concluído', requested:'Solicitado', healthy:'Saudável', attention:'Atenção', critical:'Crítico', matched:'Conciliado', corrected:'Corrigido', error:'Erro', unverified:'Não verificado' }[s] || s || '—')
const eventLabel = s => ({ checkout_created:'Checkout criado', qr_generated:'QR gerado', payment_confirmed:'Pagamento confirmado', payment_refunded:'Estorno', payment_chargeback:'Chargeback', payment_failed:'Falha', payment_rejected:'Rejeitado', payment_cancelled:'Cancelado', payment_expired:'Expirado', seller_payout:'Repasse ao vendedor', manual_adjustment:'Ajuste' }[s] || s || '—')

export default function FinancialCenter({ embedded = false }) {
  const [tab, setTab] = useState('overview')
  const [d, setD] = useState(null)
  const [tx, setTx] = useState(null)
  const [orders, setOrders] = useState(null)
  const [po, setPo] = useState(null)
  const [health, setHealth] = useState(null)
  const [ledgerRows, setLedgerRows] = useState(null)
  const [recRows, setRecRows] = useState(null)
  const [f, setF] = useState({ app_slug:'', provider:'', status:'', method:'', from:'', to:'' })
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [live, setLive] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [reconciling, setReconciling] = useState(false)
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([,v]) => v)).toString(), [f])

  async function load(silent = false) {
    try {
      if (!silent) setError('')
      const [dashboard, transactions, sales, payouts, systemHealth] = await Promise.all([
        api(`/admin/ecosystem/financial/dashboard?${qs}`),
        api(`/admin/ecosystem/financial/transactions?${qs}&per_page=100`),
        api(`/admin/ecosystem/financial/orders?${new URLSearchParams(Object.entries({ status: f.status, from: f.from, to: f.to }).filter(([,v]) => v)).toString()}&per_page=100`),
        api('/admin/ecosystem/financial/payouts'),
        api('/admin/ecosystem/financial/health'),
      ])
      setD(dashboard); setTx(transactions); setOrders(sales); setPo(payouts); setHealth(systemHealth); setLastSync(new Date())
    } catch (e) { setError(e.message) }
  }

  async function loadAuditSurface() {
    try {
      if (tab === 'ledger') setLedgerRows(await api(`/admin/ecosystem/financial/ledger?${qs}&per_page=150`))
      if (tab === 'reconciliation') setRecRows(await api('/admin/ecosystem/financial/reconciliations?per_page=150'))
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [qs])
  useEffect(() => { loadAuditSurface() }, [tab, qs])
  useEffect(() => { if (!live) return undefined; const id = setInterval(() => { load(true); if (['ledger','reconciliation'].includes(tab)) loadAuditSurface() }, 15000); return () => clearInterval(id) }, [live, qs, tab])

  async function inspect(row) {
    if (String(row.id).startsWith('cutinapp-')) { setSelected(row); return }
    try {
      const detail = await api(`/admin/ecosystem/financial/transactions/${row.id}`)
      setSelected({ ...detail.transaction, _source: detail.source, _ledger: detail.ledger, _reconciliations: detail.reconciliations })
    } catch (e) { setSelected(row); setError(e.message) }
  }

  async function reconcileNow() {
    try {
      setReconciling(true); setError('')
      await api('/admin/ecosystem/financial/reconcile', { method:'POST', body: JSON.stringify({ limit: 200 }) })
      await load(); if (tab === 'reconciliation') await loadAuditSurface()
    } catch (e) { setError(e.message) } finally { setReconciling(false) }
  }

  async function exportReport(format) {
    try { setError(''); await downloadReport(format, qs) } catch (e) { setError(e.message) }
  }

  const s = d?.summary || {}
  const reconciliation = d?.reconciliation || {}
  const ledger = d?.ledger?.balance || {}
  const settlement = d?.settlement || {}
  const funnel = d?.payment_funnel || {}
  const providerRec = d?.provider_reconciliation || {}
  const closing = d?.daily_closing || {}
  const commerce = d?.commerce || {}
  const total = Number(s.totals?.transactions || 0)
  const approved = Number(s.approved?.count || 0)
  const pending = Number(s.pending?.count || 0)
  const failed = Number(s.failed?.count || 0)
  const score = Number((health || d?.health)?.score ?? 100)
  const healthStatus = (health || d?.health)?.status || 'healthy'

  const content = <div className="finance-stack">
    <section className="finance-hero">
      <div><p>MISSION FINANCIAL CONTROL</p><h2>Centro financeiro do ecossistema</h2><span>Venda, caixa e saldo disponível são estados diferentes. QR Code gerado nunca é dinheiro recebido.</span></div>
      <div className="finance-live"><i className={live ? 'on' : ''}/><div><b>{live ? 'Monitoramento ativo' : 'Monitoramento pausado'}</b><small>{lastSync ? `Atualizado ${lastSync.toLocaleTimeString('pt-BR')}` : 'Sincronizando...'}</small></div><button onClick={() => setLive(v => !v)}>{live ? 'Pausar' : 'Ativar'}</button><button onClick={() => load()}>Atualizar</button></div>
    </section>

    <nav className="finance-tabs">{TABS.map(([key,name]) => <button key={key} className={tab===key?'active':''} onClick={() => setTab(key)}>{name}</button>)}</nav>
    {error && <div className="finance-alert critical"><b>Falha operacional</b><span>{error}</span></div>}

    {tab === 'overview' && <>
      <div className="finance-kpis">
        <Kpi title="Saldo Peter Tecnet" value={money(ledger.platform_balance)} sub="valor econômico pertencente à plataforma" />
        <Kpi title="Saldo disponível" value={money(settlement.available_gross)} sub={`${settlement.available_count||0} pagamentos liberados`} />
        <Kpi title="Aguardando liquidação" value={money(settlement.settlement_pending_gross)} sub={`${settlement.settlement_pending_count||0} pagamentos aprovados`} danger={Number(settlement.settlement_pending_count)>0} />
        <Kpi title="Caixa confirmado · GMV" value={money(s.totals?.gross)} sub={`${approved} pagamentos confirmados`} />
        <Kpi title="Em aberto · não é caixa" value={money(s.totals?.open_gross)} sub={`${pending} cobranças aguardando pagamento`} danger={pending>0} />
        <Kpi title="Saldo vendedores" value={money(ledger.seller_payable)} sub={`${money(ledger.seller_paid)} já repassados`} />
      </div>

      <section className="finance-panel"><header><div><b>Filtros e relatórios</b><small>O período usa a data financeira do evento. PDF e CSV seguem os mesmos filtros.</small></div><div><button onClick={()=>exportReport('pdf')}>Relatório PDF</button> <button onClick={()=>exportReport('csv')}>Exportar CSV</button> <button onClick={()=>setF({app_slug:'',provider:'',status:'',method:'',from:'',to:''})}>Limpar</button></div></header><div className="finance-filters"><input placeholder="Aplicação (slug)" value={f.app_slug} onChange={e=>setF({...f,app_slug:e.target.value})}/><input placeholder="Gateway / provedor" value={f.provider} onChange={e=>setF({...f,provider:e.target.value})}/><select value={f.method} onChange={e=>setF({...f,method:e.target.value})}><option value="">Todos os métodos</option><option value="pix">PIX</option><option value="card">Cartão</option></select><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="">Todos os status</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="in_process">Processando</option><option value="expired">Expirado</option><option value="failed">Falhou</option><option value="rejected">Rejeitado</option><option value="cancelled">Cancelado</option><option value="refunded">Estornado</option><option value="charged_back">Chargeback</option></select><input type="date" value={f.from} onChange={e=>setF({...f,from:e.target.value})}/><input type="date" value={f.to} onChange={e=>setF({...f,to:e.target.value})}/></div></section>

      <div className="finance-grid">
        <Panel title="Funil financeiro" subtitle="Do checkout à confirmação real"><Table heads={['Etapa','Quantidade','Conversão']} rows={[
          ['Checkout criado',funnel.checkout_created||0,'100%'],['QR gerado',funnel.qr_generated||0,pct(funnel.qr_generated,funnel.checkout_created)],['Pagamento identificado no provedor',funnel.provider_started||0,pct(funnel.provider_started,funnel.checkout_created)],['Pagamento confirmado',funnel.paid||0,`${Number(funnel.conversion_rate||0).toFixed(1)}%`],['Em aberto',funnel.open||0,'Não é caixa'],['Falhou / expirou',funnel.failed||0,'Venda não realizada'],
        ]}/></Panel>
        <Panel title="Conciliação com gateways" subtitle="Comparação automática da API com o processador"><Table heads={['Indicador','Valor']} rows={[
          ['Última verificação',fmt(providerRec.last_check_at)],['Conciliados / 24h',providerRec.matched_24h||0],['Divergências / 24h',providerRec.mismatches_24h||0],['Erros de consulta / 24h',providerRec.errors_24h||0],['Pagamentos não verificados',providerRec.unverified_payments||0],
        ]}/></Panel>
      </div>

      <Panel title="Conciliação de caixa" subtitle={reconciliation.recognition_rule || 'Pagamento pendente ou QR gerado nunca é contabilizado como dinheiro recebido.'}><Table heads={['Estado','Transações','Valor bruto','Receita Peter','Entra no caixa?']} rows={[
        ['Confirmado', reconciliation.realized?.count || 0, money(reconciliation.realized?.amount), money(reconciliation.realized?.platform_fees), 'Sim'],['Em aberto / QR gerado', reconciliation.open?.count || 0, money(reconciliation.open?.amount), money(reconciliation.open?.platform_fees), 'Não'],['Falhou / cancelou / expirou', reconciliation.failed?.count || 0, money(reconciliation.failed?.amount), money(reconciliation.failed?.platform_fees), 'Não'],['Estornado / chargeback', reconciliation.reversed?.count || 0, money(reconciliation.reversed?.amount), money(reconciliation.reversed?.platform_fees), 'Evento compensatório'],
      ]}/></Panel>

      <div className="finance-grid health-grid">
        <section className={`finance-panel finance-health ${healthStatus}`}><header><div><b>Integridade operacional</b><small>Inclui agora divergências de conciliação</small></div><strong>{score}%</strong></header><div className="health-meter"><i style={{width:`${score}%`}}/></div><div className="health-list"><HealthItem name="Pagamentos travados" value={(health||d?.health)?.stale_payments || 0}/><HealthItem name="Divergências gateway" value={(health||d?.health)?.reconciliation_mismatches_24h || 0}/><HealthItem name="Fulfillment com falha" value={(health||d?.health)?.failed_fulfillment || 0}/><HealthItem name="Jobs falhos" value={(health||d?.health)?.failed_jobs || 0}/><HealthItem name="Falhas de repasse" value={(health||d?.health)?.payout_failures || 0}/></div></section>
        <section className="finance-panel"><header><div><b>Ledger imutável</b><small>{d?.ledger?.immutability_rule}</small></div></header><div className="commerce-grid"><MiniMetric name="Eventos" value={ledger.entries}/><MiniMetric name="GMV confirmado" value={money(ledger.confirmed_gross)}/><MiniMetric name="Estornos" value={money(ledger.reversed_gross)}/><MiniMetric name="Receita Peter" value={money(ledger.platform_balance)}/><MiniMetric name="Taxas gateway" value={money(ledger.provider_fees)}/><MiniMetric name="Ajustes" value={money(ledger.adjustments)}/></div></section>
      </div>

      <section className="finance-panel"><header><div><b>Central de alertas</b><small>Anomalias que exigem ação administrativa</small></div><span className="alert-count">{d?.alerts?.length || 0}</span></header><div className="finance-alerts">{d?.alerts?.length ? d.alerts.map((a,i)=><div className={`finance-alert ${a.severity}`} key={`${a.title}-${i}`}><b>{a.title}</b><span>{a.message}</span></div>) : <div className="finance-alert ok"><b>Operação nominal</b><span>Nenhum alerta crítico detectado agora.</span></div>}</div></section>

      <div className="finance-grid"><Panel title="Performance por aplicação" subtitle="GMV e receita somente de pagamentos confirmados"><Table heads={['Aplicação','Tx','Aprov.','Pend.','Falhas','GMV pago','Em aberto','Receita realizada','Líquido']} rows={d?.applications?.map(x=>[x.application_name||x.app_slug,x.transactions,x.approved,x.pending||0,x.failed,money(x.gross),money(x.pending_gross),money(x.platform_fees),money(x.seller_net)])}/></Panel><Panel title="Gateways" subtitle="Custos realizados apenas sobre pagamentos confirmados"><Table heads={['Gateway','Tx','Aprov.','Pend.','Falhas','Sucesso','Custo realizado']} rows={d?.providers?.map(x=>[x.provider,x.transactions,x.approved,x.pending||0,x.failed,`${Number(x.success_rate||0).toFixed(1)}%`,money(x.provider_fees)])}/></Panel></div>
      <Panel title="Fluxo de caixa confirmado · 30 dias" subtitle="Somente pagamentos confirmados, reconhecidos na data em que o dinheiro foi aprovado"><div className="finance-chart">{d?.timeline?.map(x=>{const max=Math.max(...(d.timeline||[]).map(i=>Number(i.gross||0)),1);return <div className="finance-bar" key={x.day} title={`${x.day} · caixa ${money(x.gross)} · em aberto ${money(x.pending_gross)} · ${x.transactions} tx`}><span style={{height:`${Math.max(4,(Number(x.gross)/max)*100)}%`}}/><small>{String(x.day).slice(5)}</small></div>})}</div></Panel>
    </>}

    {tab === 'sales' && <><div className="finance-kpis compact"><Kpi title="Pedidos" value={commerce.orders||0} sub="checkouts criados"/><Kpi title="Pagos" value={commerce.paid_orders||0} sub={money(commerce.paid_gross)}/><Kpi title="Ingressos" value={commerce.ticket_units||0} sub={`${commerce.issued_passes||0} passes emitidos`} danger={Number(commerce.issued_passes||0)<Number(commerce.ticket_units||0)}/><Kpi title="Itens" value={commerce.item_units||0} sub="unidades vendidas"/><Kpi title="Receita paga" value={money(commerce.platform_revenue)} sub="somente vendas confirmadas"/><Kpi title="Conversão" value={`${Number(commerce.conversion_rate||0).toFixed(1)}%`} sub="pedido → pago"/></div><Panel title={`Pedidos de venda · ${orders?.total || 0}`} subtitle="Checkout criado não é venda: o status pago é o que concretiza a operação"><div className="finance-table-wrap"><table><thead><tr><th>Data</th><th>Pedido</th><th>Comprador</th><th>Evento</th><th>Produção</th><th>Status</th><th>Ingressos</th><th>Itens</th><th>Total</th><th>Receita</th></tr></thead><tbody>{orders?.data?.length?orders.data.map(o=><tr key={o.id}><td>{fmt(o.created_at)}</td><td className="mono">{String(o.public_id).slice(0,12)}…</td><td><b>{String(o.buyer_name||'').trim()||'Cliente'}</b><small>{o.buyer_email}</small></td><td>{o.event_title||`#${o.event_id}`}</td><td>{o.production_name||`#${o.production_id}`}</td><td><Status value={o.status}/></td><td>{o.ticket_units||0}</td><td>{o.item_units||0}</td><td>{money(o.total)}</td><td>{o.status==='paid'?money(o.platform_fee):'Não realizada'}</td></tr>):<EmptyRow span={10}/>}</tbody></table></div></Panel></>}

    {tab === 'transactions' && <><section className="finance-panel"><header><div><b>Investigação de transações</b><small>Caixa, disponibilidade e conciliação ficam visíveis por transação.</small></div><button onClick={()=>setF({app_slug:'',provider:'',status:'',method:'',from:'',to:''})}>Limpar filtros</button></header><div className="finance-filters"><input placeholder="Aplicação" value={f.app_slug} onChange={e=>setF({...f,app_slug:e.target.value})}/><input placeholder="Provedor" value={f.provider} onChange={e=>setF({...f,provider:e.target.value})}/><select value={f.method} onChange={e=>setF({...f,method:e.target.value})}><option value="">Método</option><option value="pix">PIX</option><option value="card">Cartão</option></select><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="">Status</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="expired">Expirado</option><option value="failed">Falhou</option><option value="refunded">Estornado</option><option value="charged_back">Chargeback</option></select><input type="date" value={f.from} onChange={e=>setF({...f,from:e.target.value})}/><input type="date" value={f.to} onChange={e=>setF({...f,to:e.target.value})}/></div></section><Panel title={`Transações · ${tx?.total || 0}`} subtitle="Clique em uma linha para abrir ledger e conciliações"><div className="finance-table-wrap"><table><thead><tr><th>Data financeira</th><th>Aplicação</th><th>Gateway</th><th>Método</th><th>Status</th><th>Caixa</th><th>Disponível</th><th>Conciliação</th><th>Bruto</th><th>Peter</th><th>Gateway</th><th>Líquido</th></tr></thead><tbody>{tx?.data?.length?tx.data.map(t=><tr key={`${t.app_slug}-${t.id}`} onClick={()=>inspect(t)}><td>{fmt(t.financial_at||t.created_at)}</td><td>{t.application_name||t.app_slug}</td><td>{t.provider}</td><td>{String(t.method||'—').toUpperCase()}</td><td><Status value={t.status}/></td><td>{t.is_realized?'Confirmado':'Não realizado'}</td><td>{t.available_at?fmt(t.available_at):(t.is_realized&&t.method==='pix'?'Imediato':'Aguardando')}</td><td>{label(t.reconciliation_status)}</td><td>{money(t.gross_amount)}</td><td>{money(t.platform_fee)}</td><td>{money(t.provider_fee)}</td><td>{money(t.seller_net)}</td></tr>):<EmptyRow span={12}/>}</tbody></table></div></Panel></>}

    {tab === 'closing' && <><div className="finance-kpis compact"><Kpi title="Saldo inicial" value={money(closing.opening_balance)} sub="início do período"/><Kpi title="Saldo final" value={money(closing.closing_balance)} sub="após recebimentos, taxas e repasses"/><Kpi title="Receita Peter no período" value={money(d?.ledger?.period?.platform_balance)} sub="eventos do ledger"/><Kpi title="Estornos no período" value={money(d?.ledger?.period?.reversed_gross)} sub="eventos compensatórios"/></div><Panel title="Fechamento diário" subtitle="Saldo inicial + recebimentos − estornos − taxas − repasses ± ajustes = saldo final"><Table heads={['Data','Saldo inicial','Recebimentos','Estornos','Taxas','Repasses','Ajustes','Movimento','Saldo final','Receita Peter']} rows={closing.days?.map(x=>[x.day,money(x.opening_balance),money(x.receipts),money(x.reversals),money(x.gateway_fees),money(x.payouts),money(x.adjustments),money(x.movement),money(x.closing_balance),money(x.platform_revenue)])}/></Panel></>}

    {tab === 'reconciliation' && <><section className="finance-panel"><header><div><b>Conciliação com o provedor</b><small>A API compara status, valor e taxa e registra a divergência antes de corrigir a projeção local.</small></div><button onClick={reconcileNow} disabled={reconciling}>{reconciling?'Conciliando...':'Conciliar agora'}</button></header></section><div className="finance-kpis compact"><Kpi title="Conciliados / 24h" value={providerRec.matched_24h||0} sub="sem divergência"/><Kpi title="Divergências / 24h" value={providerRec.mismatches_24h||0} sub="detectadas e rastreadas" danger={Number(providerRec.mismatches_24h)>0}/><Kpi title="Erros de consulta" value={providerRec.errors_24h||0} sub="gateway indisponível/configuração" danger={Number(providerRec.errors_24h)>0}/><Kpi title="Não verificados" value={providerRec.unverified_payments||0} sub="fila de conciliação" danger={Number(providerRec.unverified_payments)>0}/></div><Panel title={`Histórico de conciliação · ${recRows?.total||0}`} subtitle="Toda divergência permanece auditável"><Table heads={['Verificado','Gateway','ID gateway','Local','Remoto','Valor local','Valor remoto','Taxa local','Taxa remota','Resultado','Divergência']} rows={recRows?.data?.map(x=>[fmt(x.checked_at),x.provider,x.provider_payment_id||'—',label(x.local_status),label(x.remote_status),money(x.local_amount),x.remote_amount==null?'—':money(x.remote_amount),money(x.local_provider_fee),x.remote_provider_fee==null?'—':money(x.remote_provider_fee),x.matched?'Compatível':'Divergente',x.discrepancy_code||'—'])}/></Panel></>}

    {tab === 'ledger' && <><div className="finance-kpis compact"><Kpi title="Eventos" value={ledger.entries||0} sub="histórico imutável"/><Kpi title="GMV confirmado" value={money(ledger.confirmed_gross)} sub="entradas confirmadas"/><Kpi title="Estornos" value={money(ledger.reversed_gross)} sub="eventos compensatórios"/><Kpi title="Saldo Peter Tecnet" value={money(ledger.platform_balance)} sub="receita líquida de reversões"/><Kpi title="Vendedores a pagar" value={money(ledger.seller_payable)} sub="obrigações ainda abertas"/><Kpi title="Já repassado" value={money(ledger.seller_paid)} sub="saídas registradas"/></div><Panel title={`Ledger financeiro · ${ledgerRows?.total||0}`} subtitle="Registros não podem ser editados nem apagados; correções são novos eventos"><Table heads={['Ocorrido','Aplicação','Evento','Origem','Gateway','Bruto','Peter','Gateway','Vendedor']} rows={ledgerRows?.data?.map(x=>[fmt(x.occurred_at),x.app_slug,eventLabel(x.event_type),x.source_reference||'—',x.provider||'—',money(x.gross_amount),money(x.platform_amount),money(x.provider_amount),money(x.seller_amount)])}/></Panel></>}

    {tab === 'payouts' && <><div className="finance-kpis compact"><Kpi title="Solicitações" value={po?.summary?.total||0} sub="histórico total"/><Kpi title="Pendentes" value={po?.summary?.pending||0} sub={money(po?.summary?.amount_pending)} danger={Number(po?.summary?.pending)>0}/><Kpi title="Pagas" value={po?.summary?.paid||0} sub={money(po?.summary?.amount_paid)}/><Kpi title="Falhas" value={po?.summary?.failed||0} sub="requer atenção" danger={Number(po?.summary?.failed)>0}/><Kpi title="Saldo vendedores" value={money(ledger.seller_payable)} sub="ledger após repasses"/><Kpi title="Já repassado" value={money(ledger.seller_paid)} sub="eventos de saída"/></div><Panel title="Repasses e saques" subtitle="Repasses pagos também entram no ledger"><Table heads={['Criado','Produção','Status','Valor','Referência']} rows={po?.data?.map(x=>[fmt(x.created_at),x.production_name||`#${x.production_id}`,label(x.status),money(x.amount||x.net_amount),x.reference||x.id])}/></Panel></>}

    {tab === 'health' && <><section className={`finance-health-full ${healthStatus}`}><div className="health-orbit"><strong>{score}</strong><span>HEALTH SCORE</span></div><div><p>ECOSYSTEM PAYMENT RELIABILITY</p><h2>{label(healthStatus)}</h2><span>Inclui pagamentos travados, conciliação, liquidação, fulfillment, jobs e repasses.</span></div></section><div className="ops-grid"><OpsCard title="Pagamentos travados" value={(health||d?.health)?.stale_payments||0} description="Pendentes além da janela normal" critical={(health||d?.health)?.stale_payments>0}/><OpsCard title="Divergências gateway" value={(health||d?.health)?.reconciliation_mismatches_24h||0} description="Últimas 24 horas" critical={(health||d?.health)?.reconciliation_mismatches_24h>0}/><OpsCard title="Erros de conciliação" value={(health||d?.health)?.reconciliation_errors_24h||0} description="Provedor indisponível/configuração" critical={(health||d?.health)?.reconciliation_errors_24h>0}/><OpsCard title="Aguardando liquidação" value={(health||d?.health)?.settlement_pending_count||0} description={money((health||d?.health)?.settlement_pending_gross)} critical={false}/><OpsCard title="Fulfillment" value={(health||d?.health)?.failed_fulfillment||0} description="Pedidos pagos com emissão falha" critical={(health||d?.health)?.failed_fulfillment>0}/><OpsCard title="Repasses falhos" value={(health||d?.health)?.payout_failures||0} description="Liquidações rejeitadas/canceladas" critical={(health||d?.health)?.payout_failures>0}/></div><section className="finance-panel"><header><div><b>Checklist operacional</b><small>Critérios mínimos para uma operação financeira saudável</small></div></header><div className="checklist"><Check ok={!((health||d?.health)?.stale_payments)} text="Nenhum pagamento preso fora da janela normal"/><Check ok={!((health||d?.health)?.reconciliation_mismatches_24h)} text="Sem divergências recentes entre API e gateway"/><Check ok={!((health||d?.health)?.reconciliation_errors_24h)} text="Conciliação automática consultando o gateway normalmente"/><Check ok={!((health||d?.health)?.failed_fulfillment)} text="Todo pedido pago entrega o que foi comprado"/><Check ok={!((health||d?.health)?.payout_failures)} text="Nenhum repasse em estado de falha"/><Check ok={score>=90} text="Health Score operacional acima de 90%"/></div></section></>}

    {selected && <div className="finance-modal" onClick={()=>setSelected(null)}><article onClick={e=>e.stopPropagation()}><header><div><small>TRANSAÇÃO</small><h3>{money(selected.gross_amount)}</h3><span>{selected.application_name||selected.app_slug} · {selected.provider}</span></div><button onClick={()=>setSelected(null)}>×</button></header><dl>{Object.entries(selected).filter(([k])=>!['metadata','_source','_ledger','_reconciliations'].includes(k)).map(([k,v])=><div key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{String(v??'—')}</dd></div>)}</dl><h4>Contexto técnico</h4><pre>{typeof selected.metadata==='string'?selected.metadata:JSON.stringify(selected.metadata,null,2)}</pre>{selected._ledger?.length>0&&<><h4>Ledger</h4><pre>{JSON.stringify(selected._ledger,null,2)}</pre></>}{selected._reconciliations?.length>0&&<><h4>Conciliações</h4><pre>{JSON.stringify(selected._reconciliations,null,2)}</pre></>}{selected._source&&<><h4>Origem legada</h4><pre>{JSON.stringify(selected._source,null,2)}</pre></>}</article></div>}
  </div>

  if (embedded) return content
  return <main className="finance-page">{content}</main>
}

function Kpi({title,value,sub,danger}){return <article className={`finance-kpi ${danger?'danger':''}`}><span>{title}</span><strong>{value}</strong><small>{sub}</small></article>}
function Panel({title,subtitle,children}){return <section className="finance-panel"><header><div><b>{title}</b>{subtitle&&<small>{subtitle}</small>}</div></header>{children}</section>}
function Table({heads,rows=[]}){return <div className="finance-table-wrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows?.length?rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>):<EmptyRow span={heads.length}/>}</tbody></table></div>}
function Status({value}){return <span className={`finance-status ${value}`}>{label(value)}</span>}
function EmptyRow({span}){return <tr><td colSpan={span} className="empty-cell">Sem dados no período.</td></tr>}
function HealthItem({name,value}){return <div><span>{name}</span><b className={Number(value)>0?'bad':''}>{value}</b></div>}
function MiniMetric({name,value}){return <div><span>{name}</span><strong>{value??0}</strong></div>}
function OpsCard({title,value,description,critical}){return <article className={`ops-card ${critical?'critical':''}`}><small>{title}</small><strong>{value}</strong><span>{description}</span></article>}
function Check({ok,text}){return <div className={ok?'ok':'bad'}><i>{ok?'✓':'!'}</i><span>{text}</span></div>}
