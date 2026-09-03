import { useCallback, useEffect, useMemo, useState } from 'react'
import './MarketingSettingsAdminPage.css'
import { createAdminContent, fetchAdminContent, publishAdminContent, updateAdminContent } from './discoveryApi.js'
import { marketingServices } from './marketingHubContent.js'

const CONFIG_SLUG = 'peter-home-settings'

const initial = {
  hero_badge: 'PETER TECNET',
  hero_title: 'Tecnologia para transformar uma necessidade em algo que funciona.',
  hero_excerpt: 'Criamos software, sites, aplicativos, automações, integrações e produtos digitais. Também resolvemos demandas menores quando você só precisa que uma tarefa digital seja feita de forma prática.',
  primary_cta_label: 'Conte o que você precisa',
  primary_cta_href: '/orcamento',
  secondary_cta_label: 'Conhecer serviços',
  secondary_cta_href: '#servicos',
  services_title: 'Serviços para quem precisa criar, melhorar ou resolver.',
  platforms_title: 'Também criamos e operamos nossas próprias plataformas.',
  cases_title: 'Não mostramos apenas serviços. Mostramos o que construímos.',
  catalog_title: 'Encontre algo pronto ou conte o que precisa.',
  blog_title: 'Guias e explicações para quem está buscando uma solução.',
  banner_text: '',
  banner_href: '/orcamento',
  contact_email: '',
  contact_whatsapp: '',
  featured_service_slugs: marketingServices.map(service => service.slug).join(', '),
  featured_platform_slugs: '',
  featured_article_slugs: '',
  featured_case_slugs: '',
}

const csv = value => Array.isArray(value) ? value.join(', ') : String(value || '')
const list = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean)

function fromEntry(entry) {
  const metadata = entry?.metadata || {}
  return {
    ...initial,
    ...metadata,
    hero_title: metadata.hero_title || entry?.title || initial.hero_title,
    hero_excerpt: metadata.hero_excerpt || entry?.excerpt || initial.hero_excerpt,
    featured_service_slugs: csv(metadata.featured_service_slugs || initial.featured_service_slugs),
    featured_platform_slugs: csv(metadata.featured_platform_slugs),
    featured_article_slugs: csv(metadata.featured_article_slugs),
    featured_case_slugs: csv(metadata.featured_case_slugs),
  }
}

function payload(form) {
  return {
    type: 'page',
    status: 'published',
    title: form.hero_title,
    slug: CONFIG_SLUG,
    excerpt: form.hero_excerpt,
    category: 'landing',
    cluster: 'home-config',
    tags: ['landing', 'marketing', 'peter-tecnet'],
    search_intent: 'Peter Tecnet',
    metadata: {
      ...form,
      featured_service_slugs: list(form.featured_service_slugs),
      featured_platform_slugs: list(form.featured_platform_slugs),
      featured_article_slugs: list(form.featured_article_slugs),
      featured_case_slugs: list(form.featured_case_slugs),
    },
  }
}

