import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './seo.js'
import PeterAccountGateway from './components/PeterAccountGateway.jsx'
import PublicBlogIndex from './PublicBlogIndex.jsx'
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
const isMarketing = !isAdmin && !isLogin && !isAccountAccess

if (isMarketing) installWebVitals(APP_SLUG)

const lazyFallback = <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', background: '#02090d', color: '#e9fbff' }}><p>Carregando experiência…</p></main>

const appPage = isAdmin
  ? <Suspense fallback={lazyFallback}><AdminEntry /></Suspense>
  : isBlogIndex
    ? <PublicBlogIndex />
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
    {isAccountAccess ? (
      <Suspense fallback={lazyFallback}><AccountAccessPage /></Suspense>
    ) : isMarketing ? (
      <PublicErrorBoundary>{ecosystemExperience}</PublicErrorBoundary>
    ) : (
      ecosystemExperience
    )}
  </StrictMode>,
)
