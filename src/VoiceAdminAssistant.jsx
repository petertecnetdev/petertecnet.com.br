import { useEffect, useMemo, useRef, useState } from 'react'
import './VoiceAdminAssistant.css'
import { requestAdminNavigation } from './admin/AdminUiEvents.js'
import { commandExamples, parseAdminCommand } from './adminVoiceCommands.js'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'

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
    throw new Error('Sua sessão expirou.')
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.message || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a solicitação.')
  }
  return data
}

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function exactResource(rows, reference, fields, label) {
  const ref = normalized(reference)
  if (!ref) throw new Error(`Informe ${label}.`)
  const exact = rows.filter(row => fields.some(field => normalized(row?.[field]) === ref) || String(row?.id) === String(reference).trim())
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) throw new Error(`Há mais de um ${label} correspondente a “${reference}”. Seja mais específico.`)
  if (rows.length === 1) return rows[0]
  throw new Error(`Não consegui identificar ${label} “${reference}” com segurança.`)
}

async function resolveUser(reference) {
  const payload = await api(`/admin/ecosystem/users?search=${encodeURIComponent(reference)}`)
  const rows = payload?.users || []
  return exactResource(rows, reference, ['email', 'user_name', 'first_name', 'last_name'], 'o usuário responsável')
}

async function resolveApplication(reference) {
  const payload = await api('/admin/applications')
  const rows = payload?.applications || payload?.data || []
  const ref = normalized(reference)
  const exact = rows.filter(row => [row?.name, row?.slug].some(value => normalized(value) === ref) || String(row?.id) === String(reference).trim())
  if (exact.length === 1) return exact[0]
  const partial = rows.filter(row => [row?.name, row?.slug].some(value => normalized(value).includes(ref)))
  if (partial.length === 1) return partial[0]
  throw new Error(`Não consegui identificar a aplicação “${reference}” com segurança.`)
}

async function resolveProfile(reference) {
  const payload = await api('/admin/ecosystem/profiles')
  const rows = payload?.profiles || []
  return exactResource(rows, reference, ['name', 'slug'], 'o perfil')
}

async function resolveEstablishment(reference) {
  const payload = await api(`/admin/ecosystem/establishments?search=${encodeURIComponent(reference)}`)
  const rows = payload?.establishments || []
  return exactResource(rows, reference, ['name', 'fantasy', 'slug', 'cnpj'], 'o estabelecimento')
}

function splitName(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  return { first_name: parts.shift() || '', last_name: parts.join(' ') }
}

function randomString(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$%&*_-'
  const bytes = new Uint32Array(length)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('')
}

function generatedUsername(fields) {
  const seed = fields.email?.split('@')[0] || fields.name || 'usuario'
  const base = normalized(seed).replace(/[^a-z0-9._-]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 70) || 'usuario'
  return `${base}.${randomString(5).replace(/[^a-zA-Z0-9]/g, 'x').toLowerCase()}`
}

function generatedPassword() {
  return `Pt!${randomString(15)}`
}

function optional(target, key, value, transform = v => v) {
  if (value !== undefined && value !== null && String(value).trim() !== '') target[key] = transform(value)
}

async function executeCreateUser(fields) {
  const names = splitName(fields.name)
  const userName = fields.username || generatedUsername(fields)
  const password = fields.password || generatedPassword()
  const body = {
    ...names,
    user_name: userName,
    email: fields.email.trim().toLowerCase(),
    password,
  }
  if (fields.profile) body.profile_id = (await resolveProfile(fields.profile)).id
  const payload = await api('/admin/ecosystem/users', { method: 'POST', body: JSON.stringify(body) })
  return {
    title: 'Usuário cadastrado',
    message: `${fields.name} foi criado com sucesso.`,
    resource: payload?.user || payload,
    credentials: fields.password ? null : { username: userName, temporary_password: password },
  }
}

async function executeCreateEstablishment(fields) {
  const [owner, application] = await Promise.all([
    resolveUser(fields.owner),
    resolveApplication(fields.application),
  ])
  const body = {
    name: fields.name,
    app_ids: [application.id],
    user_id: owner.id,
  }
  optional(body, 'fantasy', fields.fantasy)
  optional(body, 'cnpj', fields.cnpj)
  optional(body, 'email', fields.email, value => value.toLowerCase())
  optional(body, 'phone', fields.phone)
  optional(body, 'city', fields.city)
  optional(body, 'uf', fields.state)
  optional(body, 'category', fields.category)
  optional(body, 'type', fields.type)
  optional(body, 'address', fields.address)
  optional(body, 'cep', fields.cep)
  const payload = await api('/admin/ecosystem/establishments', { method: 'POST', body: JSON.stringify(body) })
  return {
    title: 'Estabelecimento cadastrado',
    message: `${fields.name} foi vinculado a ${application.name} e ao responsável ${owner.email || owner.user_name || owner.id}.`,
    resource: payload?.establishment || payload,
  }
}

