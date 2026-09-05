import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './nexus-mobile-nav.css'
import './seo.js'
import PeterAccountGateway from './components/PeterAccountGateway.jsx'
import PublicBlogIndex from './PublicBlogIndex.jsx'
import PublicBlogArticle from './PublicBlogArticle.jsx'
import PetriniaCutinappStory from './PetriniaCutinappStory.jsx'
import PublicErrorBoundary from './PublicErrorBoundary.jsx'
import { installWebVitals } from './discoveryApi.js'
import { installGlobalImageFallbacks } from './utils/imageFallback.js'
import { installPasswordVisibilityToggles } from './utils/passwordVisibility.js'

const PublicExperienceRouter = lazy(() => import('./PublicExperienceRouter.jsx'))
const AdminEntry = lazy(() => import('./AdminEntry.jsx'))
const LegacyApp = lazy(() => import('./App.jsx'))
const AccountAccessPage = lazy(() => import('./AccountAccessPage.jsx'))

const API_BASE_URL = 'https://api.petertecnet.com.br/api'
const APP_SLUG = 'peter-tecnet'
const PETRINIA_STORY_SLUG = 'petrinia-cutinapp-persistencia-tecnologia'

const adminToken = localStorage.getItem('petertecnet_admin_token')
const ecosystemToken = localStorage.getItem('token')

// Preserve legacy Admin Center sessions, but never promote a normal ecosystem
// session into an "admin" token. Authorization is always decided by the API.
if (adminToken && !ecosystemToken) localStorage.setItem('token', adminToken)

installGlobalImageFallbacks()
installPasswordVisibilityToggles()

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isAccountAccess = path === '/account/activate' || path === '/account/password/reset'
const isAdmin = path === '/admin' || path.startsWith('/admin/')
const isLogin = path === '/login'
const isBlogIndex = path === '/blog'
const blogArticleMatch = path.match(/^\/blog\/([^/]+)$/)
const blogArticleSlug = blogArticleMatch ? (() => {
  try {
    return decodeURIComponent(blogArticleMatch[1])
  } catch {
    return blogArticleMatch[1]
  }
})() : null
const isPetriniaStory = blogArticleSlug === PETRINIA_STORY_SLUG
const isMarketing = !isAdmin && !isLogin && !isAccountAccess

function upsertMeta(name, content) {
  let meta = document.querySelector(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  meta.content = content
}

function installAdminPwa() {
  let manifestLink = document.querySelector('link[rel="manifest"]')
  if (!manifestLink) {
    manifestLink = document.createElement('link')
    manifestLink.rel = 'manifest'
    document.head.appendChild(manifestLink)
  }

  // Keep the manifest URL stable and explicit so Chrome can recognize the
  // Admin Center as an installable web app instead of falling back to a shortcut.
  manifestLink.href = '/manifest.webmanifest'
  manifestLink.crossOrigin = 'use-credentials'

  upsertMeta('application-name', 'Peter Tecnet Admin Center')
  upsertMeta('mobile-web-app-capable', 'yes')
  upsertMeta('apple-mobile-web-app-capable', 'yes')
  upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')
  upsertMeta('apple-mobile-web-app-title', 'Admin Center')

  if (!('serviceWorker' in navigator)) return

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      await registration.update()
    } catch (error) {
      console.warn('[Admin PWA] Falha ao registrar service worker:', error)
    }
  }

  if (document.readyState === 'complete') {
    registerServiceWorker()
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true })
  }
}

if (isAdmin) installAdminPwa()
if (isMarketing) installWebVitals(APP_SLUG)

const lazyFallback = <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', background: '#02090d', color: '#e9fbff' }}><p>Carregando experiência…</p></main>

const appPage = isAccountAccess
  ? <Suspense fallback={lazyFallback}><AccountAccessPage /></Suspense>
  : isAdmin
    ? <Suspense fallback={lazyFallback}><AdminEntry /></Suspense>
    : isBlogIndex
      ? <PublicBlogIndex />
      : isPetriniaStory
        ? <PetriniaCutinappStory />
        : blogArticleSlug
          ? <PublicBlogArticle slug={blogArticleSlug} />
          : isMarketing
            ? <Suspense fallback={lazyFallback}><PublicExperienceRouter /></Suspense>
            : <Suspense fallback={lazyFallback}><LegacyApp /></Suspense>

const ecosystemExperience = (
  <PeterAccountGateway apiBaseUrl={API_BASE_URL} appSlug={APP_SLUG}>
    {appPage}
  </PeterAccountGateway>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isMarketing ? (
      <PublicErrorBoundary>{ecosystemExperience}</PublicErrorBoundary>
    ) : (
      ecosystemExperience
    )}
  </StrictMode>,
)
