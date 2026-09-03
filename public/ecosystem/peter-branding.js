(() => {
  'use strict'

  const RUNTIME_VERSION = '1.1.0'
  const DEFAULT_API = 'https://api.petertecnet.com.br/api'
  const CACHE_TTL_MS = 5 * 60 * 1000
  const CACHE_PREFIX = 'peter.branding.v1:'
  const script = document.currentScript

  if (window.PeterTecnetBranding?.version === RUNTIME_VERSION) return

  const normalizeSlug = value => String(value || '').trim().toLowerCase()
  const inferredSlug = () => {
    const host = window.location.hostname.toLowerCase()
    if (host === 'petertecnet.com.br' || host === 'www.petertecnet.com.br') return 'peter-tecnet'
    const label = host.split('.')[0]
    return ({
      'la-ora': 'laora',
    }[label] || label)
  }

  const readCache = slug => {
    try {
      const value = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${slug}`) || 'null')
      if (!value?.branding) return null
      return value
    } catch {
      return null
    }
  }

  const writeCache = (slug, branding) => {
    try {
      localStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify({ savedAt: Date.now(), branding }))
    } catch {}
  }

  const assetFor = (branding, role) => ({
    logo: branding.logo,
    'logo-light': branding.logo_light || branding.logo,
    'logo-dark': branding.logo_dark || branding.logo,
    icon: branding.icon || branding.logo,
    favicon: branding.favicon || branding.icon || branding.logo,
    'social-image': branding.social_image || branding.logo,
  }[role] || branding.logo)

  const applyImage = (element, url) => {
    if (!url || !(element instanceof HTMLImageElement)) return
    if (!element.dataset.peterBrandingFallback) {
      element.dataset.peterBrandingFallback = element.getAttribute('src') || ''
    }
    if (element.src === url || element.getAttribute('src') === url) return
    element.src = url
    element.addEventListener('error', () => {
      const fallback = element.dataset.peterBrandingFallback
      if (fallback && element.getAttribute('src') !== fallback) element.src = fallback
    }, { once: true })
  }

  const isLocalLegacyLogo = element => {
    const src = element.getAttribute('src')
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false
    try {
      const url = new URL(src, window.location.href)
      if (url.origin !== window.location.origin) return false
      const path = url.pathname.toLowerCase()
      return /(^|\/)logo(?:[._-][a-z0-9-]+)?\.(png|jpe?g|webp|svg)$/.test(path)
        || /\/static\/media\/logo\.[a-z0-9]+\.(png|jpe?g|webp|svg)$/.test(path)
        || /\/assets\/logo-[a-z0-9]+\.(png|jpe?g|webp|svg)$/.test(path)
    } catch {
      return false
    }
  }

  const applyLegacyLogo = branding => {
    if (script?.dataset?.autoLegacyLogo !== 'true' || !branding.logo) return
    document.querySelectorAll('img[src]').forEach(element => {
      if (isLocalLegacyLogo(element)) applyImage(element, branding.logo)
    })
  }

  const applyConfiguredSelector = branding => {
    const selector = script?.dataset?.logoSelector
    if (!selector || !branding.logo) return
    try {
      document.querySelectorAll(selector).forEach(element => applyImage(element, branding.logo))
    } catch (error) {
      console.warn('[Peter Branding] Seletor de logo inválido.', error)
    }
  }

  const applyMarkedElements = branding => {
    document.querySelectorAll('[data-peter-branding]').forEach(element => {
      const role = element.getAttribute('data-peter-branding') || 'logo'
      if (element instanceof HTMLImageElement) {
        applyImage(element, assetFor(branding, role))
        return
      }
      if (role === 'display-name' && branding.display_name) element.textContent = branding.display_name
      if (role === 'short-name' && branding.short_name) element.textContent = branding.short_name
    })
    applyConfiguredSelector(branding)
    applyLegacyLogo(branding)
  }

  const applyDocumentMetadata = branding => {
    const root = document.documentElement
    if (branding.primary_color) root.style.setProperty('--peter-brand-primary', branding.primary_color)
    if (branding.secondary_color) root.style.setProperty('--peter-brand-secondary', branding.secondary_color)
    if (branding.accent_color) root.style.setProperty('--peter-brand-accent', branding.accent_color)

    const favicon = assetFor(branding, 'favicon')
    if (favicon) {
      let link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = favicon
    }

    if (branding.social_image) {
      document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(meta => {
        meta.setAttribute('content', branding.social_image)
      })
    }
    if (branding.seo_description) {
      const description = document.querySelector('meta[name="description"]')
      if (description) description.setAttribute('content', branding.seo_description)
    }
  }

  const apply = branding => {
    if (!branding) return
    applyDocumentMetadata(branding)
    applyMarkedElements(branding)
    window.dispatchEvent(new CustomEvent('peter:branding-ready', { detail: { branding } }))
  }

  const install = async options => {
    const slug = normalizeSlug(options?.appSlug || script?.dataset?.appSlug || inferredSlug())
    const apiBase = String(options?.apiBase || script?.dataset?.apiBase || DEFAULT_API).replace(/\/+$/, '')
    if (!slug) return null

    const cached = readCache(slug)
    if (cached?.branding) apply(cached.branding)

    let observer = null
    const observe = branding => {
      observer?.disconnect()
      observer = new MutationObserver(() => applyMarkedElements(branding))
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
    }
    if (cached?.branding) observe(cached.branding)

    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.branding

    try {
      const response = await fetch(`${apiBase}/applications/${encodeURIComponent(slug)}/branding`, {
        headers: { Accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.branding) throw new Error(payload?.message || 'Branding indisponível.')
      writeCache(slug, payload.branding)
      apply(payload.branding)
      observe(payload.branding)
      return payload.branding
    } catch (error) {
      if (!cached?.branding) console.warn('[Peter Branding] Não foi possível carregar a identidade dinâmica.', error)
      return cached?.branding || null
    }
  }

  window.PeterTecnetBranding = { version: RUNTIME_VERSION, install, apply }

  const autoInstall = script?.dataset?.auto !== 'false'
  if (autoInstall) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => install(), { once: true })
    } else {
      install()
    }
  }
})()