function normalizeItemType(value) {
  const type = normalized(value)
  if (['produto', 'product'].includes(type)) return 'product'
  if (['servico', 'serviço', 'service'].includes(type)) return 'service'
  if (['ingresso', 'ticket'].includes(type)) return 'ticket'
  return 'item'
}

async function executeCreateItem(fields) {
  const [establishment, application] = await Promise.all([
    resolveEstablishment(fields.establishment),
    resolveApplication(fields.application),
  ])
  const body = {
    name: fields.name,
    app_id: application.id,
    entity_id: establishment.id,
    type: normalizeItemType(fields.type),
    price: Number(fields.price),
  }
  optional(body, 'description', fields.description)
  const payload = await api('/admin/ecosystem/items', { method: 'POST', body: JSON.stringify(body) })
  return {
    title: 'Item cadastrado',
    message: `${fields.name} foi cadastrado em ${establishment.name || establishment.fantasy} por R$ ${Number(fields.price).toFixed(2).replace('.', ',')}.`,
    resource: payload?.item || payload,
  }
}

async function executePlan(plan) {
  if (plan.intent === 'navigate') {
    requestAdminNavigation(plan.target, { source: 'voice-assistant' })
    return { title: 'Navegação concluída', message: 'A área solicitada foi aberta.' }
  }
  if (plan.intent === 'search') {
    const payload = await api(`/admin/ecosystem/command/search?q=${encodeURIComponent(plan.query)}`)
    const groups = Object.entries(payload?.groups || {}).filter(([, rows]) => rows?.length)
    const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0)
    return {
      title: 'Busca concluída',
      message: total ? `Encontrei ${total} resultado(s) em ${groups.length} grupo(s).` : 'Nenhum resultado encontrado.',
      searchGroups: groups.map(([name, rows]) => ({ name, count: rows.length, rows: rows.slice(0, 3) })),
    }
  }
  if (plan.intent === 'create' && plan.entity === 'user') return executeCreateUser(plan.fields)
  if (plan.intent === 'create' && plan.entity === 'establishment') return executeCreateEstablishment(plan.fields)
  if (plan.intent === 'create' && plan.entity === 'item') return executeCreateItem(plan.fields)
  throw new Error('Esse comando ainda não possui executor cadastrado.')
}

