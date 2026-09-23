export const ADMIN_ENTITY_ROUTES = Object.freeze({
  users: '/usuarios',
  profiles: '/perfis',
  applications: '/aplicacoes',
  establishments: '/estabelecimentos',
  items: '/itens',
  events: '/eventos',
  orders: '/pedidos',
  payments: '/pagamentos',
  payouts: '/repasses',
  files: '/arquivos',
  audit: '/auditoria',
})

export const ADMIN_RESOURCE_SCOPES = Object.freeze({
  users: 'global',
  profiles: 'global',
  applications: 'global',
  establishments: 'application',
  items: 'establishment',
  events: 'application',
  orders: 'application',
  payments: 'application',
  payouts: 'application',
  files: 'shared',
  audit: 'global',
})

const segment = value => encodeURIComponent(String(value ?? '').trim())

export const adminEntityRoute = Object.freeze({
  user: userId => `${ADMIN_ENTITY_ROUTES.users}/${segment(userId)}`,
  application: applicationId => `${ADMIN_ENTITY_ROUTES.applications}/${segment(applicationId)}`,
  establishment: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}`,
  collaborators: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/colaboradores`,
  establishmentItems: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/itens`,
  establishmentEvents: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/eventos`,
  event: (establishmentId, eventId) => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/eventos/${segment(eventId)}`,
  tickets: (establishmentId, eventId) => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/eventos/${segment(eventId)}/ingressos`,
})

// O Admin Center administra domínios de negócio, não tabelas de um aplicativo específico.
// Cada recurso declara seu escopo: global, por aplicação, por estabelecimento ou compartilhado.
// Relações contextuais continuam disponíveis por deep link sem duplicar models/controllers por app.
export const ADMIN_PRIMARY_NAVIGATION = Object.freeze([
  { key: 'users', label: 'Usuários', href: ADMIN_ENTITY_ROUTES.users, scope: ADMIN_RESOURCE_SCOPES.users },
  { key: 'profiles', label: 'Perfis e permissões', href: ADMIN_ENTITY_ROUTES.profiles, scope: ADMIN_RESOURCE_SCOPES.profiles },
  { key: 'applications', label: 'Aplicações', href: ADMIN_ENTITY_ROUTES.applications, scope: ADMIN_RESOURCE_SCOPES.applications },
  { key: 'establishments', label: 'Estabelecimentos', href: ADMIN_ENTITY_ROUTES.establishments, scope: ADMIN_RESOURCE_SCOPES.establishments },
  { key: 'items', label: 'Itens', href: ADMIN_ENTITY_ROUTES.items, scope: ADMIN_RESOURCE_SCOPES.items },
  { key: 'events', label: 'Eventos', href: ADMIN_ENTITY_ROUTES.events, scope: ADMIN_RESOURCE_SCOPES.events },
  { key: 'orders', label: 'Pedidos', href: ADMIN_ENTITY_ROUTES.orders, scope: ADMIN_RESOURCE_SCOPES.orders },
  { key: 'payments', label: 'Pagamentos', href: ADMIN_ENTITY_ROUTES.payments, scope: ADMIN_RESOURCE_SCOPES.payments },
  { key: 'payouts', label: 'Repasses', href: ADMIN_ENTITY_ROUTES.payouts, scope: ADMIN_RESOURCE_SCOPES.payouts },
  { key: 'files', label: 'Arquivos', href: ADMIN_ENTITY_ROUTES.files, scope: ADMIN_RESOURCE_SCOPES.files },
  { key: 'audit', label: 'Auditoria', href: ADMIN_ENTITY_ROUTES.audit, scope: ADMIN_RESOURCE_SCOPES.audit },
])

export const adminPrimaryNavigationKey = pathname => {
  const normalizedPath = `/${String(pathname ?? '').split('?')[0].split('#')[0].split('/').filter(Boolean).join('/')}`
  return Object.entries(ADMIN_ENTITY_ROUTES)
    .find(([, route]) => normalizedPath === route || normalizedPath.startsWith(`${route}/`))?.[0] || null
}

export const adminEstablishmentNavigation = establishmentId => [
  { key: 'overview', label: 'Visão geral', href: adminEntityRoute.establishment(establishmentId) },
  { key: 'collaborators', label: 'Colaboradores', href: adminEntityRoute.collaborators(establishmentId) },
  { key: 'items', label: 'Itens', href: adminEntityRoute.establishmentItems(establishmentId) },
  { key: 'events', label: 'Eventos', href: adminEntityRoute.establishmentEvents(establishmentId) },
]

export const adminEventNavigation = (establishmentId, eventId) => [
  { key: 'overview', label: 'Visão geral', href: adminEntityRoute.event(establishmentId, eventId) },
  { key: 'tickets', label: 'Ingressos', href: adminEntityRoute.tickets(establishmentId, eventId) },
]

export const adminBreadcrumbs = Object.freeze({
  users: () => [{ label: 'Usuários', href: ADMIN_ENTITY_ROUTES.users }],
  user: (userId, label = 'Usuário') => [
    ...adminBreadcrumbs.users(),
    { label, href: adminEntityRoute.user(userId) },
  ],
  applications: () => [{ label: 'Aplicações', href: ADMIN_ENTITY_ROUTES.applications }],
  application: (applicationId, label = 'Aplicação') => [
    ...adminBreadcrumbs.applications(),
    { label, href: adminEntityRoute.application(applicationId) },
  ],
  establishments: () => [{ label: 'Estabelecimentos', href: ADMIN_ENTITY_ROUTES.establishments }],
  establishment: (establishmentId, label = 'Estabelecimento') => [
    ...adminBreadcrumbs.establishments(),
    { label, href: adminEntityRoute.establishment(establishmentId) },
  ],
  collaborators: (establishmentId, establishmentLabel = 'Estabelecimento') => [
    ...adminBreadcrumbs.establishment(establishmentId, establishmentLabel),
    { label: 'Colaboradores', href: adminEntityRoute.collaborators(establishmentId) },
  ],
  items: (establishmentId, establishmentLabel = 'Estabelecimento') => [
    ...adminBreadcrumbs.establishment(establishmentId, establishmentLabel),
    { label: 'Itens', href: adminEntityRoute.establishmentItems(establishmentId) },
  ],
  events: (establishmentId, establishmentLabel = 'Estabelecimento') => [
    ...adminBreadcrumbs.establishment(establishmentId, establishmentLabel),
    { label: 'Eventos', href: adminEntityRoute.establishmentEvents(establishmentId) },
  ],
  event: (establishmentId, eventId, establishmentLabel = 'Estabelecimento', eventLabel = 'Evento') => [
    ...adminBreadcrumbs.events(establishmentId, establishmentLabel),
    { label: eventLabel, href: adminEntityRoute.event(establishmentId, eventId) },
  ],
  tickets: (establishmentId, eventId, establishmentLabel = 'Estabelecimento', eventLabel = 'Evento') => [
    ...adminBreadcrumbs.event(establishmentId, eventId, establishmentLabel, eventLabel),
    { label: 'Ingressos', href: adminEntityRoute.tickets(establishmentId, eventId) },
  ],
})
