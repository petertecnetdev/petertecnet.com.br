import { useCallback, useEffect, useMemo, useState } from 'react'
import './ContentDiscoveryAdminPage.css'
import { blogArticles } from './marketingContent.js'
import {
  createAdminContent,
  deleteAdminContent,
  fetchAdminContent,
  fetchDiscoveryAnalytics,
  publishAdminContent,
  updateAdminContent,
} from './discoveryApi.js'

const emptyEditor = {
  application_id: '',
  type: 'article',
  status: 'draft',
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: '',
  tags: '',
  cluster: '',
  search_intent: '',
  seo_title: '',
  seo_description: '',
  cover_image: '',
  og_image: '',
  scheduled_at: '',
}

const localDateTime = value => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const apiDateTime = value => value ? new Date(value).toISOString() : null

function toEditor(entry) {
  return {
    ...emptyEditor,
    ...entry,
    application_id: entry.application_id || '',
    tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : '',
    scheduled_at: localDateTime(entry.scheduled_at),
  }
}

function toPayload(editor) {
  return {
    application_id: editor.application_id ? Number(editor.application_id) : null,
    type: editor.type,
    status: editor.status,
    title: editor.title.trim(),
    slug: editor.slug.trim() || null,
    excerpt: editor.excerpt.trim() || null,
    content: editor.content || null,
    category: editor.category.trim() || null,
    tags: editor.tags.split(',').map(tag => tag.trim()).filter(Boolean),
    cluster: editor.cluster.trim() || null,
    search_intent: editor.search_intent.trim() || null,
    seo_title: editor.seo_title.trim() || null,
    seo_description: editor.seo_description.trim() || null,
    cover_image: editor.cover_image.trim() || null,
    og_image: editor.og_image.trim() || null,
    scheduled_at: editor.status === 'scheduled' ? apiDateTime(editor.scheduled_at) : null,
    metadata: editor.metadata || null,
  }
}

function legacyBody(article) {
  const blocks = [article.intro]
  article.sections.forEach(section => {
    blocks.push(`## ${section.heading}`)
    ;(section.paragraphs || []).forEach(paragraph => blocks.push(paragraph))
    ;(section.bullets || section.points || []).forEach(point => blocks.push(`- ${typeof point === 'string' ? point : point?.text || point?.title || ''}`))
  })
  return blocks.filter(Boolean).join('\n\n')
}

function Metric({ label, value, hint }) {
  return <article className="content-metric"><span>{label}</span><strong>{value ?? 0}</strong>{hint && <small>{hint}</small>}</article>
}

function Funnel({ rows = [] }) {
  const max = Math.max(...rows.map(row => Number(row.total) || 0), 1)
  return <div className="content-funnel">{rows.map(row => <div key={row.stage}><div><strong>{String(row.stage).replaceAll('_', ' ')}</strong><span>{row.total}</span></div><i><b style={{ width: `${Math.max(4, (Number(row.total) / max) * 100)}%` }} /></i></div>)}</div>
}