export default function MarketingSettingsAdminPage() {
  const [entry, setEntry] = useState(null)
  const [form, setForm] = useState(initial)
  const [applications, setApplications] = useState([])
  const [articles, setArticles] = useState([])
  const [cases, setCases] = useState([])
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setState('loading'); setError('')
    try {
      const response = await fetchAdminContent()
      const data = response?.data || {}
      const entries = data.entries || []
      const config = entries.find(candidate => candidate.slug === CONFIG_SLUG || candidate.cluster === 'home-config') || null
      setEntry(config)
      setForm(fromEntry(config))
      setApplications(data.applications || [])
      setArticles(entries.filter(candidate => candidate.type === 'article' && candidate.status === 'published'))
      setCases(entries.filter(candidate => candidate.type === 'case-study' && candidate.status === 'published'))
      setState('ready')
    } catch (err) { setError(err.message); setState('error') }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async event => {
    event.preventDefault(); setState('saving'); setMessage(''); setError('')
    try {
      const result = entry ? await updateAdminContent(entry.id, payload(form)) : await createAdminContent(payload(form))
      const saved = result?.data || entry
      if (saved?.id && saved.status !== 'published') await publishAdminContent(saved.id)
      setEntry(saved)
      setMessage('Landing atualizada. As alterações públicas entram sem precisar editar o React.')
      setState('ready')
    } catch (err) { setError(err.validation ? Object.values(err.validation).flat().join(' ') : err.message); setState('error') }
  }

  const platformHint = useMemo(() => applications.map(app => app.slug).filter(Boolean).join(', '), [applications])
  const articleHint = useMemo(() => articles.slice(0, 12).map(article => article.slug).join(', '), [articles])
  const caseHint = useMemo(() => cases.slice(0, 12).map(item => item.slug).join(', '), [cases])

  const field = (key, label, options = {}) => <label className={options.wide ? 'is-wide' : ''}><span>{label}</span>{options.textarea ? <textarea rows={options.rows || 4} value={form[key] || ''} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} placeholder={options.placeholder || ''} /> : <input value={form[key] || ''} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} placeholder={options.placeholder || ''} />}{options.help && <small>{options.help}</small>}</label>

  return <main className="ecosystem-main marketing-settings-admin">
    <header className="ecosystem-top marketing-settings-top"><div><p className="admin-kicker">Peter Tecnet Admin Center / Marketing</p><h1>Landing e apresentação comercial</h1><p>Controle textos principais, destaques, ordem de conteúdo, contatos, banners e chamadas sem alterar o código da landing.</p></div><div className="top-actions"><button type="button" onClick={load}>Atualizar</button><a href="/" target="_blank" rel="noreferrer">Ver landing ↗</a></div></header>
    {error && <div className="marketing-settings-notice is-error">{error}</div>}{message && <div className="marketing-settings-notice is-success">{message}</div>}

    <form className="marketing-settings-form" onSubmit={save}>
      <section className="marketing-settings-card"><div><p className="admin-kicker">TOPO</p><h2>Mensagem principal</h2></div><div className="marketing-settings-grid">{field('hero_badge', 'Selo')}{field('hero_title', 'Título principal', { wide: true, textarea: true, rows: 3 })}{field('hero_excerpt', 'Texto de apresentação', { wide: true, textarea: true, rows: 4 })}{field('primary_cta_label', 'CTA principal')}{field('primary_cta_href', 'Destino principal')}{field('secondary_cta_label', 'CTA secundário')}{field('secondary_cta_href', 'Destino secundário')}</div></section>

      <section className="marketing-settings-card"><div><p className="admin-kicker">SEÇÕES</p><h2>Títulos e ordem</h2></div><div className="marketing-settings-grid">{field('services_title', 'Título de serviços', { wide: true })}{field('featured_service_slugs', 'Serviços exibidos / ordem', { wide: true, textarea: true, rows: 3, help: `Slugs disponíveis: ${marketingServices.map(service => service.slug).join(', ')}` })}{field('platforms_title', 'Título de plataformas', { wide: true })}{field('featured_platform_slugs', 'Plataformas exibidas / ordem', { wide: true, textarea: true, rows: 2, help: platformHint || 'As plataformas cadastradas aparecerão aqui quando carregadas.' })}{field('cases_title', 'Título de cases', { wide: true })}{field('featured_case_slugs', 'Cases destacados / ordem', { wide: true, help: caseHint || 'Crie estudos de caso em Conteúdo.' })}{field('catalog_title', 'Título do catálogo', { wide: true })}{field('blog_title', 'Título do blog', { wide: true })}{field('featured_article_slugs', 'Artigos destacados / ordem', { wide: true, textarea: true, rows: 2, help: articleHint || 'Publique artigos no editor de conteúdo.' })}</div></section>

      <section className="marketing-settings-card"><div><p className="admin-kicker">CONTATO E CAMPANHA</p><h2>Banner e canais</h2></div><div className="marketing-settings-grid">{field('banner_text', 'Texto do banner', { wide: true })}{field('banner_href', 'Destino do banner')}{field('contact_email', 'E-mail comercial')}{field('contact_whatsapp', 'WhatsApp', { help: 'Número com DDD ou URL completa.' })}</div></section>

      <div className="marketing-settings-actions"><button className="content-primary" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Salvando…' : 'Salvar e publicar'}</button><a href="/admin/content">Gerenciar blog, páginas e cases ↗</a><a href="/admin/discovery">Ver aquisição e conversões ↗</a></div>
    </form>
  </main>
}
