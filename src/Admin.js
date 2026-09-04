import { createElement, Fragment } from 'react'
import { AdminPage as LegacyAdminPage, LoginPage } from './Admin.jsx'
import AdminEstablishmentsPageBridge from './AdminEstablishmentsPageBridge.jsx'
import VoiceAdminAssistant from './VoiceAdminAssistant.jsx'

export { LoginPage }

export function AdminPage() {
  return createElement(
    Fragment,
    null,
    createElement(LegacyAdminPage),
    createElement(AdminEstablishmentsPageBridge),
    createElement(VoiceAdminAssistant)
  )
}
