const CREATE = /\b(cadastre|cadastrar|crie|criar|adicione|adicionar|inclua|incluir|registre|registrar)\b/i
const SEARCH = /\b(busque|buscar|procure|procurar|encontre|encontrar|pesquise|pesquisar)\b/i
const NAVIGATE = /\b(abre|abra|abrir|mostrar|mostre|ir para|vá para|va para)\b/i
const DESTRUCTIVE = /\b(exclua|excluir|delete|deletar|apague|apagar|remova|remover|bloqueie|bloquear)\b/i

const ENTITIES = [
  { key: 'user.invite', entity: 'user', pattern: /\b(usuário|usuario|cliente|pessoa)\b/i },
  { key: 'establishment.create', entity: 'establishment', pattern: /\b(empresa|estabelecimento|negócio|negocio)\b/i },
  { key: 'item.create', entity: 'item', itemType: 'product', pattern: /\b(produto)\b/i },
  { key: 'item.create', entity: 'item', itemType: 'service', pattern: /\b(serviço|servico)\b/i },
  { key: 'item.create', entity: 'item', itemType: 'ticket', pattern: /\b(ingresso|ticket)\b/i },
  { key: 'item.create', entity: 'item', itemType: 'item', pattern: /\b(item)\b/i },
]

const FIELDS = {
  name: ['nome'],
  email: ['e-mail', 'email'],
  application: ['aplicativo', 'aplicação', 'aplicacao', 'app', 'plataforma'],
  owner: ['responsável', 'responsavel', 'proprietário', 'proprietario', 'dono', 'usuário responsável', 'usuario responsavel'],
  establishment: ['estabelecimento', 'empresa', 'negócio', 'negocio'],
  fantasy: ['nome fantasia', 'fantasia'],
  cnpj: ['cnpj'],
  phone: ['telefone', 'celular', 'whatsapp'],
  city: ['cidade'],
  state: ['estado', 'uf'],
  category: ['categoria'],
  subcategory: ['subcategoria'],
  type: ['tipo'],
  price: ['preço', 'preco', 'valor'],
  description: ['descrição', 'descricao'],
  address: ['endereço', 'endereco'],
  cep: ['cep'],
  brand: ['marca'],
  duration: ['duração', 'duracao'],
  stock: ['estoque'],
  profile: ['perfil'],
}

const NAV_TARGETS = [
  ['users', /\b(usuários|usuarios|clientes)\b/i],
  ['establishments', /\b(estabelecimentos|empresas)\b/i],
  ['items', /\b(itens|produtos|serviços|servicos|ingressos)\b/i],
  ['applications', /\b(aplicações|aplicacoes|aplicativos|apps|plataformas)\b/i],
  ['profiles', /\b(perfis|permissões|permissoes)\b/i],
  ['activity', /\b(atividade|interações|interacoes)\b/i],
  ['financial', /\b(financeiro|financeira|pagamentos|cobranças|cobrancas)\b/i],
  ['audit', /\b(auditoria|logs)\b/i],
  ['command', /\b(mission control|central de comando|operações|operacoes)\b/i],
  ['dashboard', /\b(visão geral|visao geral|dashboard|painel)\b/i],
]

function clean(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function stripJoiner(value = '') {
  return clean(String(value).replace(/\s+(?:e|depois|então|entao|em seguida)\s*$/i, ''))
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function aliases() {
  return Object.entries(FIELDS)
    .flatMap(([key, values]) => values.map(alias => ({ key, alias })))
    .sort((a, b) => b.alias.length - a.alias.length)
}

function parseFields(text) {
  const markers = aliases()
  const pattern = markers.map(({ alias }) => escapeRegex(alias)).join('|')
  const regex = new RegExp(`(?:^|[;,]|\\s)(${pattern})\\s*(?::|=|é|eh)?\\s*`, 'gi')
  const found = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const marker = markers.find(item => item.alias.toLowerCase() === match[1].toLowerCase())
    if (marker) found.push({ ...marker, start: match.index, valueStart: regex.lastIndex })
  }
  const fields = {}
  found.forEach((marker, index) => {
    const end = found[index + 1]?.start ?? text.length
    const value = stripJoiner(text.slice(marker.valueStart, end).replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, ''))
    if (value) fields[marker.key] = value
  })
  return { fields, firstMarker: found[0]?.start ?? -1 }
}

