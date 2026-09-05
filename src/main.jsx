import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './nexus-mobile-nav.css'
import './seo.js'
import PublicBlogIndex from './PublicBlogIndex.jsx'
import PublicBlogArticle from './PublicBlogArticle.jsx'
import PetriniaCutinappStory from './PetriniaCutinappStory.jsx'
import PublicErrorBoundary from './PublicErrorBoundary.jsx'
import PeterAccountGateway from './components/PeterAccountGateway.jsx'
import { installWebVitals } from './discoveryApi.js'
import { installGlobalImageFallbacks } from './utils/imageFallback.js'
import installSeoFaqSection from './installSeoFaqSection.jsx'

const PublicExperienceRouter = lazy(() => import('./PublicExperienceRouter.jsx'))
const API_BASE_URL = 'https://api.petertecnet.com.br/api'
const APP_SLUG = 'peter-tecnet'
const PETRINIA_STORY_SLUG = 'petrinia-cutinapp-persistencia-tecnologia'

installGlobalImageFallbacks()

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isBlogIndex = path === '/blog'
const blogArticleMatch = path.match(/^\/blog\/([^/]+)$/)
const blogArticleSlug = blogArticleMatch ? (() => {
  try { return decodeURIComponent(blogArticleMatch[1]) } catch { return blogArticleMatch[1] }
})() : null
const isPetriniaStory = blogArticleSlug === PETRINIA_STORY_SLUG

// Peter Tecnet is public-only for now. Legacy /admin and /login URLs return to the landing page.
if (path === '/admin' || path.startsWith('/admin/') || path === '/login') {
  window.history.replaceState({}, '', '/')
}

installWebVitals(APP_SLUG)
const lazyFallback = <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', background: '#02090d', color: '#e9fbff' }}><p>Carregando experiência…</p></main>

const appPage = isBlogIndex
  ? <PublicBlogIndex />
  : isPetriniaStory
    ? <PetriniaCutinappStory />
    : blogArticleSlug
      ? <PublicBlogArticle slug={blogArticleSlug} />
      : <Suspense fallback={lazyFallback}><PublicExperienceRouter /></Suspense>

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PublicErrorBoundary>
      <PeterAccountGateway apiBaseUrl={API_BASE_URL} appSlug={APP_SLUG}>
        {appPage}
      </PeterAccountGateway>
    </PublicErrorBoundary>
  </StrictMode>,
)

if (window.location.pathname === '/') installSeoFaqSection()