function PlanPreview({ plan }) {
  if (!plan) return null
  if (plan.status === 'blocked' || plan.status === 'unknown' || plan.status === 'empty') {
    return <div className={`vaa-notice ${plan.status === 'blocked' ? 'danger' : ''}`}>{plan.message}</div>
  }
  if (plan.status === 'incomplete') {
    return <div className="vaa-notice warn"><b>Faltam informações</b><span>{(plan.missing || []).join(', ')}.</span></div>
  }
  return <div className="vaa-plan">
    <div className="vaa-plan-head"><span>Prévia segura</span><b>{plan.summary}</b></div>
    {plan.fields && <dl>{Object.entries(plan.fields).filter(([, value]) => value !== '' && value !== undefined && value !== null).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>}
    {plan.entity === 'user' && (!plan.fields.username || !plan.fields.password) && <small>Se login ou senha não forem informados, credenciais temporárias fortes serão geradas na execução.</small>}
  </div>
}

function ResultView({ result }) {
  if (!result) return null
  return <div className="vaa-result" role="status">
    <b>{result.title}</b>
    <span>{result.message}</span>
    {result.credentials && <div className="vaa-credentials"><span>Credenciais temporárias — copie agora</span><code>Usuário: {result.credentials.username}</code><code>Senha: {result.credentials.temporary_password}</code></div>}
    {result.searchGroups?.length > 0 && <div className="vaa-search-results">{result.searchGroups.map(group => <div key={group.name}><b>{group.name} ({group.count})</b>{group.rows.map((row, index) => <span key={row?.id ?? index}>{row?.name || row?.title || row?.email || row?.user_name || `#${row?.id ?? index + 1}`}</span>)}</div>)}</div>}
  </div>
}

export default function VoiceAdminAssistant() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [plan, setPlan] = useState(null)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const recognitionRef = useRef(null)
  const examples = useMemo(commandExamples, [])
  const supported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => () => recognitionRef.current?.abort?.(), [])

  function resetDerived() {
    setPlan(null)
    setResult(null)
    setError('')
  }

  function startListening() {
    if (!supported) {
      setError('Este navegador não oferece reconhecimento de voz compatível. Você ainda pode digitar o comando normalmente.')
      setOpen(true)
      return
    }
    recognitionRef.current?.abort?.()
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    resetDerived()
    setInterim('')
    setListening(true)
    setOpen(true)

    recognition.onresult = event => {
      let finalText = ''
      let interimText = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const value = event.results[index][0]?.transcript || ''
        if (event.results[index].isFinal) finalText += value
        else interimText += value
      }
      if (finalText) setText(previous => `${previous ? `${previous} ` : ''}${finalText}`.trim())
      setInterim(interimText)
    }
    recognition.onerror = event => {
      const messages = {
        'not-allowed': 'Permissão de microfone negada pelo navegador.',
        'audio-capture': 'Não encontrei um microfone disponível.',
        'no-speech': 'Não detectei fala. Tente novamente.',
        network: 'O serviço de reconhecimento de voz do navegador não respondeu.',
      }
      setError(messages[event.error] || `Falha no reconhecimento de voz: ${event.error}.`)
    }
    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }
    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop?.()
  }

  function interpret() {
    setError('')
    setResult(null)
    setPlan(parseAdminCommand(text))
  }

  async function execute() {
    if (!plan || plan.status !== 'ready') return
    setExecuting(true)
    setError('')
    setResult(null)
    try {
      const response = await executePlan(plan)
      setResult(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setExecuting(false)
    }
  }

  return <div className={`vaa-root ${open ? 'open' : ''}`}>
    {!open && <button className="vaa-fab" type="button" onClick={startListening} aria-label="Abrir comandos por voz"><span className="vaa-mic-icon" aria-hidden="true"/> <b>Comando por voz</b></button>}
    {open && <section className="vaa-panel" aria-label="Assistente de comandos administrativos">
      <header>
        <div><span>ADMIN VOICE</span><h2>Comandos administrativos</h2><p>Fale ou digite. Nada é criado sem uma prévia e sua confirmação.</p></div>
        <button type="button" className="vaa-close" onClick={()=>{recognitionRef.current?.abort?.();setOpen(false)}} aria-label="Fechar">×</button>
      </header>

      <div className={`vaa-listen ${listening ? 'active' : ''}`}>
        <button type="button" className="vaa-mic" onClick={listening ? stopListening : startListening}><span className="vaa-mic-icon" aria-hidden="true"/>{listening ? 'Parar gravação' : 'Falar comando'}</button>
        <span>{listening ? 'Ouvindo em português (Brasil)…' : supported ? 'Microfone pronto' : 'Use o modo digitado neste navegador'}</span>
      </div>

      <label className="vaa-command-field">Comando
        <textarea rows="4" value={text} onChange={event=>{setText(event.target.value);resetDerived()}} placeholder="Ex.: Cadastre usuário João Silva email joao@exemplo.com"/>
        {interim && <small className="vaa-interim">{interim}</small>}
      </label>

      <div className="vaa-actions">
        <button type="button" onClick={()=>{setText('');setInterim('');resetDerived()}} disabled={executing}>Limpar</button>
        <button type="button" className="primary" onClick={interpret} disabled={!text.trim() || executing}>Interpretar</button>
        <button type="button" className="confirm" onClick={execute} disabled={plan?.status !== 'ready' || executing}>{executing ? 'Executando…' : 'Confirmar e executar'}</button>
      </div>

      {error && <div className="vaa-notice danger" role="alert">{error}</div>}
      <PlanPreview plan={plan}/>
      <ResultView result={result}/>

      <details className="vaa-examples"><summary>Exemplos de comandos</summary>{examples.map(example => <button type="button" key={example} onClick={()=>{setText(example);resetDerived()}}>{example}</button>)}</details>
      <footer>O Admin Center não salva o áudio. O reconhecimento de fala é fornecido pelo navegador; somente o texto transcrito é usado para montar a solicitação administrativa.</footer>
    </section>}
  </div>
}
