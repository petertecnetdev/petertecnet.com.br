(() => {
  'use strict'

  const RUNTIME_VERSION = '1.4.0'
  const DEFAULT_API = 'https://api.petertecnet.com.br/api'
  const CACHE_PREFIX = 'peter.branding.v3:'
  const script = document.currentScript
  let activeContext = null
  let focusListenerInstalled = false

  if (window.PeterTecnetBranding?.version === RUNTIME_VERSION) return

  const normalizeSlug = value => String(value || '').trim().toLowerCase()
  const inferredSlug = () => {
    const host = window.location.hostname.toLowerCase()
    if (host === 'petertecnet.com.br' || host === 'www.petertecnet.com.br') return 'peter-tecnet'
    const label = host.split('.')[0]
    return ({ 'la-ora': 'laora' }[label] || label)
  }

  const normalizeHex = value => {
    const raw = String(value || '').trim()
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase()
    if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw.slice(1).split('').map(char => char + char).join('')}`.toLowerCase()
    return null
  }

  const hexToRgb = value => {
    const hex = normalizeHex(value)
    if (!hex) return null
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ]
  }

  const mixHex = (value, target, amount) => {
    const source = hexToRgb(value)
    const destination = hexToRgb(target)
    if (!source || !destination) return normalizeHex(value)
    const mixed = source.map((channel, index) => Math.round(channel + (destination[index] - channel) * amount))
    return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
  }

  const contrastFor = value => {
    const rgb = hexToRgb(value)
    if (!rgb) return '#ffffff'
    const [r, g, b] = rgb.map(channel => {
      const normalized = channel / 255
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return ((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) > 0.47 ? '#071018' : '#ffffff'
  }

  const readCache = slug => {
    try {
      const value = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${slug}`) || 'null')
      return value?.branding ? value : null
    } catch { return null }
  }

  const writeCache = (slug, branding) => {
    try { localStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify({ savedAt: Date.now(), branding })) } catch {}
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
    if (element.dataset.peterBrandingFailed === url) return
    if (!element.dataset.peterBrandingFallback) element.dataset.peterBrandingFallback = element.getAttribute('src') || ''
    if (element.src === url || element.getAttribute('src') === url) {
      element.dataset.peterBrandingApplied = 'true'
      return
    }

    if (element.dataset.peterBrandingFailed && element.dataset.peterBrandingFailed !== url) {
      delete element.dataset.peterBrandingFailed
    }

    element.src = url
    element.removeAttribute('srcset')
    element.dataset.peterBrandingApplied = 'true'
    element.addEventListener('error', () => {
      element.dataset.peterBrandingFailed = url
      delete element.dataset.peterBrandingApplied
      const fallback = element.dataset.peterBrandingFallback
      if (fallback && element.getAttribute('src') !== fallback) element.src = fallback
    }, { once: true })
  }

  const applyBackgroundAsset = (element, url) => {
    if (!url || element instanceof HTMLImageElement) return
    if (!element.dataset.peterBrandingBackgroundFallback) {
      element.dataset.peterBrandingBackgroundFallback = element.style.backgroundImage || ''
    }
    element.style.setProperty('background-image', `url("${url}")`, 'important')
    element.style.setProperty('background-size', 'contain', 'important')
    element.style.setProperty('background-position', 'center', 'important')
    element.style.setProperty('background-repeat', 'no-repeat', 'important')
    element.dataset.peterBrandingApplied = 'true'
  }

  const semanticText = element => [
    element.getAttribute?.('id'),
    element.getAttribute?.('class'),
    element.getAttribute?.('alt'),
    element.getAttribute?.('aria-label'),
    element.getAttribute?.('data-testid'),
  ].filter(Boolean).join(' ').toLowerCase()

  const isLocalAppLogoUrl = (src, slug, semantics = '') => {
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false

    try {
      const url = new URL(src, window.location.href)
      if (url.origin !== window.location.origin) return false

      const path = url.pathname.toLowerCase()
      const filename = path.split('/').pop() || ''
      const compactSlug = slug.replace(/[^a-z0-9]/g, '')
      const compactFilename = filename.replace(/[^a-z0-9]/g, '')
      const isGenericLogo = /^(logo|app-logo|brand-logo|logo-app|logo-brand)([._-][a-z0-9-]+)?\.(png|jpe?g|webp|svg)$/.test(filename)
        || /\/static\/media\/logo\.[a-z0-9]+\.(png|jpe?g|webp|svg)$/.test(path)
        || /\/assets\/logo-[a-z0-9]+\.(png|jpe?g|webp|svg)$/.test(path)
      const isSlugLogo = filename.includes('logo') && compactSlug && compactFilename.includes(compactSlug)
      const hasLogoSemantics = /(^|[\s_-])(logo|brand)([\s_-]|$)/.test(semantics)
      const isAppAssetDirectory = /^\/(images?|assets?|static\/media)\//.test(path)
      const isEntityImage = /(establishment|empresa|company|business|produto|product|item|avatar|customer|cliente|employer|profissional|artist|artista|photo|foto)/.test(semantics)

      return isGenericLogo || isSlugLogo || (isAppAssetDirectory && hasLogoSemantics && !isEntityImage)
    } catch { return false }
  }

  const isLocalLegacyLogo = (element, slug) => {
    const semantics = semanticText(element)
    return isLocalAppLogoUrl(element.getAttribute('src'), slug, semantics)
      || isLocalAppLogoUrl(element.dataset.peterBrandingFallback, slug, semantics)
  }

  const applyLegacyLogo = (branding, slug) => {
    if (script?.dataset?.autoLegacyLogo !== 'true' || !branding.logo) return
    document.querySelectorAll('img[src]').forEach(element => {
      if (isLocalLegacyLogo(element, slug)) applyImage(element, branding.logo)
    })
  }

  const applyLogoBackgrounds = (branding, slug) => {
    if (script?.dataset?.autoLegacyLogo !== 'true' || !branding.logo) return

    const candidates = document.querySelectorAll(
      '[data-peter-branding-background], [class*="logo"], [id*="logo"], [class*="brand"], [id*="brand"]'
    )

    candidates.forEach(element => {
      if (element.hasAttribute('data-peter-branding')) return
      const semantics = semanticText(element)
      const background = element.style.backgroundImage || window.getComputedStyle(element).backgroundImage
      const currentMatch = background && background.match(/url\(["']?([^"')]+)["']?\)/i)
      const fallbackBackground = element.dataset.peterBrandingBackgroundFallback || ''
      const fallbackMatch = fallbackBackground.match(/url\(["']?([^"')]+)["']?\)/i)
      const isManagedBackground = Boolean(
        (currentMatch && isLocalAppLogoUrl(currentMatch[1], slug, semantics))
        || (fallbackMatch && isLocalAppLogoUrl(fallbackMatch[1], slug, semantics))
      )

      if (!isManagedBackground) return
      applyBackgroundAsset(element, branding.logo)
    })
  }

  const applyConfiguredSelector = branding => {
    const selector = script?.dataset?.logoSelector
    if (!selector || !branding.logo) return
    try { document.querySelectorAll(selector).forEach(element => applyImage(element, branding.logo)) }
    catch (error) { console.warn('[Peter Branding] Seletor de logo inválido.', error) }
  }

  const applyMarkedElements = (branding, slug) => {
    document.querySelectorAll('[data-peter-branding]').forEach(element => {
      const role = element.getAttribute('data-peter-branding') || 'logo'
      const asset = assetFor(branding, role)
      if (element instanceof HTMLImageElement) return applyImage(element, asset)
      if (['logo', 'logo-light', 'logo-dark', 'icon'].includes(role) && asset) return applyBackgroundAsset(element, asset)
      if (role === 'display-name' && branding.display_name) element.textContent = branding.display_name
      if (role === 'short-name' && branding.short_name) element.textContent = branding.short_name
    })
    applyConfiguredSelector(branding)
    applyLegacyLogo(branding, slug)
    applyLogoBackgrounds(branding, slug)
  }

  const applyColorTokens = branding => {
    const root = document.documentElement
    const primary = normalizeHex(branding.primary_color)
    const secondary = normalizeHex(branding.secondary_color) || primary
    const accent = normalizeHex(branding.accent_color) || secondary || primary

    const applyColor = (name, value) => {
      if (!value) return
      const rgb = hexToRgb(value)
      root.style.setProperty(`--peter-brand-${name}`, value)
      if (rgb) root.style.setProperty(`--peter-brand-${name}-rgb`, rgb.join(', '))
    }

    applyColor('primary', primary)
    applyColor('secondary', secondary)
    applyColor('accent', accent)

    if (primary) {
      root.style.setProperty('--peter-brand-primary-hover', mixHex(primary, '#ffffff', 0.14))
      root.style.setProperty('--peter-brand-primary-dark', mixHex(primary, '#000000', 0.18))
      root.style.setProperty('--peter-brand-primary-contrast', contrastFor(primary))
      root.style.setProperty('--peter-brand-primary-soft', `rgba(${hexToRgb(primary).join(', ')}, .14)`)
      root.style.setProperty('--bs-primary', primary)
      root.style.setProperty('--bs-primary-rgb', hexToRgb(primary).join(', '))
    }
    if (secondary) {
      root.style.setProperty('--peter-brand-secondary-soft', `rgba(${hexToRgb(secondary).join(', ')}, .14)`)
      root.style.setProperty('--bs-secondary', secondary)
      root.style.setProperty('--bs-secondary-rgb', hexToRgb(secondary).join(', '))
    }
    if (accent) {
      root.style.setProperty('--peter-brand-accent-soft', `rgba(${hexToRgb(accent).join(', ')}, .14)`)
      root.style.setProperty('--bs-info', accent)
      root.style.setProperty('--bs-info-rgb', hexToRgb(accent).join(', '))
    }
    if (primary || secondary || accent) {
      root.style.setProperty(
        '--peter-brand-gradient',
        `linear-gradient(135deg, ${secondary || primary} 0%, ${primary || secondary} 52%, ${accent || primary || secondary} 100%)`
      )
    }

    if (primary) {
      let themeColor = document.querySelector('meta[name="theme-color"]')
      if (!themeColor) {
        themeColor = document.createElement('meta')
        themeColor.name = 'theme-color'
        document.head.appendChild(themeColor)
      }
      themeColor.setAttribute('content', primary)
    }
  }

  const applyDocumentMetadata = branding => {
    const root = document.documentElement
    applyColorTokens(branding)
    if (branding.logo) root.style.setProperty('--peter-brand-logo-url', `url("${branding.logo}")`)

    const favicon = assetFor(branding, 'favicon')
    if (favicon) {
      const icons = [...document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')]
      if (!icons.length) {
        const link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
        icons.push(link)
      }
      icons.forEach(link => { link.href = favicon })
    }

    const socialImage = branding.social_image || branding.logo
    if (socialImage) document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(meta => meta.setAttribute('content', socialImage))
    if (branding.seo_description) document.querySelector('meta[name="description"]')?.setAttribute('content', branding.seo_description)
  }

  const apply = (branding, slug = activeContext?.slug || inferredSlug()) => {
    if (!branding) return
    applyDocumentMetadata(branding)
    applyMarkedElements(branding, slug)
    window.dispatchEvent(new CustomEvent('peter:branding-ready', { detail: { branding, slug } }))
  }

  const observe = (branding, slug) => {
    activeContext?.observer?.disconnect()
    const observer = new MutationObserver(() => applyMarkedElements(branding, slug))
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'style', 'class'],
    })
    if (activeContext) activeContext.observer = observer
  }

  const fetchPublishedBranding = async (slug, apiBase) => {
    const endpoint = `${apiBase}/applications/${encodeURIComponent(slug)}/branding?_branding_refresh=${Date.now()}`
    const response = await fetch(endpoint, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.branding) throw new Error(payload?.message || 'Branding indisponível.')
    return payload.branding
  }

  const refresh = async () => {
    if (!activeContext?.slug || !activeContext?.apiBase) return null

    try {
      const branding = await fetchPublishedBranding(activeContext.slug, activeContext.apiBase)
      activeContext.branding = branding
      writeCache(activeContext.slug, branding)
      apply(branding, activeContext.slug)
      observe(branding, activeContext.slug)
      return branding
    } catch (error) {
      if (!activeContext.branding) console.warn('[Peter Branding] Não foi possível carregar a identidade dinâmica.', error)
      return activeContext.branding || null
    }
  }

  const install = async options => {
    const slug = normalizeSlug(options?.appSlug || script?.dataset?.appSlug || inferredSlug())
    const apiBase = String(options?.apiBase || script?.dataset?.apiBase || DEFAULT_API).replace(/\/+$/, '')
    if (!slug) return null

    const cached = readCache(slug)
    activeContext = {
      slug,
      apiBase,
      branding: cached?.branding || null,
      observer: null,
    }

    if (cached?.branding) {
      apply(cached.branding, slug)
      observe(cached.branding, slug)
    }

    const branding = await refresh()

    if (!focusListenerInstalled) {
      focusListenerInstalled = true
      window.addEventListener('focus', () => { refresh() }, { passive: true })
      window.addEventListener('pageshow', event => { if (event.persisted) refresh() }, { passive: true })
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh() }, { passive: true })
    }

    return branding
  }

  window.PeterTecnetBranding = { version: RUNTIME_VERSION, install, refresh, apply, applyColorTokens }
  if (script?.dataset?.auto !== 'false') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(), { once: true })
    else install()
  }
})()
