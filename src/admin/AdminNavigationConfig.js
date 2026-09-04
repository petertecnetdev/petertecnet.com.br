export const ADMIN_GROUP_ORDER = ['Operação', 'Negócio', 'Ecossistema', 'Governança', 'Configurações', 'Produtos']

export const ADMIN_TABS = [
  { key: 'home', label: 'Início', icon: '⌂', path: '/admin', group: 'Operação', surface: 'module' },
  { key: 'command', label: 'Mission Control', icon: '⌘', path: '/admin/mission-control', group: 'Operação', surface: 'legacy' },
  { key: 'dashboard', label: 'Visão geral', icon: '▦', path: '/admin/overview', group: 'Operação', surface: 'legacy' },
  { key: 'activity', label: 'Atividade', icon: '⌁', path: '/admin/activity', group: 'Operação', surface: 'legacy' },
  { key: 'financial', label: 'Financeiro', icon: '¤', path: '/admin/financial', group: 'Negócio', surface: 'legacy' },
  { key: 'establishments', label: 'Estabelecimentos', icon: '⌂', path: '/admin/establishments', group: 'Negócio', surface: 'legacy' },
  { key: 'items', label: 'Itens', icon: '▣', path: '/admin/items', group: 'Negócio', surface: 'legacy' },
  { key: 'visibility', label: 'Visibilidade e publicação', icon: '◐', path: '/admin/visibility', group: 'Negócio', surface: 'module' },
  { key: 'marketing', label: 'Landing e marketing', icon: '◈', path: '/admin/marketing', group: 'Negócio', surface: 'module' },
  { key: 'content', label: 'Conteúdo e SEO', icon: '◫', path: '/admin/content', group: 'Negócio', surface: 'module' },
  { key: 'discovery', label: 'Discovery Intelligence', icon: '⌕', path: '/admin/discovery', group: 'Negócio', surface: 'module' },
  { key: 'applications', label: 'Aplicações', icon: '◇', path: '/admin/applications', group: 'Ecossistema', surface: 'legacy' },
  { key: 'branding', label: 'Branding e logos', icon: '✧', path: '/admin/branding', group: 'Ecossistema', surface: 'module' },
  { key: 'ecosystem-launcher', label: 'Navegação do ecossistema', icon: '⌘', path: '/admin/ecosystem-launcher', group: 'Ecossistema', surface: 'module' },
  { key: 'users', label: 'Usuários', icon: '◉', path: '/admin/users', group: 'Governança', surface: 'legacy' },
  { key: 'profiles', label: 'Acessos e permissões', icon: '⌗', path: '/admin/profiles', group: 'Governança', surface: 'module' },
  { key: 'audit', label: 'Auditoria', icon: '◎', path: '/admin/audit', group: 'Governança', surface: 'legacy' },
  { key: 'site', label: 'Site institucional', icon: '✦', path: '/admin/site', group: 'Configurações', surface: 'legacy' },
  { key: 'laora', label: 'Laora Safety Center', icon: '◉', path: '/admin/laora', group: 'Produtos', surface: 'module' },
]

export const ADMIN_TAB_BY_KEY = Object.fromEntries(ADMIN_TABS.map(tab => [tab.key, tab]))
export const ADMIN_LEGACY_TAB_KEYS = ADMIN_TABS.filter(tab => tab.surface === 'legacy').map(tab => tab.key)
export const ADMIN_MODULE_TAB_KEYS = ADMIN_TABS.filter(tab => tab.surface === 'module').map(tab => tab.key)
export const ADMIN_LEGACY_DOM_ORDER = ['command', 'dashboard', 'activity', 'financial', 'applications', 'users', 'establishments', 'items', 'site', 'audit']

export const ADMIN_ROUTE_ALIASES = Object.fromEntries([
  ...ADMIN_TABS.map(tab => [tab.path, tab.key]),
  ['/admin/dashboard', 'dashboard'],
])

export function normalizeAdminPath(pathname = '/') {
  return String(pathname || '/').replace(/\/+$/, '') || '/'
}

export function adminTabFromLocation(pathname = window.location.pathname) {
  const path = normalizeAdminPath(pathname)
  if (ADMIN_ROUTE_ALIASES[path]) return ADMIN_ROUTE_ALIASES[path]
  if (path.startsWith('/admin/users/')) return 'users'
  if (path.startsWith('/admin/establishments/')) return 'establishments'
  if (path.startsWith('/admin/items/')) return 'items'
  if (path.startsWith('/admin/marketing/')) return 'marketing'
  if (path.startsWith('/admin/content/')) return 'content'
  if (path.startsWith('/admin/discovery/')) return 'discovery'
  if (path.startsWith('/admin/branding/')) return 'branding'
  if (path.startsWith('/admin/visibility/')) return 'visibility'
  if (path.startsWith('/admin/ecosystem-launcher/')) return 'ecosystem-launcher'
  if (path.startsWith('/admin/laora')) return 'laora'
  if (path.startsWith('/admin/mission-control/')) return 'command'
  return 'home'
}

export function adminTabLabel(key) {
  return ADMIN_TAB_BY_KEY[key]?.label || 'Admin Center'
}

export function adminTabPath(key) {
  return ADMIN_TAB_BY_KEY[key]?.path || '/admin'
}

export function isLegacyAdminTab(key) {
  return ADMIN_TAB_BY_KEY[key]?.surface === 'legacy'
}
