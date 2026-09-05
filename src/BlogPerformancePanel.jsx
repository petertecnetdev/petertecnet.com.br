import './BlogPerformancePanel.css'

const number = value => new Intl.NumberFormat('pt-BR').format(Number(value) || 0)
const percent = value => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

function RankBadge({ rank, recommended }) {
  return <span className={`blog-rank-badge ${recommended ? 'is-instagram' : ''}`}>
    <strong>#{rank}</strong>
    {recommended && <em>Instagram</em>}
  </span>
}

function ResultMetric({ label, value, emphasis = false }) {
  return <div className={`blog-result-metric ${emphasis ? 'is-emphasis' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
}

export default function BlogPerformancePanel({ rows = [], periodDays = 30 }) {
  const recommended = rows.filter(row => row.instagram_recommended)

  return <section className="content-panel blog-performance-panel" aria-labelledby="blog-performance-title">
    <div className="content-panel-head blog-performance-head">
      <div>
        <p className="admin-kicker">BLOG / RESULTADOS</p>
        <h2 id="blog-performance-title">Quais conteúdos merecem ir para o Instagram</h2>
        <p>Ranking por alcance, leitura, cliques e conversões assistidas. Os três melhores entram na prioridade editorial do Instagram.</p>
      </div>
      <div className="blog-performance-period"><span>Período</span><strong>{periodDays} dias</strong></div>
    </div>

    <div className="blog-instagram-shortlist" aria-label="Prioridades para Instagram">
      <div className="blog-instagram-shortlist-copy">
        <span>PRÓXIMOS PARA O INSTAGRAM</span>
        <strong>{recommended.length ? `${recommended.length} conteúdos priorizados` : 'Aguardando dados suficientes'}</strong>
        <small>O ranking é recalculado automaticamente conforme chegam novas interações.</small>
      </div>
      <div className="blog-instagram-shortlist-items">
        {recommended.map(row => <a key={row.slug} href={`/blog/${row.slug}`} target="_blank" rel="noreferrer">
          <b>#{row.rank}</b>
          <span>{row.title}</span>
          <em>score {number(row.score)}</em>
        </a>)}
        {!recommended.length && <p>Assim que os artigos receberem tráfego, os vencedores aparecerão aqui.</p>}
      </div>
    </div>

    <div className="blog-performance-table" role="table" aria-label="Performance dos artigos">
      <div className="blog-performance-row is-header" role="row">
        <span>Conteúdo</span><span>Sessões</span><span>Views</span><span>CTA</span><span>Conversões</span><span>Score</span>
      </div>
      {rows.map(row => <article className={`blog-performance-row ${row.instagram_recommended ? 'is-instagram' : ''}`} role="row" key={row.slug}>
        <div className="blog-performance-title-cell">
          <RankBadge rank={row.rank} recommended={row.instagram_recommended} />
          <div>
            <a href={`/blog/${row.slug}`} target="_blank" rel="noreferrer">{row.title}</a>
            <small>{row.category || row.slug}</small>
          </div>
        </div>
        <ResultMetric label="Sessões" value={number(row.sessions)} />
        <ResultMetric label="Views" value={number(row.views)} />
        <ResultMetric label="CTA" value={`${number(row.cta_clicks)} · ${percent(row.cta_rate)}`} />
        <ResultMetric label="Conversões" value={`${number(row.assisted_conversions)} · ${percent(row.conversion_rate)}`} />
        <ResultMetric label="Score" value={number(row.score)} emphasis />
      </article>)}
      {!rows.length && <div className="blog-performance-empty">
        <strong>Ainda não há dados de leitura suficientes.</strong>
        <span>As métricas aparecerão automaticamente quando os artigos receberem visitas e interações.</span>
      </div>}
    </div>
  </section>
}
