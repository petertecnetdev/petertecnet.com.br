import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminSessionGuard from './AdminSessionGuard.jsx'
import PwaInstallButton from './PwaInstallButton.jsx'
import './App.css'
import './AdminEstablishmentsFeedback.css'
import './AdminResponsive.css'
import './AdminNavigationStandard.css'
import './AdminHamburgerPolish.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AdminSessionGuard />
    <PwaInstallButton />
  </StrictMode>,
)
