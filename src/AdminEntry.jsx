import App from './App.jsx'
import LaoraAdminCenter from './LaoraAdminCenter.jsx'
import EcosystemLauncherAdmin from './EcosystemLauncherAdmin.jsx'
import ApplicationBrandingPage from './ApplicationBrandingPage.jsx'
import ContentDiscoveryAdminPage from './ContentDiscoveryAdminPage.jsx'
import ContentApiMigrationBridge from './ContentApiMigrationBridge.jsx'
import DiscoveryIntelligenceAdminPage from './DiscoveryIntelligenceAdminPage.jsx'
import MarketingSettingsAdminPage from './MarketingSettingsAdminPage.jsx'
import AdminVisibilityPage from './AdminVisibilityPage.jsx'
import AdminPersistentShell from './AdminPersistentShell.jsx'
import AdminRouteSync from './AdminRouteSync.jsx'
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

function persistentPage(activeKey, content) {
  return <><AdminPersistentShell activeKey={activeKey}>{content}</AdminPersistentShell><AdminMobileNavigation /></>
}

export default function AdminEntry() {
  const path = normalizePath()
  const isLauncherAdmin = path === '/admin/ecosystem-launcher'
  const isBrandingAdmin = path === '/admin/branding'
  const isContentAdmin = path === '/admin/content'
  const isDiscoveryAdmin = path === '/admin/discovery'
  const isMarketingAdmin = path === '/admin/marketing'
  const isVisibilityAdmin = path === '/admin/visibility'
  const isLaoraAdmin = path.startsWith('/admin/laora')

  let page
  if (isLauncherAdmin) {
    page = persistentPage('ecosystem-launcher', <EcosystemLauncherAdmin />)
  } else if (isBrandingAdmin) {
    page = persistentPage('branding', <ApplicationBrandingPage />)
  } else if (isContentAdmin) {
    page = persistentPage('content', <><ContentApiMigrationBridge /><ContentDiscoveryAdminPage /></>)
  } else if (isDiscoveryAdmin) {
    page = persistentPage('discovery', <DiscoveryIntelligenceAdminPage />)
  } else if (isMarketingAdmin) {
    page = persistentPage('marketing', <MarketingSettingsAdminPage />)
  } else if (isVisibilityAdmin) {
    page = persistentPage('visibility', <AdminVisibilityPage />)
  } else if (isLaoraAdmin) {
    page = <><LaoraAdminCenter /><AdminMobileNavigation /></>
  } else {
    page = <><App /><AdminEstablishmentMediaBridge /><AdminMobileNavigation /><AdminProductivityBridge /><AdminHomeBridge /><AdminDeepLinkBridge /><AdminRouteSync /></>
  }

  return <AdminUiProvider>{page}</AdminUiProvider>
}
