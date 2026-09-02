import { useEffect, useMemo, useState } from 'react'
import './FinancialCenter.css'

const API = 'https://api.petertecnet.com.br/api'
const TABS = [['overview','Visão geral'],['sales','Vendas'],['transactions','Transações'],['payouts','Repasses'],['health','Saúde operacional']]

async function api(path) {
  const token = localStorage.getItem('token')
  const r = await fetch(`${API}${path}`, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) { localStorage.removeItem('token'); window.location.href = '/login' }
  if (!r.ok) throw new Error(d?.message || d?.error || 'Falha ao consultar o centro financeiro.')
  return d
}

const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (a, b) => b ? `${((Number(a || 0) / Number(b)) * 100).toFixed(1)}%` : '0%'
const fmt = v => v ? new Date(v).toLocaleString('pt-BR') : '—'
const label = s => ({ approved:'Aprovado', paid:'Pago', pending:'Pendente', in_process:'Processando', authorized:'Autorizado', failed:'Falhou', rejected:'Rejeitado', cancelled:'Cancelado', refunded:'Estornado', charged_back:'Chargeback', processing:'Processando', completed:'Concluído', requested:'Solicitado', healthy:'Saudável', attention:'Atenção', critical:'Crítico' }[s] || s || '—')

export default function FinancialCenter({ embedded = false }) {
  const [tab, setTab] = useState('overview')
  const [d, setD] = useState(null)
  const [tx, setTx] = useState(null)
  const [orders, setOrders] = useState(null)
  const [po, setPo] = useState(null)
  const [health, setHealth] = useState(null)
  const [f, setF] = useState({ app_slug:'', provider:'', status:'', method:'', from:'', to:'' })
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [live, setLive] = useState(true)
  const [lastSync, setLastSync] = useState(null)
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

  useEffect(() => { load() }, [qs])
  useEffect(() => { if (!live) return undefined; const id = setInterval(() => load(true), 15000); return () => clearInterval(id) }, [live, qs])

  async function inspect(row) {
    if (String(row.id).startsWith('cutinapp-')) { setSelected(row); return }
    try { const detail = await api(`/admin/ecosystem/financial/transactions/${row.id}`); setSelected({ ...detail.transaction, _source: detail.source }) }
    catch (e) { setSelected(row); setError(e.message) }
  }

  const s = d?.summary || {}
  const commerce = d?.commerce || {}
  const total = Number(s.totals?.transactions || 0)
  const approved = Number(s.approved?.count || 0)
  const failed = Number(s.failed?.count || 0)
  const score = Number((health || d?.health)?.score ?? 100)
  const healthStatus = (health || d?.health)?.status || 'healthy'

  const content = <div className="finance-stack">
    <section className="finance-hero">
      <div><p>MISSION FINANCIAL CONTROL</p><h2>Centro financeiro do ecossistema</h2><span>Venda → pagamento → emissão → comissão → repasse → auditoria. Tudo em uma única sala de controle.</span></div>
      <div className="finance-live"><i className={live ? 'on' : ''}/><div><b>{live ? 'Monitoramento ativo' : 'Monitoramento pausado'}</b><small>{lastSync ? `Atualizado ${lastSync.toLocaleTimeString('pt-BR')}` : 'Sincronizando...'}</small></div><button onClick={() => setLive(v => !v)}>{live ? 'Pausar' : 'Ativar'}</button><button onClick={() => load()}>Atualizar</button></div>
    </section>

    <nav className="finance-tabs">{TABS.map(([key,name]) => <button key={key} className={tab===key?'active':''} onClick={() => setTab(key)}>{name}</button>)}</nav>

    {error && <div className="finance-alert critical"><b>Falha operacional</b><span>{error}</span></div>}

    {tab === 'overview' && <>
      <div className="finance-kpis">
        <Kpi title="Volume processado" value={money(s.totals?.gross)} sub={`${total} transações`} />
        <Kpi title="Receita Peter Tecnet" value={money(s.totals?.platform_fees)} sub="comissões da plataforma" />
        <Kpi title="Líquido produtores" value={money(s.totals?.seller_net)} sub="obrigação econômica" />
        <Kpi title="Taxas de gateway" value={money(s.totals?.provider_fees)} sub="custo de processamento" />
        <Kpi title="Aprovação" value={pct(approved,total)} sub={`${approved} aprovadas`} danger={total>0 && approved/total<.8} />
        <Kpi title="Falhas" value={pct(failed,total)} sub={`${failed} transações`} danger={failed>0} />
      </div>

      <div className="finance-grid health-grid">
        <section className={`finance-panel finance-health ${healthStatus}`}><header><div><b>Integridade operacional</b><small>Saúde consolidada do fluxo financeiro</small></div><strong>{score}%</strong></header><div className="health-meter"><i style={{width:`${score}%`}}/></div><div className="health-list"><HealthItem name="Pagamentos travados" value={(health||d?.health)?.stale_payments || 0}/><HealthItem name="Fulfillment com falha" value={(health||d?.health)?.failed_fulfillment || 0}/><HealthItem name="Jobs falhos" value={(health||d?.health)?.failed_jobs || 0}/><HealthItem name="Falhas de repasse" value={(health||d?.health)?.payout_failures || 0}/><HealthItem name="Erros API / 1h" value={(health||d?.health)?.recent_api_errors || 0}/></div></section>
        <section className="finance-panel"><header><div><b>Cutinapp · operação comercial</b><small>Visão real das compras já registradas</small></div></header><div className="commerce-grid"><MiniMetric name="Pedidos" value={commerce.orders}/><MiniMetric name="Pedidos pagos" value={commerce.paid_orders}/><MiniMetric name="Conversão" value={`${Number(commerce.conversion_rate||0).toFixed(1)}%`}/><MiniMetric name="Ingressos vendidos" value={commerce.ticket_units}/><MiniMetric name="Passes emitidos" value={commerce.issued_passes}/><MiniMetric name="Itens vendidos" value={commerce.item_units}/></div></section>
      </div>

      <section className="finance-panel"><header><div><b>Central de alertas</b><small>Anomalias que exigem ação administrativa</small></div><span className="alert-count">{d?.alerts?.length || 0}</span></header><div className="finance-alerts">{d?.alerts?.length ? d.alerts.map((a,i)=><div className={`finance-alert ${a.severity}`} key={`${a.title}-${i}`}><b>{a.title}</b><span>{a.message}</span></div>) : <div className="finance-alert ok"><b>Operação nominal</b><span>Nenhum alerta crítico detectado agora.</span></div>}</div></section>

      <section className="finance-panel"><header><div><b>Filtros de investigação</b><small>Corte os dados por aplicação, gateway, método, status e período</small></div><button onClick={()=>setF({app_slug:'',provider:'',status:'',method:'',from:'',to:''})}>Limpar</button></header><div className="finance-filters"><input placeholder="Aplicação (slug)" value={f.app_slug} onChange={e=>setF({...f,app_slug:e.target.value})}/><input placeholder="Gateway / provedor" value={f.provider} onChange={e=>setF({...f,provider:e.target.value})}/><select value={f.method} onChange={e=>setF({...f,method:e.target.value})}><option value="">Todos os métodos</option><option value="pix">PIX</option><option value="card">Cartão</option></select><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="">Todos os status</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="in_process">Processando</option><option value="failed">Falhou</option><option value="rejected">Rejeitado</option><option value="cancelled">Cancelado</option><option value="refunded">Estornado</option><option value="charged_back">Chargeback</option></select><input type="date" value={f.from} onChange={e=>setF({...f,from:e.target.value})}/><input type="date" value={f.to} onChange={e=>setF({...f,to:e.target.value})}/></div></section>

      <div className="finance-grid"><Panel title="Performance por aplicação" subtitle="Quem movimenta o ecossistema"><Table heads={['Aplicação','Tx','Aprov.','Falhas','Bruto','Receita','Líquido']} rows={d?.applications?.map(x=>[x.application_name||x.app_slug,x.transactions,x.approved,x.failed,money(x.gross),money(x.platform_fees),money(x.seller_net)])}/></Panel><Panel title="Gateways" subtitle="Performance dos processadores"><Table heads={['Gateway','Tx','Aprov.','Falhas','Sucesso','Custo']} rows={d?.providers?.map(x=>[x.provider,x.transactions,x.approved,x.failed,`${Number(x.success_rate||0).toFixed(1)}%`,money(x.provider_fees)])}/></Panel></div>

      <div className="finance-grid"><Panel title="Métodos de pagamento" subtitle="PIX, cartão e demais canais"><Table heads={['Método','Tx','Aprov.','Falhas','Volume']} rows={d?.methods?.map(x=>[label(x.method),x.transactions,x.approved,x.failed,money(x.gross)])}/></Panel><Panel title="Economia Cutinapp" subtitle="Venda aprovada e obrigações"><Table heads={['Indicador','Valor']} rows={[[ 'GMV pago', money(commerce.paid_gross) ],['Receita plataforma',money(commerce.platform_revenue)],['Líquido produtor',money(commerce.producer_net)],['Pedidos cancelados',commerce.cancelled_orders||0],['Estornos',commerce.refunded_orders||0]]}/></Panel></div>

      <Panel title="Fluxo financeiro · 30 dias" subtitle="GMV diário e intensidade transacional"><div className="finance-chart">{d?.timeline?.map(x=>{const max=Math.max(...(d.timeline||[]).map(i=>Number(i.gross||0)),1);return <div className="finance-bar" key={x.day} title={`${x.day} · ${money(x.gross)} · ${x.transactions} tx`}><span style={{height:`${Math.max(4,(Number(x.gross)/max)*100)}%`}}/><small>{String(x.day).slice(5)}</small></div>})}</div></Panel>
    </>}

    {tab === 'sales' && <>
      <div className="finance-kpis compact"><Kpi title="Pedidos" value={commerce.orders||0} sub="checkouts criados"/><Kpi title="Pagos" value={commerce.paid_orders||0} sub={money(commerce.paid_gross)}/><Kpi title="Ingressos" value={commerce.ticket_units||0} sub={`${commerce.issued_passes||0} passes emitidos`} danger={Number(commerce.issued_passes||0)<Number(commerce.ticket_units||0)}/><Kpi title="Itens" value={commerce.item_units||0} sub="unidades vendidas"/><Kpi title="Receita" value={money(commerce.platform_revenue)} sub="Cutinapp"/><Kpi title="Conversão" value={`${Number(commerce.conversion_rate||0).toFixed(1)}%`} sub="pedido → pago"/></div>
      <Panel title={`Pedidos de venda · ${orders?.total || 0}`} subtitle="Cada checkout da Cutinapp com comprador, evento e produção"><div className="finance-table-wrap"><table><thead><tr><th>Data</th><th>Pedido</th><th>Comprador</th><th>Evento</th><th>Produção</th><th>Status</th><th>Ingressos</th><th>Itens</th><th>Total</th><th>Receita</th></tr></thead><tbody>{orders?.data?.length?orders.data.map(o=><tr key={o.id}><td>{fmt(o.created_at)}</td><td className="mono">{String(o.public_id).slice(0,12)}…</td><td><b>{String(o.buyer_name||'').trim()||'Cliente'}</b><small>{o.buyer_email}</small></td><td>{o.event_title||`#${o.event_id}`}</td><td>{o.production_name||`#${o.production_id}`}</td><td><Status value={o.status}/></td><td>{o.ticket_units||0}</td><td>{o.item_units||0}</td><td>{money(o.total)}</td><td>{money(o.platform_fee)}</td></tr>):<EmptyRow span={10}/>}</tbody></table></div></Panel>
    </>}

    {tab === 'transactions' && <>
      <section className="finance-panel"><header><div><b>Investigação de transações</b><small>Pagamento, gateway, status, taxas e origem</small></div><button onClick={()=>setF({app_slug:'',provider:'',status:'',method:'',from:'',to:''})}>Limpar filtros</button></header><div className="finance-filters"><input placeholder="Aplicação" value={f.app_slug} onChange={e=>setF({...f,app_slug:e.target.value})}/><input placeholder="Provedor" value={f.provider} onChange={e=>setF({...f,provider:e.target.value})}/><select value={f.method} onChange={e=>setF({...f,method:e.target.value})}><option value="">Método</option><option value="pix">PIX</option><option value="card">Cartão</option></select><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="">Status</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="failed">Falhou</option><option value="rejected">Rejeitado</option><option value="refunded">Estornado</option><option value="charged_back">Chargeback</option></select><input type="date" value={f.from} onChange={e=>setF({...f,from:e.target.value})}/><input type="date" value={f.to} onChange={e=>setF({...f,to:e.target.value})}/></div></section>
      <Panel title={`Transações · ${tx?.total || 0}`} subtitle="Clique em uma linha para inspecionar"><div className="finance-table-wrap"><table><thead><tr><th>Data</th><th>Aplicação</th><th>Gateway</th><th>ID gateway</th><th>Origem</th><th>Método</th><th>Status</th><th>Bruto</th><th>Peter</th><th>Gateway</th><th>Líquido</th></tr></thead><tbody>{tx?.data?.length?tx.data.map(t=><tr key={`${t.app_slug}-${t.id}`} onClick={()=>inspect(t)}><td>{fmt(t.created_at)}</td><td>{t.application_name||t.app_slug}</td><td>{t.provider}</td><td className="mono">{t.provider_payment_id||'—'}</td><td className="mono">{t.source_reference||'—'}</td><td>{String(t.method||'—').toUpperCase()}</td><td><Status value={t.status}/></td><td>{money(t.gross_amount)}</td><td>{money(t.platform_fee)}</td><td>{money(t.provider_fee)}</td><td>{money(t.seller_net)}</td></tr>):<EmptyRow span={11}/>}</tbody></table></div></Panel>
    </>}

    {tab === 'payouts' && <>
      <div className="finance-kpis compact"><Kpi title="Solicitações" value={po?.summary?.total||0} sub="histórico total"/><Kpi title="Pendentes" value={po?.summary?.pending||0} sub={money(po?.summary?.amount_pending)} danger={Number(po?.summary?.pending)>0}/><Kpi title="Pagas" value={po?.summary?.paid||0} sub={money(po?.summary?.amount_paid)}/><Kpi title="Falhas" value={po?.summary?.failed||0} sub="requer atenção" danger={Number(po?.summary?.failed)>0}/><Kpi title="Contas conectadas" value={`${(health||d?.health)?.connected_producer_accounts||0}/${(health||d?.health)?.producer_accounts||0}`} sub="Mercado Pago"/><Kpi title="Líquido produtores" value={money(s.totals?.seller_net)} sub="base econômica"/></div>
      <Panel title="Repasses e saques" subtitle="Controle de liquidação por produção"><Table heads={['Criado','Produção','Status','Valor','Referência']} rows={po?.data?.map(x=>[fmt(x.created_at),x.production_name||`#${x.production_id}`,label(x.status),money(x.amount||x.net_amount),x.public_id||x.id])}/></Panel>
    </>}

    {tab === 'health' && <>
      <section className={`finance-health-full ${healthStatus}`}><div className="health-orbit"><strong>{score}</strong><span>HEALTH SCORE</span></div><div><p>ECOSYSTEM PAYMENT RELIABILITY</p><h2>{label(healthStatus)}</h2><span>Indicador composto por pagamentos travados, emissão de ingressos, jobs, repasses e erros recentes da API.</span></div></section>
      <div className="ops-grid"><OpsCard title="Pagamentos travados" value={(health||d?.health)?.stale_payments||0} description="Pendentes há mais de 30 minutos" critical={(health||d?.health)?.stale_payments>0}/><OpsCard title="Fulfillment" value={(health||d?.health)?.failed_fulfillment||0} description="Pedidos pagos com emissão falha" critical={(health||d?.health)?.failed_fulfillment>0}/><OpsCard title="Jobs falhos" value={(health||d?.health)?.failed_jobs||0} description="Processamentos assíncronos quebrados" critical={(health||d?.health)?.failed_jobs>0}/><OpsCard title="Repasses falhos" value={(health||d?.health)?.payout_failures||0} description="Liquidações rejeitadas/canceladas" critical={(health||d?.health)?.payout_failures>0}/><OpsCard title="Erros API" value={(health||d?.health)?.recent_api_errors||0} description="Última hora" critical={(health||d?.health)?.recent_api_errors>5}/><OpsCard title="Contas produtor" value={`${(health||d?.health)?.connected_producer_accounts||0}/${(health||d?.health)?.producer_accounts||0}`} description="Conectadas ao processador" critical={false}/></div>
      <section className="finance-panel"><header><div><b>Checklist operacional</b><small>Critérios mínimos para uma operação financeira saudável</small></div></header><div className="checklist"><Check ok={!((health||d?.health)?.stale_payments)} text="Nenhum pagamento preso fora da janela normal"/><Check ok={!((health||d?.health)?.failed_fulfillment)} text="Todo pedido pago entrega os ingressos comprados"/><Check ok={!((health||d?.health)?.failed_jobs)} text="Fila assíncrona sem jobs permanentemente falhos"/><Check ok={!((health||d?.health)?.payout_failures)} text="Nenhum repasse em estado de falha"/><Check ok={Number(commerce.issued_passes||0)>=Number(commerce.ticket_units||0)} text="Quantidade emitida compatível com quantidade vendida"/><Check ok={score>=90} text="Health Score operacional acima de 90%"/></div></section>
    </>}

    {selected && <div className="finance-modal" onClick={()=>setSelected(null)}><article onClick={e=>e.stopPropagation()}><header><div><small>TRANSAÇÃO</small><h3>{money(selected.gross_amount)}</h3><span>{selected.application_name||selected.app_slug} · {selected.provider}</span></div><button onClick={()=>setSelected(null)}>×</button></header><dl>{Object.entries(selected).filter(([k])=>!['metadata','_source'].includes(k)).map(([k,v])=><div key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{String(v??'—')}</dd></div>)}</dl><h4>Contexto técnico</h4><pre>{typeof selected.metadata==='string'?selected.metadata:JSON.stringify(selected.metadata,null,2)}</pre>{selected._source&&<><h4>Origem Cutinapp</h4><pre>{JSON.stringify(selected._source,null,2)}</pre></>}</article></div>}
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
