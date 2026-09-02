const PUBLIC_ORIGIN = 'https://petertecnet.com.br'
const DEFAULT_IMAGE = `${PUBLIC_ORIGIN}/thumbnail.jpg`

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([key, value]) => {
    if (value) element.setAttribute(key, value)
  })
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }
  element.href = href
}

function normalizePath(path) {
  const normalized = String(path || '/').split('?')[0].replace(/\/+$/, '')
  return normalized || '/'
}

export function updatePageSeo({ title, description, path = '/', image, type = 'website', robots } = {}) {
  const normalizedPath = normalizePath(path)
  const canonical = `${PUBLIC_ORIGIN}${normalizedPath === '/' ? '/' : normalizedPath}`
  const pageTitle = title || 'Peter Tecnet | Plataformas, aplicativos e soluções tecnológicas'
  const pageDescription = description || 'Tecnologia para transformar necessidades reais em produtos, plataformas, aplicativos e soluções digitais.'
  const pageImage = image && !/^data:/i.test(image) ? image : DEFAULT_IMAGE

  document.title = pageTitle
  upsertCanonical(canonical)
  upsertMeta('meta[name="description"]', { name: 'description', content: pageDescription })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: robots || 'index, follow, max-image-preview:large' })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: pageTitle })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: pageDescription })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: pageImage })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: pageTitle })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: pageDescription })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: pageImage })
}

export function applySeoPolicy() {
  const path = normalizePath(window.location.pathname)
  const isLanding = path === '/'
  const isSolution = /^\/solucoes\/[^/]+$/.test(path)
  const isPublic = isLanding || isSolution

  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: isPublic ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
  })
  upsertCanonical(`${PUBLIC_ORIGIN}${path === '/' ? '/' : path}`)
}

applySeoPolicy()
