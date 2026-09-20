export const ADMIN_ENTITY_ROUTES = Object.freeze({
  users: '/usuarios',
  establishments: '/estabelecimentos',
})

const segment = value => encodeURIComponent(String(value ?? '').trim())

export const adminEntityRoute = Object.freeze({
  user: userId => `${ADMIN_ENTITY_ROUTES.users}/${segment(userId)}`,
  establishment: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}`,
  collaborators: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/colaboradores`,
  items: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/itens`,
  events: establishmentId => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/eventos`,
  event: (establishmentId, eventId) => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/eventos/${segment(eventId)}`,
  tickets: (establishmentId, eventId) => `${ADMIN_ENTITY_ROUTES.establishments}/${segment(establishmentId)}/eventos/${segment(eventId)}/ingressos`,
})

export const adminEstablishmentNavigation = establishmentId => [
  { key: 'overview', label: 'Visão geral', href: adminEntityRoute.establishment(establishmentId) },
  { key: 'collaborators', label: 'Colaboradores', href: adminEntityRoute.collaborators(establishmentId) },
  { key: 'items', label: 'Itens', href: adminEntityRoute.items(establishmentId) },
  { key: 'events', label: 'Eventos', href: adminEntityRoute.events(establishmentId) },
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
  establishments: () => [{ label: 'Estabelecimentos', href: ADMIN_ENTITY_ROUTES.establishments }],
  establishment: (establishmentId, label = 'Estabelecimento') => [
    { label: 'Estabelecimentos', href: ADMIN_ENTITY_ROUTES.establishments },
    { label, href: adminEntityRoute.establishment(establishmentId) },
  ],
  collaborators: (establishmentId, establishmentLabel = 'Estabelecimento') => [
    ...adminBreadcrumbs.establishment(establishmentId, establishmentLabel),
    { label: 'Colaboradores', href: adminEntityRoute.collaborators(establishmentId) },
  ],
  items: (establishmentId, establishmentLabel = 'Estabelecimento') => [
    ...adminBreadcrumbs.establishment(establishmentId, establishmentLabel),
    { label: 'Itens', href: adminEntityRoute.items(establishmentId) },
  ],
  events: (establishmentId, establishmentLabel = 'Estabelecimento') => [
    ...adminBreadcrumbs.establishment(establishmentId, establishmentLabel),
    { label: 'Eventos', href: adminEntityRoute.events(establishmentId) },
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
