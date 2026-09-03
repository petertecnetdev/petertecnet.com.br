import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API = 'https://api.petertecnet.com.br/api'
const API_ORIGIN = 'https://api.petertecnet.com.br'
const TOKEN_KEY = 'token'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const OPTIMIZED_IMAGE_MAX_WIDTH = 1600
const OPTIMIZED_IMAGE_MAX_HEIGHT = 1200

const emptyEstablishment = {
  name: '', fantasy: '', cnpj: '', type: '', category: '', phone: '', email: '', description: '',
  city: '', uf: '', cep: '', address: '', website_url: '', instagram_url: '', user_id: '', app_id: '', app_ids: [],
  is_published: true, is_approved: true, is_featured: false, is_cancelled: false,
}

const emptyItem = {
  name: '', entity_id: '', app_id: '', type: 'product', price: '', description: '', sku: '', category: '',
  subcategory: '', brand: '', duration: '', stock: '', discount: '', image: '', status: true, is_featured: false,
}

const emptyQuickUser = { name: '', email: '', app_id: '' }

const digits = value => String(value ?? '').replace(/\D+/g, '')
const normalizeText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim()
const clean = value => {
  const normalized = String(value ?? '').trim()
  return normalized === '' ? null : normalized
}

const fullName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
const establishmentName = item => item?.fantasy || item?.name || `Estabelecimento #${item?.id}`
const money = value => value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fileSize = bytes => bytes ? `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} MB` : '—'

function formatDocument(value) {
  const raw = digits(value).slice(0, 14)
  if (raw.length <= 11) {
    return raw
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return raw
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\/\d{4})(\d)/, '$1-$2')
}

