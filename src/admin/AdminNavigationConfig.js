export const ADMIN_TABS = [
  { key: 'command', label: 'Mission Control', icon: '◈', path: '/admin' },
  { key: 'dashboard', label: 'Visão geral', icon: '▦', path: '/admin' },
  { key: 'activity', label: 'Atividade', icon: '⌁', path: '/admin' },
  { key: 'financial', label: 'Financeiro', icon: '¤', path: '/admin/financial' },
  { key: 'applications', label: 'Aplicações', icon: '◇', path: '/admin' },
  { key: 'users', label: 'Usuários', icon: '◎', path: '/admin' },
  { key: 'profiles', label: 'Perfis e permissões', icon: '◌', path: '/admin' },
  { key: 'establishments', label: 'Estabelecimentos', icon: '▣', path: '/admin' },
  { key: 'items', label: 'Itens', icon: '◆', path: '/admin' },
  { key: 'site', label: 'Site institucional', icon: '⌂', path: '/admin' },
  { key: 'audit', label: 'Auditoria', icon: '≋', path: '/admin' },
]

export const ADMIN_TAB_BY_KEY = Object.fromEntries(ADMIN_TABS.map(tab => [tab.key, tab]))

export function adminTabFromLocation(pathname = window.location.pathname) {
  const cleanPath = String(pathname || '').replace(/\/+$/, '') || '/admin'
  if (cleanPath === '/admin/financial') return 'financial'
  return 'command'
}

export function adminTabLabel(key) {
  return ADMIN_TAB_BY_KEY[key]?.label || 'Admin Center'
}

export function adminTabPath(key) {
  return ADMIN_TAB_BY_KEY[key]?.path || '/admin'
}
