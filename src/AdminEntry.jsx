import App from './App.jsx'
import LaoraAdminCenter from './LaoraAdminCenter.jsx'
import EcosystemLauncherAdmin from './EcosystemLauncherAdmin.jsx'
import ApplicationBrandingPage from './ApplicationBrandingPage.jsx'
import ContentDiscoveryAdminPage from './ContentDiscoveryAdminPage.jsx'
import ContentApiMigrationBridge from './ContentApiMigrationBridge.jsx'
import DiscoveryIntelligenceAdminPage from './DiscoveryIntelligenceAdminPage.jsx'
import MarketingSettingsAdminPage from './MarketingSettingsAdminPage.jsx'
import IdentitySecurityCenter from './IdentitySecurityCenter.jsx'
import AdminMobileNavigation from './components/AdminMobileNavigation.jsx'
import AdminEstablishmentMediaBridge from './AdminEstablishmentMedia.jsx'
import AdminProductivityBridge from './AdminProductivityBridge.jsx'
import AdminHomeBridge from './AdminHomeBridge.jsx'
import AdminDeepLinkBridge from './AdminDeepLinkBridge.jsx'
import AdminUiProvider from './admin/AdminUiProvider.jsx'
import './admin/AdminTokens.css'
import './AdminProductivityBridge.css'
import './AdminProductivityLayoutFix.css'
import './AdminVisualSystem.css'
import './AdminExperience.css'
import './admin/AdminFutureTheme.css'
import './admin/AdminNavigationState.css'
import './admin/AdminSidebarRefinement.css'

function normalizePath(pathname = window.location.pathname) {
  return String(pathname || '/').replace(/\/+$/, '') || '/'
}

export default function AdminEntry() {
  const path = normalizePath()
  const isLauncherAdmin = path === '/admin/ecosystem-launcher'
  const isBrandingAdmin = path === '/admin/branding'
  const isContentAdmin = path === '/admin/content'
  const isDiscoveryAdmin = path === '/admin/discovery'
  const isMarketingAdmin = path === '/admin/marketing'
  const isIdentityAdmin = path === '/admin/identity' || path.startsWith('/admin/identity/')
  const isLaoraAdmin = path.startsWith('/admin/laora')

  let page
  if (isLauncherAdmin) {
    page = <EcosystemLauncherAdmin />
  } else if (isBrandingAdmin) {
    page = <><ApplicationBrandingPage /><AdminMobileNavigation /></>
  } else if (isContentAdmin) {
    page = <><ContentApiMigrationBridge /><ContentDiscoveryAdminPage /><AdminMobileNavigation /></>
  } else if (isDiscoveryAdmin) {
    page = <><DiscoveryIntelligenceAdminPage /><AdminMobileNavigation /></>
  } else if (isMarketingAdmin) {
    page = <><MarketingSettingsAdminPage /><AdminMobileNavigation /></>
  } else if (isIdentityAdmin) {
    page = <><IdentitySecurityCenter /><AdminMobileNavigation /></>
  } else if (isLaoraAdmin) {
    page = <><LaoraAdminCenter /><AdminMobileNavigation /></>
  } else {
    page = <><App /><AdminEstablishmentMediaBridge /><AdminMobileNavigation /><AdminProductivityBridge /><AdminHomeBridge /><AdminDeepLinkBridge /></>
  }

  return <AdminUiProvider>{page}</AdminUiProvider>
}
