import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminEstablishmentsPageBridge.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'

const emptyForm = {
  name: '', fantasy: '', cnpj: '', type: '', category: '', phone: '', email: '', description: '',
  city: '', uf: '', cep: '', address: '', website_url: '', instagram_url: '', user_id: '', app_id: '', app_ids: [],
  is_published: true, is_approved: true, is_featured: false, is_cancelled: false,
}

const clean = value => {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}
const digits = value => String(value ?? '').replace(/\D+/g, '')
const nameOf = row => row?.fantasy || row?.name || `Estabelecimento #${row?.id}`
const fullName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const linkedAppIds = row => [...new Set([...(row?.applications || []).map(app => Number(app.id)), Number(row?.app_id)].filter(Boolean))]

function formatDocument(value) {
  const raw = digits(value).slice(0, 14)
  if (raw.length <= 11) return raw.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
  return raw.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\/\d{4})(\d)/, '$1-$2')
}
function formatPhone(value) {
  const raw = digits(value).slice(0, 11)
  if (!raw) return ''
  if (raw.length <= 10) return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
function formatCep(value) { return digits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2') }

function normalizeEstablishment(row = {}) {
  const appIds = linkedAppIds(row)
  return {
    ...emptyForm,
    ...row,
    cnpj: formatDocument(row?.cnpj || ''),
    phone: formatPhone(row?.phone || ''),
    cep: formatCep(row?.cep || ''),
    user_id: row?.user_id || row?.user?.id || '',
    app_id: row?.app_id || appIds[0] || '',
    app_ids: appIds,
    is_published: row?.is_published !== false,
    is_approved: row?.is_approved !== false,
    is_featured: !!row?.is_featured,
    is_cancelled: !!row?.is_cancelled,
  }
}

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
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
  if (!response.ok) throw new Error(data?.error || data?.message || Object.values(data?.errors || {})?.flat()?.[0] || `Falha ao acessar ${path}.`)
  return data
}

function useInlineTarget() {
  const [target, setTarget] = useState(null)
  useEffect(() => {
    let host = null
    const sync = () => {
      const main = document.querySelector('.ecosystem-main')
      const active = [...document.querySelectorAll('.ecosystem-sidebar nav button')].find(button => button.classList.contains('active'))
      const isEstablishments = active?.textContent?.trim() === 'Estabelecimentos'
      if (!main || !isEstablishments) {
        document.querySelector('.ecosystem-main')?.classList.remove('establishments-inline-active')
        setTarget(null)
        return
      }
      main.classList.add('establishments-inline-active')
      host = main.querySelector(':scope > .establishments-inline-host')
      if (!host) {
        host = document.createElement('div')
        host.className = 'establishments-inline-host'
        main.appendChild(host)
      }
      setTarget(host)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
    document.addEventListener('click', sync, true)
    window.addEventListener('popstate', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', sync, true)
      window.removeEventListener('popstate', sync)
      document.querySelector('.ecosystem-main')?.classList.remove('establishments-inline-active')
      host?.remove()
    }
  }, [])
  return target
}

function Field({ label, value, onChange, type = 'text', placeholder = '', wide = false, required = false, textarea = false, onBlur }) {
  return <label className={`est-field${wide ? ' est-wide' : ''}`}><span>{label}{required ? ' *' : ''}</span>{textarea
    ? <textarea rows="5" value={value ?? ''} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    : <input type={type} value={value ?? ''} placeholder={placeholder} required={required} onBlur={onBlur} onChange={event => onChange(event.target.value)} />}</label>
}

function Toggle({ label, detail, checked, onChange }) {
  return <label className="est-toggle"><input type="checkbox" checked={!!checked} onChange={event => onChange(event.target.checked)} /><span><b>{label}</b><small>{detail}</small></span></label>
}

function AdminEstablishmentsPage() {
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState([])
  const [apps, setApps] = useState([])
  const [query, setQuery] = useState('')
  const [ownerQuery, setOwnerQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cepStatus, setCepStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [estResult, usersResult, appsResult] = await Promise.allSettled([
      api('/admin/ecosystem/establishments'),
      api('/admin/ecosystem/users'),
      api('/admin/applications'),
    ])
    if (estResult.status === 'fulfilled') setRows(estResult.value?.establishments || estResult.value?.data || [])
    else setError(`Não foi possível carregar os estabelecimentos: ${estResult.reason?.message || 'erro desconhecido'}`)
    if (usersResult.status === 'fulfilled') setUsers(usersResult.value?.users || usersResult.value?.data || [])
    if (appsResult.status === 'fulfilled') setApps(appsResult.value?.applications || appsResult.value?.data || [])
    if (usersResult.status === 'rejected' || appsResult.status === 'rejected') {
      const parts = []
      if (usersResult.status === 'rejected') parts.push(`usuários: ${usersResult.reason?.message || 'erro'}`)
      if (appsResult.status === 'rejected') parts.push(`aplicações: ${appsResult.reason?.message || 'erro'}`)
      setError(current => current || `Cadastro carregado parcialmente (${parts.join('; ')}).`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filteredRows = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return rows
    return rows.filter(row => normalize([row.name, row.fantasy, row.cnpj, row.email, row.city, row.uf, row.user?.email].filter(Boolean).join(' ')).includes(needle))
  }, [rows, query])

  const ownerOptions = useMemo(() => {
    const needle = normalize(ownerQuery)
    const selected = users.find(user => Number(user.id) === Number(form.user_id))
    const found = users.filter(user => !needle || normalize(`${fullName(user)} ${user.email || ''}`).includes(needle)).slice(0, 12)
    return selected && !found.some(user => Number(user.id) === Number(selected.id)) ? [selected, ...found] : found
  }, [users, ownerQuery, form.user_id])

  const completeness = useMemo(() => {
    const checks = [form.name, form.fantasy, form.user_id, form.app_ids.length, form.phone, form.email, form.city, form.uf, form.address, form.description]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [form])

  function startNew() {
    setEditingId(null)
    setForm(emptyForm)
    setOwnerQuery('')
    setError('')
    setSuccess('')
    setCepStatus('')
  }

  function edit(row) {
    setEditingId(row.id)
    setForm(normalizeEstablishment(row))
    setOwnerQuery(row?.user?.email || fullName(row?.user || {}))
    setError('')
    setSuccess('')
    setCepStatus('')
  }

  function setValue(key, value) { setForm(current => ({ ...current, [key]: value })) }

  function toggleApp(id, checked) {
    const numeric = Number(id)
    setForm(current => {
      const next = checked ? [...new Set([...current.app_ids, numeric])] : current.app_ids.filter(appId => Number(appId) !== numeric)
      const primary = next.includes(Number(current.app_id)) ? Number(current.app_id) : next[0] || ''
      return { ...current, app_ids: next, app_id: primary }
    })
  }

  async function lookupCep() {
    const cep = digits(form.cep)
    if (cep.length !== 8) return
    setCepStatus('Consultando CEP…')
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()
      if (!response.ok || data?.erro) throw new Error('CEP não encontrado')
      setForm(current => ({
        ...current,
        city: data.localidade || current.city,
        uf: data.uf || current.uf,
        address: [data.logradouro, data.bairro].filter(Boolean).join(', ') || current.address,
      }))
      setCepStatus('CEP localizado e endereço preenchido.')
    } catch {
      setCepStatus('Não foi possível preencher o endereço automaticamente.')
    }
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim()) return setError('Informe a razão social ou nome do estabelecimento.')
    if (!Number(form.user_id)) return setError('Selecione o responsável pelo estabelecimento.')
    const appIds = [...new Set(form.app_ids.map(Number).filter(Boolean))]
    if (!appIds.length) return setError('Selecione pelo menos uma aplicação.')
    const appId = appIds.includes(Number(form.app_id)) ? Number(form.app_id) : appIds[0]
    const body = {
      name: form.name.trim(), fantasy: clean(form.fantasy), cnpj: clean(form.cnpj), type: clean(form.type), category: clean(form.category),
      phone: clean(form.phone), email: clean(form.email), description: clean(form.description), city: clean(form.city), uf: clean(form.uf)?.toUpperCase() || null,
      cep: clean(form.cep), address: clean(form.address), website_url: clean(form.website_url), instagram_url: clean(form.instagram_url),
      user_id: Number(form.user_id), app_id: appId, app_ids: appIds, is_published: !!form.is_published, is_approved: !!form.is_approved,
      is_featured: !!form.is_featured, is_cancelled: !!form.is_cancelled,
    }
    setSaving(true)
    try {
      const result = await api(`/admin/ecosystem/establishments${editingId ? `/${editingId}` : ''}`, { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) })
      const saved = result?.establishment || result?.data || { ...body, id: editingId }
      await load()
      if (saved?.id) {
        setEditingId(saved.id)
        setForm(normalizeEstablishment(saved))
      }
      setSuccess(editingId ? 'Estabelecimento atualizado com sucesso.' : 'Estabelecimento cadastrado com sucesso.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="establishments-inline-page">
    <div className="est-page-intro"><div><p>GESTÃO DE ESTABELECIMENTOS</p><h2>Cadastro e edição</h2><span>Gerencie responsável, aplicações, dados comerciais, endereço e publicação sem sair da página.</span></div><button type="button" onClick={load} disabled={loading || saving}>Atualizar dados</button></div>

    {error && <div className="est-notice is-error" role="alert">{error}</div>}
    {success && <div className="est-notice is-success" role="status">{success}</div>}

    <div className="est-layout">
      <aside className="est-records">
        <div className="est-records-head"><div><b>Estabelecimentos</b><small>{rows.length} cadastrados</small></div><button type="button" onClick={startNew}>+ Novo</button></div>
        <input className="est-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, CNPJ, e-mail, cidade…" />
        <div className="est-record-list">{loading ? <div className="est-empty">Carregando…</div> : filteredRows.length ? filteredRows.map(row => <button type="button" key={row.id} className={Number(editingId) === Number(row.id) ? 'est-record is-selected' : 'est-record'} onClick={() => edit(row)}><span><b>{nameOf(row)}</b><small>{row.user?.email || row.email || 'Sem e-mail'}</small><i>{[row.city, row.uf].filter(Boolean).join(' / ') || 'Localidade não informada'}</i></span><em>{row.is_approved === false ? 'Pendente' : row.is_cancelled ? 'Cancelado' : 'Ativo'}</em></button>) : <div className="est-empty">Nenhum estabelecimento encontrado.</div>}</div>
      </aside>

      <main className="est-editor">
        <div className="est-editor-heading"><div><p>{editingId ? `EDITANDO #${editingId}` : 'NOVO CADASTRO'}</p><h2>{editingId ? (form.fantasy || form.name || 'Editar estabelecimento') : 'Cadastrar estabelecimento'}</h2><span>O conteúdo se adapta à largura disponível do Admin Center.</span></div>{editingId && <button type="button" onClick={startNew}>Criar outro</button>}</div>

        <div className="est-progress"><div><strong>{completeness}%</strong><span>completo</span></div><progress max="100" value={completeness} /></div>

        <form onSubmit={save}>
          <section className="est-section"><div className="est-section-title"><h3>Identificação</h3><p>Dados que o cliente e o público reconhecem com facilidade.</p></div><div className="est-grid">
            <Field label="Razão social / nome" value={form.name} onChange={value => setValue('name', value)} required wide placeholder="Ex.: Ferragista São José" />
            <Field label="Nome fantasia" value={form.fantasy} onChange={value => setValue('fantasy', value)} placeholder="Nome que aparece para o público" />
            <Field label="CPF/CNPJ" value={form.cnpj} onChange={value => setValue('cnpj', formatDocument(value))} placeholder="00.000.000/0000-00" />
            <Field label="Tipo de estabelecimento" value={form.type} onChange={value => setValue('type', value)} placeholder="Ex.: produção, restaurante, barbearia" />
            <Field label="Categoria" value={form.category} onChange={value => setValue('category', value)} placeholder="Ex.: Eventos" />
          </div></section>

          <section className="est-section"><div className="est-section-title"><h3>Responsável e aplicações</h3><p>Troque o proprietário aqui quando o cadastro tiver sido criado por outro usuário.</p></div><div className="est-grid">
            <label className="est-field est-wide"><span>Buscar responsável</span><input value={ownerQuery} onChange={event => setOwnerQuery(event.target.value)} placeholder="Nome ou e-mail do usuário" /></label>
            <div className="est-owner-results est-wide">{ownerOptions.map(user => <button type="button" key={user.id} className={Number(form.user_id) === Number(user.id) ? 'is-selected' : ''} onClick={() => { setValue('user_id', Number(user.id)); setOwnerQuery(user.email || fullName(user)) }}><b>{fullName(user)}</b><span>{user.email}</span>{Number(form.user_id) === Number(user.id) && <em>Responsável atual</em>}</button>)}</div>
            <div className="est-app-grid est-wide">{apps.map(app => { const checked = form.app_ids.includes(Number(app.id)); return <label key={app.id} className={checked ? 'est-app is-selected' : 'est-app'}><input type="checkbox" checked={checked} onChange={event => toggleApp(app.id, event.target.checked)} /><span><b>{app.name}</b><small>{checked ? 'Vinculada' : 'Disponível'}</small></span></label> })}</div>
          </div></section>

          <section className="est-section"><div className="est-section-title"><h3>Contato</h3><p>Informações usadas na apresentação pública e no atendimento.</p></div><div className="est-grid">
            <Field label="Telefone" type="tel" value={form.phone} onChange={value => setValue('phone', formatPhone(value))} placeholder="(00) 00000-0000" />
            <Field label="E-mail" type="email" value={form.email} onChange={value => setValue('email', value)} placeholder="contato@empresa.com" />
            <Field label="Website" type="url" value={form.website_url} onChange={value => setValue('website_url', value)} placeholder="https://…" />
            <Field label="Instagram" type="url" value={form.instagram_url} onChange={value => setValue('instagram_url', value)} placeholder="https://instagram.com/…" />
          </div></section>

          <section className="est-section"><div className="est-section-title"><h3>Endereço</h3><p>O CEP pode preencher cidade, UF e parte do endereço automaticamente.</p></div><div className="est-grid">
            <Field label="CEP" value={form.cep} onChange={value => setValue('cep', formatCep(value))} onBlur={lookupCep} placeholder="00000-000" />
            <Field label="Cidade" value={form.city} onChange={value => setValue('city', value)} />
            <Field label="UF" value={form.uf} onChange={value => setValue('uf', value.slice(0, 2).toUpperCase())} />
            <Field label="Endereço completo" value={form.address} onChange={value => setValue('address', value)} wide placeholder="Rua, número, complemento, bairro" />
            {cepStatus && <p className="est-hint est-wide">{cepStatus}</p>}
          </div></section>

          <section className="est-section"><div className="est-section-title"><h3>Apresentação e visibilidade</h3><p>Descrição e estado administrativo do estabelecimento.</p></div><div className="est-grid">
            <Field label="Descrição" value={form.description} onChange={value => setValue('description', value)} wide textarea placeholder="Explique o que o estabelecimento oferece." />
            <div className="est-toggles est-wide"><Toggle label="Aprovado" detail="Libera o estabelecimento" checked={form.is_approved} onChange={value => setValue('is_approved', value)} /><Toggle label="Publicado" detail="Pode aparecer para o público" checked={form.is_published} onChange={value => setValue('is_published', value)} /><Toggle label="Destaque" detail="Recebe prioridade de exibição" checked={form.is_featured} onChange={value => setValue('is_featured', value)} /><Toggle label="Cancelado" detail="Mantém o registro desativado" checked={form.is_cancelled} onChange={value => setValue('is_cancelled', value)} /></div>
          </div></section>

          <div className="est-savebar"><span>{editingId ? 'Revise as alterações antes de salvar.' : 'Preencha os dados obrigatórios para cadastrar.'}</span><button type="submit" disabled={saving}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar estabelecimento'}</button></div>
        </form>
      </main>
    </div>
  </div>
}

export default function AdminEstablishmentsPageBridge() {
  const target = useInlineTarget()
  return target ? createPortal(<AdminEstablishmentsPage />, target) : null
}
