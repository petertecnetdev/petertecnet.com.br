import { createElement, Fragment } from 'react'
import { AdminPage as LegacyAdminPage, LoginPage } from './Admin.jsx'
import AdminCommercialWorkspace from './AdminCommercialWorkspaceV2.jsx'
import AdminVisibilityPage, { AdminModuleNav } from './AdminVisibilityPage.jsx'
import './AdminCommercialWorkspaceV2.css'
import './AdminCommercialWorkspaceMobile.css'

export { LoginPage }

export function AdminPage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/admin'

  if (path === '/admin/visibility') {
    return createElement(AdminVisibilityPage)
  }

  return createElement(
    Fragment,
    null,
    createElement(AdminModuleNav, { active: 'mission' }),
    createElement(LegacyAdminPage),
    createElement(AdminCommercialWorkspace)
  )
}
