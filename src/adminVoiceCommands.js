const CREATE_WORDS = /\b(cadastre|cadastrar|crie|criar|adicione|adicionar|inclua|incluir)\b/i
const SEARCH_WORDS = /\b(busque|buscar|procure|procurar|encontre|encontrar|pesquise|pesquisar)\b/i
const NAV_WORDS = /\b(abre|abra|abrir|mostrar|mostre|ir para|va para|vá para)\b/i
const DESTRUCTIVE_WORDS = /\b(exclua|excluir|delete|deletar|apague|apagar|remova|remover)\b/i

const FIELD_ALIASES = {
  name: ['nome'],
  email: ['e-mail', 'email'],
  username: ['nome de usuário', 'nome de usuario', 'username', 'login'],
  password: ['senha'],
  profile: ['perfil'],
  owner: ['responsável', 'responsavel', 'proprietário', 'proprietario', 'dono', 'usuário responsável', 'usuario responsavel'],
  application: ['aplicativo', 'aplicação', 'aplicacao', 'app'],
  city: ['cidade'],
  state: ['estado', 'uf'],
  cnpj: ['cnpj'],
  phone: ['telefone', 'celular', 'whatsapp'],
  category: ['categoria'],
  type: ['tipo'],
  price: ['preço', 'preco', 'valor'],
  description: ['descrição', 'descricao'],
  establishment: ['estabelecimento', 'empresa'],
  address: ['endereço', 'endereco'],
  cep: ['cep'],
}

const ENTITY_PATTERNS = [
  { entity: 'user', pattern: /\b(usuário|usuario)\b/i },
  { entity: 'establishment', pattern: /\b(empresa|estabelecimento|negócio|negocio)\b/i },
  { entity: 'item', type: 'product', pattern: /\b(produto)\b/i },
  { entity: 'item', type: 'service', pattern: /\b(serviço|servico)\b/i },
  { entity: 'item', type: 'ticket', pattern: /\b(ingresso|ticket)\b/i },
  { entity: 'item', type: 'item', pattern: /\b(item)\b/i },
]

const NAV_TARGETS = [
  { key: 'users', pattern: /\b(usuários|usuarios|usuário|usuario)\b/i },
  { key: 'establishments', pattern: /\b(estabelecimentos|empresas|empresa)\b/i },
  { key: 'items', pattern: /\b(itens|produtos|serviços|servicos|ingressos)\b/i },
  { key: 'applications', pattern: /\b(aplicações|aplicacoes|aplicativos|apps)\b/i },
  { key: 'profiles', pattern: /\b(perfis|permissões|permissoes)\b/i },
  { key: 'activity', pattern: /\b(atividade|interações|interacoes)\b/i },
  { key: 'financial', pattern: /\b(financeiro|financeira|pagamentos)\b/i },
  { key: 'audit', pattern: /\b(auditoria|logs)\b/i },
  { key: 'command', pattern: /\b(mission control|central de comando|operações|operacoes)\b/i },
  { key: 'dashboard', pattern: /\b(visão geral|visao geral|dashboard|painel)\b/i },
]

function normalizeSpaces(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function allMarkers() {
  return Object.entries(FIELD_ALIASES)
    .flatMap(([key, aliases]) => aliases.map(alias => ({ key, alias })))
    .sort((a, b) => b.alias.length - a.alias.length)
}

function parseSegments(text) {
  const markers = allMarkers()
  const aliasPattern = markers.map(({ alias }) => escapeRegex(alias)).join('|')
  const regex = new RegExp(`(?:^|[;,]|\\s)(${aliasPattern})\\s*(?::|=|é|eh)?\\s*`, 'gi')
  const matches = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const alias = match[1].toLowerCase()
    const marker = markers.find(item => item.alias.toLowerCase() === alias)
    if (marker) matches.push({ key: marker.key, alias: marker.alias, start: match.index, valueStart: regex.lastIndex })
  }

  const fields = {}
  matches.forEach((item, index) => {
    const end = matches[index + 1]?.start ?? text.length
    const value = normalizeSpaces(text.slice(item.valueStart, end).replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, ''))
    if (value) fields[item.key] = value
  })
  return { fields, firstMarkerStart: matches[0]?.start ?? -1 }
}

function leadingName(entityTail, firstMarkerStart) {
  const end = firstMarkerStart >= 0 ? firstMarkerStart : entityTail.length
  return normalizeSpaces(entityTail.slice(0, end)
    .replace(/^(novo|nova|chamado|chamada|de nome|com nome)\s+/i, '')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, ''))
}

