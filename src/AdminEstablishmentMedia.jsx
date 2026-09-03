import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminEstablishmentMedia.css'

const API = 'https://api.petertecnet.com.br/api'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const ROLE_ALIASES = {
  logo: new Set(['logo', 'avatar']),
  background: new Set(['background', 'cover', 'banner']),
}

const normalize = value => String(value || '').trim().toLowerCase()
const token = () => localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token')

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...options.headers,
    },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('petertecnet_admin_token')
  }
  if (!response.ok) throw new Error(data?.message || data?.error || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível atualizar a identidade visual.')
  return data
}

function directLabelText(label) {
  return [...label.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent)
    .join(' ')
    .trim()
}

function findLabel(form, name) {
  const wanted = normalize(name)
  return [...form.querySelectorAll('label')].find(label => normalize(directLabelText(label)).startsWith(wanted)) || null
}

function readContext(form) {
  const value = (name, selector = 'input,textarea,select') => findLabel(form, name)?.querySelector(selector)?.value?.trim?.() || ''
  return {
    name: value('Nome fantasia') || value('Razão social') || value('Nome'),
    category: value('Categoria'),
    city: value('Cidade'),
    uf: value('UF'),
    phone: value('Telefone'),
    website: value('Website'),
    instagram: value('Instagram'),
    description: value('Descrição', 'textarea'),
    appId: Number(value('Aplicação principal', 'select')) || 0,
  }
}

function ensureMediaSlot(form, establishmentId) {
  let slot = form.querySelector('.establishment-media-native-slot')
  if (slot) return slot

  slot = document.createElement('div')
  slot.className = 'wide establishment-media-native-slot'
  slot.dataset.establishmentMediaSlot = String(establishmentId)

  const description = findLabel(form, 'Descrição')
  if (description?.parentNode === form) description.insertAdjacentElement('afterend', slot)
  else {
    const actions = form.querySelector('.form-actions')
    if (actions?.parentNode === form) form.insertBefore(slot, actions)
    else form.appendChild(slot)
  }
  return slot
}

function locateEstablishmentEditor() {
  const forms = [...document.querySelectorAll('.ecosystem-main form.form-grid')]
  for (const form of forms) {
    if (!findLabel(form, 'Aplicação principal') || !findLabel(form, 'Nome fantasia')) continue
    const panel = form.closest('.admin-panel, section')
    const heading = panel?.querySelector('h2,h3,header b')?.textContent || ''
    const id = Number(heading.match(/Editar estabelecimento\s*#?(\d+)/i)?.[1])
    if (!id) continue
    return { id, form, slot: ensureMediaSlot(form, id) }
  }
  return null
}

function roleOf(file) {
  const group = normalize(file?.group)
  if (ROLE_ALIASES.logo.has(group)) return 'logo'
  if (ROLE_ALIASES.background.has(group)) return 'background'
  return null
}

function publicUrl(file) {
  return file?.public_url || file?.url || file?.path || ''
}

function newestForRole(files, role) {
  return [...files]
    .filter(file => roleOf(file) === role)
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0] || null
}

function validateImage(file) {
  if (!file) return ''
  if (!String(file.type || '').startsWith('image/')) return 'Selecione um arquivo de imagem.'
  if (file.size > MAX_IMAGE_BYTES) return 'A imagem deve ter no máximo 20 MB.'
  return ''
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Dropzone({ role, label, hint, currentUrl, file, objectUrl, removed, disabled, onFile, onRemove, onUndo }) {
  const inputRef = useRef(null)
  const preview = removed ? '' : (objectUrl || currentUrl)

  function accept(files) {
    const next = files?.[0]
    if (next) onFile(next)
  }

  return <article className={`establishment-media-card ${file ? 'has-new' : ''} ${removed ? 'is-removed' : ''}`}>
    <header>
      <div><span>{role === 'logo' ? 'LOGO' : 'CAPA'}</span><b>{label}</b></div>
      {file && <em>Nova imagem</em>}
      {removed && <em>Será removida</em>}
    </header>

    <button
      type="button"
      className={`establishment-media-drop ${preview ? 'has-preview' : ''}`}
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); accept(event.dataTransfer.files) }}
    >
      {preview ? <img src={preview} alt={`Prévia da ${label.toLowerCase()}`} /> : <span><i>＋</i><b>Adicionar {label.toLowerCase()}</b><small>Arraste uma imagem ou toque para escolher</small></span>}
    </button>

    <input ref={inputRef} type="file" accept="image/*" hidden onChange={event => accept(event.target.files)} />
    <p>{hint}</p>
    {file && <small className="establishment-media-file">{file.name} · {formatBytes(file.size)}</small>}
    <div className="establishment-media-card-actions">
      {!removed && <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>{preview ? 'Trocar imagem' : 'Escolher imagem'}</button>}
      {(currentUrl || file) && !removed && <button type="button" className="danger-lite" onClick={onRemove} disabled={disabled}>Remover</button>}
      {(file || removed) && <button type="button" onClick={onUndo} disabled={disabled}>Desfazer</button>}
    </div>
  </article>
}

