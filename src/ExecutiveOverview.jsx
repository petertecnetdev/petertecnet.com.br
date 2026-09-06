import { useAdminData } from './adminData.js'
import './ExecutiveOverview.css'

function n(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function compact(value) { return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n(value)) }
function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n(value)) }
function pct(value) { return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n(value))}%` }

function Metric({ label, value, detail, tone = '' }) {
  return <article className={`exec-metric ${tone}`}><small>{label}</small><b>{value}</b><span>{detail}</span></article>
}

function Action({ tone = 'normal', title, detail, page, onNavigate }) {
  return <button className={`exec-action ${tone}`} type="button" onClick={() => onNavigate(page)}><span/><div><b>{title}</b><small>{detail}</small></div><i>↗</i></button>
}

export default function ExecutiveOverview({ onNavigate }) {
  const { data, errors, updatedAt, realtimeState, lastSeenAt, retry } = useAdminData()
  const summary = data.dashboard?.summary || {}
  const financial = data.financial?.summary || {}
  const totals = financial.totals || {}
  const approved = financial.approved || {}
  const failed = financial.failed || {}
  const pending = financial.pending || {}
  const support = data.support || {}
  const telemetry = data.telemetry?.summary || {}
  const apps = data.dashboard?.applications || data.applications || []
  const timeline = data.financial?.timeline || []

  const today = new Date().toISOString().slice(0, 10)
  const revenueToday = timeline.filter(row => String(row?.day || '') === today).reduce((sum, row) => sum + n(row?.gross), 0)
  const revenue7d = timeline.slice(-7).reduce((sum, row) => sum + n(row?.gross), 0)
  const approvalRate = n(totals.transactions) ? (n(approved.count) / n(totals.transactions)) * 100 : 0
  const unhealthyApps = apps.filter(app => app?.is_active === false).length + n(telemetry.warning) + n(telemetry.down)
  const metrics = { revenueToday, revenue7d, approvalRate, unhealthyApps }

  let changesSinceLastVisit = 0
  if (lastSeenAt) {
    const threshold = new Date(lastSeenAt).getTime()
    const recentRows = data.activity?.activity || data.dashboard?.recent_activity || []
    changesSinceLastVisit = recentRows.filter(row => {
      const time = new Date(row?.created_at || row?.occurred_at || 0).getTime()
      return Number.isFinite(time) && time > threshold
    }).length
  }

  const actions = []
  if (n(failed.count)) actions.push({ tone: 'danger', title: `${compact(failed.count)} pagamento(s) falharam`, detail: `${money(failed.amount)} exigem investigação`, page: 'financial' })
  if (n(pending.count)) actions.push({ tone: 'warning', title: `${compact(pending.count)} pagamento(s) pendentes`, detail: `${money(pending.amount)} aguardando conclusão`, page: 'financial' })
  if (n(support.urgent)) actions.push({ tone: 'danger', title: `${compact(support.urgent)} chamado(s) urgente(s)`, detail: `${compact(support.unassigned)} sem responsável`, page: 'support' })
  if (n(telemetry.down)) actions.push({ tone: 'danger', title: `${compact(telemetry.down)} aplicação(ões) sem telemetria`, detail: `${compact(telemetry.alerts)} alertas de telemetria`, page: 'telemetry' })
  if (!actions.length) actions.push({ tone: 'success', title: 'Nenhum bloqueio crítico aberto', detail: 'Operação, suporte e telemetria sem urgências detectadas', page: 'operations' })

  const sourcesWithError = Object.keys(errors)

  return <section className="executive-overview" aria-label="Resumo executivo do Admin Center">
    <div className="exec-head">
      <div><p className="eyebrow">VISÃO EXECUTIVA</p><h2>O que precisa da sua atenção agora</h2><p>Receita, adoção, suporte e saúde técnica em uma leitura única.</p></div>
      <div className="exec-freshness"><span className={realtimeState === 'connected' ? 'live' : ''}/><div><small>{realtimeState === 'connected' ? 'TEMPO REAL' : 'SINCRONIZAÇÃO'}</small><b>{updatedAt ? `Atualizado ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Carregando'}</b></div></div>
    </div>

    {sourcesWithError.length > 0 && <div className="exec-source-warning"><span>!</span><div><b>{sourcesWithError.length} fonte(s) indisponível(is)</b><small>O painel preservou os demais dados; tente novamente sem recarregar a página.</small></div><button type="button" onClick={() => Promise.all(sourcesWithError.map(retry))}>Repetir fontes ↻</button></div>}

    <div className="exec-metrics-grid">
      <Metric label="Receita hoje" value={money(metrics.revenueToday)} detail={`${money(metrics.revenue7d)} nos últimos 7 dias`} tone="accent"/>
      <Metric label="Aprovação de pagamentos" value={pct(metrics.approvalRate)} detail={`${compact(approved.count)} aprovados de ${compact(totals.transactions)} transações`}/>
      <Metric label="Usuários ativos" value={compact(summary.active_users_today)} detail={`${compact(summary.active_users_7d)} em 7d · ${compact(summary.active_users_30d)} em 30d`}/>
      <Metric label="Novos usuários · 30d" value={compact(summary.new_users_30d)} detail={`${compact(summary.inactive_users_30d)} inativos no mesmo recorte`}/>
      <Metric label="Suporte ativo" value={compact(support.active)} detail={`${compact(support.urgent)} urgentes · ${compact(support.unassigned)} sem responsável`} tone={n(support.urgent) ? 'danger' : ''}/>
      <Metric label="Saúde das aplicações" value={`${Math.max(0, n(telemetry.active_applications) - n(telemetry.warning) - n(telemetry.down))}/${compact(telemetry.active_applications || summary.active_applications)}`} detail={`${compact(metrics.unhealthyApps)} sinais de atenção`} tone={metrics.unhealthyApps ? 'warning' : 'success'}/>
      <Metric label="Sessões frontend · 15min" value={compact(telemetry.active_sessions_15m)} detail={`${compact(telemetry.events_24h)} eventos · ${compact(telemetry.errors_24h)} erros em 24h`}/>
      <Metric label="Pedidos" value={compact(data.orders?.total)} detail="Total retornado pelo financeiro"/>
    </div>

    <div className="exec-decision-grid">
      <article className="exec-actions-panel"><header><div><small>PRIORIDADES</small><h3>Fila de decisão</h3></div><span>{actions.length}</span></header><div>{actions.slice(0, 5).map((action, index) => <Action {...action} onNavigate={onNavigate} key={`${action.page}-${index}`}/>)}</div></article>
      <article className="exec-context-panel"><header><small>DESDE SUA ÚLTIMA VISITA</small><h3>{lastSeenAt ? `${compact(changesSinceLastVisit)} movimento(s) recente(s)` : 'Primeira leitura registrada'}</h3></header><p>{lastSeenAt ? `Último acesso registrado em ${new Date(lastSeenAt).toLocaleString('pt-BR')}.` : 'A partir de agora o Admin Center destacará o que mudou entre suas visitas.'}</p><div className="exec-mini-grid"><span><small>Interações hoje</small><b>{compact(summary.interactions_today)}</b></span><span><small>Chamados criados hoje</small><b>{compact(support.created_today)}</b></span><span><small>Chamados resolvidos hoje</small><b>{compact(support.resolved_today)}</b></span><span><small>Alertas técnicos</small><b>{compact(telemetry.alerts)}</b></span></div></article>
    </div>
  </section>
}
