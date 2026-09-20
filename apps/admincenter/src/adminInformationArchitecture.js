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

export const adminBreadcrumbs = Object.freeze({
  users: () => [{ label: 'Usuários', href: ADMIN_ENTITY_ROUTES.users }],
  establishments: () => [{ label: 'Estabelecimentos', href: ADMIN_ENTITY_ROUTES.establishments }],
  establishment: (establishmentId, label = 'Estabelecimento') => [
    { label: 'Estabelecimentos', href: ADMIN_ENTITY_ROUTES.establishments },
    { label, href: adminEntityRoute.establishment(establishmentId) },
  ],
  event: (establishmentId, eventId, establishmentLabel = 'Estabelecimento', eventLabel = 'Evento') => [
    { label: 'Estabelecimentos', href: ADMIN_ENTITY_ROUTES.establishments },
    { label: establishmentLabel, href: adminEntityRoute.establishment(establishmentId) },
    { label: 'Eventos', href: adminEntityRoute.events(establishmentId) },
    { label: eventLabel, href: adminEntityRoute.event(establishmentId, eventId) },
  ],
  tickets: (establishmentId, eventId, establishmentLabel = 'Estabelecimento', eventLabel = 'Evento') => [
    ...adminBreadcrumbs.event(establishmentId, eventId, establishmentLabel, eventLabel),
    { label: 'Ingressos', href: adminEntityRoute.tickets(establishmentId, eventId) },
  ],
})