function formatPhone(value) {
  const raw = digits(value).slice(0, 11)
  if (!raw) return ''
  if (raw.length <= 10) {
    return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

function formatCep(value) {
  return digits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

function formatMoneyInput(value) {
  const raw = String(value ?? '').replace(/[^\d,.]/g, '')
  if (!raw) return ''
  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  const separatorIndex = Math.max(lastComma, lastDot)
  let integerPart = separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw
  let decimalPart = separatorIndex >= 0 ? raw.slice(separatorIndex + 1).replace(/\D/g, '').slice(0, 2) : ''
  integerPart = integerPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0'
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const hadSeparator = separatorIndex >= 0
  return `${integerPart}${hadSeparator ? `,${decimalPart}` : ''}`
}

function parseMoneyInput(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return NaN
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  return Number(normalized)
}

function validateCpf(value) {
  const raw = digits(value)
  if (raw.length !== 11 || /^(\d)\1+$/.test(raw)) return false
  const calculate = length => {
    let sum = 0
    for (let i = 0; i < length; i += 1) sum += Number(raw[i]) * (length + 1 - i)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return calculate(9) === Number(raw[9]) && calculate(10) === Number(raw[10])
}

function validateCnpj(value) {
  const raw = digits(value)
  if (raw.length !== 14 || /^(\d)\1+$/.test(raw)) return false
  const calc = base => {
    let factor = base.length - 7
    let total = 0
    for (const char of base) {
      total += Number(char) * factor
      factor -= 1
      if (factor < 2) factor = 9
    }
    const remainder = total % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = calc(raw.slice(0, 12))
  const second = calc(raw.slice(0, 12) + first)
  return raw.endsWith(`${first}${second}`)
}

function documentIsValid(value) {
  const raw = digits(value)
  if (!raw) return true
  if (raw.length === 11) return validateCpf(raw)
  if (raw.length === 14) return validateCnpj(raw)
  return false
}

function absoluteAssetUrl(value) {
  if (!value) return ''
  try {
    return new URL(value, API_ORIGIN).href
  } catch {
    return value
  }
}

function currentItemImage(item) {
  if (item?.image) return absoluteAssetUrl(item.image)
  const primary = item?.files?.find(file => file.is_primary) || item?.files?.[0]
  return absoluteAssetUrl(primary?.public_url || '')
}

function linkedApplicationIds(establishment) {
  return [...new Set([
    ...(establishment?.applications || []).map(app => Number(app.id)),
    Number(establishment?.app_id),
  ].filter(Boolean))]
}

function normalizeEstablishment(item) {
  const appIds = linkedApplicationIds(item)
  return {
    ...emptyEstablishment,
    ...item,
    cnpj: formatDocument(item?.cnpj || ''),
    phone: formatPhone(item?.phone || ''),
    cep: formatCep(item?.cep || ''),
    user_id: item?.user_id || item?.user?.id || '',
    app_id: item?.app_id || item?.app?.id || item?.application?.id || appIds[0] || '',
    app_ids: appIds,
    is_published: !!item?.is_published,
    is_approved: !!item?.is_approved,
    is_featured: !!item?.is_featured,
    is_cancelled: !!item?.is_cancelled,
  }
}

function normalizeItem(item) {
  return {
    ...emptyItem,
    ...item,
    entity_id: item?.entity_id || item?.establishment?.id || '',
    app_id: item?.app_id || item?.establishment?.app_id || '',
    price: item?.price === null || item?.price === undefined ? '' : formatMoneyInput(String(item.price).replace('.', ',')),
    discount: item?.discount === null || item?.discount === undefined ? '' : formatMoneyInput(String(item.discount).replace('.', ',')),
    duration: item?.duration ?? '',
    stock: item?.stock ?? '',
    status: item?.status !== false,
    is_featured: !!item?.is_featured,
    image: currentItemImage(item),
  }
}

function serialize(value) {
  return JSON.stringify(value)
}

function splitName(name) {
  const parts = String(name || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  return { first_name: parts.shift() || '', last_name: parts.join(' ') || null }
}

function userById(users, id) {
  return users.find(user => Number(user.id) === Number(id))
}

function appById(applications, id) {
  return applications.find(app => Number(app.id) === Number(id))
}

function completeness(establishment, itemCount = 0) {
  const checks = [
    ['Nome', !!establishment?.name, 15],
    ['Nome fantasia', !!establishment?.fantasy, 8],
    ['Responsável', !!establishment?.user_id, 12],
    ['Aplicação', linkedApplicationIds(establishment).length > 0 || !!establishment?.app_id, 12],
    ['Telefone', digits(establishment?.phone).length >= 10, 10],
    ['E-mail', !!establishment?.email, 8],
    ['CEP e localidade', digits(establishment?.cep).length === 8 && !!establishment?.city && !!establishment?.uf, 10],
    ['Endereço', !!establishment?.address, 7],
    ['Descrição', String(establishment?.description || '').trim().length >= 40, 8],
    ['Site ou Instagram', !!establishment?.website_url || !!establishment?.instagram_url, 5],
    ['Primeiro item', itemCount > 0, 5],
  ]
  const score = checks.reduce((total, [, done, weight]) => total + (done ? weight : 0), 0)
  return { score, missing: checks.filter(([, done]) => !done).map(([label]) => label) }
}

function nameSimilarity(a, b) {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.92
  const leftTokens = new Set(left.split(' ').filter(token => token.length > 2))
  const rightTokens = new Set(right.split(' ').filter(token => token.length > 2))
  if (!leftTokens.size || !rightTokens.size) return 0
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length
  return intersection / Math.max(leftTokens.size, rightTokens.size)
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const data = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
      throw new Error('Sua sessão expirou. Entre novamente.')
    }
    if (!response.ok) {
      throw new Error(data?.error || data?.message || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a operação.')
    }
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function loadImageSource(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      return await createImageBitmap(file)
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem selecionada.')) }
    image.src = url
  })
}

async function optimizePhoto(file) {
  if (file.type === 'image/gif') return { file, originalBytes: file.size, optimizedBytes: file.size, optimized: false }
  const source = await loadImageSource(file)
  const sourceWidth = source.width || source.naturalWidth
  const sourceHeight = source.height || source.naturalHeight
  const targetRatio = 4 / 3
  let sourceX = 0
  let sourceY = 0
  let cropWidth = sourceWidth
  let cropHeight = sourceHeight
  if (sourceWidth / sourceHeight > targetRatio) {
    cropWidth = sourceHeight * targetRatio
    sourceX = (sourceWidth - cropWidth) / 2
  } else {
    cropHeight = sourceWidth / targetRatio
    sourceY = (sourceHeight - cropHeight) / 2
  }
  const scale = Math.min(1, OPTIMIZED_IMAGE_MAX_WIDTH / cropWidth, OPTIMIZED_IMAGE_MAX_HEIGHT / cropHeight)
  const width = Math.max(1, Math.round(cropWidth * scale))
  const height = Math.max(1, Math.round(cropHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Seu navegador não conseguiu preparar a imagem. Tente enviar outra foto.')
  context.drawImage(source, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height)
  if (typeof source.close === 'function') source.close()
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
  if (!blob) return { file, originalBytes: file.size, optimizedBytes: file.size, optimized: false }
  const baseName = (file.name || 'foto').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-') || 'foto'
  const optimizedFile = new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
  return { file: optimizedFile, originalBytes: file.size, optimizedBytes: optimizedFile.size, optimized: true, width, height }
}

function FormSection({ title, description, children, action }) {
  return <section className="aco-form-section">
    <div className="aco-section-heading"><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{action}</div>
    <div className="aco-form-grid">{children}</div>
  </section>
}

function Field({ label, value, onChange, onBlur, type = 'text', placeholder = '', required = false, wide = false, min, max, step, autoComplete, inputMode, hint }) {
  return <label className={wide ? 'aco-field aco-wide' : 'aco-field'}>
    <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
    <input type={type} value={value ?? ''} onChange={event => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} required={required} min={min} max={max} step={step} autoComplete={autoComplete} inputMode={inputMode}/>
    {hint && <small className="aco-field-hint">{hint}</small>}
  </label>
}

function Select({ label, value, onChange, children, required = false, wide = false, disabled = false }) {
  return <label className={wide ? 'aco-field aco-wide' : 'aco-field'}>
    <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
    <select value={value ?? ''} onChange={event => onChange(event.target.value)} required={required} disabled={disabled}>{children}</select>
  </label>
}

function Toggle({ label, detail, checked, onChange }) {
  return <label className={checked ? 'aco-toggle is-on' : 'aco-toggle'}>
    <input type="checkbox" checked={!!checked} onChange={event => onChange(event.target.checked)}/>
    <span><b>{label}</b><small>{detail}</small></span>
  </label>
}

function CompletenessCard({ value }) {
  return <div className="aco-completeness">
    <div className="aco-completeness-top"><span><b>{value.score}%</b> completo</span><small>{value.score >= 85 ? 'Pronto para operação' : 'Ainda há dados que enriquecem o cadastro'}</small></div>
    <div className="aco-progress"><i style={{ width: `${value.score}%` }}/></div>
    {value.missing.length > 0 && <p>Faltam: {value.missing.slice(0, 5).join(', ')}{value.missing.length > 5 ? '…' : ''}</p>}
  </div>
}

function HistoryCard({ record, users, title = 'Histórico operacional' }) {
  if (!record?.id) return null
  const creator = userById(users, record.created_by)
  const updater = userById(users, record.updated_by)
  return <section className="aco-history">
    <div><b>{title}</b><span>Rastreabilidade para a equipe Peter Tecnet</span></div>
    <dl>
      <div><dt>Criado</dt><dd>{dateTime(record.created_at)}</dd></div>
      <div><dt>Por</dt><dd>{creator ? fullName(creator) : record.created_by ? `Usuário #${record.created_by}` : 'Não informado'}</dd></div>
      <div><dt>Última edição</dt><dd>{dateTime(record.updated_at)}</dd></div>
      <div><dt>Por</dt><dd>{updater ? fullName(updater) : record.updated_by ? `Usuário #${record.updated_by}` : 'Não informado'}</dd></div>
    </dl>
  </section>
}

export default function AdminCommercialWorkspaceV2() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('guided')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [applications, setApplications] = useState([])
  const [users, setUsers] = useState([])
  const [establishments, setEstablishments] = useState([])
  const [items, setItems] = useState([])
  const [establishmentQuery, setEstablishmentQuery] = useState('')
  const [itemQuery, setItemQuery] = useState('')
  const [establishmentId, setEstablishmentId] = useState(null)
  const [establishmentForm, setEstablishmentForm] = useState(emptyEstablishment)
  const [itemId, setItemId] = useState(null)
  const [itemForm, setItemForm] = useState(emptyItem)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [photoMeta, setPhotoMeta] = useState(null)
  const [cepStatus, setCepStatus] = useState('')
  const [remoteDuplicates, setRemoteDuplicates] = useState([])
  const [quickUserOpen, setQuickUserOpen] = useState(false)
  const [quickUser, setQuickUser] = useState(emptyQuickUser)
  const [quickUserSaving, setQuickUserSaving] = useState(false)
  const [guidedActive, setGuidedActive] = useState(false)
  const [guidedStep, setGuidedStep] = useState(0)
  const [guided, setGuided] = useState({ user_id: '', app_id: '', establishment_id: '', item_ids: [] })
  const [guidedUserQuery, setGuidedUserQuery] = useState('')
  const [finalized, setFinalized] = useState(false)
  const cameraInput = useRef(null)
  const galleryInput = useRef(null)
  const lastCepLookup = useRef('')
  const establishmentSnapshot = useRef(serialize(emptyEstablishment))
  const itemSnapshot = useRef(serialize(emptyItem))

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [appsData, usersData, establishmentsData, itemsData] = await Promise.all([
        apiRequest('/admin/applications'),
        apiRequest('/admin/ecosystem/users'),
        apiRequest('/admin/ecosystem/establishments'),
        apiRequest('/admin/ecosystem/items'),
      ])
      setApplications(appsData?.applications || [])
      setUsers(usersData?.users || [])
      setEstablishments(establishmentsData?.establishments || [])
      setItems(itemsData?.items || itemsData?.data || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const isEstablishmentDirty = serialize(establishmentForm) !== establishmentSnapshot.current
  const isItemDirty = serialize(itemForm) !== itemSnapshot.current || !!photoFile
  const hasUnsavedChanges = open && (isEstablishmentDirty || isItemDirty) && mode !== 'guided'

  useEffect(() => {
    const handleBeforeUnload = event => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  function confirmDiscard() {
    if (!hasUnsavedChanges) return true
    return window.confirm('Existem alterações ainda não salvas. Deseja descartá-las?')
  }

  useEffect(() => {
    const handleAdminNavigation = event => {
      const button = event.target.closest?.('.ecosystem-sidebar nav button')
      const label = button?.textContent?.trim()
      if (label === 'Estabelecimentos') {
        if (!confirmDiscard()) return
        setGuidedActive(false)
        setMode('establishments')
        setOpen(true)
      }
      if (label === 'Itens') {
        if (!confirmDiscard()) return
        setGuidedActive(false)
        setMode('items')
        setOpen(true)
      }
    }
    document.addEventListener('click', handleAdminNavigation, true)
    return () => document.removeEventListener('click', handleAdminNavigation, true)
  })

  useEffect(() => {
    if (open) loadWorkspace()
  }, [open, loadWorkspace])

  useEffect(() => () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  useEffect(() => {
    const cep = digits(establishmentForm.cep)
    if (cep.length !== 8 || cep === lastCepLookup.current) return undefined
    const timer = window.setTimeout(async () => {
      lastCepLookup.current = cep
      setCepStatus('Consultando CEP…')
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('CEP indisponível')
        const data = await response.json()
        if (data?.erro) throw new Error('CEP não encontrado')
        setEstablishmentForm(current => ({
          ...current,
          cep: formatCep(cep),
          city: data.localidade || current.city,
          uf: data.uf || current.uf,
          address: current.address || [data.logradouro, data.bairro].filter(Boolean).join(', '),
        }))
        setCepStatus('Endereço preenchido automaticamente. Confira número e complemento.')
      } catch {
        setCepStatus('Não foi possível localizar o CEP automaticamente. Você pode preencher manualmente.')
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [establishmentForm.cep])

  useEffect(() => {
    if (mode !== 'establishments') return undefined
    const cnpj = digits(establishmentForm.cnpj)
    const phone = digits(establishmentForm.phone)
    const email = String(establishmentForm.email || '').trim().toLocaleLowerCase('pt-BR')
    const name = String(establishmentForm.name || '').trim()
    const search = cnpj.length >= 11 ? formatDocument(cnpj) : email.includes('@') ? email : phone.length >= 10 ? formatPhone(phone) : name.length >= 5 ? name : ''
    if (!search) {
      setRemoteDuplicates([])
      return undefined
    }
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiRequest(`/admin/ecosystem/establishments?search=${encodeURIComponent(search)}`)
        setRemoteDuplicates((result?.establishments || []).filter(item => Number(item.id) !== Number(establishmentId)))
      } catch {
        setRemoteDuplicates([])
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [mode, establishmentId, establishmentForm.name, establishmentForm.cnpj, establishmentForm.phone, establishmentForm.email])

  const filteredEstablishments = useMemo(() => {
    const query = normalizeText(establishmentQuery)
    if (!query) return establishments
    return establishments.filter(item => normalizeText(`${item.name || ''} ${item.fantasy || ''} ${item.cnpj || ''} ${item.user?.email || ''} ${item.city || ''}`).includes(query))
  }, [establishments, establishmentQuery])

  const filteredItems = useMemo(() => {
    const query = normalizeText(itemQuery)
    if (!query) return items
    return items.filter(item => normalizeText(`${item.name || ''} ${item.sku || ''} ${item.category || ''} ${establishmentName(item.establishment)}`).includes(query))
  }, [items, itemQuery])

  const guidedUsers = useMemo(() => {
    const query = normalizeText(guidedUserQuery)
    if (!query) return users.slice(0, 30)
    return users.filter(user => normalizeText(`${fullName(user)} ${user.email || ''}`).includes(query)).slice(0, 30)
  }, [users, guidedUserQuery])

  const selectedEstablishment = useMemo(() => establishments.find(item => Number(item.id) === Number(establishmentId)), [establishments, establishmentId])
  const selectedItem = useMemo(() => items.find(item => Number(item.id) === Number(itemId)), [items, itemId])
  const guidedUser = useMemo(() => userById(users, guided.user_id), [users, guided.user_id])
  const guidedApplication = useMemo(() => appById(applications, guided.app_id), [applications, guided.app_id])
  const guidedEstablishment = useMemo(() => establishments.find(item => Number(item.id) === Number(guided.establishment_id)), [establishments, guided.establishment_id])
  const guidedItems = useMemo(() => items.filter(item => Number(item.entity_id) === Number(guided.establishment_id)), [items, guided.establishment_id])
  const establishmentItems = useMemo(() => items.filter(item => Number(item.entity_id) === Number(establishmentId)), [items, establishmentId])
  const establishmentCompletion = useMemo(() => completeness(establishmentForm, establishmentItems.length), [establishmentForm, establishmentItems.length])
  const guidedCompletion = useMemo(() => completeness(guidedEstablishment || {}, guidedItems.length), [guidedEstablishment, guidedItems.length])

  const duplicateMatches = useMemo(() => {
    const cnpj = digits(establishmentForm.cnpj)
    const phone = digits(establishmentForm.phone)
    const email = String(establishmentForm.email || '').trim().toLocaleLowerCase('pt-BR')
    const name = establishmentForm.name
    const combined = [...establishments, ...remoteDuplicates]
    const seen = new Set()
    return combined.filter(item => {
      if (!item?.id || Number(item.id) === Number(establishmentId) || seen.has(Number(item.id))) return false
      seen.add(Number(item.id))
      const exactCnpj = cnpj.length >= 11 && digits(item.cnpj) === cnpj
      const exactPhone = phone.length >= 10 && digits(item.phone) === phone
      const exactEmail = email && String(item.email || '').trim().toLocaleLowerCase('pt-BR') === email
      const similarName = String(name || '').trim().length >= 5 && nameSimilarity(item.name || item.fantasy, name) >= 0.72
      return exactCnpj || exactPhone || exactEmail || similarName
    }).slice(0, 5)
  }, [establishments, remoteDuplicates, establishmentId, establishmentForm.cnpj, establishmentForm.phone, establishmentForm.email, establishmentForm.name])

  const exactDocumentDuplicate = duplicateMatches.some(item => digits(item.cnpj) && digits(item.cnpj) === digits(establishmentForm.cnpj))

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function switchMode(nextMode) {
    if (nextMode === mode) return
    if (!confirmDiscard()) return
    resetMessages()
    setMode(nextMode)
  }

  function requestClose() {
    if (saving || quickUserSaving || photoProcessing) return
    if (!confirmDiscard()) return
    setOpen(false)
  }

  function startNewEstablishment(prefill = {}) {
    resetMessages()
    setEstablishmentId(null)
    const next = { ...emptyEstablishment, ...prefill, app_ids: [...(prefill.app_ids || [])] }
    setEstablishmentForm(next)
    establishmentSnapshot.current = serialize(next)
    setRemoteDuplicates([])
    setCepStatus('')
  }

  function editEstablishment(item) {
    if (!confirmDiscard()) return
    resetMessages()
    setEstablishmentId(item.id)
    const next = normalizeEstablishment(item)
    setEstablishmentForm(next)
    establishmentSnapshot.current = serialize(next)
    setRemoteDuplicates([])
    setCepStatus('')
  }

  function updateEstablishmentField(field, value) {
    setEstablishmentForm(current => ({ ...current, [field]: value }))
  }

  function setPrimaryApplication(value) {
    const appId = value ? Number(value) : ''
    setEstablishmentForm(current => ({
      ...current,
      app_id: appId,
      app_ids: appId ? [...new Set([...(current.app_ids || []), appId])] : current.app_ids,
    }))
  }

  function toggleApplication(appId, checked) {
    const numericId = Number(appId)
    setEstablishmentForm(current => ({
      ...current,
      app_ids: checked ? [...new Set([...(current.app_ids || []), numericId])] : (current.app_ids || []).filter(id => Number(id) !== numericId),
    }))
  }

  async function saveEstablishment(event) {
    event.preventDefault()
    resetMessages()
    const appIds = [...new Set((establishmentForm.app_ids || []).map(Number).filter(Boolean))]
    const appId = Number(establishmentForm.app_id) || appIds[0] || null
    if (appId && !appIds.includes(appId)) appIds.unshift(appId)
    if (!establishmentForm.name.trim()) return setError('Informe a razão social ou nome do estabelecimento.')
    if (!establishmentForm.user_id) return setError('Selecione o usuário responsável pelo estabelecimento.')
    if (!appIds.length) return setError('Selecione pelo menos uma aplicação da Peter Tecnet para o estabelecimento.')
    if (establishmentForm.cnpj && !documentIsValid(establishmentForm.cnpj)) return setError('O CPF/CNPJ informado não é válido. Confira os números antes de salvar.')
    if (establishmentForm.phone && digits(establishmentForm.phone).length < 10) return setError('Informe um telefone com DDD válido.')
    if (establishmentForm.cep && digits(establishmentForm.cep).length !== 8) return setError('Informe um CEP com 8 dígitos.')
    if (exactDocumentDuplicate) return setError('Este CPF/CNPJ já aparece em outro estabelecimento. Abra o cadastro existente em vez de criar uma duplicidade.')

    const body = {
      name: establishmentForm.name.trim(),
      fantasy: clean(establishmentForm.fantasy), cnpj: clean(establishmentForm.cnpj), type: clean(establishmentForm.type), category: clean(establishmentForm.category),
      phone: clean(establishmentForm.phone), email: clean(establishmentForm.email), description: clean(establishmentForm.description), city: clean(establishmentForm.city),
      uf: clean(establishmentForm.uf)?.toUpperCase() || null, cep: clean(establishmentForm.cep), address: clean(establishmentForm.address),
      website_url: clean(establishmentForm.website_url), instagram_url: clean(establishmentForm.instagram_url), user_id: Number(establishmentForm.user_id),
      app_id: appId, app_ids: appIds, is_published: !!establishmentForm.is_published, is_approved: !!establishmentForm.is_approved,
      is_featured: !!establishmentForm.is_featured, is_cancelled: !!establishmentForm.is_cancelled,
    }

    setSaving(true)
    try {
      const result = await apiRequest(`/admin/ecosystem/establishments${establishmentId ? `/${establishmentId}` : ''}`, {
        method: establishmentId ? 'PUT' : 'POST', body: JSON.stringify(body),
      })
      const saved = result?.establishment
      const refreshed = await apiRequest('/admin/ecosystem/establishments')
      const refreshedEstablishments = refreshed?.establishments || []
      setEstablishments(refreshedEstablishments)
      if (saved?.id) {
        const fresh = refreshedEstablishments.find(item => Number(item.id) === Number(saved.id)) || saved
        const normalized = normalizeEstablishment(fresh)
        setEstablishmentId(saved.id)
        setEstablishmentForm(normalized)
        establishmentSnapshot.current = serialize(normalized)
      }
      setSuccess(establishmentId ? 'Estabelecimento atualizado com sucesso.' : 'Estabelecimento cadastrado e vinculado ao usuário com sucesso.')
      if (guidedActive && saved?.id) {
        setGuided(current => ({ ...current, user_id: Number(saved.user_id || establishmentForm.user_id), app_id: Number(saved.app_id || appId), establishment_id: Number(saved.id) }))
        setGuidedStep(2)
        setMode('guided')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function clearPhotoSelection({ keepExisting = false } = {}) {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoMeta(null)
    setPhotoPreview(keepExisting ? itemForm.image || '' : '')
    if (cameraInput.current) cameraInput.current.value = ''
    if (galleryInput.current) galleryInput.current.value = ''
  }

  function startNewItem(prefill = {}) {
    resetMessages()
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoMeta(null)
    setPhotoPreview('')
    setItemId(null)
    const next = { ...emptyItem, ...prefill }
    setItemForm(next)
    itemSnapshot.current = serialize(next)
  }

  function editItem(item) {
    if (!confirmDiscard()) return
    resetMessages()
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoMeta(null)
    setItemId(item.id)
    const normalized = normalizeItem(item)
    setItemForm(normalized)
    itemSnapshot.current = serialize(normalized)
    setPhotoPreview(normalized.image)
  }

  function selectItemEstablishment(value) {
    const entityId = value ? Number(value) : ''
    const establishment = establishments.find(item => Number(item.id) === Number(entityId))
    const appIds = linkedApplicationIds(establishment)
    const appId = Number(establishment?.app_id) || appIds[0] || ''
    setItemForm(current => ({ ...current, entity_id: entityId, app_id: appId }))
  }

  async function choosePhoto(file) {
    resetMessages()
    if (!file) return
    if (!file.type?.startsWith('image/')) return setError('Escolha uma imagem JPG, PNG, WEBP ou GIF.')
    if (file.size > MAX_IMAGE_BYTES) return setError('A imagem original deve ter no máximo 20 MB.')
    setPhotoProcessing(true)
    try {
      const optimized = await optimizePhoto(file)
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
      setPhotoFile(optimized.file)
      setPhotoMeta(optimized)
      setPhotoPreview(URL.createObjectURL(optimized.file))
    } catch (processingError) {
      setError(processingError.message || 'Não foi possível preparar a foto.')
    } finally {
      setPhotoProcessing(false)
    }
  }

  async function uploadItemPhoto(item, appId) {
    if (!photoFile) return itemForm.image || ''
    const formData = new FormData()
    formData.append('app_id', String(appId))
    formData.append('entity_id', String(item.id))
    formData.append('entity_name', 'item')
    formData.append('group', 'cover')
    formData.append('is_primary', '1')
    formData.append('visibility', 'public')
    formData.append('file', photoFile)
    const upload = await apiRequest('/file', { method: 'POST', body: formData })
    const publicUrl = absoluteAssetUrl(upload?.file?.public_url)
    if (!publicUrl) throw new Error('A foto foi enviada, mas a API não retornou a URL pública do arquivo.')
    return publicUrl
  }

  async function saveItem(event) {
    event.preventDefault()
    resetMessages()
    const action = event.nativeEvent?.submitter?.value || 'save'
    const entityId = Number(itemForm.entity_id)
    const establishment = establishments.find(item => Number(item.id) === entityId)
    const allowedApps = linkedApplicationIds(establishment)
    const appId = Number(itemForm.app_id)
    const price = parseMoneyInput(itemForm.price)
    const discount = itemForm.discount === '' ? null : parseMoneyInput(itemForm.discount)
    if (!itemForm.name.trim()) return setError('Informe o nome do item.')
    if (!entityId) return setError('Selecione o estabelecimento ao qual o item pertence.')
    if (!appId) return setError('Selecione a aplicação do item.')
    if (allowedApps.length && !allowedApps.includes(appId)) return setError('A aplicação escolhida não está vinculada a este estabelecimento.')
    if (Number.isNaN(price) || price < 0) return setError('Informe um preço válido para o item.')
    if (discount !== null && (Number.isNaN(discount) || discount < 0)) return setError('Informe um desconto válido.')

    const body = {
      name: itemForm.name.trim(), entity_id: entityId, app_id: appId, type: itemForm.type || 'item', price,
      description: clean(itemForm.description), sku: clean(itemForm.sku), category: clean(itemForm.category), subcategory: clean(itemForm.subcategory),
      brand: clean(itemForm.brand), duration: itemForm.duration === '' ? null : Number(itemForm.duration), stock: itemForm.stock === '' ? null : Number(itemForm.stock),
      discount, status: !!itemForm.status, is_featured: !!itemForm.is_featured,
    }

    setSaving(true)
    try {
      const result = await apiRequest(`/admin/ecosystem/items${itemId ? `/${itemId}` : ''}`, { method: itemId ? 'PUT' : 'POST', body: JSON.stringify(body) })
      let savedItem = result?.item
      if (!savedItem?.id) throw new Error('A API não retornou o item salvo.')
      setItemId(savedItem.id)
      if (photoFile) {
        const image = await uploadItemPhoto(savedItem, appId)
        const imageUpdate = await apiRequest(`/admin/ecosystem/items/${savedItem.id}`, { method: 'PUT', body: JSON.stringify({ image }) })
        savedItem = imageUpdate?.item || { ...savedItem, image }
      }
      const refreshed = await apiRequest('/admin/ecosystem/items')
      const refreshedItems = refreshed?.items || refreshed?.data || []
      setItems(refreshedItems)
      setSuccess(itemId ? 'Item atualizado com sucesso.' : 'Item cadastrado com sucesso.')
      if (guidedActive) {
        setGuided(current => ({ ...current, item_ids: [...new Set([...(current.item_ids || []), Number(savedItem.id)])] }))
      }
      if (action === 'another') {
        startNewItem({ entity_id: entityId, app_id: appId, type: itemForm.type || 'product', status: true })
        setSuccess('Item salvo. O próximo cadastro já está preparado para a mesma empresa.')
      } else if (guidedActive && action === 'review') {
        startNewItem({ entity_id: entityId, app_id: appId })
        setGuidedStep(4)
        setMode('guided')
        setSuccess('Item salvo. Revise o atendimento antes de finalizar.')
      } else {
        const fresh = refreshedItems.find(item => Number(item.id) === Number(savedItem.id)) || savedItem
        const normalized = normalizeItem(fresh)
        setItemForm(normalized)
        itemSnapshot.current = serialize(normalized)
        setPhotoFile(null)
        setPhotoMeta(null)
        if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
        setPhotoPreview(currentItemImage(fresh))
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function createQuickUser(event) {
    event.preventDefault()
    resetMessages()
    const email = quickUser.email.trim().toLocaleLowerCase('pt-BR')
    const appId = Number(quickUser.app_id || establishmentForm.app_id || guided.app_id)
    if (!email || !email.includes('@')) return setError('Informe um e-mail válido para o cliente.')
    if (!appId) return setError('Selecione primeiro a aplicação que será usada no convite do cliente.')
    setQuickUserSaving(true)
    try {
      const onboarding = await apiRequest('/admin/ecosystem/onboarding', {
        method: 'POST',
        body: JSON.stringify({ email, app_id: appId }),
      })
      let createdUser = onboarding?.user
      if (!createdUser?.id) throw new Error('A API não retornou o usuário preparado.')
      if (onboarding.created_user && quickUser.name.trim()) {
        const names = splitName(quickUser.name)
        const updated = await apiRequest(`/admin/ecosystem/users/${createdUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(names),
        })
        createdUser = updated?.user || createdUser
      }
      const usersResult = await apiRequest('/admin/ecosystem/users')
      const nextUsers = usersResult?.users || []
      setUsers(nextUsers)
      setEstablishmentForm(current => ({
        ...current,
        user_id: Number(createdUser.id),
        app_id: Number(current.app_id || appId),
        app_ids: [...new Set([...(current.app_ids || []), appId])],
      }))
      setGuided(current => ({ ...current, user_id: Number(createdUser.id), app_id: appId }))
      setQuickUser({ ...emptyQuickUser, app_id: appId })
      setQuickUserOpen(false)
      setSuccess(onboarding.mail_sent === false ? 'Usuário preparado, mas o e-mail de ativação não foi enviado. Verifique a configuração de e-mail.' : onboarding.created_user ? 'Cliente criado e convite de ativação enviado por e-mail.' : 'Usuário existente reutilizado e novo convite enviado.')
      if (guidedActive) setGuidedStep(1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setQuickUserSaving(false)
    }
  }

  function beginGuided() {
    if (!confirmDiscard()) return
    setGuidedActive(true)
    setFinalized(false)
    setGuidedStep(0)
    setGuided({ user_id: '', app_id: '', establishment_id: '', item_ids: [] })
    setGuidedUserQuery('')
    setMode('guided')
    resetMessages()
  }

  function chooseGuidedUser(userId) {
    setGuided(current => ({ ...current, user_id: Number(userId) }))
  }

  function continueGuidedUser() {
    if (!guided.user_id) return setError('Selecione ou crie o cliente antes de continuar.')
    if (!guided.app_id) return setError('Selecione a aplicação de entrada do cliente.')
    resetMessages()
    setGuidedStep(1)
  }

  function createGuidedEstablishment() {
    startNewEstablishment({ user_id: guided.user_id, app_id: guided.app_id, app_ids: [Number(guided.app_id)], email: guidedUser?.email || '' })
    setMode('establishments')
  }

  function selectGuidedEstablishment(id) {
    const establishment = establishments.find(item => Number(item.id) === Number(id))
    if (!establishment) return
    setGuided(current => ({ ...current, establishment_id: Number(establishment.id), app_id: Number(establishment.app_id || current.app_id) }))
    setGuidedStep(2)
  }

  async function saveGuidedApplications() {
    if (!guidedEstablishment) return setError('Selecione uma empresa antes de configurar as aplicações.')
    const form = normalizeEstablishment(guidedEstablishment)
    const ids = [...new Set((form.app_ids || []).map(Number).filter(Boolean))]
    if (!ids.length) return setError('O estabelecimento precisa ter pelo menos uma aplicação.')
    const primaryAppId = ids.includes(Number(guided.app_id)) ? Number(guided.app_id) : Number(form.app_id) && ids.includes(Number(form.app_id)) ? Number(form.app_id) : ids[0]
    setSaving(true)
    resetMessages()
    try {
      await apiRequest(`/admin/ecosystem/establishments/${guidedEstablishment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ app_id: primaryAppId, app_ids: ids }),
      })
      const refreshed = await apiRequest('/admin/ecosystem/establishments')
      setEstablishments(refreshed?.establishments || [])
      setGuided(current => ({ ...current, app_id: primaryAppId }))
      setGuidedStep(3)
      setSuccess('Aplicações confirmadas. Agora cadastre os produtos ou serviços.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function toggleGuidedApplication(appId, checked) {
    if (!guidedEstablishment) return
    const current = normalizeEstablishment(guidedEstablishment)
    const existing = current.app_ids || []
    const numericId = Number(appId)
    const nextIds = checked ? [...new Set([...existing, numericId])] : existing.filter(id => Number(id) !== numericId)
    const nextPrimary = nextIds.includes(Number(guided.app_id)) ? Number(guided.app_id) : nextIds.includes(Number(guidedEstablishment.app_id)) ? Number(guidedEstablishment.app_id) : nextIds[0] || ''
    setEstablishments(list => list.map(item => Number(item.id) === Number(guidedEstablishment.id) ? { ...item, applications: applications.filter(app => nextIds.includes(Number(app.id))), app_id: nextPrimary || item.app_id } : item))
    setGuided(value => ({ ...value, app_id: nextPrimary }))
  }

  function addGuidedItem() {
    if (!guidedEstablishment) return
    const appId = Number(guided.app_id || guidedEstablishment.app_id || linkedApplicationIds(guidedEstablishment)[0])
    startNewItem({ entity_id: Number(guidedEstablishment.id), app_id: appId, status: true })
    setMode('items')
  }

  function finishGuided() {
    setFinalized(true)
    setSuccess('Atendimento concluído. Usuário, empresa e catálogo inicial ficaram preparados.')
    setGuidedActive(false)
  }

  function openWorkspace(nextMode = 'guided') {
    if (nextMode === 'guided') beginGuided()
    else {
      setGuidedActive(false)
      setMode(nextMode)
      resetMessages()
    }
    setOpen(true)
  }

  function duplicateReason(item) {
    const reasons = []
    if (digits(establishmentForm.cnpj) && digits(item.cnpj) === digits(establishmentForm.cnpj)) reasons.push('mesmo documento')
    if (digits(establishmentForm.phone).length >= 10 && digits(item.phone) === digits(establishmentForm.phone)) reasons.push('mesmo telefone')
    if (establishmentForm.email && String(item.email || '').toLocaleLowerCase('pt-BR') === String(establishmentForm.email).toLocaleLowerCase('pt-BR')) reasons.push('mesmo e-mail')
    if (nameSimilarity(item.name || item.fantasy, establishmentForm.name) >= 0.72) reasons.push('nome semelhante')
    return reasons.join(', ')
  }

  const establishmentValidationHints = {
    document: establishmentForm.cnpj && !documentIsValid(establishmentForm.cnpj) ? 'Documento incompleto ou inválido.' : '',
    phone: establishmentForm.phone && digits(establishmentForm.phone).length < 10 ? 'Inclua DDD e número.' : '',
    cep: establishmentForm.cep && digits(establishmentForm.cep).length !== 8 ? 'CEP deve ter 8 dígitos.' : cepStatus,
  }

  const guidedUserEstablishments = establishments.filter(item => Number(item.user_id || item.user?.id) === Number(guided.user_id))
  const guidedStepLabels = ['Cliente', 'Empresa', 'Aplicações', 'Itens', 'Revisar']

  return <>
    <button className="aco-launch" type="button" onClick={() => openWorkspace('guided')} aria-label="Abrir atendimento guiado">
      <span>+</span><b>Cadastro fácil</b><small>Atendimento guiado</small>
    </button>

    {open && <div className="aco-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && requestClose()}>
      <section className="aco-workspace" role="dialog" aria-modal="true" aria-labelledby="aco-title">
        <header className="aco-header">
          <div><p>Peter Tecnet · operação comercial</p><h2 id="aco-title">Cadastro e edição assistidos</h2><span>Fluxo preparado para atendimento presencial: cliente, empresa, aplicações, itens e revisão.</span></div>
          <div className="aco-header-actions"><button type="button" onClick={loadWorkspace} disabled={loading || saving}>Atualizar dados</button><button className="aco-close" type="button" onClick={requestClose} disabled={saving || photoProcessing} aria-label="Fechar">×</button></div>
        </header>

        <nav className="aco-tabs aco-tabs-three" aria-label="Tipo de cadastro">
          <button type="button" className={mode === 'guided' ? 'is-active' : ''} onClick={() => switchMode('guided')}><b>★</b><span><strong>Atendimento guiado</strong><small>Usuário → empresa → itens</small></span></button>
          <button type="button" className={mode === 'establishments' ? 'is-active' : ''} onClick={() => { setGuidedActive(false); switchMode('establishments') }}><b>E</b><span><strong>Estabelecimentos</strong><small>Cadastro e edição direta</small></span></button>
          <button type="button" className={mode === 'items' ? 'is-active' : ''} onClick={() => { setGuidedActive(false); switchMode('items') }}><b>I</b><span><strong>Itens</strong><small>Produtos, serviços e fotos</small></span></button>
        </nav>

        {(error || success) && <div className={error ? 'aco-notice is-error' : 'aco-notice is-success'} role={error ? 'alert' : 'status'}>{error || success}</div>}
        {loading && <div className="aco-loading"><span/><p>Carregando dados do ecossistema…</p></div>}

        {!loading && mode === 'guided' && <div className="aco-guided-wrap">
          <div className="aco-guided-stepper" aria-label="Etapas do atendimento">{guidedStepLabels.map((label, index) => <button type="button" key={label} className={index === guidedStep ? 'is-current' : index < guidedStep ? 'is-done' : ''} disabled={!guidedActive && !finalized} onClick={() => guidedActive && index <= guidedStep && setGuidedStep(index)}><b>{index < guidedStep ? '✓' : index + 1}</b><span>{label}</span></button>)}</div>

          {!guidedActive && !finalized && <div className="aco-guided-empty"><span>◎</span><h3>Atendimento comercial em uma única sequência</h3><p>O colaborador não precisa entender a estrutura interna do ecossistema. O assistente conduz o cadastro e reutiliza os módulos genéricos já existentes.</p><button type="button" onClick={beginGuided}>Iniciar novo atendimento</button></div>}

          {finalized && !guidedActive && <div className="aco-guided-empty is-success"><span>✓</span><h3>Atendimento concluído</h3><p>O cliente foi preparado e o histórico permaneceu registrado. Você pode iniciar outro atendimento quando quiser.</p><button type="button" onClick={beginGuided}>Novo atendimento</button></div>}

          {guidedActive && guidedStep === 0 && <div className="aco-guided-card">
            <div className="aco-guided-heading"><div><p>Etapa 1 de 5</p><h3>Quem é o cliente?</h3><span>Selecione alguém já cadastrado ou crie rapidamente pelo e-mail. O convite de ativação será enviado automaticamente.</span></div></div>
            <div className="aco-guided-grid">
              <section>
                <label className="aco-search"><span>Buscar usuário existente</span><input value={guidedUserQuery} onChange={event => setGuidedUserQuery(event.target.value)} placeholder="Nome ou e-mail"/></label>
                <div className="aco-user-picks">{guidedUsers.map(user => <button type="button" key={user.id} className={Number(guided.user_id) === Number(user.id) ? 'is-selected' : ''} onClick={() => chooseGuidedUser(user.id)}><b>{fullName(user)}</b><span>{user.email}</span></button>)}</div>
              </section>
              <section className="aco-guided-side">
                <Select label="Aplicação de entrada" value={guided.app_id} onChange={value => setGuided(current => ({ ...current, app_id: Number(value) || '' }))} required wide><option value="">Selecione a ferramenta</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</Select>
                {guidedUser && <div className="aco-selected-summary"><b>{fullName(guidedUser)}</b><span>{guidedUser.email}</span><small>Cliente selecionado</small></div>}
                <button type="button" className="aco-primary-action" onClick={() => { setQuickUser({ ...emptyQuickUser, app_id: guided.app_id }); setQuickUserOpen(true) }}>+ Criar cliente por e-mail</button>
                <button type="button" className="aco-secondary-action" onClick={continueGuidedUser} disabled={!guided.user_id || !guided.app_id}>Continuar para empresa →</button>
              </section>
            </div>
          </div>}

          {guidedActive && guidedStep === 1 && <div className="aco-guided-card">
            <div className="aco-guided-heading"><div><p>Etapa 2 de 5</p><h3>Empresa do cliente</h3><span>Reutilize uma empresa já vinculada ou crie um novo estabelecimento com o responsável e a aplicação pré-preenchidos.</span></div></div>
            <div className="aco-guided-grid">
              <section><h4>Empresas existentes deste usuário</h4><div className="aco-existing-cards">{guidedUserEstablishments.length ? guidedUserEstablishments.map(item => <button type="button" key={item.id} onClick={() => selectGuidedEstablishment(item.id)}><b>{establishmentName(item)}</b><span>{[item.city, item.uf].filter(Boolean).join(' / ') || 'Localidade não informada'}</span><small>Usar este cadastro</small></button>) : <div className="aco-empty-inline">Nenhuma empresa vinculada a este cliente ainda.</div>}</div></section>
              <section className="aco-guided-side"><div className="aco-selected-summary"><b>{fullName(guidedUser)}</b><span>{guidedApplication?.name || 'Aplicação não selecionada'}</span><small>Contexto do atendimento</small></div><button type="button" className="aco-primary-action" onClick={createGuidedEstablishment}>+ Cadastrar nova empresa</button></section>
            </div>
          </div>}

          {guidedActive && guidedStep === 2 && guidedEstablishment && <div className="aco-guided-card">
            <div className="aco-guided-heading"><div><p>Etapa 3 de 5</p><h3>Aplicações da empresa</h3><span>Confirme em quais ferramentas Peter Tecnet este estabelecimento deve aparecer.</span></div><CompletenessCard value={guidedCompletion}/></div>
            <div className="aco-choice-grid aco-guided-apps">{applications.map(app => { const checked = linkedApplicationIds(guidedEstablishment).includes(Number(app.id)); return <label className={checked ? 'aco-choice is-selected' : 'aco-choice'} key={app.id}><input type="checkbox" checked={checked} onChange={event => toggleGuidedApplication(app.id, event.target.checked)}/><span><b>{app.name}</b><small>{Number(guided.app_id) === Number(app.id) ? 'Aplicação principal' : checked ? 'Vinculada' : 'Disponível'}</small></span></label> })}</div>
            <div className="aco-guided-footer"><button type="button" className="aco-secondary-action" onClick={() => setGuidedStep(1)}>← Voltar</button><button type="button" className="aco-primary-action" onClick={saveGuidedApplications} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar aplicações →'}</button></div>
          </div>}

          {guidedActive && guidedStep === 3 && guidedEstablishment && <div className="aco-guided-card">
            <div className="aco-guided-heading"><div><p>Etapa 4 de 5</p><h3>Produtos e serviços</h3><span>Cadastre quantos itens quiser. “Salvar e adicionar outro” mantém a empresa selecionada e acelera atendimento presencial.</span></div><CompletenessCard value={guidedCompletion}/></div>
            <div className="aco-guided-items">{guidedItems.length ? guidedItems.map(item => <div key={item.id}>{currentItemImage(item) ? <img src={currentItemImage(item)} alt=""/> : <span>{item.name?.slice(0, 1)}</span>}<section><b>{item.name}</b><small>{money(item.price)} · {item.category || item.type}</small></section></div>) : <div className="aco-empty-inline">Nenhum item cadastrado para esta empresa ainda.</div>}</div>
            <div className="aco-guided-footer"><button type="button" className="aco-secondary-action" onClick={() => setGuidedStep(2)}>← Aplicações</button><div><button type="button" className="aco-primary-action" onClick={addGuidedItem}>+ Adicionar item</button><button type="button" className="aco-secondary-action" onClick={() => setGuidedStep(4)}>Revisar atendimento →</button></div></div>
          </div>}

          {guidedActive && guidedStep === 4 && <div className="aco-guided-card">
            <div className="aco-guided-heading"><div><p>Etapa 5 de 5</p><h3>Revisão final</h3><span>Confira o que será entregue ao cliente e o nível de completude do cadastro.</span></div><CompletenessCard value={guidedCompletion}/></div>
            <div className="aco-review-grid">
              <section><span>Cliente</span><b>{fullName(guidedUser)}</b><small>{guidedUser?.email}</small></section>
              <section><span>Empresa</span><b>{establishmentName(guidedEstablishment)}</b><small>{[guidedEstablishment?.city, guidedEstablishment?.uf].filter(Boolean).join(' / ') || 'Localidade incompleta'}</small></section>
              <section><span>Aplicações</span><b>{linkedApplicationIds(guidedEstablishment).length}</b><small>{linkedApplicationIds(guidedEstablishment).map(id => appById(applications, id)?.name).filter(Boolean).join(', ')}</small></section>
              <section><span>Catálogo inicial</span><b>{guidedItems.length} {guidedItems.length === 1 ? 'item' : 'itens'}</b><small>{guidedItems.length ? 'Catálogo já iniciado' : 'Pode ser completado posteriormente'}</small></section>
            </div>
            <HistoryCard record={guidedEstablishment} users={users}/>
            <div className="aco-guided-footer"><button type="button" className="aco-secondary-action" onClick={() => setGuidedStep(3)}>← Itens</button><button type="button" className="aco-primary-action" onClick={finishGuided}>Finalizar atendimento</button></div>
          </div>}
        </div>}

        {!loading && mode === 'establishments' && <div className="aco-content">
          <aside className="aco-records">
            <div className="aco-records-head"><div><b>Estabelecimentos</b><small>{establishments.length} carregados</small></div><button type="button" onClick={() => { if (confirmDiscard()) startNewEstablishment() }}>+ Novo</button></div>
            <label className="aco-search"><span>Buscar</span><input value={establishmentQuery} onChange={event => setEstablishmentQuery(event.target.value)} placeholder="Nome, CNPJ, e-mail, cidade…"/></label>
            <div className="aco-record-list">{filteredEstablishments.map(item => <button type="button" className={Number(establishmentId) === Number(item.id) ? 'aco-record is-selected' : 'aco-record'} key={item.id} onClick={() => editEstablishment(item)}><span className="aco-record-icon">{establishmentName(item).slice(0, 1).toUpperCase()}</span><span><b>{establishmentName(item)}</b><small>{item.user?.email || 'Sem responsável exibido'}</small><i>{[item.city, item.uf].filter(Boolean).join(' / ') || 'Localidade não informada'}</i></span><em>{item.is_approved ? 'Aprovado' : 'Pendente'}</em></button>)}</div>
          </aside>

          <main className="aco-editor">
            <div className="aco-editor-title"><div><p>{establishmentId ? `Editando #${establishmentId}` : guidedActive ? 'Atendimento guiado · empresa' : 'Novo cadastro'}</p><h2>{establishmentId ? establishmentName(establishmentForm) : 'Cadastrar estabelecimento'}</h2><span>Máscaras, validação, CEP automático e prevenção de duplicidade estão ativos.</span></div>{establishmentId && <button type="button" onClick={() => { if (confirmDiscard()) startNewEstablishment() }}>Criar outro</button>}</div>
            <CompletenessCard value={establishmentCompletion}/>
            {duplicateMatches.length > 0 && <div className="aco-duplicates"><div><b>Possíveis cadastros já existentes</b><span>Evite duplicidade antes de salvar.</span></div>{duplicateMatches.map(item => <button type="button" key={item.id} onClick={() => editEstablishment(item)}><b>{establishmentName(item)}</b><small>{duplicateReason(item)}</small><span>Abrir cadastro #{item.id}</span></button>)}</div>}
            <form onSubmit={saveEstablishment}>
              <FormSection title="Identificação" description="Comece pelos dados que o cliente reconhece facilmente.">
                <Field label="Razão social / nome" value={establishmentForm.name} onChange={value => updateEstablishmentField('name', value)} required wide placeholder="Ex.: Ferragista São José"/>
                <Field label="Nome fantasia" value={establishmentForm.fantasy} onChange={value => updateEstablishmentField('fantasy', value)} placeholder="Nome que aparece para o público"/>
                <Field label="CPF/CNPJ" value={establishmentForm.cnpj} onChange={value => updateEstablishmentField('cnpj', formatDocument(value))} inputMode="numeric" placeholder="00.000.000/0000-00" hint={establishmentValidationHints.document}/>
                <Field label="Tipo de estabelecimento" value={establishmentForm.type} onChange={value => updateEstablishmentField('type', value)} placeholder="Loja, clínica, salão…"/>
                <Field label="Categoria" value={establishmentForm.category} onChange={value => updateEstablishmentField('category', value)} placeholder="Segmento principal"/>
              </FormSection>

              <FormSection title="Responsável e aplicações" description="Vincule a empresa ao usuário correto e escolha em quais ferramentas ela poderá operar." action={<button className="aco-section-action" type="button" onClick={() => { setQuickUser({ ...emptyQuickUser, app_id: establishmentForm.app_id }); setQuickUserOpen(true) }}>+ Novo usuário</button>}>
                <Select label="Usuário responsável" value={establishmentForm.user_id} onChange={value => updateEstablishmentField('user_id', value)} required wide><option value="">Selecione o usuário</option>{users.map(user => <option key={user.id} value={user.id}>{fullName(user)} · {user.email}</option>)}</Select>
                <Select label="Aplicação principal" value={establishmentForm.app_id} onChange={setPrimaryApplication} required wide><option value="">Selecione a aplicação principal</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</Select>
                <div className="aco-wide"><span className="aco-label">Aplicações vinculadas *</span><div className="aco-choice-grid">{applications.map(app => { const checked = establishmentForm.app_ids.includes(Number(app.id)); const primary = Number(establishmentForm.app_id) === Number(app.id); return <label className={checked ? 'aco-choice is-selected' : 'aco-choice'} key={app.id}><input type="checkbox" checked={checked} disabled={primary} onChange={event => toggleApplication(app.id, event.target.checked)}/><span><b>{app.name}</b><small>{primary ? 'Principal' : checked ? 'Vinculada' : 'Disponível'}</small></span></label> })}</div></div>
              </FormSection>

              <FormSection title="Contato" description="Os formatos são ajustados durante a digitação para reduzir erro humano.">
                <Field label="Telefone" value={establishmentForm.phone} onChange={value => updateEstablishmentField('phone', formatPhone(value))} type="tel" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" hint={establishmentValidationHints.phone}/>
                <Field label="E-mail" value={establishmentForm.email} onChange={value => updateEstablishmentField('email', value.trimStart())} type="email" autoComplete="email" placeholder="contato@empresa.com"/>
                <Field label="Website" value={establishmentForm.website_url} onChange={value => updateEstablishmentField('website_url', value)} type="url" placeholder="https://…"/>
                <Field label="Instagram" value={establishmentForm.instagram_url} onChange={value => updateEstablishmentField('instagram_url', value)} type="url" placeholder="https://instagram.com/…"/>
              </FormSection>

              <FormSection title="Endereço" description="Digite o CEP. Rua, bairro, cidade e UF são buscados automaticamente.">
                <Field label="CEP" value={establishmentForm.cep} onChange={value => updateEstablishmentField('cep', formatCep(value))} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" hint={establishmentValidationHints.cep}/>
                <Field label="Cidade" value={establishmentForm.city} onChange={value => updateEstablishmentField('city', value)} autoComplete="address-level2"/>
                <Field label="UF" value={establishmentForm.uf} onChange={value => updateEstablishmentField('uf', value.slice(0, 2).toUpperCase())} max="2" autoComplete="address-level1"/>
                <Field label="Endereço completo" value={establishmentForm.address} onChange={value => updateEstablishmentField('address', value)} wide autoComplete="street-address" placeholder="Rua, número, complemento, bairro"/>
              </FormSection>

              <FormSection title="Apresentação e visibilidade" description="Finalize com uma descrição simples e escolha o estado administrativo.">
                <label className="aco-field aco-wide"><span>Descrição</span><textarea rows="5" value={establishmentForm.description} onChange={event => updateEstablishmentField('description', event.target.value)} placeholder="Explique em poucas linhas o que a empresa oferece."/></label>
                <div className="aco-wide aco-toggle-grid"><Toggle label="Aprovado" detail="Libera o estabelecimento" checked={establishmentForm.is_approved} onChange={value => updateEstablishmentField('is_approved', value)}/><Toggle label="Publicado" detail="Pode aparecer para o público" checked={establishmentForm.is_published} onChange={value => updateEstablishmentField('is_published', value)}/><Toggle label="Destaque" detail="Recebe prioridade de exibição" checked={establishmentForm.is_featured} onChange={value => updateEstablishmentField('is_featured', value)}/><Toggle label="Cancelado" detail="Mantém o registro desativado" checked={establishmentForm.is_cancelled} onChange={value => updateEstablishmentField('is_cancelled', value)}/></div>
              </FormSection>

              <HistoryCard record={selectedEstablishment || establishmentForm} users={users}/>
              <div className="aco-savebar"><span>{isEstablishmentDirty ? 'Há alterações ainda não salvas.' : establishmentId ? 'Cadastro sincronizado.' : 'Preencha os dados e salve para continuar.'}</span><button type="submit" disabled={saving || exactDocumentDuplicate}>{saving ? 'Salvando…' : establishmentId ? 'Salvar alterações' : guidedActive ? 'Salvar empresa e continuar' : 'Cadastrar estabelecimento'}</button></div>
            </form>
          </main>
        </div>}

        {!loading && mode === 'items' && <div className="aco-content">
          <aside className="aco-records">
            <div className="aco-records-head"><div><b>Itens</b><small>{items.length} carregados</small></div><button type="button" onClick={() => { if (confirmDiscard()) startNewItem() }}>+ Novo</button></div>
            <label className="aco-search"><span>Buscar</span><input value={itemQuery} onChange={event => setItemQuery(event.target.value)} placeholder="Nome, SKU, categoria, empresa…"/></label>
            <div className="aco-record-list">{filteredItems.map(item => <button type="button" className={Number(itemId) === Number(item.id) ? 'aco-record is-selected' : 'aco-record'} key={item.id} onClick={() => editItem(item)}>{currentItemImage(item) ? <img className="aco-record-photo" src={currentItemImage(item)} alt=""/> : <span className="aco-record-icon">{item.name?.slice(0, 1)?.toUpperCase() || 'I'}</span>}<span><b>{item.name}</b><small>{establishmentName(item.establishment)}</small><i>{item.category || item.type || 'Sem categoria'} · {money(item.price)}</i></span><em>{item.status === false ? 'Inativo' : 'Ativo'}</em></button>)}</div>
          </aside>

          <main className="aco-editor">
            <div className="aco-editor-title"><div><p>{itemId ? `Editando item #${itemId}` : guidedActive ? 'Atendimento guiado · itens' : 'Novo item'}</p><h2>{itemId ? itemForm.name : 'Cadastrar produto ou serviço'}</h2><span>A foto é recortada em 4:3, corrigida e comprimida no aparelho antes do upload.</span></div>{itemId && <button type="button" onClick={() => { if (confirmDiscard()) startNewItem() }}>Criar outro</button>}</div>
            <form onSubmit={saveItem}>
              <FormSection title="Onde este item será usado" description="Escolha a empresa; somente aplicações realmente vinculadas ficam disponíveis.">
                <Select label="Estabelecimento" value={itemForm.entity_id} onChange={selectItemEstablishment} required wide><option value="">Selecione a empresa do usuário</option>{establishments.map(item => <option key={item.id} value={item.id}>{establishmentName(item)}{item.user?.email ? ` · ${item.user.email}` : ''}</option>)}</Select>
                <Select label="Aplicação" value={itemForm.app_id} onChange={value => setItemForm(current => ({ ...current, app_id: value }))} required wide disabled={!itemForm.entity_id}><option value="">Selecione a aplicação</option>{applications.filter(app => { const establishment = establishments.find(item => Number(item.id) === Number(itemForm.entity_id)); const ids = linkedApplicationIds(establishment); return !ids.length || ids.includes(Number(app.id)) }).map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</Select>
              </FormSection>

              <FormSection title="Informações do item" description="Preço e desconto usam máscara brasileira sem perder o valor numérico enviado à API.">
                <Field label="Nome do item" value={itemForm.name} onChange={value => setItemForm(current => ({ ...current, name: value }))} required wide placeholder="Ex.: Corte masculino, Furadeira 750W…"/>
                <Select label="Tipo" value={itemForm.type} onChange={value => setItemForm(current => ({ ...current, type: value }))} required><option value="product">Produto</option><option value="service">Serviço</option><option value="item">Item genérico</option><option value="ticket">Ingresso</option></Select>
                <Field label="Preço (R$)" value={itemForm.price} onChange={value => setItemForm(current => ({ ...current, price: formatMoneyInput(value) }))} inputMode="decimal" required placeholder="0,00"/>
                <Field label="Categoria" value={itemForm.category} onChange={value => setItemForm(current => ({ ...current, category: value }))} placeholder="Ex.: Ferramentas"/>
                <Field label="Subcategoria" value={itemForm.subcategory} onChange={value => setItemForm(current => ({ ...current, subcategory: value }))} placeholder="Ex.: Elétricas"/>
                <Field label="Marca" value={itemForm.brand} onChange={value => setItemForm(current => ({ ...current, brand: value }))}/>
                <Field label="SKU / código" value={itemForm.sku} onChange={value => setItemForm(current => ({ ...current, sku: value }))}/>
                <Field label="Estoque" value={itemForm.stock} onChange={value => setItemForm(current => ({ ...current, stock: value.replace(/\D/g, '') }))} inputMode="numeric"/>
                <Field label="Duração (minutos)" value={itemForm.duration} onChange={value => setItemForm(current => ({ ...current, duration: value.replace(/\D/g, '') }))} inputMode="numeric"/>
                <Field label="Desconto (R$)" value={itemForm.discount} onChange={value => setItemForm(current => ({ ...current, discount: formatMoneyInput(value) }))} inputMode="decimal"/>
                <label className="aco-field aco-wide"><span>Descrição</span><textarea rows="5" value={itemForm.description} onChange={event => setItemForm(current => ({ ...current, description: event.target.value }))} placeholder="Descreva benefícios, características e informações importantes."/></label>
              </FormSection>

              <FormSection title="Foto do item" description="A imagem é reenquadrada para 4:3 e comprimida para WEBP antes de sair do aparelho, mantendo a galeria como segunda opção.">
                <div className="aco-wide aco-photo-box">
                  <div className="aco-photo-preview">{photoPreview ? <img src={photoPreview} alt="Prévia do item"/> : <div><span>▧</span><b>Sem foto</b><small>Adicione uma imagem para deixar o catálogo mais atrativo.</small></div>}</div>
                  <div className="aco-photo-actions">
                    <input ref={cameraInput} className="aco-file-input" type="file" accept="image/*" capture="environment" onChange={event => choosePhoto(event.target.files?.[0])}/>
                    <input ref={galleryInput} className="aco-file-input" type="file" accept="image/*" onChange={event => choosePhoto(event.target.files?.[0])}/>
                    <button className="aco-camera" type="button" onClick={() => cameraInput.current?.click()} disabled={photoProcessing}><span>●</span><b>{photoProcessing ? 'Preparando foto…' : 'Tirar foto'}</b><small>Usar a câmera do aparelho</small></button>
                    <button type="button" onClick={() => galleryInput.current?.click()} disabled={photoProcessing}><span>▣</span><b>Escolher da galeria</b><small>Enviar uma imagem existente</small></button>
                    {(photoPreview || photoFile) && <button className="aco-remove-photo" type="button" onClick={() => clearPhotoSelection()} disabled={photoProcessing}>Limpar seleção</button>}
                    {photoMeta?.optimized && <p className="aco-photo-optimized">Otimizada: {fileSize(photoMeta.originalBytes)} → {fileSize(photoMeta.optimizedBytes)} · {photoMeta.width}×{photoMeta.height} · WEBP</p>}
                    {!photoMeta?.optimized && <p>JPG, PNG, WEBP ou GIF · original máximo de 20 MB.</p>}
                  </div>
                </div>
              </FormSection>

              <FormSection title="Publicação" description="Controle rapidamente se o item já pode aparecer para os usuários."><div className="aco-wide aco-toggle-grid"><Toggle label="Ativo" detail="Disponível para uso e exibição" checked={itemForm.status} onChange={value => setItemForm(current => ({ ...current, status: value }))}/><Toggle label="Destaque" detail="Prioriza o item no catálogo" checked={itemForm.is_featured} onChange={value => setItemForm(current => ({ ...current, is_featured: value }))}/></div></FormSection>
              <HistoryCard record={selectedItem || itemForm} users={users} title="Histórico do item"/>

              <div className="aco-savebar"><span>{isItemDirty ? 'Há alterações ou uma nova foto ainda não salvas.' : itemId ? 'Item sincronizado.' : 'Cadastre o item e continue sem perder a empresa selecionada.'}</span><div className="aco-save-actions"><button type="submit" value="another" disabled={saving || photoProcessing}>{saving ? 'Salvando…' : 'Salvar e adicionar outro'}</button>{guidedActive && <button type="submit" value="review" disabled={saving || photoProcessing}>Salvar e revisar</button>}{!guidedActive && <button type="submit" value="save" disabled={saving || photoProcessing}>{itemId ? 'Salvar alterações' : 'Salvar item'}</button>}</div></div>
            </form>
          </main>
        </div>}

        {quickUserOpen && <div className="aco-mini-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !quickUserSaving && setQuickUserOpen(false)}><form className="aco-mini-dialog" onSubmit={createQuickUser}><div><p>Cadastro rápido</p><h3>Novo cliente</h3><span>O usuário recebe um convite seguro para definir a própria senha.</span></div><Field label="Nome" value={quickUser.name} onChange={value => setQuickUser(current => ({ ...current, name: value }))} wide placeholder="Nome do cliente"/><Field label="E-mail" value={quickUser.email} onChange={value => setQuickUser(current => ({ ...current, email: value }))} type="email" wide required placeholder="cliente@email.com"/><Select label="Aplicação do convite" value={quickUser.app_id} onChange={value => setQuickUser(current => ({ ...current, app_id: value }))} required wide><option value="">Selecione a aplicação</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</Select><div className="aco-mini-actions"><button type="button" onClick={() => setQuickUserOpen(false)} disabled={quickUserSaving}>Cancelar</button><button type="submit" disabled={quickUserSaving}>{quickUserSaving ? 'Preparando…' : 'Criar e enviar convite'}</button></div></form></div>}
      </section>
    </div>}
  </>
}
