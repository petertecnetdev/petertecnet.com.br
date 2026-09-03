import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './AdminResponsive.css'
import './seo.js'
import App from './App.jsx'
import LaoraAdminCenter from './LaoraAdminCenter.jsx'
import AccountAccessPage from './AccountAccessPage.jsx'
import EcosystemLauncherAdmin from './EcosystemLauncherAdmin.jsx'
import PeterAccountGateway from './components/PeterAccountGateway.jsx'
import AdminMobileNavigation from './components/AdminMobileNavigation.jsx'
import AdminEstablishmentMediaBridge from './AdminEstablishmentMedia.jsx'
import AdminProductivityBridge from './AdminProductivityBridge.jsx'
import AdminHomeBridge from './AdminHomeBridge.jsx'
import './AdminMobileNavigation.css'
import './AdminDesktop.css'
import './AdminProductivityBridge.css'
import './AdminProductivityLayoutFix.css'

const API_BASE_URL = 'https://api.petertecnet.com.br/api'
const APP_SLUG = 'peter-tecnet'

const adminToken = localStorage.getItem('petertecnet_admin_token')
const ecosystemToken = localStorage.getItem('token')

if (adminToken && !ecosystemToken) localStorage.setItem('token', adminToken)
if (ecosystemToken && !adminToken) localStorage.setItem('petertecnet_admin_token', ecosystemToken)

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isAccountAccess = path === '/account/activate' || path === '/account/password/reset'
const isLauncherAdmin = path === '/admin/ecosystem-launcher'
const isLaoraAdmin = path.startsWith('/admin/laora')
const isAdmin = path === '/admin' || path.startsWith('/admin/')
const page = isLauncherAdmin ? (
  <EcosystemLauncherAdmin />
) : isLaoraAdmin ? (
  <>
    <LaoraAdminCenter />
    <AdminMobileNavigation />
  </>
) : (
  <>
    <App />
    {isAdmin && <AdminEstablishmentMediaBridge />}
    {isAdmin && <AdminMobileNavigation />}
    {isAdmin && <AdminProductivityBridge />}
    {isAdmin && <AdminHomeBridge />}
  </>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAccountAccess ? (
      <AccountAccessPage />
    ) : (
      <PeterAccountGateway apiBaseUrl={API_BASE_URL} appSlug={APP_SLUG}>
        {page}
      </PeterAccountGateway>
    )}
  </StrictMode>,
)
