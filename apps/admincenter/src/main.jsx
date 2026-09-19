import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import PwaInstallButton from './PwaInstallButton.jsx'
import SupportAdminApp, { AdminSupportLauncher } from './SupportAdminApp.jsx'
import { installAdminRuntimeMonitor } from './adminRuntimeMonitor.js'
import './App.css'
import './AdminEstablishmentsFeedback.css'
import './AdminResponsive.css'
import './SupportAdminResponsiveFix.css'
import './AdminProcessingExperience.css'
import './AdminExperienceV2.css'
import './AdminUiKit.css'
import './AdminQualityLayer.css'

installAdminRuntimeMonitor()

const path = window.location.pathname.replace(/\/+$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/support' ? <SupportAdminApp /> : <><App /><AdminSupportLauncher /></>}
    <PwaInstallButton />
  </StrictMode>,
)
