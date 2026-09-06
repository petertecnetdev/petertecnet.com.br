import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminSessionGuard from './AdminSessionGuard.jsx'
import PwaInstallButton from './PwaInstallButton.jsx'
import SupportAdminApp, { AdminSupportLauncher } from './SupportAdminApp.jsx'
import './App.css'
import './AdminEstablishmentsFeedback.css'
import './AdminResponsive.css'
import './AdminNavigationStandard.css'
import './AdminHamburgerPolish.css'
import './SupportAdminResponsiveFix.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/support' ? <SupportAdminApp /> : <><App /><AdminSupportLauncher /></>}
    <AdminSessionGuard />
    <PwaInstallButton />
  </StrictMode>,
)
