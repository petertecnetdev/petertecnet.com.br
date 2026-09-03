export const ADMIN_TABS = [
  { key: 'command', label: 'Mission Control', icon: '⌘', path: '/admin/mission-control', group: 'Operação' },
  { key: 'dashboard', label: 'Visão geral', icon: '▦', path: '/admin/overview', group: 'Operação' },
  { key: 'activity', label: 'Atividade', icon: '⌁', path: '/admin/activity', group: 'Operação' },
  { key: 'financial', label: 'Financeiro', icon: '¤', path: '/admin/financial', group: 'Negócio' },
  { key: 'applications', label: 'Aplicações', icon: '◇', path: '/admin/applications', group: 'Ecossistema' },
  { key: 'users', label: 'Usuários', icon: '◉', path: '/admin/users', group: 'Governança' },
  { key: 'profiles', label: 'Perfis e permissões', icon: '⌗', path: '/admin/profiles', group: 'Governança' },
  { key: 'identity', label: 'Identidade e sessões', icon: '◎', path: '/admin/identity', group: 'Governança' },
  { key: 'establishments', label: 'Estabelecimentos', icon: '⌂', path: '/admin/establishments', group: 'Negócio' },
  { key: 'items', label: 'Itens', icon: '▣', path: '/admin/items', group: 'Negócio' },
  { key: 'site', label: 'Site institucional', icon: '✦', path: '/admin/site', group: 'Configurações' },
  { key: 'audit', label: 'Auditoria', icon: '◌', path: '/admin/audit', group: 'Governança' },
]

export const ADMIN_TAB_BY_KEY = Object.fromEntries(ADMIN_TABS.map(tab => [tab.key, tab]))

export const ADMIN_ROUTE_ALIASES = {
  '/admin': 'command',
  '/admin/mission-control': 'command',
  '/admin/overview': 'dashboard',
  '/admin/dashboard': 'dashboard',
  '/admin/activity': 'activity',
  '/admin/financial': 'financial',
  '/admin/applications': 'applications',
  '/admin/users': 'users',
  '/admin/profiles': 'profiles',
  '/admin/identity': 'identity',
  '/admin/establishments': 'establishments',
  '/admin/items': 'items',
  '/admin/site': 'site',
  '/admin/audit': 'audit',
}

export function normalizeAdminPath(pathname = '/') {
  return String(pathname || '/').replace(/\/+$/, '') || '/'
}

export function adminTabFromLocation(pathname = window.location.pathname) {
  const path = normalizeAdminPath(pathname)
  if (ADMIN_ROUTE_ALIASES[path]) return ADMIN_ROUTE_ALIASES[path]
  if (path.startsWith('/admin/users/')) return 'users'
  if (path.startsWith('/admin/establishments/')) return 'establishments'
  if (path.startsWith('/admin/items/')) return 'items'
  if (path.startsWith('/admin/mission-control/')) return 'command'
  return 'command'
}

export function adminTabLabel(key) {
  return ADMIN_TAB_BY_KEY[key]?.label || 'Admin Center'
}

export function adminTabPath(key) {
  return ADMIN_TAB_BY_KEY[key]?.path || '/admin/mission-control'
}
