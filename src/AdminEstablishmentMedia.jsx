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
  const name = findLabel('Razão social / nome')?.querySelector('input')?.value || ''
  const appId = Number(findLabel('Aplicação principal')?.querySelector('select')?.value) || 0
  return { name, appId }
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

  function chooseImage(role, event) {
    const selected = event.target.files?.[0] || null
    if (!selected) return
    setError('')
    setSuccess('')
    if (!selected.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem para este campo.')
      event.target.value = ''
      return
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setError('A imagem deve ter no máximo 20 MB.')
      event.target.value = ''
      return
    }

    const previousUrl = previewUrls.current[role]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
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

  function resetSelection(role) {
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

  function toggleRemoval(role) {
    resetSelection(role)
    if (role === 'logo') setRemoveLogo(value => !value)
    else setRemoveBackground(value => !value)
    setError('')
    setSuccess('')
  }

  async function uploadImage(role, imageFile) {
    if (!context.appId) throw new Error('Selecione uma aplicação principal antes de salvar a logo ou o background.')
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
    await Promise.allSettled(roleFiles.map(file => apiRequest(`/file/${file.id}`, { method: 'DELETE' })))
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

      resetSelection('logo')
      resetSelection('background')
      setRemoveLogo(false)
      setRemoveBackground(false)
      await loadFiles()
      setSuccess('Logo e background atualizados com sucesso.')
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
    <div className="establishment-media-heading">
      <div><p className="subheading">Identidade visual</p><h3>Logo e imagem de background</h3></div>
      <span>{loading ? 'Carregando imagens…' : hasPendingMedia ? 'Prévia não salva' : 'Imagens atuais'}</span>
    </div>

    <div className="establishment-visual-preview" style={backgroundUrl ? { backgroundImage: `linear-gradient(rgba(2,8,13,.38),rgba(2,8,13,.78)), url("${backgroundUrl}")` } : undefined}>
      <div className="establishment-visual-preview__content">
        <div className="establishment-visual-preview__logo">{logoUrl ? <img src={logoUrl} alt="Prévia da logo" /> : <span>Sem logo</span>}</div>
        <div><small>Prévia do estabelecimento</small><strong>{context.name || `Estabelecimento #${establishmentId}`}</strong></div>
      </div>
    </div>

    <div className="establishment-media-grid">
      <article className="establishment-media-card">
        <div className="establishment-media-thumb logo">{logoUrl ? <img src={logoUrl} alt="Logo selecionada" /> : <span>Sem logo</span>}</div>
        <div className="establishment-media-card__body"><b>Logo</b><small>PNG, JPG, WEBP ou GIF · até 20 MB. A prévia aparece antes do envio.</small></div>
        <label className="establishment-file-button">Escolher nova logo<input type="file" accept="image/*" onChange={event=>chooseImage('logo',event)} disabled={saving}/></label>
        {(currentLogo || logoFile) && <button type="button" onClick={()=>toggleRemoval('logo')} disabled={saving}>{removeLogo ? 'Manter logo atual' : 'Remover logo'}</button>}
      </article>

      <article className="establishment-media-card">
        <div className="establishment-media-thumb background">{backgroundUrl ? <img src={backgroundUrl} alt="Background selecionado" /> : <span>Sem background</span>}</div>
        <div className="establishment-media-card__body"><b>Background / capa</b><small>Use uma imagem horizontal de boa resolução. A composição acima mostra como ficará.</small></div>
        <label className="establishment-file-button">Escolher novo background<input type="file" accept="image/*" onChange={event=>chooseImage('background',event)} disabled={saving}/></label>
        {(currentBackground || backgroundFile) && <button type="button" onClick={()=>toggleRemoval('background')} disabled={saving}>{removeBackground ? 'Manter background atual' : 'Remover background'}</button>}
      </article>
    </div>

    {error && <div className="notice error establishment-media-notice">{error}</div>}
    {success && <div className="notice success establishment-media-notice">{success}</div>}

    <div className="establishment-media-actions">
      <button type="button" className="primary" disabled={saving || !hasPendingMedia} onClick={persistMedia}>{saving ? 'Enviando imagens…' : 'Aplicar imagens agora'}</button>
      <small>{hasPendingMedia ? 'Você também pode usar “Salvar alterações”; as imagens serão enviadas antes dos demais dados.' : 'Escolha uma imagem para visualizar a alteração antes de salvar.'}</small>
    </div>
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
