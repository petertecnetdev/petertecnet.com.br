import { lazy, Suspense, useEffect, useState } from 'react'
import AdminPersistentShell from './AdminPersistentShell.jsx'
import AdminRouteSync from './AdminRouteSync.jsx'
import AdminRouteErrorBoundary from './AdminRouteErrorBoundary.jsx'
import AdminMobileNavigation from './components/AdminMobileNavigation.jsx'
import AdminEstablishmentMediaBridge from './AdminEstablishmentMedia.jsx'
import AdminProductivityBridge from './AdminProductivityBridge.jsx'
import AdminHomeBridge from './AdminHomeBridge.jsx'
import AdminDeepLinkBridge from './AdminDeepLinkBridge.jsx'
import AdminUiProvider from './admin/AdminUiProvider.jsx'
import AdminWorkspaceStateBridge from './admin/AdminWorkspaceStateBridge.jsx'
import AdminRealtimeBridge from './admin/AdminRealtimeBridge.jsx'
import AdminInteractionGuard from './admin/AdminInteractionGuard.jsx'
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
import './admin/AdminMobileHardening.css'

const LegacyAdminPage = lazy(() => import('./Admin.js').then(module => ({ default: module.AdminPage })))
const LaoraAdminCenter = lazy(() => import('./LaoraAdminCenter.jsx'))
const EcosystemLauncherAdmin = lazy(() => import('./EcosystemLauncherAdmin.jsx'))
const ApplicationBrandingPage = lazy(() => import('./ApplicationBrandingPage.jsx'))
const ContentDiscoveryAdminPage = lazy(() => import('./ContentDiscoveryAdminPage.jsx'))
const ContentApiMigrationBridge = lazy(() => import('./ContentApiMigrationBridge.jsx'))
const DiscoveryIntelligenceAdminPage = lazy(() => import('./DiscoveryIntelligenceAdminPage.jsx'))
const MarketingSettingsAdminPage = lazy(() => import('./MarketingSettingsAdminPage.jsx'))
const AdminVisibilityPage = lazy(() => import('./AdminVisibilityPage.jsx'))
const AdminEventsPage = lazy(() => import('./AdminEventsPage.jsx'))
const CognitiveControlCenter = lazy(() => import('./CognitiveControlCenter.jsx'))

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

function AdminRouteLoading() {
  return (
    <div className="admin-stack" role="status" aria-live="polite" aria-busy="true">
      <div className="panel">
        <strong>Carregando módulo...</strong>
      </div>
    </div>
  )
}

function legacyWorkspace() {
  return <>
    <LegacyAdminPage />
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
      <AdminInteractionGuard />
      <AdminPersistentShell activeKey={activeKey}>
        <AdminRouteErrorBoundary key={path}>
          <Suspense fallback={<AdminRouteLoading />}>
            {adminRouteContent(path)}
          </Suspense>
        </AdminRouteErrorBoundary>
      </AdminPersistentShell>
      <AdminMobileNavigation />
      <AdminWorkspaceStateBridge />
      <AdminRealtimeBridge />
    </AdminUiProvider>
  )
}
