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
import { installPasswordVisibilityToggles } from './utils/passwordVisibility.js'
import { installPeterWhatsappFallback } from './utils/peterWhatsappFallback.js'
import installSeoFaqSection from './installSeoFaqSection.jsx'

const PublicExperienceRouter = lazy(() => import('./PublicExperienceRouter.jsx'))
const AdminTicketSalesPage = lazy(() => import('./AdminTicketSalesPage.jsx'))
const API_BASE_URL = 'https://api.petertecnet.com.br/api'
const APP_SLUG = 'peter-tecnet'
const PETRINIA_STORY_SLUG = 'petrinia-cutinapp-persistencia-tecnologia'

installGlobalImageFallbacks()
installPeterWhatsappFallback()

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isAdminTicketSales = ['/admin/events/tickets', '/admin/tickets', '/admin/ingressos'].includes(path)
const isBlogIndex = path === '/blog'
const blogArticleMatch = path.match(/^\/blog\/([^/]+)$/)
const blogArticleSlug = blogArticleMatch ? (() => {
  try { return decodeURIComponent(blogArticleMatch[1]) } catch { return blogArticleMatch[1] }
})() : null
const isPetriniaStory = blogArticleSlug === PETRINIA_STORY_SLUG

// The legacy Admin shell was removed from this frontend. Keep its old routes
// redirected, but expose the production ticket workspace as an isolated,
// authenticated Admin Center surface instead of resurrecting the removed shell.
if (!isAdminTicketSales && (path === '/admin' || path.startsWith('/admin/') || path === '/login')) {
  window.history.replaceState({}, '', '/')
}

installWebVitals(APP_SLUG)
const lazyFallback = <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', background: '#02090d', color: '#e9fbff' }}><p>Carregando experiência…</p></main>

const appPage = isAdminTicketSales
  ? <Suspense fallback={lazyFallback}><AdminTicketSalesPage /></Suspense>
  : isBlogIndex
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
