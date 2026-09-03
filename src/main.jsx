import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './seo.js'
import App from './App.jsx'
import MarketingExperience from './MarketingExperience.jsx'
import LaoraAdminCenter from './LaoraAdminCenter.jsx'
import AccountAccessPage from './AccountAccessPage.jsx'
import EcosystemLauncherAdmin from './EcosystemLauncherAdmin.jsx'
import IdentitySecurityCenter from './IdentitySecurityCenter.jsx'
import PeterAccountGateway from './components/PeterAccountGateway.jsx'
import AdminMobileNavigation from './components/AdminMobileNavigation.jsx'
import AdminEstablishmentMediaBridge from './AdminEstablishmentMedia.jsx'
import AdminProductivityBridge from './AdminProductivityBridge.jsx'
import AdminHomeBridge from './AdminHomeBridge.jsx'
import AdminDeepLinkBridge from './AdminDeepLinkBridge.jsx'
import { AdminUiProvider } from './admin/AdminUiContext.jsx'
import { installGlobalImageFallbacks } from './utils/imageFallback.js'
import { installPasswordVisibilityToggles } from './utils/passwordVisibility.js'
import './admin/AdminTokens.css'
import './AdminProductivityBridge.css'
import './AdminProductivityLayoutFix.css'
import './AdminVisualSystem.css'
import './AdminExperience.css'
import './admin/AdminNavigationState.css'

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
const isLauncherAdmin = path === '/admin/ecosystem-launcher'
const isIdentityAdmin = path === '/admin/identity'
const isLaoraAdmin = path.startsWith('/admin/laora')
const isAdmin = path === '/admin' || path.startsWith('/admin/')
const isLogin = path === '/login'
const isMarketing = !isAdmin && !isLogin && !isAccountAccess

const page = isLauncherAdmin ? (
  <EcosystemLauncherAdmin />
) : isIdentityAdmin ? (
  <>
    <IdentitySecurityCenter />
    <AdminMobileNavigation />
  </>
) : isLaoraAdmin ? (
  <>
    <LaoraAdminCenter />
    <AdminMobileNavigation />
  </>
) : isMarketing ? (
  <MarketingExperience />
) : (
  <>
    <App />
    {isAdmin && <AdminEstablishmentMediaBridge />}
    {isAdmin && <AdminMobileNavigation />}
    {isAdmin && <AdminProductivityBridge />}
    {isAdmin && <AdminHomeBridge />}
    {isAdmin && <AdminDeepLinkBridge />}
  </>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAccountAccess ? (
      <AccountAccessPage />
    ) : (
      <PeterAccountGateway apiBaseUrl={API_BASE_URL} appSlug={APP_SLUG}>
        {isAdmin ? <AdminUiProvider>{page}</AdminUiProvider> : page}
      </PeterAccountGateway>
    )}
  </StrictMode>,
)
