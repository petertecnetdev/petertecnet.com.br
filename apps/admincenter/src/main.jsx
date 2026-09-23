import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminCenterV2 from './AdminCenterV2.jsx'
import PwaInstallButton from './PwaInstallButton.jsx'
import SupportAdminApp from './SupportAdminApp.jsx'
import { installAdminRuntimeMonitor } from './adminRuntimeMonitor.js'
import { installWebVitals } from './discoveryApi.js'
import './admin.css'

installAdminRuntimeMonitor()
installWebVitals('admincenter')

const path = window.location.pathname.replace(/\/+$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/support' ? <SupportAdminApp /> : <AdminCenterV2 />}
    <PwaInstallButton />
  </StrictMode>,
)
