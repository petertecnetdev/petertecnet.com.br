export const API_BASE = 'https://api.petertecnet.com.br/api'

export const getToken = () => localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token')

export async function controlApi(path, options = {}) {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('petertecnet_admin_token')
    window.location.href = '/login'
  }
  if (!response.ok) throw new Error(data?.message || data?.error || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a operação.')
  return data
}

export function normalizeEntityType(value = '') {
  const type = String(value).toLowerCase().replace(/^app\\models\\/i, '').replace(/_/g, '-').replace(/\s+/g, '-')
  if (type.includes('establishment') || type.includes('estabelecimento')) return 'establishment'
  if (type.includes('application') || type.includes('aplicacao')) return 'application'
  if (type.includes('payment') || type.includes('pagamento')) return 'payment'
  if (type.includes('service-record') || type.includes('servicerecord')) return 'service-record'
  if (type.includes('event') || type.includes('evento')) return 'event'
  if (type.includes('order') || type.includes('pedido')) return 'order'
  if (type.includes('item')) return 'item'
  if (type.includes('user') || type.includes('usuario')) return 'user'
  return null
}

export const NAVIGATION = [
  ['command', 'Mission Control', '/admin/mission-control'],
  ['dashboard', 'Visão geral', '/admin/overview'],
  ['activity', 'Atividade', '/admin/activity'],
  ['financial', 'Financeiro', '/admin/financial'],
  ['applications', 'Aplicações', '/admin/applications'],
  ['users', 'Usuários', '/admin/users'],
  ['profiles', 'Perfis e permissões', '/admin/profiles'],
  ['establishments', 'Estabelecimentos', '/admin/establishments'],
  ['items', 'Itens', '/admin/items'],
  ['site', 'Site institucional', '/admin/site'],
  ['audit', 'Auditoria', '/admin/audit'],
]

export function navigateAdmin(key) {
  const button = document.querySelector(`.ecosystem-sidebar nav button[data-admin-tab="${key}"]`)
  if (button) {
    button.click()
    return
  }
  const route = NAVIGATION.find(item => item[0] === key)?.[2] || '/admin/mission-control'
  window.history.pushState({ adminTab: key }, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