function extractEmail(text) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
}

function normalizePrice(value) {
  if (value === undefined || value === null || value === '') return undefined
  const raw = String(value).replace(/r\$/gi, '').replace(/\s/g, '')
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const number = Number(normalized.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : undefined
}

function inferEntity(segment) {
  return ENTITIES.find(item => item.pattern.test(segment)) || null
}

function actionStartIndexes(text) {
  const starts = []
  const patterns = [
    /\b(cadastre|cadastrar|crie|criar|adicione|adicionar|inclua|incluir|registre|registrar)\b\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:novo\s+|nova\s+)?(?:usuário|usuario|cliente|pessoa|empresa|estabelecimento|negócio|negocio|produto|serviço|servico|ingresso|ticket|item)\b/gi,
    /\b(busque|buscar|procure|procurar|encontre|encontrar|pesquise|pesquisar)\b/gi,
    /\b(abre|abra|abrir|mostrar|mostre|ir para|vá para|va para)\b/gi,
  ]
  patterns.forEach(regex => {
    for (const match of text.matchAll(regex)) starts.push(match.index)
  })
  return [...new Set(starts.filter(index => Number.isInteger(index)))].sort((a, b) => a - b)
}

function splitActions(text) {
  const starts = actionStartIndexes(text)
  if (starts.length <= 1) return [stripJoiner(text)]
  return starts
    .map((start, index) => stripJoiner(text.slice(start, starts[index + 1] ?? text.length)).replace(/^(e|depois|então|entao|em seguida)\s+/i, ''))
    .map(clean)
    .filter(Boolean)
}

function requiredFor(key) {
  if (key === 'user.invite') return ['name', 'email', 'application']
  if (key === 'establishment.create') return ['name', 'owner', 'application']
  if (key === 'item.create') return ['name', 'establishment', 'application', 'price']
  if (key === 'ecosystem.search') return ['query']
  if (key === 'admin.navigate') return ['target']
  return []
}

function leadingName(tail, firstMarker) {
  const end = firstMarker >= 0 ? firstMarker : tail.length
  return stripJoiner(tail.slice(0, end)
    .replace(/^(novo|nova|chamado|chamada|de nome|com nome|dele|dela|para ele|para ela)\s+/i, '')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, ''))
}

function parseSegment(segment, context = {}) {
  if (DESTRUCTIVE.test(segment)) {
    return { status: 'blocked', key: 'blocked', raw: segment, message: 'Ações destrutivas não são executadas por voz pelo Admin Copilot.' }
  }

  if (SEARCH.test(segment)) {
    const query = clean(segment.replace(SEARCH, '').replace(/^(por|o|a|um|uma)\s+/i, ''))
    return { status: query ? 'ready' : 'incomplete', key: 'ecosystem.search', payload: { query }, missing: query ? [] : ['query'], raw: segment }
  }

  if (NAVIGATE.test(segment)) {
    const target = NAV_TARGETS.find(([, pattern]) => pattern.test(segment))?.[0] || ''
    return { status: target ? 'ready' : 'incomplete', key: 'admin.navigate', payload: { target }, missing: target ? [] : ['target'], raw: segment }
  }

  if (!CREATE.test(segment)) return { status: 'unknown', key: 'unknown', raw: segment, message: 'Solicitação ainda não reconhecida pelo planejador.' }
  const entity = inferEntity(segment)
  if (!entity) return { status: 'incomplete', key: 'unknown', raw: segment, missing: ['resource'] }

  const match = entity.pattern.exec(segment)
  const tail = segment.slice((match?.index ?? 0) + (match?.[0]?.length ?? 0))
  const { fields, firstMarker } = parseFields(tail)
  if (!fields.name) fields.name = leadingName(tail, firstMarker)
  if (!fields.email) fields.email = extractEmail(segment)
  if (!fields.application && context.application) fields.application = context.application
  if (entity.key === 'establishment.create' && !fields.owner && context.user) fields.owner = context.user.email || context.user.name
  if (entity.key === 'item.create' && !fields.establishment && context.establishment) fields.establishment = context.establishment.name
  if (entity.key === 'item.create' && !fields.type) fields.type = entity.itemType || 'item'
  if (fields.price !== undefined) fields.price = normalizePrice(fields.price)
  if (fields.state) fields.state = fields.state.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)

  const missing = requiredFor(entity.key).filter(field => fields[field] === undefined || fields[field] === null || fields[field] === '')
  return { status: missing.length ? 'incomplete' : 'ready', key: entity.key, entity: entity.entity, payload: fields, missing, raw: segment }
}

