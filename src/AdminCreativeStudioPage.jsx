import { useMemo, useState } from 'react'
import { generateMarketingImage } from './creativeApi.js'
import './AdminCreativeStudioPage.css'

const PURPOSES = [
  ['blog_cover', 'Capa de blog'],
  ['application_promo', 'Divulgação de aplicativo'],
  ['banner', 'Banner'],
  ['open_graph', 'Open Graph'],
  ['commercial_campaign', 'Campanha comercial'],
]

const STYLES = [
  ['technology', 'Tecnologia'],
  ['premium', 'Premium'],
  ['clean', 'Clean'],
  ['editorial', 'Editorial'],
  ['neon', 'Neon'],
  ['sunset', 'Vibrante'],
]

const FORMATS = [
  ['landscape', 'Paisagem'],
  ['cover', '16:9'],
  ['og', 'Open Graph'],
  ['post', 'Post 4:5'],
  ['story', 'Story 9:16'],
  ['square', 'Quadrado'],
]

function downloadDataUri(dataUri, filename) {
  const a = document.createElement('a')
  a.href = dataUri
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function AdminCreativeStudioPage() {
  const [form, setForm] = useState({
    purpose: 'blog_cover',
    subject: '',
    description: '',
    style: 'technology',
    format: 'landscape',
    audience: '',
    cta: '',
    brand_context: 'Peter Tecnet — tecnologia, software, automação e ecossistema de aplicativos.',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const canGenerate = useMemo(() => form.subject.trim().length >= 2 && !loading, [form.subject, loading])

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function submit(event) {
    event.preventDefault()
    if (!canGenerate) return
    setLoading(true)
    setError('')
    try {
      const data = await generateMarketingImage(form)
      setResult(data)
    } catch (err) {
      setError(err?.message || 'Falha ao gerar imagem.')
    } finally {
      setLoading(false)
    }
  }

  const image = result?.image?.data_uri || ''
  const purposeLabel = PURPOSES.find(([value]) => value === form.purpose)?.[1] || 'criativo'

  return (
    <main className="creative-studio-shell">
      <header className="creative-studio-header">
        <div>
          <p className="creative-studio-kicker">Peter Tecnet AI</p>
          <h1>Estúdio de Criativos</h1>
          <p>Gere imagens para blog, aplicativos, banners, Open Graph e campanhas comerciais usando a IA integrada da Peter Tecnet.</p>
        </div>
        <a className="creative-back" href="/">Voltar para a Landing</a>
      </header>

      <section className="creative-studio-grid">
        <form className="creative-panel creative-form" onSubmit={submit}>
          <div className="creative-field-row">
            <label>
              Tipo de peça
              <select value={form.purpose} onChange={e => update('purpose', e.target.value)}>
                {PURPOSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Formato
              <select value={form.format} onChange={e => update('format', e.target.value)}>
                {FORMATS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <label>
            Assunto principal
            <input value={form.subject} onChange={e => update('subject', e.target.value)} placeholder="Ex.: Conheça a Cutinapp" maxLength={180} />
          </label>

          <label>
            Conceito / mensagem
            <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Explique o que a imagem precisa comunicar." rows={5} maxLength={1200} />
          </label>

          <div className="creative-field-row">
            <label>
              Estilo visual
              <select value={form.style} onChange={e => update('style', e.target.value)}>
                {STYLES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Público
              <input value={form.audience} onChange={e => update('audience', e.target.value)} placeholder="Ex.: produtores de eventos" maxLength={240} />
            </label>
          </div>

          <label>
            Chamada para ação
            <input value={form.cta} onChange={e => update('cta', e.target.value)} placeholder="Ex.: Conheça agora" maxLength={180} />
          </label>

          <label>
            Contexto da marca / produto
            <textarea value={form.brand_context} onChange={e => update('brand_context', e.target.value)} rows={3} maxLength={500} />
          </label>

          {error && <div className="creative-error" role="alert">{error}</div>}

          <button className="creative-generate" type="submit" disabled={!canGenerate}>
            {loading ? 'Gerando com IA…' : 'Gerar imagem com IA'}
          </button>
          <p className="creative-note">A IA gera a arte sem texto. Títulos, logos e chamadas exatas continuam sob controle da Peter Tecnet.</p>
        </form>

        <section className="creative-panel creative-preview">
          <div className="creative-preview-heading">
            <div>
              <p className="creative-studio-kicker">Prévia</p>
              <h2>{result ? purposeLabel : 'Sua imagem aparecerá aqui'}</h2>
            </div>
            {image && (
              <button type="button" className="creative-download" onClick={() => downloadDataUri(image, `peter-tecnet-${form.purpose}.jpg`)}>
                Baixar JPG
              </button>
            )}
          </div>

          <div className={`creative-canvas ${image ? 'has-image' : ''}`}>
            {image ? <img src={image} alt={`Criativo de ${purposeLabel} gerado por IA`} /> : (
              <div className="creative-empty">
                <span>AI</span>
                <p>Defina o assunto, formato e estilo para criar a primeira peça.</p>
              </div>
            )}
          </div>

          {result && (
            <div className="creative-meta">
              <span>Provider: {result.image?.provider || 'IA'}</span>
              <span>Modelo: {result.image?.model || 'ativo'}</span>
              <span>Plano: {result.usage?.plan || 'free_guarded'}</span>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
