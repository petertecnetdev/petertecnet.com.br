import App from './App.jsx'
import LaoraAdminCenter from './LaoraAdminCenter.jsx'
import EcosystemLauncherAdmin from './EcosystemLauncherAdmin.jsx'
import ApplicationBrandingPage from './ApplicationBrandingPage.jsx'
import ContentDiscoveryAdminPage from './ContentDiscoveryAdminPage.jsx'
import ContentApiMigrationBridge from './ContentApiMigrationBridge.jsx'
import DiscoveryIntelligenceAdminPage from './DiscoveryIntelligenceAdminPage.jsx'
import DiscoveryGrowthAdminPage from './DiscoveryGrowthAdminPage.jsx'
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

function normalizePath(pathname = window.location.pathname) {
  return String(pathname || '/').replace(/\/+$/, '') || '/'
}

export default function AdminEntry() {
  const path = normalizePath()
  const isLauncherAdmin = path === '/admin/ecosystem-launcher'
  const isBrandingAdmin = path === '/admin/branding'
  const isContentAdmin = path === '/admin/content'
  const isDiscoveryAdmin = path === '/admin/discovery'
  const isGrowthAdmin = path === '/admin/growth'
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
  } else if (isGrowthAdmin) {
    page = <><DiscoveryGrowthAdminPage /><AdminMobileNavigation /></>
  } else if (isLaoraAdmin) {
    page = <><LaoraAdminCenter /><AdminMobileNavigation /></>
  } else {
    page = <><App /><AdminEstablishmentMediaBridge /><AdminMobileNavigation /><AdminProductivityBridge /><AdminHomeBridge /><AdminDeepLinkBridge /></>
  }

  return <AdminUiProvider>{page}</AdminUiProvider>
}
