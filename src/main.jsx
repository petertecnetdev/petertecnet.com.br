import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminAppNavigation from './AdminAppNavigation.jsx'
import AdminGlobalSearch from './AdminGlobalSearch.jsx'
import AdminEstablishmentsIntegration from './AdminEstablishmentsIntegration.jsx'
import AdminItemsIntegration from './AdminItemsIntegration.jsx'
import './App.css'
import './AdminEstablishmentsFeedback.css'
import './AdminResponsive.css'
import './AdminNavigationStandard.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AdminGlobalSearch />
    <AdminEstablishmentsIntegration />
    <AdminItemsIntegration />
    <AdminAppNavigation />
  </StrictMode>,
)
