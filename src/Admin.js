import { createElement, Fragment } from 'react'
import { AdminPage as LegacyAdminPage, LoginPage } from './Admin.jsx'
import AdminEstablishmentsPageBridge from './AdminEstablishmentsPageBridge.jsx'
import AdminUserEmailBridge from './AdminUserEmailBridge.jsx'
import VoiceAdminAssistant from './VoiceAdminAssistant.jsx'

export { LoginPage }

export function AdminPage() {
  return createElement(
    Fragment,
    null,
    createElement(LegacyAdminPage),
    createElement(AdminEstablishmentsPageBridge),
    createElement(AdminUserEmailBridge),
    createElement(VoiceAdminAssistant)
  )
}
