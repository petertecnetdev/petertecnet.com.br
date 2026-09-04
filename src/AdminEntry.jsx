import { useEffect, useState } from 'react'
import App from './App.jsx'
import LaoraAdminCenter from './LaoraAdminCenter.jsx'
import EcosystemLauncherAdmin from './EcosystemLauncherAdmin.jsx'
import ApplicationBrandingPage from './ApplicationBrandingPage.jsx'
import ContentDiscoveryAdminPage from './ContentDiscoveryAdminPage.jsx'
import ContentApiMigrationBridge from './ContentApiMigrationBridge.jsx'
import DiscoveryIntelligenceAdminPage from './DiscoveryIntelligenceAdminPage.jsx'
import MarketingSettingsAdminPage from './MarketingSettingsAdminPage.jsx'
import AdminVisibilityPage from './AdminVisibilityPage.jsx'
import AdminEventsPage from './AdminEventsPage.jsx'
import CognitiveControlCenter from './CognitiveControlCenter.jsx'
import AdminPersistentShell from './AdminPersistentShell.jsx'
import AdminRouteSync from './AdminRouteSync.jsx'
import AdminMobileNavigation from './components/AdminMobileNavigation.jsx'
import AdminEstablishmentMediaBridge from './AdminEstablishmentMedia.jsx'
import AdminProductivityBridge from './AdminProductivityBridge.jsx'
import AdminHomeBridge from './AdminHomeBridge.jsx'
import AdminDeepLinkBridge from './AdminDeepLinkBridge.jsx'
import AdminUiProvider from './admin/AdminUiProvider.jsx'
import AdminWorkspaceStateBridge from './admin/AdminWorkspaceStateBridge.jsx'
import AdminRealtimeBridge from './admin/AdminRealtimeBridge.jsx'
import { adminTabFromLocation, normalizeAdminPath } from './admin/AdminNavigationConfig.js'
import { ADMIN_NAVIGATION_CHANGED_EVENT } from './admin/AdminUiEvents.js'
import './admin/AdminTokens.css'
import './AdminProductivityBridge.css'
import './AdminProductivityLayoutFix.css'
import './AdminVisualSystem.css'
import './AdminExperience.css'
import './admin/AdminFutureTheme.css'
import './admin/AdminNavigationState.css'
import './admin/AdminSidebarRefinement.css'

function useAdminPath() {
  const [path, setPath] = useState(() => normalizeAdminPath(window.location.pathname))

  useEffect(() => {
    const sync = () => setPath(normalizeAdminPath(window.location.pathname))
    window.addEventListener('popstate', sync)
    window.addEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, sync)
    }
  }, [])

  return path
}

function legacyWorkspace() {
  return <>
    <App />
    <AdminEstablishmentMediaBridge />
    <AdminProductivityBridge />
    <AdminHomeBridge />
    <AdminDeepLinkBridge />
    <AdminRouteSync />
  </>
}

function adminRouteContent(path) {
  if (path === '/admin/ecosystem-launcher') return <EcosystemLauncherAdmin />
  if (path === '/admin/branding') return <ApplicationBrandingPage />
  if (path === '/admin/content') return <><ContentApiMigrationBridge /><ContentDiscoveryAdminPage /></>
  if (path === '/admin/discovery') return <DiscoveryIntelligenceAdminPage />
  if (path === '/admin/marketing') return <MarketingSettingsAdminPage />
  if (path === '/admin/visibility') return <AdminVisibilityPage />
  if (path === '/admin/events') return <AdminEventsPage />
  if (path === '/admin/cognition') return <CognitiveControlCenter />
  if (path.startsWith('/admin/laora')) return <LaoraAdminCenter />
  return legacyWorkspace()
}

export default function AdminEntry() {
  const path = useAdminPath()
  const activeKey = adminTabFromLocation(path)

  return (
    <AdminUiProvider>
      <AdminPersistentShell activeKey={activeKey}>
        {adminRouteContent(path)}
      </AdminPersistentShell>
      <AdminMobileNavigation />
      <AdminWorkspaceStateBridge />
      <AdminRealtimeBridge />
    </AdminUiProvider>
  )
}
