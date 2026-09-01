const PUBLIC_URL = 'https://petertecnet.com.br/'

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
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

export function applySeoPolicy() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const isPublicLanding = path === '/'

  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: isPublicLanding
      ? 'index, follow, max-image-preview:large'
      : 'noindex, nofollow',
  })

  if (isPublicLanding) {
    upsertCanonical(PUBLIC_URL)
  } else {
    upsertCanonical(`${PUBLIC_URL.replace(/\/$/, '')}${path}`)
  }
}

applySeoPolicy()
