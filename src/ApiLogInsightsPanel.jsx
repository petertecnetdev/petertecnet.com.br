import { useEffect, useMemo, useState } from 'react'
import './ApiLogInsightsPanel.css'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function tone(score) {
  if (score >= 90) return 'healthy'
  if (score >= 70) return 'attention'
  if (score >= 45) return 'unstable'
  return 'critical'
}

export default function ApiLogInsightsPanel({ request }) {
  const [range, setRange] = useState('24h')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    request(`/admin/ecosystem/log-insights?range=${range}`)
      .then(result => { if (alive) setData(result) })
      .catch(err => { if (alive) setError(err.message || 'Não foi possível interpretar os logs da API.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [range, request])

  const summary = data?.summary || {}
  const scoreTone = tone(Number(summary.health_score ?? 100))
  const topApplications = useMemo(() => data?.applications || [], [data])

  return <section className="api-log-insights">
    <header className="ali-header">
      <div>
        <span className="ali-eyebrow">INTELIGÊNCIA DOS LOGS DA API</span>
        <h2>O que os logs estão dizendo sobre o ecossistema</h2>
        <p>Os registros técnicos são agrupados por problema, aplicação e impacto para mostrar o que realmente merece atenção.</p>
      </div>
      <label>Período
        <select value={range} onChange={event => setRange(event.target.value)}>
          <option value="1h">Última hora</option>
          <option value="24h">Últimas 24 horas</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
      </label>
    </header>

    {loading && <div className="ali-state">Interpretando os logs da API…</div>}
    {error && <div className="ali-state ali-error">{error}</div>}

    {!loading && !error && <>
      <div className="ali-kpis">
        <article className={`ali-score ${scoreTone}`}><span>Saúde da API</span><b>{summary.health_score ?? 100}</b><small>{summary.health_label || 'Saudável'}</small></article>
        <article><span>Registros relevantes</span><b>{summary.entries ?? 0}</b><small>no período selecionado</small></article>
        <article><span>Erros</span><b>{summary.errors ?? 0}</b><small>falhas que exigem investigação</small></article>
        <article><span>Avisos</span><b>{summary.warnings ?? 0}</b><small>sinais de degradação</small></article>
        <article><span>Problemas críticos</span><b>{summary.critical_groups ?? 0}</b><small>grupos de falha distintos</small></article>
      </div>

      <div className="ali-grid">
        <article className="ali-card ali-narrative">
          <div className="ali-card-title"><div><span>RESUMO DIDÁTICO</span><h3>O que isso significa</h3></div></div>
          {(data?.narrative || []).map((text, index) => <p key={index}>{text}</p>)}
        </article>

        <article className="ali-card">
          <div className="ali-card-title"><div><span>IMPACTO POR APLICAÇÃO</span><h3>Onde os problemas aparecem</h3></div></div>
          <div className="ali-apps">
            {topApplications.length ? topApplications.map(app => <div key={app.name}><div><b>{app.name}</b><span>{app.count} registros</span></div><strong>{app.share}%</strong><i><em style={{ width: `${Math.min(100, app.share)}%` }} /></i></div>) : <p>Nenhuma aplicação concentrou registros relevantes.</p>}
          </div>
        </article>
      </div>

      <article className="ali-card ali-issues">
        <div className="ali-card-title"><div><span>PROBLEMAS AGRUPADOS</span><h3>Prioridade de investigação</h3></div><small>Eventos repetidos aparecem como um único problema.</small></div>
        <div className="ali-issue-list">
          {(data?.issues || []).length ? data.issues.map(issue => {
            const open = expanded === issue.fingerprint
            return <div className={`ali-issue ${issue.severity}`} key={issue.fingerprint}>
              <button type="button" onClick={() => setExpanded(open ? null : issue.fingerprint)}>
                <div className="ali-issue-main"><span className={`ali-severity ${issue.severity}`}>{issue.severity}</span><div><b>{issue.title}</b><p>{issue.explanation}</p></div></div>
                <div className="ali-issue-meta"><strong>{issue.count}×</strong><span>{formatDate(issue.last_seen)}</span><span>{open ? 'Fechar' : 'Detalhar'}</span></div>
              </button>
              {open && <div className="ali-issue-detail">
                <div className="ali-impact"><b>Impacto observado</b><p>{issue.impact}</p></div>
                <div className="ali-app-chips">{(issue.applications || []).map(app => <span key={app.name}>{app.name} · {app.count}</span>)}</div>
                <dl><div><dt>Primeira ocorrência</dt><dd>{formatDate(issue.first_seen)}</dd></div><div><dt>Última ocorrência</dt><dd>{formatDate(issue.last_seen)}</dd></div><div><dt>Nível do log</dt><dd>{issue.level}</dd></div><div><dt>Status HTTP</dt><dd>{issue.sample?.http_status || '—'}</dd></div></dl>
                <details><summary>Ver contexto técnico sanitizado</summary><pre>{issue.sample?.technical_excerpt || 'Sem contexto adicional.'}</pre></details>
              </div>}
            </div>
          }) : <div className="ali-empty">Nenhum problema relevante encontrado neste período.</div>}
        </div>
      </article>
    </>}
  </section>
}
