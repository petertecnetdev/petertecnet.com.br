import { AdminPage as LegacyAdminPage, LoginPage } from './Admin.jsx'
import AdminCommercialWorkspace from './AdminCommercialWorkspace.jsx'
import './AdminCommercialWorkspace.css'

export { LoginPage }

export function AdminPage() {
  return <>
    <LegacyAdminPage />
    <AdminCommercialWorkspace />
  </>
}
