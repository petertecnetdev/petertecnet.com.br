import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API = 'https://api.petertecnet.com.br/api'
const API_ORIGIN = 'https://api.petertecnet.com.br'
const TOKEN_KEY = 'token'

const emptyEstablishment = {
  name: '', fantasy: '', cnpj: '', type: '', category: '', phone: '', email: '', description: '',
  city: '', uf: '', cep: '', address: '', website_url: '', instagram_url: '', user_id: '', app_id: '', app_ids: [],
  is_published: true, is_approved: true, is_featured: false, is_cancelled: false,
}

const emptyItem = {
  name: '', entity_id: '', app_id: '', type: 'product', price: '', description: '', sku: '', category: '',
  subcategory: '', brand: '', duration: '', stock: '', discount: '', image: '', status: true, is_featured: false,
}

const clean = value => {
  const normalized = String(value ?? '').trim()
  return normalized === '' ? null : normalized
}

const fullName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
const establishmentName = item => item?.fantasy || item?.name || `Estabelecimento #${item?.id}`
const money = value => value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

function normalizeEstablishment(item) {
  const appIds = [...new Set([...(item?.applications || []).map(app => Number(app.id)), Number(item?.app_id)].filter(Boolean))]
  return {
    ...emptyEstablishment,
    ...item,
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
    duration: item?.duration ?? '',
    stock: item?.stock ?? '',
    discount: item?.discount ?? '',
    status: item?.status !== false,
    is_featured: !!item?.is_featured,
    image: currentItemImage(item),
  }
}

function FormSection({ title, description, children }) {
  return <section className="aco-form-section">
    <div className="aco-section-heading"><h3>{title}</h3>{description && <p>{description}</p>}</div>
    <div className="aco-form-grid">{children}</div>
  </section>
}

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false, wide = false, min, max, step, autoComplete }) {
  return <label className={wide ? 'aco-field aco-wide' : 'aco-field'}>
    <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
    <input type={type} value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={placeholder} required={required} min={min} max={max} step={step} autoComplete={autoComplete}/>
  </label>
}

function Select({ label, value, onChange, children, required = false, wide = false }) {
  return <label className={wide ? 'aco-field aco-wide' : 'aco-field'}>
    <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
    <select value={value ?? ''} onChange={event => onChange(event.target.value)} required={required}>{children}</select>
  </label>
}

function Toggle({ label, detail, checked, onChange }) {
  return <label className={checked ? 'aco-toggle is-on' : 'aco-toggle'}>
    <input type="checkbox" checked={!!checked} onChange={event => onChange(event.target.checked)}/>
    <span><b>{label}</b><small>{detail}</small></span>
  </label>
}

