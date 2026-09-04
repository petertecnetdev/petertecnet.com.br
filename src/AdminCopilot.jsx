import { useEffect, useMemo, useRef, useState } from 'react'
import './AdminCopilot.css'
import { requestAdminNavigation } from './admin/AdminUiEvents.js'
import { copilotExamples, planAdminCommand, splitPersonName } from './admin/AdminCopilotPlanner.js'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
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
      throw new Error('Sua sessão administrativa expirou.')
    }
    if (!response.ok) {
      const validation = Object.values(data?.errors || {}).flat()?.[0]
      throw new Error(validation || data?.message || data?.error || 'Não foi possível concluir a solicitação.')
    }
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function sessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `copilot-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function itemType(value = '') {
  const normalized = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (normalized.includes('produt')) return 'product'
  if (normalized.includes('servic')) return 'service'
  if (normalized.includes('ingresso') || normalized.includes('ticket')) return 'ticket'
  return 'item'
}

function compactObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

function onboardingBody(actions, dryRun = false) {
  const user = actions.find(action => action.key === 'user.invite')
  if (!user) return null
  const establishment = actions.find(action => action.key === 'establishment.create')
  const items = actions.filter(action => action.key === 'item.create')
  const person = splitPersonName(user.payload.name)
  const body = {
    email: user.payload.email,
    app_id: Number(user.payload.application),
    user: person,
    dry_run: dryRun,
  }
  if (establishment) {
    body.establishment = compactObject({
      name: establishment.payload.name,
      fantasy: establishment.payload.fantasy,
      cnpj: establishment.payload.cnpj,
      phone: establishment.payload.phone,
      email: establishment.payload.email,
      description: establishment.payload.description,
      category: establishment.payload.category,
      type: establishment.payload.type,
      city: establishment.payload.city,
      uf: establishment.payload.state,
      address: establishment.payload.address,
      cep: establishment.payload.cep,
      is_published: true,
      is_approved: true,
    })
    body.items = items.map(action => compactObject({
      name: action.payload.name,
      type: itemType(action.payload.type),
      price: Number(action.payload.price),
      description: action.payload.description,
      category: action.payload.category,
      subcategory: action.payload.subcategory,
      brand: action.payload.brand,
      duration: action.payload.duration ? Number(action.payload.duration) : undefined,
      stock: action.payload.stock ? Number(action.payload.stock) : undefined,
      status: true,
      is_featured: false,
    }))
  }
  return body
}

async function audit(payload) {
  try {
    await api('/admin/ecosystem/copilot/audit', { method: 'POST', body: JSON.stringify(payload) })
  } catch (error) {
    console.warn('[Admin Copilot] audit failed', error)
  }
}

function summarizeAction(action) {
  const labels = {
    'user.invite': 'Convidar usuário',
    'establishment.create': 'Cadastrar estabelecimento',
    'item.create': 'Cadastrar item',
    'ecosystem.search': 'Buscar',
    'admin.navigate': 'Navegar',
  }
  const subject = action.payload?.name || action.payload?.query || action.payload?.target || ''
  return `${labels[action.key] || action.key}${subject ? ` · ${subject}` : ''}`
}

export default function AdminCopilot() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [plan, setPlan] = useState(null)
  const [preflight, setPreflight] = useState(null)
  const [capabilities, setCapabilities] = useState([])
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [context, setContext] = useState({})
  const [conversationId, setConversationId] = useState(sessionId)
  const recognitionRef = useRef(null)
  const examples = useMemo(copilotExamples, [])
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => () => recognitionRef.current?.abort?.(), [])

  useEffect(() => {
    if (!open || capabilities.length) return
    void api('/admin/ecosystem/copilot/capabilities')
      .then(payload => setCapabilities(payload?.capabilities || []))
      .catch(() => setCapabilities([]))
  }, [open, capabilities.length])

  function clearDerived() {
    setPlan(null)
    setPreflight(null)
    setConfirmed(false)
    setResult(null)
    setError('')
  }

  function newConversation() {
    recognitionRef.current?.abort?.()
    setText('')
    setInterim('')
    setPlan(null)
    setPreflight(null)
    setConfirmed(false)
    setResult(null)
    setError('')
    setContext({})
    setConversationId(sessionId())
  }

  function startListening() {
    setOpen(true)
    if (!speechSupported) {
      setError('Este navegador não oferece reconhecimento de voz compatível. O modo digitado continua disponível.')
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
    clearDerived()
    setInterim('')
    setListening(true)

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
        'audio-capture': 'Nenhum microfone disponível.',
        'no-speech': 'Não detectei fala. Tente novamente.',
        network: 'O serviço de reconhecimento de voz não respondeu.',
      }
      setError(messages[event.error] || `Falha no reconhecimento de voz: ${event.error}.`)
    }
    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }
    recognition.start()
  }

  async function interpretAndValidate() {
    setBusy(true)
    setError('')
    setResult(null)
    setConfirmed(false)
    try {
      const nextPlan = planAdminCommand(text, context)
      setPlan(nextPlan)
      setPreflight(null)
      if (nextPlan.status !== 'ready') return

      const check = await api('/admin/ecosystem/copilot/preflight', {
        method: 'POST',
        body: JSON.stringify({
          actions: nextPlan.actions.map(action => ({ key: action.key, payload: action.payload })),
          context,
        }),
      })

      let executorCheck = null
      const normalizedActions = check?.actions || []
      if (normalizedActions.some(action => action.key === 'user.invite')) {
        const body = onboardingBody(normalizedActions, true)
        if (body) executorCheck = await api('/admin/ecosystem/onboarding', { method: 'POST', body: JSON.stringify(body) })
      }
      setPreflight({ ...check, executor_check: executorCheck })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function executeSingle(action) {
    if (action.key === 'ecosystem.search') {
      const payload = await api(`/admin/ecosystem/command/search?q=${encodeURIComponent(action.payload.query)}`)
      const groups = Object.entries(payload?.groups || {}).filter(([, rows]) => rows?.length)
      return { type: 'search', groups, total: groups.reduce((sum, [, rows]) => sum + rows.length, 0) }
    }
    if (action.key === 'admin.navigate') {
      requestAdminNavigation(action.payload.target, { source: 'admin-copilot' })
      return { type: 'navigate', target: action.payload.target }
    }
    if (action.key === 'establishment.create') {
      return api('/admin/ecosystem/establishments', {
        method: 'POST',
        body: JSON.stringify(compactObject({
          name: action.payload.name,
          fantasy: action.payload.fantasy,
          cnpj: action.payload.cnpj,
          email: action.payload.email,
          phone: action.payload.phone,
          city: action.payload.city,
          uf: action.payload.state,
          category: action.payload.category,
          type: action.payload.type,
          address: action.payload.address,
          cep: action.payload.cep,
          app_ids: [Number(action.payload.application)],
          user_id: Number(action.payload.owner),
        })),
      })
    }
    if (action.key === 'item.create') {
      return api('/admin/ecosystem/items', {
        method: 'POST',
        body: JSON.stringify(compactObject({
          name: action.payload.name,
          app_id: Number(action.payload.application),
          entity_id: Number(action.payload.establishment),
          type: itemType(action.payload.type),
          price: Number(action.payload.price),
          description: action.payload.description,
          category: action.payload.category,
        })),
      })
    }
    throw new Error(`Executor não disponível para ${action.key}.`)
  }

  async function executePlan() {
    if (!preflight?.valid) return
    if (preflight.requires_confirmation && !confirmed) {
      setError('Confirme a prévia antes de executar alterações administrativas.')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    const normalizedActions = preflight.actions || []
    try {
      let output
      const onboarding = onboardingBody(normalizedActions, false)
      if (onboarding) {
        output = await api('/admin/ecosystem/onboarding', { method: 'POST', body: JSON.stringify(onboarding) })
        setContext(previous => ({
          ...previous,
          application: output?.application?.name || output?.application?.slug || previous.application,
          user: output?.user ? { name: [output.user.first_name, output.user.last_name].filter(Boolean).join(' '), email: output.user.email, id: output.user.id } : previous.user,
          establishment: output?.establishment ? { name: output.establishment.name, id: output.establishment.id } : previous.establishment,
        }))
      } else {
        const outputs = []
        for (const action of normalizedActions) outputs.push(await executeSingle(action))
        output = { actions: outputs }
      }

      const summary = normalizedActions.map(summarizeAction)
      const success = { title: 'Plano executado', message: `${summary.length} ação(ões) concluída(s).`, output, summary }
      setResult(success)
      await audit({ status: 'success', transcript: text, plan: normalizedActions, result: output, session_id: conversationId })
    } catch (err) {
      setError(err.message)
      await audit({ status: 'error', transcript: text, plan: normalizedActions, result: { message: err.message }, session_id: conversationId })
    } finally {
      setBusy(false)
    }
  }

  const warnings = [
    ...(preflight?.actions || []).flatMap(action => action.warnings || []),
    ...(preflight?.executor_check?.warnings || []),
  ]

  return <div className={`acp-root ${open ? 'open' : ''}`}>
    {!open && <button type="button" className="acp-fab" onClick={startListening} aria-label="Abrir Admin Copilot"><span className="acp-mic"/><b>Admin Copilot</b></button>}
    {open && <section className="acp-panel" aria-label="Admin Copilot">
      <header className="acp-header">
        <div><span>ADMIN COPILOT</span><h2>Operação por voz e linguagem natural</h2><p>Planeja, valida, confirma, executa e audita ações administrativas.</p></div>
        <div className="acp-header-actions"><button type="button" onClick={newConversation}>Nova conversa</button><button type="button" className="acp-close" onClick={()=>{recognitionRef.current?.abort?.();setOpen(false)}} aria-label="Fechar">×</button></div>
      </header>

      <div className="acp-statusbar"><span><i className="ok"/>API protegida</span><span><i className={speechSupported?'ok':'warn'}/>{speechSupported?'Voz pt-BR':'Modo digitado'}</span><span><i className="ok"/>{capabilities.length || '—'} capacidades</span><span>Sessão contextual ativa</span></div>

      <div className={`acp-listener ${listening ? 'listening' : ''}`}>
        <button type="button" onClick={listening ? ()=>recognitionRef.current?.stop?.() : startListening}><span className="acp-mic"/>{listening?'Parar':'Falar'}</button>
        <div><b>{listening?'Ouvindo…':'Diga uma solicitação completa'}</b><span>{interim || 'Você pode combinar usuário, empresa e itens no mesmo comando.'}</span></div>
      </div>

      <label className="acp-input">Solicitação
        <textarea rows="5" value={text} onChange={event=>{setText(event.target.value);clearDerived()}} placeholder="Ex.: Cadastre usuário João Silva email joao@exemplo.com e crie empresa Oficina do João aplicativo Nexus e cadastre serviço Revisão valor 120"/>
      </label>

      <div className="acp-actions"><button type="button" className="primary" onClick={interpretAndValidate} disabled={busy || !text.trim()}>{busy?'Validando…':'Interpretar e simular'}</button><button type="button" onClick={()=>{setText('');clearDerived()}} disabled={busy}>Limpar solicitação</button></div>

      {error && <div className="acp-notice danger" role="alert"><b>Não executado</b><span>{error}</span></div>}
      {plan?.message && <div className="acp-notice warn"><span>{plan.message}</span></div>}
      {plan?.missing?.length > 0 && <div className="acp-notice warn"><b>Informações faltando</b><span>{plan.missing.map(item=>`${item.key}: ${item.field}`).join(' · ')}</span></div>}

      {plan?.actions?.length > 0 && <section className="acp-plan"><header><div><span>PLANO</span><h3>{plan.actions.length} etapa(s){plan.compound?' · comando composto':''}</h3></div><b className={`risk ${preflight?.risk || 'draft'}`}>{preflight?.risk || plan.status}</b></header><ol>{plan.actions.map((action,index)=><li key={`${action.key}-${index}`}><span>{index+1}</span><div><b>{summarizeAction(action)}</b><small>{action.raw}</small>{action.missing?.length>0&&<em>Falta: {action.missing.join(', ')}</em>}</div></li>)}</ol></section>}

      {preflight?.valid && <section className="acp-preflight"><header><div><span>SIMULAÇÃO VALIDADA</span><h3>Nenhuma gravação feita até aqui</h3></div><strong>{preflight.risk}</strong></header>{warnings.length>0&&<div className="acp-warnings">{warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div>}<div className="acp-resolved">{preflight.actions.map((action,index)=><article key={`${action.key}-${index}`}><b>{action.label}</b><span>{Object.entries(action.resolved || {}).map(([key,value])=>`${key}: ${value?.name || value?.email || value?.fantasy || value?.id || 'contexto do plano'}`).join(' · ') || 'Sem referências externas'}</span></article>)}</div>{preflight.requires_confirmation&&<label className="acp-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>Revisei o plano e autorizo a execução destas alterações.</span></label>}<button type="button" className="execute" disabled={busy || (preflight.requires_confirmation && !confirmed)} onClick={executePlan}>{busy?'Executando…':preflight.requires_confirmation?'Confirmar e executar':'Executar'}</button></section>}

      {result && <section className="acp-result" role="status"><span>CONCLUÍDO</span><h3>{result.title}</h3><p>{result.message}</p><div>{result.summary?.map(item=><b key={item}>{item}</b>)}</div>{result.output?.mail_sent===false&&<div className="acp-notice warn"><span>O cadastro foi gravado, mas o e-mail de convite não foi enviado. Verifique a configuração de e-mail.</span></div>}</section>}

      {!plan && !result && <section className="acp-examples"><span>EXEMPLOS</span>{examples.map(example=><button type="button" key={example} onClick={()=>{setText(example);clearDerived()}}>{example}</button>)}</section>}
    </section>}
  </div>
}