function EstablishmentPublicPreview({ context, establishmentId, logoUrl, backgroundUrl }) {
  const location = [context.city, context.uf].filter(Boolean).join(' / ')
  return <section className="establishment-public-preview" aria-label="Prévia da página pública do estabelecimento">
    <header className="establishment-public-preview__heading">
      <div><span>PRÉVIA DA VIEW</span><h4>Como o cliente verá o estabelecimento</h4></div>
      <small>Atualização em tempo real, antes de salvar</small>
    </header>

    <div className="establishment-public-preview__browser">
      <div className="establishment-public-preview__browserbar"><i/><i/><i/><span>nexus.petertecnet.com.br/establishment/{establishmentId}</span></div>
      <div className={`establishment-public-preview__cover ${backgroundUrl ? '' : 'empty'}`} style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}>
        {!backgroundUrl && <span>CAPA DO ESTABELECIMENTO</span>}
      </div>
      <div className="establishment-public-preview__content">
        <div className={`establishment-public-preview__logo ${logoUrl ? '' : 'empty'}`}>
          {logoUrl ? <img src={logoUrl} alt="Logo do estabelecimento"/> : <span>LOGO</span>}
        </div>
        <div className="establishment-public-preview__identity">
          <span>{context.category || 'Categoria do estabelecimento'}</span>
          <h3>{context.name || `Estabelecimento #${establishmentId}`}</h3>
          <p>{location || 'Cidade / UF'}</p>
        </div>
        <div className="establishment-public-preview__actions">
          <button type="button" disabled={!context.phone}>Contato</button>
          <button type="button" disabled={!context.website}>Site</button>
          <button type="button" disabled={!context.instagram}>Instagram</button>
        </div>
        <section className="establishment-public-preview__about">
          <b>Sobre</b>
          <p>{context.description || 'A descrição do estabelecimento aparecerá aqui para apresentar a empresa, seus diferenciais e sua proposta ao cliente.'}</p>
        </section>
        <section className="establishment-public-preview__catalog">
          <header><div><b>Produtos e serviços</b><span>Área do catálogo vinculada ao estabelecimento</span></div><button type="button">Ver catálogo</button></header>
          <div><article><i/><span/><small/></article><article><i/><span/><small/></article><article><i/><span/><small/></article></div>
        </section>
      </div>
    </div>
  </section>
}

