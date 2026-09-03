import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminEstablishmentMedia.css'

const API = 'https://api.petertecnet.com.br/api'
const API_ORIGIN = 'https://api.petertecnet.com.br'
const TOKEN_KEY = 'token'
const MAX_IMAGE_SIZE = 20 * 1024 * 1024

function resolveAssetUrl(value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) return value
  return `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`
}

function formatFileSize(bytes = 0) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.body instanceof FormData ? 60000 : 20000)
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'

  try {
    const response = await fetch(`${API}${path}`, { ...options, signal: controller.signal, headers })
    const data = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
    }
    if (!response.ok) throw new Error(data?.error || data?.message || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a operação.')
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function locateEstablishmentEditor() {
  const heading = [...document.querySelectorAll('.admin-panel .panel-title h2')]
    .find(node => /^Editar estabelecimento #\d+/.test(node.textContent?.trim() || ''))
  if (!heading) return null
  const id = Number((heading.textContent || '').match(/#(\d+)/)?.[1])
  const form = heading.closest('.admin-panel')?.querySelector('form.form-grid')
  return id && form ? { id, form } : null
}

function filesForRole(files, role) {
  const aliases = role === 'logo' ? ['logo', 'avatar'] : ['background', 'cover', 'banner']
  return files
    .filter(file => aliases.includes(String(file.group || file.type || '').toLowerCase()))
    .sort((a, b) => Number(b.id) - Number(a.id))
}

function readEditorContext(formElement) {
  const labels = [...formElement.querySelectorAll('label')]
  const findLabel = prefix => labels.find(label => (label.childNodes?.[0]?.textContent || label.textContent || '').trim().startsWith(prefix))
  const name = findLabel('Nome fantasia')?.querySelector('input')?.value
    || findLabel('Razão social / nome')?.querySelector('input')?.value
    || ''
  const category = findLabel('Categoria')?.querySelector('input')?.value || ''
  const city = findLabel('Cidade')?.querySelector('input')?.value || ''
  const uf = findLabel('UF')?.querySelector('input')?.value || ''
  const appId = Number(findLabel('Aplicação principal')?.querySelector('select')?.value) || 0
  return { name, category, city, uf, appId }
}

function ImageDropzone({ role, title, description, imageUrl, selectedFile, markedForRemoval, saving, onChoose, onRemove, onUndo }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const isLogo = role === 'logo'

  function acceptDrop(event) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) onChoose(role, file)
  }

  return <article className={`media-control-card ${dragging ? 'is-dragging' : ''} ${markedForRemoval ? 'is-removing' : ''}`}>
    <div className={`media-control-preview ${isLogo ? 'is-logo' : 'is-cover'}`}>
      {imageUrl && !markedForRemoval
        ? <img src={imageUrl} alt={`Prévia de ${title.toLowerCase()}`} />
        : <div className="media-empty-state"><span>{isLogo ? 'L' : '▭'}</span><small>{markedForRemoval ? 'Será removida' : `Sem ${title.toLowerCase()}`}</small></div>}
      {selectedFile && <span className="media-new-badge">Nova</span>}
    </div>

    <div className="media-control-content">
      <div className="media-control-title"><div><b>{title}</b><p>{description}</p></div><span>{isLogo ? '1:1' : '16:9'}</span></div>

      {selectedFile && <div className="media-file-selected"><span>Arquivo selecionado</span><b>{selectedFile.name}</b><small>{formatFileSize(selectedFile.size)}</small></div>}
      {markedForRemoval && <div className="media-removal-message">Esta imagem será removida quando você salvar as alterações.</div>}

      <div
        className="media-dropzone"
        onDragEnter={event => { event.preventDefault(); setDragging(true) }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={acceptDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
      >
        <strong>{selectedFile ? 'Escolher outro arquivo' : imageUrl ? `Trocar ${title.toLowerCase()}` : `Adicionar ${title.toLowerCase()}`}</strong>
        <small>Arraste uma imagem aqui ou clique para selecionar</small>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) onChoose(role, file)
            event.target.value = ''
          }}
          disabled={saving}
        />
      </div>

      <div className="media-control-actions">
        {(selectedFile || markedForRemoval) && <button type="button" onClick={() => onUndo(role)} disabled={saving}>Desfazer alteração</button>}
        {!selectedFile && imageUrl && !markedForRemoval && <button type="button" className="danger-text" onClick={() => onRemove(role)} disabled={saving}>Remover imagem</button>}
      </div>
    </div>
  </article>
}

function EstablishmentMediaEditor({ establishmentId, formElement }) {
  const [files, setFiles] = useState([])
  const [logoFile, setLogoFile] = useState(null)
  const [backgroundFile, setBackgroundFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [backgroundPreview, setBackgroundPreview] = useState('')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [removeBackground, setRemoveBackground] = useState(false)
  const [context, setContext] = useState(() => readEditorContext(formElement))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const previewUrls = useRef({ logo: '', background: '' })
  const bypassNextSubmit = useRef(false)

  const logoFiles = useMemo(() => filesForRole(files, 'logo'), [files])
  const backgroundFiles = useMemo(() => filesForRole(files, 'background'), [files])
  const currentLogo = logoFiles[0] || null
  const currentBackground = backgroundFiles[0] || null
  const logoUrl = removeLogo ? '' : (logoPreview || resolveAssetUrl(currentLogo?.public_url))
  const backgroundUrl = removeBackground ? '' : (backgroundPreview || resolveAssetUrl(currentBackground?.public_url))
  const hasPendingMedia = !!logoFile || !!backgroundFile || removeLogo || removeBackground
  const location = [context.city, context.uf].filter(Boolean).join(' / ')

  async function loadFiles() {
    setLoading(true)
    try {
      const data = await apiRequest(`/file/list-by-entity?entity_id=${establishmentId}&entity_name=establishment`)
      setFiles(Array.isArray(data?.files) ? data.files : [])
    } catch (loadError) {
      setError(`Não foi possível carregar as imagens atuais: ${loadError.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [establishmentId])

  useEffect(() => {
    const syncContext = () => setContext(readEditorContext(formElement))
    syncContext()
    formElement.addEventListener('input', syncContext)
    formElement.addEventListener('change', syncContext)
    return () => {
      formElement.removeEventListener('input', syncContext)
      formElement.removeEventListener('change', syncContext)
    }
  }, [formElement])

  useEffect(() => () => {
    Object.values(previewUrls.current).forEach(url => { if (url) URL.revokeObjectURL(url) })
  }, [])

  function clearPreview(role) {
    const previousUrl = previewUrls.current[role]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    previewUrls.current[role] = ''
    if (role === 'logo') {
      setLogoFile(null)
      setLogoPreview('')
    } else {
      setBackgroundFile(null)
      setBackgroundPreview('')
    }
  }

  function chooseImage(role, selected) {
    setError('')
    setSuccess('')
    if (!selected?.type?.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido (PNG, JPG, WEBP ou GIF).')
      return
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setError('A imagem deve ter no máximo 20 MB.')
      return
    }

    clearPreview(role)
    const previewUrl = URL.createObjectURL(selected)
    previewUrls.current[role] = previewUrl

    if (role === 'logo') {
      setLogoFile(selected)
      setLogoPreview(previewUrl)
      setRemoveLogo(false)
    } else {
      setBackgroundFile(selected)
      setBackgroundPreview(previewUrl)
      setRemoveBackground(false)
    }
  }

  function markRemoval(role) {
    clearPreview(role)
    if (role === 'logo') setRemoveLogo(true)
    else setRemoveBackground(true)
    setError('')
    setSuccess('')
  }

  function undoChange(role) {
    clearPreview(role)
    if (role === 'logo') setRemoveLogo(false)
    else setRemoveBackground(false)
    setError('')
    setSuccess('')
  }

  async function uploadImage(role, imageFile) {
    if (!context.appId) throw new Error('Selecione uma aplicação principal antes de salvar as imagens.')
    const body = new FormData()
    body.append('app_id', String(context.appId))
    body.append('entity_id', String(establishmentId))
    body.append('entity_name', 'establishment')
    body.append('group', role)
    body.append('is_primary', '1')
    body.append('position', role === 'logo' ? '0' : '1')
    body.append('visibility', 'public')
    body.append('file', imageFile)
    return apiRequest('/file', { method: 'POST', body })
  }

  async function removeFiles(roleFiles) {
    if (!roleFiles.length) return
    await Promise.all(roleFiles.map(file => apiRequest(`/file/${file.id}`, { method: 'DELETE' })))
  }

  async function persistMedia() {
    if (!hasPendingMedia) return true
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (logoFile) {
        await uploadImage('logo', logoFile)
        await removeFiles(logoFiles)
      } else if (removeLogo) {
        await removeFiles(logoFiles)
      }

      if (backgroundFile) {
        await uploadImage('background', backgroundFile)
        await removeFiles(backgroundFiles)
      } else if (removeBackground) {
        await removeFiles(backgroundFiles)
      }

      clearPreview('logo')
      clearPreview('background')
      setRemoveLogo(false)
      setRemoveBackground(false)
      await loadFiles()
      setSuccess('Identidade visual atualizada com sucesso.')
      return true
    } catch (saveError) {
      setError(saveError.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const interceptSubmit = async event => {
      if (bypassNextSubmit.current) {
        bypassNextSubmit.current = false
        return
      }
      if (!hasPendingMedia || saving) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      const saved = await persistMedia()
      if (saved) {
        bypassNextSubmit.current = true
        formElement.requestSubmit()
      }
    }

    formElement.addEventListener('submit', interceptSubmit, true)
    return () => formElement.removeEventListener('submit', interceptSubmit, true)
  }, [formElement, hasPendingMedia, saving, logoFile, backgroundFile, removeLogo, removeBackground, context.appId, files])

  return <section className="wide establishment-media-editor" aria-label="Identidade visual do estabelecimento">
    <header className="media-editor-header">
      <div>
        <span className="media-editor-eyebrow">Identidade visual</span>
        <h3>Logo e capa do estabelecimento</h3>
        <p>Escolha as imagens e confira o resultado antes de salvar o cadastro.</p>
      </div>
      <div className={`media-editor-state ${hasPendingMedia ? 'pending' : loading ? 'loading' : 'saved'}`}>
        <i />
        {loading ? 'Carregando' : hasPendingMedia ? 'Alterações pendentes' : 'Tudo salvo'}
      </div>
    </header>

    <div className={`brand-live-preview ${!backgroundUrl ? 'without-cover' : ''}`} style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}>
      <div className="brand-live-preview__shade" />
      <div className="brand-live-preview__toolbar"><span>Prévia pública</span><small>Atualiza enquanto você edita</small></div>
      <div className="brand-live-preview__identity">
        <div className={`brand-live-preview__logo ${!logoUrl ? 'empty' : ''}`}>
          {logoUrl ? <img src={logoUrl} alt="Prévia da logo" /> : <span>LOGO</span>}
        </div>
        <div className="brand-live-preview__text">
          <small>{context.category || 'Estabelecimento'}</small>
          <strong>{context.name || `Estabelecimento #${establishmentId}`}</strong>
          {location && <span>{location}</span>}
        </div>
      </div>
    </div>

    <div className="media-guidance">
      <div><b>Logo</b><span>Prefira imagem quadrada, com fundo transparente e boa margem interna.</span></div>
      <div><b>Capa</b><span>Prefira imagem horizontal em alta resolução. O centro da imagem deve conter o assunto principal.</span></div>
    </div>

    <div className="media-controls-grid">
      <ImageDropzone
        role="logo"
        title="Logo"
        description="Usada para identificar o estabelecimento em cartões, perfis e catálogos."
        imageUrl={logoUrl}
        selectedFile={logoFile}
        markedForRemoval={removeLogo}
        saving={saving}
        onChoose={chooseImage}
        onRemove={markRemoval}
        onUndo={undoChange}
      />
      <ImageDropzone
        role="background"
        title="Capa"
        description="Imagem de destaque exibida no topo da apresentação do estabelecimento."
        imageUrl={backgroundUrl}
        selectedFile={backgroundFile}
        markedForRemoval={removeBackground}
        saving={saving}
        onChoose={chooseImage}
        onRemove={markRemoval}
        onUndo={undoChange}
      />
    </div>

    {error && <div className="notice error establishment-media-notice">{error}</div>}
    {success && <div className="notice success establishment-media-notice">{success}</div>}

    <footer className={`media-save-hint ${hasPendingMedia ? 'visible' : ''}`}>
      <div><i /><span><b>Há alterações de imagem ainda não salvas.</b><small>Use o botão “Salvar alterações” no final do formulário. As imagens serão enviadas primeiro e os demais dados logo em seguida.</small></span></div>
      {saving && <strong>Enviando imagens…</strong>}
    </footer>
  </section>
}

export default function AdminEstablishmentMediaBridge() {
  const [editor, setEditor] = useState(null)

  useEffect(() => {
    let animationFrame = 0
    const sync = () => {
      const next = locateEstablishmentEditor()
      setEditor(current => {
        if (!next && !current) return current
        if (next && current && next.id === current.id && next.form === current.form) return current
        return next
      })
    }
    const scheduleSync = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  if (!editor) return null
  return createPortal(<EstablishmentMediaEditor key={editor.id} establishmentId={editor.id} formElement={editor.form} />, editor.form)
}