function extractEmail(text) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
}

function normalizeMoney(value = '') {
  const raw = String(value).replace(/r\$/gi, '').replace(/\s/g, '')
  if (!raw) return null
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function inferEntity(text) {
  for (const item of ENTITY_PATTERNS) {
    const match = item.pattern.exec(text)
    if (match) return { ...item, match }
  }
  return null
}

function requiredFor(entity) {
  if (entity === 'user') return ['name', 'email']
  if (entity === 'establishment') return ['name', 'owner', 'application']
  if (entity === 'item') return ['name', 'establishment', 'application', 'price']
  return []
}

function missingFields(entity, fields) {
  return requiredFor(entity).filter(key => fields[key] === undefined || fields[key] === null || fields[key] === '')
}

export function parseAdminCommand(input) {
  const text = normalizeSpaces(input)
  if (!text) return { status: 'empty', message: 'Diga ou digite um comando administrativo.' }

  if (DESTRUCTIVE_WORDS.test(text)) {
    return {
      status: 'blocked',
      risk: 'destructive',
      message: 'Ações destrutivas por voz ficam bloqueadas. Use o fluxo visual do Admin Center para excluir ou remover recursos.',
      raw: text,
    }
  }

  if (SEARCH_WORDS.test(text)) {
    const query = normalizeSpaces(text.replace(SEARCH_WORDS, '').replace(/^(por|o|a|um|uma)\s+/i, ''))
    return query
      ? { status: 'ready', intent: 'search', query, raw: text, summary: `Buscar por “${query}” no ecossistema.` }
      : { status: 'incomplete', intent: 'search', missing: ['termo de busca'], raw: text }
  }

  if (NAV_WORDS.test(text)) {
    const target = NAV_TARGETS.find(item => item.pattern.test(text))
    return target
      ? { status: 'ready', intent: 'navigate', target: target.key, raw: text, summary: `Abrir a área ${target.key} do Admin Center.` }
      : { status: 'incomplete', intent: 'navigate', missing: ['área do Admin Center'], raw: text }
  }

  if (!CREATE_WORDS.test(text)) {
    return {
      status: 'unknown',
      raw: text,
      message: 'Ainda não reconheci essa solicitação. Posso cadastrar recursos, buscar informações ou abrir áreas do Admin Center.',
    }
  }

  const entityInfo = inferEntity(text)
  if (!entityInfo) {
    return { status: 'incomplete', intent: 'create', missing: ['tipo de recurso'], raw: text }
  }

  const entityTail = text.slice(entityInfo.match.index + entityInfo.match[0].length)
  const { fields, firstMarkerStart } = parseSegments(entityTail)
  if (!fields.name) fields.name = leadingName(entityTail, firstMarkerStart)
  if (!fields.email) fields.email = extractEmail(text)
  if (entityInfo.entity === 'item' && !fields.type) fields.type = entityInfo.type || 'item'
  if (fields.price !== undefined) fields.price = normalizeMoney(fields.price)
  if (fields.state) fields.state = fields.state.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)

  const missing = missingFields(entityInfo.entity, fields)
  return {
    status: missing.length ? 'incomplete' : 'ready',
    intent: 'create',
    entity: entityInfo.entity,
    fields,
    missing,
    raw: text,
    summary: buildSummary(entityInfo.entity, fields),
  }
}

export function buildSummary(entity, fields) {
  const labels = { user: 'usuário', establishment: 'estabelecimento', item: 'item' }
  const parts = [`Cadastrar ${labels[entity] || entity} “${fields.name || 'sem nome'}”`]
  if (fields.email) parts.push(`e-mail ${fields.email}`)
  if (fields.owner) parts.push(`responsável ${fields.owner}`)
  if (fields.application) parts.push(`aplicação ${fields.application}`)
  if (fields.establishment) parts.push(`estabelecimento ${fields.establishment}`)
  if (fields.price !== undefined && fields.price !== null) parts.push(`valor R$ ${Number(fields.price).toFixed(2).replace('.', ',')}`)
  return `${parts.join(' · ')}.`
}

export function commandExamples() {
  return [
    'Cadastre usuário João Silva email joao@exemplo.com',
    'Cadastre empresa Cirilo Ferragista responsável peter@exemplo.com aplicativo Nexus cidade Linhares uf ES',
    'Cadastre produto Martelo estabelecimento Cirilo Ferragista aplicativo Nexus valor 39,90 descrição Martelo profissional',
    'Busque usuário joao@exemplo.com',
    'Abra usuários',
  ]
}
