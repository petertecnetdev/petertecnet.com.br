const SITE_ORIGIN = 'https://petertecnet.com.br'
const WEB_PROTOCOLS = new Set(['http:', 'https:'])

function parseWebUrl(href) {
  try {
    const url = new URL(href, SITE_ORIGIN)
    return WEB_PROTOCOLS.has(url.protocol) && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

function isSubdomainOf(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function isInstagramDestination(url) {
  return Boolean(url && isSubdomainOf(url.hostname, 'instagram.com'))
}

function isWhatsAppDestination(url) {
  return Boolean(url && (url.hostname === 'wa.me' || isSubdomainOf(url.hostname, 'whatsapp.com')))
}

function internalRouteSlug(url, prefix) {
  if (!url || url.origin !== SITE_ORIGIN || !url.pathname.startsWith(prefix)) return null

  const rawSegment = url.pathname.slice(prefix.length).split('/')[0]
  if (!rawSegment) return null

  try {
    const slug = decodeURIComponent(rawSegment)
    if (!slug || slug === '.' || slug === '..' || /[\\/\u0000-\u001f]/.test(slug)) return null
    return slug
  } catch {
    return null
  }
}

export function classifyMarketingConversion(anchor) {
  const href = String(anchor?.getAttribute?.('href') || '').trim()
  if (!href || href === '#') return null
  if (/^mailto:/i.test(href)) return { type: 'contact', id: 'email' }

  const url = parseWebUrl(href)
  if (!url) return null
  if (isInstagramDestination(url)) return { type: 'contact', id: 'instagram' }
  if (isWhatsAppDestination(url)) return { type: 'contact', id: 'whatsapp' }
  if (url.origin !== SITE_ORIGIN) return null

  if (url.pathname === '/orcamento' || url.pathname === '/orcamento/') {
    return { type: 'conversion', id: 'quote' }
  }

  const routes = [
    ['/servicos/', 'service'],
    ['/plataformas/', 'application'],
    ['/solucoes/', 'item'],
    ['/blog/', 'content'],
  ]

  for (const [prefix, type] of routes) {
    const id = internalRouteSlug(url, prefix)
    if (id) return { type, id }
  }

  return null
}
