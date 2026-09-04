import { createElement, Fragment, lazy, Suspense } from 'react'
import { AdminPage as LegacyAdminPage, LoginPage } from './Admin.jsx'

const AdminEstablishmentsPageBridge = lazy(() => import('./AdminEstablishmentsPageBridge.jsx'))
const AdminUserEmailBridge = lazy(() => import('./AdminUserEmailBridge.jsx'))
const VoiceAdminAssistant = lazy(() => import('./VoiceAdminAssistant.jsx'))

export { LoginPage }

export function AdminPage() {
  return createElement(
    Fragment,
    null,
    createElement(LegacyAdminPage),
    createElement(
      Suspense,
      { fallback: null },
      createElement(AdminEstablishmentsPageBridge),
      createElement(AdminUserEmailBridge),
      createElement(VoiceAdminAssistant)
    )
  )
}
