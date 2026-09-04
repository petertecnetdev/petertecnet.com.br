import { createElement, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { AdminPage as LegacyAdminPage, LoginPage } from './Admin.jsx'
import AdminCommercialWorkspace from './AdminCommercialWorkspaceV2.jsx'
import VoiceAdminAssistant from './VoiceAdminAssistant.jsx'
import './AdminCommercialWorkspaceV2.css'
import './AdminCommercialWorkspaceMobile.css'

export { LoginPage }

export function AdminPage() {
  const commercialWorkspace = typeof document !== 'undefined'
    ? createPortal(createElement(AdminCommercialWorkspace), document.body)
    : createElement(AdminCommercialWorkspace)

  return createElement(
    Fragment,
    null,
    createElement(LegacyAdminPage),
    commercialWorkspace,
    createElement(VoiceAdminAssistant)
  )
}
