import { createElement, Fragment } from 'react'
import { AdminPage as LegacyAdminPage, LoginPage } from './Admin.jsx'
import AdminCommercialWorkspace from './AdminCommercialWorkspaceV2.jsx'
import VoiceAdminAssistant from './VoiceAdminAssistant.jsx'
import './AdminCommercialWorkspaceV2.css'
import './AdminCommercialWorkspaceMobile.css'

export { LoginPage }

export function AdminPage() {
  return createElement(
    Fragment,
    null,
    createElement(LegacyAdminPage),
    createElement(AdminCommercialWorkspace),
    createElement(VoiceAdminAssistant)
  )
}