function propagate(plan, initialContext = {}) {
  const actions = plan.map(action => ({ ...action, payload: { ...(action.payload || {}) } }))
  const inheritedApplication = actions.find(action => action.payload?.application)?.payload?.application || initialContext.application
  let sessionUser = initialContext.user || null
  let sessionEstablishment = initialContext.establishment || null

  actions.forEach(action => {
    if (inheritedApplication && action.payload && !action.payload.application && ['user.invite', 'establishment.create', 'item.create'].includes(action.key)) {
      action.payload.application = inheritedApplication
    }
    if (action.key === 'user.invite') {
      sessionUser = { name: action.payload.name, email: action.payload.email }
    }
    if (action.key === 'establishment.create') {
      if (!action.payload.owner && sessionUser) action.payload.owner = sessionUser.email || sessionUser.name
      sessionEstablishment = { name: action.payload.name }
    }
    if (action.key === 'item.create' && !action.payload.establishment && sessionEstablishment) {
      action.payload.establishment = sessionEstablishment.name
    }
    action.missing = requiredFor(action.key).filter(field => action.payload?.[field] === undefined || action.payload?.[field] === null || action.payload?.[field] === '')
    if (!['blocked', 'unknown'].includes(action.status)) action.status = action.missing.length ? 'incomplete' : 'ready'
  })

  return actions
}

export function planAdminCommand(input, context = {}) {
  const text = clean(input)
  if (!text) return { status: 'empty', actions: [], missing: [], message: 'Fale ou digite uma solicitação administrativa.' }
  if (DESTRUCTIVE.test(text)) return { status: 'blocked', actions: [], missing: [], message: 'Comandos destrutivos continuam bloqueados no Admin Copilot.' }

  const segments = splitActions(text)
  const parsed = propagate(segments.map(segment => parseSegment(segment, context)), context)
  const missing = parsed.flatMap((action, index) => (action.missing || []).map(field => ({ action: index, key: action.key, field })))
  const blocked = parsed.find(action => action.status === 'blocked')
  const unknown = parsed.find(action => action.status === 'unknown')

  return {
    status: blocked ? 'blocked' : unknown ? 'unknown' : missing.length ? 'incomplete' : 'ready',
    actions: parsed,
    missing,
    raw: text,
    compound: parsed.length > 1,
    message: blocked?.message || unknown?.message || '',
  }
}

export function splitPersonName(name = '') {
  const parts = clean(name).split(' ').filter(Boolean)
  return { first_name: parts.shift() || '', last_name: parts.join(' ') || null }
}

export function copilotExamples() {
  return [
    'Cadastre usuário João Silva email joao@exemplo.com aplicativo Nexus',
    'Cadastre empresa Oficina do João responsável joao@exemplo.com aplicativo Nexus cidade Linhares uf ES',
    'Cadastre produto Martelo estabelecimento Oficina do João aplicativo Nexus valor 39,90',
    'Cadastre usuário João Silva email joao@exemplo.com e crie empresa Oficina do João aplicativo Nexus e cadastre serviço Revisão valor 120',
    'Busque joao@exemplo.com',
  ]
}