export default function AdminCommercialWorkspace() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('establishments')
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
  const cameraInput = useRef(null)
  const galleryInput = useRef(null)

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

  useEffect(() => {
    const handleAdminNavigation = event => {
      const button = event.target.closest?.('.ecosystem-sidebar nav button')
      const label = button?.textContent?.trim()
      if (label === 'Estabelecimentos') {
        setMode('establishments')
        setOpen(true)
      }
      if (label === 'Itens') {
        setMode('items')
        setOpen(true)
      }
    }
    document.addEventListener('click', handleAdminNavigation, true)
    return () => document.removeEventListener('click', handleAdminNavigation, true)
  }, [])

  useEffect(() => {
    if (open) loadWorkspace()
  }, [open, loadWorkspace])

  useEffect(() => () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  const filteredEstablishments = useMemo(() => {
    const query = establishmentQuery.trim().toLocaleLowerCase('pt-BR')
    if (!query) return establishments
    return establishments.filter(item => `${item.name || ''} ${item.fantasy || ''} ${item.cnpj || ''} ${item.user?.email || ''} ${item.city || ''}`.toLocaleLowerCase('pt-BR').includes(query))
  }, [establishments, establishmentQuery])

  const filteredItems = useMemo(() => {
    const query = itemQuery.trim().toLocaleLowerCase('pt-BR')
    if (!query) return items
    return items.filter(item => `${item.name || ''} ${item.sku || ''} ${item.category || ''} ${establishmentName(item.establishment)}`.toLocaleLowerCase('pt-BR').includes(query))
  }, [items, itemQuery])

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function startNewEstablishment() {
    resetMessages()
    setEstablishmentId(null)
    setEstablishmentForm({ ...emptyEstablishment, app_ids: [] })
  }

  function editEstablishment(item) {
    resetMessages()
    setEstablishmentId(item.id)
    setEstablishmentForm(normalizeEstablishment(item))
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
      await apiRequest(`/admin/ecosystem/establishments${establishmentId ? `/${establishmentId}` : ''}`, {
        method: establishmentId ? 'PUT' : 'POST', body: JSON.stringify(body),
      })
      setSuccess(establishmentId ? 'Estabelecimento atualizado com sucesso.' : 'Estabelecimento cadastrado e vinculado ao usuário com sucesso.')
      const refreshed = await apiRequest('/admin/ecosystem/establishments')
      setEstablishments(refreshed?.establishments || [])
      if (!establishmentId) setEstablishmentForm({ ...emptyEstablishment, app_ids: [] })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function clearPhotoSelection() {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview('')
    if (cameraInput.current) cameraInput.current.value = ''
    if (galleryInput.current) galleryInput.current.value = ''
  }

  function startNewItem() {
    resetMessages()
    clearPhotoSelection()
    setItemId(null)
    setItemForm({ ...emptyItem })
  }

  function editItem(item) {
    resetMessages()
    clearPhotoSelection()
    setItemId(item.id)
    const normalized = normalizeItem(item)
    setItemForm(normalized)
    setPhotoPreview(normalized.image)
  }

  function selectItemEstablishment(value) {
    const entityId = value ? Number(value) : ''
    const establishment = establishments.find(item => Number(item.id) === Number(entityId))
    const linkedApps = (establishment?.applications || []).map(app => Number(app.id)).filter(Boolean)
    const appId = Number(establishment?.app_id) || linkedApps[0] || ''
    setItemForm(current => ({ ...current, entity_id: entityId, app_id: appId }))
  }

  function choosePhoto(file) {
    resetMessages()
    if (!file) return
    if (!file.type?.startsWith('image/')) return setError('Escolha uma imagem JPG, PNG, WEBP ou GIF.')
    if (file.size > 20 * 1024 * 1024) return setError('A imagem deve ter no máximo 20 MB.')
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
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
    const entityId = Number(itemForm.entity_id)
    const appId = Number(itemForm.app_id)
    if (!itemForm.name.trim()) return setError('Informe o nome do item.')
    if (!entityId) return setError('Selecione o estabelecimento ao qual o item pertence.')
    if (!appId) return setError('Selecione a aplicação do item.')
    if (itemForm.price === '' || Number.isNaN(Number(itemForm.price)) || Number(itemForm.price) < 0) return setError('Informe um preço válido para o item.')

    const body = {
      name: itemForm.name.trim(), entity_id: entityId, app_id: appId, type: itemForm.type || 'item', price: Number(itemForm.price),
      description: clean(itemForm.description), sku: clean(itemForm.sku), category: clean(itemForm.category), subcategory: clean(itemForm.subcategory),
      brand: clean(itemForm.brand), duration: itemForm.duration === '' ? null : Number(itemForm.duration), stock: itemForm.stock === '' ? null : Number(itemForm.stock),
      discount: itemForm.discount === '' ? null : Number(itemForm.discount), status: !!itemForm.status, is_featured: !!itemForm.is_featured,
    }

    setSaving(true)
    try {
      const result = await apiRequest(`/admin/ecosystem/items${itemId ? `/${itemId}` : ''}`, { method: itemId ? 'PUT' : 'POST', body: JSON.stringify(body) })
      let savedItem = result?.item
      if (!savedItem?.id) throw new Error('A API não retornou o item salvo.')

      if (photoFile) {
        const image = await uploadItemPhoto(savedItem, appId)
        const imageUpdate = await apiRequest(`/admin/ecosystem/items/${savedItem.id}`, { method: 'PUT', body: JSON.stringify({ image }) })
        savedItem = imageUpdate?.item || { ...savedItem, image }
      }

      setSuccess(itemId ? 'Item atualizado com sucesso.' : 'Item cadastrado com sucesso.')
      const refreshed = await apiRequest('/admin/ecosystem/items')
      setItems(refreshed?.items || refreshed?.data || [])
      if (itemId) {
        setItemForm(normalizeItem(savedItem))
        clearPhotoSelection()
        setPhotoPreview(currentItemImage(savedItem))
      } else {
        startNewItem()
        setSuccess('Item cadastrado com sucesso.')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function openWorkspace(nextMode = mode) {
    setMode(nextMode)
    setOpen(true)
    resetMessages()
  }

  return <>
    <button className="aco-launch" type="button" onClick={() => openWorkspace('establishments')} aria-label="Abrir cadastro fácil">
      <span>+</span><b>Cadastro fácil</b><small>Empresas e itens</small>
    </button>

    {open && <div className="aco-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !saving && setOpen(false)}>
      <section className="aco-workspace" role="dialog" aria-modal="true" aria-labelledby="aco-title">
        <header className="aco-header">
          <div><p>Peter Tecnet · operação comercial</p><h2 id="aco-title">Cadastro e edição assistidos</h2><span>Interface simplificada para preparar a conta do usuário sem exigir que ele faça todo o trabalho inicial.</span></div>
          <div className="aco-header-actions"><button type="button" onClick={loadWorkspace} disabled={loading || saving}>Atualizar dados</button><button className="aco-close" type="button" onClick={() => setOpen(false)} disabled={saving} aria-label="Fechar">×</button></div>
        </header>

        <nav className="aco-tabs" aria-label="Tipo de cadastro">
          <button type="button" className={mode === 'establishments' ? 'is-active' : ''} onClick={() => { setMode('establishments'); resetMessages() }}><b>1</b><span><strong>Estabelecimento</strong><small>Empresa, responsável e contato</small></span></button>
          <button type="button" className={mode === 'items' ? 'is-active' : ''} onClick={() => { setMode('items'); resetMessages() }}><b>2</b><span><strong>Item</strong><small>Produto/serviço e fotografia</small></span></button>
        </nav>

        {(error || success) && <div className={error ? 'aco-notice is-error' : 'aco-notice is-success'} role={error ? 'alert' : 'status'}>{error || success}</div>}
        {loading && <div className="aco-loading"><span/><p>Carregando dados do ecossistema…</p></div>}

        {!loading && mode === 'establishments' && <div className="aco-content">
          <aside className="aco-records">
            <div className="aco-records-head"><div><b>Estabelecimentos</b><small>{establishments.length} cadastrados</small></div><button type="button" onClick={startNewEstablishment}>+ Novo</button></div>
            <label className="aco-search"><span>Buscar</span><input value={establishmentQuery} onChange={event => setEstablishmentQuery(event.target.value)} placeholder="Nome, CNPJ, e-mail, cidade…"/></label>
            <div className="aco-record-list">{filteredEstablishments.map(item => <button type="button" className={Number(establishmentId) === Number(item.id) ? 'aco-record is-selected' : 'aco-record'} key={item.id} onClick={() => editEstablishment(item)}><span className="aco-record-icon">{establishmentName(item).slice(0, 1).toUpperCase()}</span><span><b>{establishmentName(item)}</b><small>{item.user?.email || 'Sem responsável exibido'}</small><i>{[item.city, item.uf].filter(Boolean).join(' / ') || 'Localidade não informada'}</i></span><em>{item.is_approved ? 'Aprovado' : 'Pendente'}</em></button>)}</div>
          </aside>

          <main className="aco-editor">
            <div className="aco-editor-title"><div><p>{establishmentId ? `Editando #${establishmentId}` : 'Novo cadastro'}</p><h2>{establishmentId ? establishmentName(establishmentForm) : 'Cadastrar estabelecimento'}</h2><span>Preencha por blocos. Campos obrigatórios estão destacados com *.</span></div>{establishmentId && <button type="button" onClick={startNewEstablishment}>Criar outro</button>}</div>
            <form onSubmit={saveEstablishment}>
              <FormSection title="Identificação" description="Comece pelos dados que o cliente reconhece facilmente.">
                <Field label="Razão social / nome" value={establishmentForm.name} onChange={value => setEstablishmentForm({ ...establishmentForm, name: value })} required wide placeholder="Ex.: Ferragista São José"/>
                <Field label="Nome fantasia" value={establishmentForm.fantasy} onChange={value => setEstablishmentForm({ ...establishmentForm, fantasy: value })} placeholder="Nome que aparece para o público"/>
                <Field label="CNPJ / documento" value={establishmentForm.cnpj} onChange={value => setEstablishmentForm({ ...establishmentForm, cnpj: value })} placeholder="00.000.000/0000-00"/>
                <Field label="Tipo de estabelecimento" value={establishmentForm.type} onChange={value => setEstablishmentForm({ ...establishmentForm, type: value })} placeholder="Loja, clínica, salão…"/>
                <Field label="Categoria" value={establishmentForm.category} onChange={value => setEstablishmentForm({ ...establishmentForm, category: value })} placeholder="Segmento principal"/>
              </FormSection>

              <FormSection title="Responsável e aplicações" description="Vincule a empresa ao usuário correto e escolha em quais ferramentas ela poderá operar.">
                <Select label="Usuário responsável" value={establishmentForm.user_id} onChange={value => setEstablishmentForm({ ...establishmentForm, user_id: value })} required wide>
                  <option value="">Selecione o usuário</option>{users.map(user => <option key={user.id} value={user.id}>{fullName(user)} · {user.email}</option>)}
                </Select>
                <Select label="Aplicação principal" value={establishmentForm.app_id} onChange={setPrimaryApplication} required wide>
                  <option value="">Selecione a aplicação principal</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
                </Select>
                <div className="aco-wide"><span className="aco-label">Aplicações vinculadas *</span><div className="aco-choice-grid">{applications.map(app => { const checked = establishmentForm.app_ids.includes(Number(app.id)); const primary = Number(establishmentForm.app_id) === Number(app.id); return <label className={checked ? 'aco-choice is-selected' : 'aco-choice'} key={app.id}><input type="checkbox" checked={checked} disabled={primary} onChange={event => toggleApplication(app.id, event.target.checked)}/><span><b>{app.name}</b><small>{primary ? 'Principal' : checked ? 'Vinculada' : 'Disponível'}</small></span></label> })}</div></div>
              </FormSection>

              <FormSection title="Contato" description="Dados usados para o usuário e o público encontrarem a empresa.">
                <Field label="Telefone" value={establishmentForm.phone} onChange={value => setEstablishmentForm({ ...establishmentForm, phone: value })} type="tel" autoComplete="tel" placeholder="(00) 00000-0000"/>
                <Field label="E-mail" value={establishmentForm.email} onChange={value => setEstablishmentForm({ ...establishmentForm, email: value })} type="email" autoComplete="email" placeholder="contato@empresa.com"/>
                <Field label="Website" value={establishmentForm.website_url} onChange={value => setEstablishmentForm({ ...establishmentForm, website_url: value })} type="url" placeholder="https://…"/>
                <Field label="Instagram" value={establishmentForm.instagram_url} onChange={value => setEstablishmentForm({ ...establishmentForm, instagram_url: value })} type="url" placeholder="https://instagram.com/…"/>
              </FormSection>

              <FormSection title="Endereço" description="Organizado na mesma ordem em que normalmente o agente recebe os dados.">
                <Field label="CEP" value={establishmentForm.cep} onChange={value => setEstablishmentForm({ ...establishmentForm, cep: value })} autoComplete="postal-code" placeholder="00000-000"/>
                <Field label="Cidade" value={establishmentForm.city} onChange={value => setEstablishmentForm({ ...establishmentForm, city: value })} autoComplete="address-level2"/>
                <Field label="UF" value={establishmentForm.uf} onChange={value => setEstablishmentForm({ ...establishmentForm, uf: value.slice(0, 2).toUpperCase() })} max="2" autoComplete="address-level1"/>
                <Field label="Endereço completo" value={establishmentForm.address} onChange={value => setEstablishmentForm({ ...establishmentForm, address: value })} wide autoComplete="street-address" placeholder="Rua, número, complemento, bairro"/>
              </FormSection>

              <FormSection title="Apresentação e visibilidade" description="Finalize com uma descrição simples e escolha o estado administrativo.">
                <label className="aco-field aco-wide"><span>Descrição</span><textarea rows="5" value={establishmentForm.description} onChange={event => setEstablishmentForm({ ...establishmentForm, description: event.target.value })} placeholder="Explique em poucas linhas o que a empresa oferece."/></label>
                <div className="aco-wide aco-toggle-grid">
                  <Toggle label="Aprovado" detail="Libera o estabelecimento" checked={establishmentForm.is_approved} onChange={value => setEstablishmentForm({ ...establishmentForm, is_approved: value })}/>
                  <Toggle label="Publicado" detail="Pode aparecer para o público" checked={establishmentForm.is_published} onChange={value => setEstablishmentForm({ ...establishmentForm, is_published: value })}/>
                  <Toggle label="Destaque" detail="Recebe prioridade de exibição" checked={establishmentForm.is_featured} onChange={value => setEstablishmentForm({ ...establishmentForm, is_featured: value })}/>
                  <Toggle label="Cancelado" detail="Mantém o registro desativado" checked={establishmentForm.is_cancelled} onChange={value => setEstablishmentForm({ ...establishmentForm, is_cancelled: value })}/>
                </div>
              </FormSection>

              <div className="aco-savebar"><span>{establishmentId ? 'As alterações serão aplicadas imediatamente ao estabelecimento.' : 'O estabelecimento será criado já vinculado ao usuário selecionado.'}</span><button type="submit" disabled={saving}>{saving ? 'Salvando…' : establishmentId ? 'Salvar alterações' : 'Cadastrar estabelecimento'}</button></div>
            </form>
          </main>
        </div>}

        {!loading && mode === 'items' && <div className="aco-content">
          <aside className="aco-records">
            <div className="aco-records-head"><div><b>Itens</b><small>{items.length} cadastrados</small></div><button type="button" onClick={startNewItem}>+ Novo</button></div>
            <label className="aco-search"><span>Buscar</span><input value={itemQuery} onChange={event => setItemQuery(event.target.value)} placeholder="Nome, SKU, categoria, empresa…"/></label>
            <div className="aco-record-list">{filteredItems.map(item => <button type="button" className={Number(itemId) === Number(item.id) ? 'aco-record is-selected' : 'aco-record'} key={item.id} onClick={() => editItem(item)}>{currentItemImage(item) ? <img className="aco-record-photo" src={currentItemImage(item)} alt=""/> : <span className="aco-record-icon">{item.name?.slice(0, 1)?.toUpperCase() || 'I'}</span>}<span><b>{item.name}</b><small>{establishmentName(item.establishment)}</small><i>{item.category || item.type || 'Sem categoria'} · {money(item.price)}</i></span><em>{item.status === false ? 'Inativo' : 'Ativo'}</em></button>)}</div>
          </aside>

          <main className="aco-editor">
            <div className="aco-editor-title"><div><p>{itemId ? `Editando item #${itemId}` : 'Novo item'}</p><h2>{itemId ? itemForm.name : 'Cadastrar produto ou serviço'}</h2><span>Cadastre o essencial primeiro. A foto pode ser tirada na hora ou escolhida da galeria.</span></div>{itemId && <button type="button" onClick={startNewItem}>Criar outro</button>}</div>
            <form onSubmit={saveItem}>
              <FormSection title="Onde este item será usado" description="Escolha a empresa; a aplicação principal é sugerida automaticamente.">
                <Select label="Estabelecimento" value={itemForm.entity_id} onChange={selectItemEstablishment} required wide><option value="">Selecione a empresa do usuário</option>{establishments.map(item => <option key={item.id} value={item.id}>{establishmentName(item)}{item.user?.email ? ` · ${item.user.email}` : ''}</option>)}</Select>
                <Select label="Aplicação" value={itemForm.app_id} onChange={value => setItemForm({ ...itemForm, app_id: value })} required wide><option value="">Selecione a aplicação</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</Select>
              </FormSection>

              <FormSection title="Informações do item" description="Use nomes claros, como o cliente pesquisaria no catálogo.">
                <Field label="Nome do item" value={itemForm.name} onChange={value => setItemForm({ ...itemForm, name: value })} required wide placeholder="Ex.: Corte masculino, Furadeira 750W…"/>
                <Select label="Tipo" value={itemForm.type} onChange={value => setItemForm({ ...itemForm, type: value })} required><option value="product">Produto</option><option value="service">Serviço</option><option value="item">Item genérico</option><option value="ticket">Ingresso</option></Select>
                <Field label="Preço" value={itemForm.price} onChange={value => setItemForm({ ...itemForm, price: value })} type="number" min="0" step="0.01" required placeholder="0,00"/>
                <Field label="Categoria" value={itemForm.category} onChange={value => setItemForm({ ...itemForm, category: value })} placeholder="Ex.: Ferramentas"/>
                <Field label="Subcategoria" value={itemForm.subcategory} onChange={value => setItemForm({ ...itemForm, subcategory: value })} placeholder="Ex.: Elétricas"/>
                <Field label="Marca" value={itemForm.brand} onChange={value => setItemForm({ ...itemForm, brand: value })}/>
                <Field label="SKU / código" value={itemForm.sku} onChange={value => setItemForm({ ...itemForm, sku: value })}/>
                <Field label="Estoque" value={itemForm.stock} onChange={value => setItemForm({ ...itemForm, stock: value })} type="number" min="0" step="1"/>
                <Field label="Duração (minutos)" value={itemForm.duration} onChange={value => setItemForm({ ...itemForm, duration: value })} type="number" min="0" max="1440" step="1"/>
                <Field label="Desconto" value={itemForm.discount} onChange={value => setItemForm({ ...itemForm, discount: value })} type="number" min="0" step="0.01"/>
                <label className="aco-field aco-wide"><span>Descrição</span><textarea rows="5" value={itemForm.description} onChange={event => setItemForm({ ...itemForm, description: event.target.value })} placeholder="Descreva benefícios, características e informações importantes."/></label>
              </FormSection>

              <FormSection title="Foto do item" description="No celular, “Tirar foto” abre diretamente a câmera traseira quando o navegador oferece suporte. A galeria continua disponível como segunda opção.">
                <div className="aco-wide aco-photo-box">
                  <div className="aco-photo-preview">{photoPreview ? <img src={photoPreview} alt="Prévia do item"/> : <div><span>▧</span><b>Sem foto</b><small>Adicione uma imagem para deixar o catálogo mais atrativo.</small></div>}</div>
                  <div className="aco-photo-actions">
                    <input ref={cameraInput} className="aco-file-input" type="file" accept="image/*" capture="environment" onChange={event => choosePhoto(event.target.files?.[0])}/>
                    <input ref={galleryInput} className="aco-file-input" type="file" accept="image/*" onChange={event => choosePhoto(event.target.files?.[0])}/>
                    <button className="aco-camera" type="button" onClick={() => cameraInput.current?.click()}><span>●</span><b>Tirar foto</b><small>Usar a câmera do aparelho</small></button>
                    <button type="button" onClick={() => galleryInput.current?.click()}><span>▣</span><b>Escolher da galeria</b><small>Enviar uma imagem existente</small></button>
                    {(photoPreview || photoFile) && <button className="aco-remove-photo" type="button" onClick={clearPhotoSelection}>Limpar seleção</button>}
                    <p>JPG, PNG, WEBP ou GIF · máximo de 20 MB.</p>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Publicação" description="Controle rapidamente se o item já pode aparecer para os usuários.">
                <div className="aco-wide aco-toggle-grid"><Toggle label="Ativo" detail="Disponível para uso e exibição" checked={itemForm.status} onChange={value => setItemForm({ ...itemForm, status: value })}/><Toggle label="Destaque" detail="Prioriza o item no catálogo" checked={itemForm.is_featured} onChange={value => setItemForm({ ...itemForm, is_featured: value })}/></div>
              </FormSection>

              <div className="aco-savebar"><span>{photoFile ? 'A foto será enviada e vinculada ao item automaticamente.' : 'Você pode salvar sem foto e adicionar uma depois.'}</span><button type="submit" disabled={saving}>{saving ? 'Salvando…' : itemId ? 'Salvar alterações' : 'Cadastrar item'}</button></div>
            </form>
          </main>
        </div>}
      </section>
    </div>}
  </>
}
