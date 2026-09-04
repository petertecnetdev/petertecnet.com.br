import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
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

if (adminToken && !ecosystemToken) localStorage.setItem('token', adminToken)
if (ecosystemToken && !adminToken) localStorage.setItem('petertecnet_admin_token', ecosystemToken)

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

function installAdminPwa() {
  let manifestLink = document.querySelector('link[rel="manifest"]')
  if (!manifestLink) {
    manifestLink = document.createElement('link')
    manifestLink.rel = 'manifest'
    document.head.appendChild(manifestLink)
  }
  manifestLink.href = '/manifest.webmanifest'

  let appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]')
  if (!appleCapable) {
    appleCapable = document.createElement('meta')
    appleCapable.name = 'apple-mobile-web-app-capable'
    document.head.appendChild(appleCapable)
  }
  appleCapable.content = 'yes'

  let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (!appleStatusBar) {
    appleStatusBar = document.createElement('meta')
    appleStatusBar.name = 'apple-mobile-web-app-status-bar-style'
    document.head.appendChild(appleStatusBar)
  }
  appleStatusBar.content = 'black-translucent'

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error) => {
        console.warn('[Admin PWA] Falha ao registrar service worker:', error)
      })
    }, { once: true })
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