function EstablishmentMediaEditor({ establishmentId, formElement }) {
  const [files, setFiles] = useState([])
  const [logoFile, setLogoFile] = useState(null)
  const [backgroundFile, setBackgroundFile] = useState(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [backgroundRemoved, setBackgroundRemoved] = useState(false)
  const [context, setContext] = useState(() => readContext(formElement))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const bypassSubmit = useRef(false)

  const logoCurrent = useMemo(() => newestForRole(files, 'logo'), [files])
  const backgroundCurrent = useMemo(() => newestForRole(files, 'background'), [files])
  const logoObjectUrl = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : '', [logoFile])
  const backgroundObjectUrl = useMemo(() => backgroundFile ? URL.createObjectURL(backgroundFile) : '', [backgroundFile])
  const logoUrl = logoRemoved ? '' : (logoObjectUrl || publicUrl(logoCurrent))
  const backgroundUrl = backgroundRemoved ? '' : (backgroundObjectUrl || publicUrl(backgroundCurrent))
  const dirty = !!logoFile || !!backgroundFile || logoRemoved || backgroundRemoved

  useEffect(() => () => {
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl)
    if (backgroundObjectUrl) URL.revokeObjectURL(backgroundObjectUrl)
  }, [logoObjectUrl, backgroundObjectUrl])

  useEffect(() => {
    let active = true
    setLoading(true)
    api(`/file/list-by-entity?entity_id=${establishmentId}&entity_name=establishment`)
      .then(data => { if (active) setFiles(Array.isArray(data) ? data : (data?.data || data?.files || [])) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [establishmentId])

  useEffect(() => {
    const sync = () => setContext(readContext(formElement))
    formElement.addEventListener('input', sync)
    formElement.addEventListener('change', sync)
    sync()
    return () => {
      formElement.removeEventListener('input', sync)
      formElement.removeEventListener('change', sync)
    }
  }, [formElement])

  function choose(role, file) {
    const validation = validateImage(file)
    if (validation) { setError(validation); return }
    setError('')
    setMessage('')
    if (role === 'logo') { setLogoFile(file); setLogoRemoved(false) }
    else { setBackgroundFile(file); setBackgroundRemoved(false) }
  }

  function undo(role) {
    setError('')
    setMessage('')
    if (role === 'logo') { setLogoFile(null); setLogoRemoved(false) }
    else { setBackgroundFile(null); setBackgroundRemoved(false) }
  }

  function markRemove(role) {
    setError('')
    setMessage('')
    if (role === 'logo') { setLogoFile(null); setLogoRemoved(true) }
    else { setBackgroundFile(null); setBackgroundRemoved(true) }
  }

  async function deleteRole(role, exceptId = null) {
    const roleFiles = files.filter(file => roleOf(file) === role && Number(file.id) !== Number(exceptId))
    for (const file of roleFiles) await api(`/file/${file.id}`, { method: 'DELETE' })
  }

  async function uploadRole(role, file) {
    if (!file) return null
    const appId = Number(readContext(formElement).appId)
    if (!appId) throw new Error('Selecione uma aplicação principal antes de salvar a logo ou a capa.')
    const body = new FormData()
    body.append('app_id', String(appId))
    body.append('entity_id', String(establishmentId))
    body.append('entity_name', 'establishment')
    body.append('group', role)
    body.append('is_primary', '1')
    body.append('position', role === 'logo' ? '0' : '1')
    body.append('visibility', 'public')
    body.append('file', file)
    return api('/file', { method: 'POST', body })
  }

  async function persistMedia() {
    if (!dirty) return true
    setSaving(true)
    setError('')
    setMessage('')
    try {
      let newLogo = null
      let newBackground = null
      if (logoFile) newLogo = await uploadRole('logo', logoFile)
      if (backgroundFile) newBackground = await uploadRole('background', backgroundFile)

      if (logoRemoved) await deleteRole('logo')
      else if (logoFile) await deleteRole('logo', newLogo?.id || newLogo?.data?.id)
      if (backgroundRemoved) await deleteRole('background')
      else if (backgroundFile) await deleteRole('background', newBackground?.id || newBackground?.data?.id)

      const fresh = await api(`/file/list-by-entity?entity_id=${establishmentId}&entity_name=establishment`)
      setFiles(Array.isArray(fresh) ? fresh : (fresh?.data || fresh?.files || []))
      setLogoFile(null)
      setBackgroundFile(null)
      setLogoRemoved(false)
      setBackgroundRemoved(false)
      setMessage('Identidade visual pronta. Salvando os demais dados do estabelecimento…')
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onSubmit = async event => {
      if (bypassSubmit.current) { bypassSubmit.current = false; return }
      if (!dirty) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const ok = await persistMedia()
      if (!ok) return
      bypassSubmit.current = true
      formElement.requestSubmit()
    }
    formElement.addEventListener('submit', onSubmit, true)
    return () => formElement.removeEventListener('submit', onSubmit, true)
  })

  return <section className="establishment-media-editor">
    <header className="establishment-media-editor__title">
      <div><span>IDENTIDADE VISUAL</span><h3>Logo, capa e prévia da página do estabelecimento</h3><p>Adicione as imagens e confira em tempo real como a apresentação ficará antes de salvar.</p></div>
      <div className={`establishment-media-editor__state ${dirty ? 'pending' : ''}`}><i/>{dirty ? 'Alterações não salvas' : loading ? 'Carregando imagens…' : 'Sincronizado'}</div>
    </header>

    {error && <div className="establishment-media-notice error" role="alert">{error}</div>}
    {message && <div className="establishment-media-notice success">{message}</div>}

    <div className="establishment-media-grid">
      <Dropzone role="logo" label="Logo" hint="Recomendado: imagem quadrada 1:1, preferencialmente PNG ou WebP." currentUrl={publicUrl(logoCurrent)} file={logoFile} objectUrl={logoObjectUrl} removed={logoRemoved} disabled={loading || saving} onFile={file => choose('logo', file)} onRemove={() => markRemove('logo')} onUndo={() => undo('logo')} />
      <Dropzone role="background" label="Capa" hint="Recomendado: imagem horizontal 16:9, com boa leitura no centro da composição." currentUrl={publicUrl(backgroundCurrent)} file={backgroundFile} objectUrl={backgroundObjectUrl} removed={backgroundRemoved} disabled={loading || saving} onFile={file => choose('background', file)} onRemove={() => markRemove('background')} onUndo={() => undo('background')} />
    </div>

    <EstablishmentPublicPreview context={context} establishmentId={establishmentId} logoUrl={logoUrl} backgroundUrl={backgroundUrl} />

    <footer className="establishment-media-editor__footer">
      <div><b>{dirty ? 'Prévia ainda não publicada' : 'Identidade visual atual'}</b><span>{dirty ? 'Ao clicar em “Salvar alterações”, as imagens e os dados serão persistidos juntos.' : 'Troque a logo ou a capa acima para visualizar a nova composição.'}</span></div>
      {saving && <strong>Salvando imagens…</strong>}
    </footer>
  </section>
}

export default function AdminEstablishmentMediaBridge() {
  const [editor, setEditor] = useState(null)

  useEffect(() => {
    let currentKey = ''
    const sync = () => {
      const found = locateEstablishmentEditor()
      const key = found ? `${found.id}:${found.slot.dataset.establishmentMediaSlot}` : ''
      if (key !== currentKey) {
        currentKey = key
        setEditor(found)
      }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('popstate', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('popstate', sync)
    }
  }, [])

  if (!editor?.slot?.isConnected) return null
  return createPortal(<EstablishmentMediaEditor key={editor.id} establishmentId={editor.id} formElement={editor.form} />, editor.slot)
}