export default function ContentDiscoveryAdminPage() {
  const [entries, setEntries] = useState([])
  const [applications, setApplications] = useState([])
  const [summary, setSummary] = useState({})
  const [analytics, setAnalytics] = useState(null)
  const [editor, setEditor] = useState(emptyEditor)
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [contentPayload, analyticsPayload] = await Promise.all([
        fetchAdminContent({ q: query || undefined, status: statusFilter || undefined }),
        fetchDiscoveryAnalytics({ days: 30 }).catch(() => null),
      ])
      const data = contentPayload?.data || {}
      setEntries(data.entries || [])
      setApplications(data.applications || [])
      setSummary(data.summary || {})
      if (analyticsPayload?.data) setAnalytics(analyticsPayload.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [query, statusFilter])

  useEffect(() => { load() }, [load])

  const selected = useMemo(() => entries.find(entry => entry.id === selectedId) || null, [entries, selectedId])
  const legacyMissing = useMemo(() => {
    const existing = new Set(entries.map(entry => entry.slug))
    return blogArticles.filter(article => !existing.has(article.slug))
  }, [entries])

  const choose = entry => {
    setSelectedId(entry.id)
    setEditor(toEditor(entry))
    setMessage('')
    setError('')
  }

  const createNew = () => {
    setSelectedId(null)
    setEditor(emptyEditor)
    setMessage('')
    setError('')
  }

  const save = async event => {
    event.preventDefault()
    if (!editor.title.trim()) return setError('Informe um título.')
    if (editor.status === 'scheduled' && !editor.scheduled_at) return setError('Informe a data do agendamento.')
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = toPayload(editor)
      const result = selectedId ? await updateAdminContent(selectedId, payload) : await createAdminContent(payload)
      setSelectedId(result?.data?.id || selectedId)
      setEditor(toEditor(result?.data || payload))
      setMessage(selectedId ? 'Conteúdo atualizado.' : 'Conteúdo criado.')
      await load()
    } catch (err) {
      setError(err.validation ? Object.values(err.validation).flat().join(' ') : err.message)
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      await publishAdminContent(selectedId)
      setMessage('Conteúdo publicado e disponível na API pública.')
      await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!selectedId || !window.confirm('Excluir este conteúdo?')) return
    setSaving(true)
    try {
      await deleteAdminContent(selectedId)
      createNew()
      setMessage('Conteúdo excluído.')
      await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const importLegacy = async () => {
    if (!legacyMissing.length) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      for (const article of legacyMissing) {
        await createAdminContent({
          type: 'article',
          status: 'published',
          title: article.title,
          slug: article.slug,
          excerpt: article.description,
          content: legacyBody(article),
          category: article.category,
          tags: [article.category, article.relatedPlatform].filter(Boolean),
          cluster: article.relatedPlatform || String(article.category).toLocaleLowerCase('pt-BR').replace(/\s+/g, '-'),
          search_intent: article.title,
          seo_title: article.seoTitle,
          seo_description: article.description,
          metadata: { related_platform: article.relatedPlatform, migrated_from: 'marketingContent.js' },
        })
      }
      setMessage(`${legacyMissing.length} artigos iniciais migrados para a API administrável.`)
      await load()
    } catch (err) {
      setError(`A migração foi interrompida: ${err.message}`)
      await load()
    } finally { setSaving(false) }
  }

  const a = analytics?.summary || {}
  return <main className="ecosystem-main content-admin">
    <header className="ecosystem-top content-admin-top"><div><p className="admin-kicker">Peter Tecnet Admin Center / Discovery</p><h1>Conteúdo, SEO e aquisição</h1><p>Publique conteúdo, organize clusters editoriais e acompanhe a jornada da busca até a conversão.</p></div><div className="top-actions"><button type="button" onClick={load}>Atualizar</button><a href="/" target="_blank" rel="noreferrer">Ver site ↗</a></div></header>

    {error && <div className="content-notice is-error" role="alert">{error}</div>}
    {message && <div className="content-notice is-success" role="status">{message}</div>}

    <section className="content-metrics" aria-label="Indicadores de aquisição">
      <Metric label="Conteúdos" value={summary.total} hint={`${summary.published || 0} publicados`} />
      <Metric label="Sessões / 30 dias" value={a.sessions} hint={`${a.page_views || 0} page views`} />
      <Metric label="Cliques em CTA" value={a.cta_clicks} hint={`${a.cta_rate || 0}% por page view`} />
      <Metric label="Conversões" value={a.conversions} hint={`${a.conversion_rate || 0}% das sessões`} />
    </section>

    <section className="content-admin-grid">
      <div className="content-panel content-library">
        <div className="content-panel-head"><div><p className="admin-kicker">BIBLIOTECA</p><h2>Conteúdos</h2></div><button type="button" className="content-primary" onClick={createNew}>+ Novo</button></div>
        <div className="content-filters"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conteúdo…" /><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">Todos os status</option><option value="draft">Rascunho</option><option value="scheduled">Agendado</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></div>
        {legacyMissing.length > 0 && <button type="button" className="content-migration" disabled={saving} onClick={importLegacy}><span>Importar artigos atuais</span><small>{legacyMissing.length} artigos da landing ainda estão somente no bundle. Migre-os para editar sem código.</small></button>}
        <div className="content-entry-list">{loading ? <p>Carregando…</p> : entries.length ? entries.map(entry => <button type="button" key={entry.id} className={selectedId === entry.id ? 'is-active' : ''} onClick={() => choose(entry)}><span><small>{entry.category || entry.type}</small><strong>{entry.title}</strong></span><em className={`is-${entry.status}`}>{entry.status}</em></button>) : <p>Nenhum conteúdo encontrado.</p>}</div>
      </div>

      <form className="content-panel content-editor" onSubmit={save}>
        <div className="content-panel-head"><div><p className="admin-kicker">EDITOR</p><h2>{selected ? 'Editar conteúdo' : 'Novo conteúdo'}</h2></div>{selected && <a href={`/blog/${selected.slug}`} target="_blank" rel="noreferrer">Visualizar ↗</a>}</div>
        <div className="content-form-grid">
          <label className="is-wide"><span>Título</span><input value={editor.title} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))} required /></label>
          <label><span>Aplicação</span><select value={editor.application_id} onChange={event => setEditor(current => ({ ...current, application_id: event.target.value }))}><option value="">Global / ecossistema</option>{applications.map(app => <option value={app.id} key={app.id}>{app.name}</option>)}</select></label>
          <label><span>Status</span><select value={editor.status} onChange={event => setEditor(current => ({ ...current, status: event.target.value }))}><option value="draft">Rascunho</option><option value="scheduled">Agendado</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
          <label><span>Tipo</span><select value={editor.type} onChange={event => setEditor(current => ({ ...current, type: event.target.value }))}><option value="article">Artigo</option><option value="guide">Guia</option><option value="page">Página</option><option value="case-study">Estudo de caso</option></select></label>
          <label><span>Slug</span><input value={editor.slug || ''} onChange={event => setEditor(current => ({ ...current, slug: event.target.value }))} placeholder="gerado automaticamente" /></label>
          {editor.status === 'scheduled' && <label><span>Publicar em</span><input type="datetime-local" value={editor.scheduled_at || ''} onChange={event => setEditor(current => ({ ...current, scheduled_at: event.target.value }))} /></label>}
          <label><span>Categoria</span><input value={editor.category || ''} onChange={event => setEditor(current => ({ ...current, category: event.target.value }))} /></label>
          <label><span>Cluster editorial</span><input value={editor.cluster || ''} onChange={event => setEditor(current => ({ ...current, cluster: event.target.value }))} placeholder="ex: catalogo-digital" /></label>
          <label className="is-wide"><span>Tags</span><input value={editor.tags || ''} onChange={event => setEditor(current => ({ ...current, tags: event.target.value }))} placeholder="seo, catálogo, qrcode" /></label>
          <label className="is-wide"><span>Intenção de busca</span><input value={editor.search_intent || ''} onChange={event => setEditor(current => ({ ...current, search_intent: event.target.value }))} placeholder="como criar catálogo digital para empresa" /></label>
          <label className="is-wide"><span>Resumo</span><textarea rows="3" value={editor.excerpt || ''} onChange={event => setEditor(current => ({ ...current, excerpt: event.target.value }))} /></label>
          <label className="is-wide"><span>Conteúdo</span><textarea className="content-body" rows="18" value={editor.content || ''} onChange={event => setEditor(current => ({ ...current, content: event.target.value }))} placeholder={'Texto livre. Use ## para subtítulos e - para listas.'} /></label>
        </div>
        <fieldset className="content-seo-fields"><legend>SEO e compartilhamento</legend><label><span>Title SEO</span><input value={editor.seo_title || ''} onChange={event => setEditor(current => ({ ...current, seo_title: event.target.value }))} /><small>{(editor.seo_title || editor.title).length}/68</small></label><label><span>Description SEO</span><textarea rows="3" value={editor.seo_description || ''} onChange={event => setEditor(current => ({ ...current, seo_description: event.target.value }))} /><small>{(editor.seo_description || editor.excerpt).length}/158</small></label><label><span>Imagem de capa</span><input value={editor.cover_image || ''} onChange={event => setEditor(current => ({ ...current, cover_image: event.target.value }))} placeholder="URL ou caminho de mídia" /></label><label><span>Open Graph customizado</span><input value={editor.og_image || ''} onChange={event => setEditor(current => ({ ...current, og_image: event.target.value }))} placeholder="vazio = card automático" /></label></fieldset>
        <div className="content-editor-actions"><button className="content-primary" disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar'}</button>{selectedId && editor.status !== 'published' && <button type="button" disabled={saving} onClick={publish}>Publicar agora</button>}{selectedId && <button className="is-danger" type="button" disabled={saving} onClick={remove}>Excluir</button>}</div>
      </form>
    </section>

    <section className="content-analytics-grid">
      <div className="content-panel"><div className="content-panel-head"><div><p className="admin-kicker">FUNIL</p><h2>Descoberta → conversão</h2></div><small>Últimos 30 dias</small></div><Funnel rows={analytics?.funnel || []} /></div>
      <div className="content-panel"><div className="content-panel-head"><div><p className="admin-kicker">ORIGEM</p><h2>Como as sessões chegam</h2></div></div><div className="content-source-list">{(analytics?.sources || []).map(row => <div key={row.source}><strong>{row.source}</strong><span>{row.sessions} sessões</span><b>{row.total} eventos</b></div>)}{!analytics?.sources?.length && <p>Os dados aparecem conforme as novas páginas recebem tráfego.</p>}</div></div>
    </section>
  </main>
}
