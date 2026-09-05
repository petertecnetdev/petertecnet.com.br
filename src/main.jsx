import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminAppNavigation from './AdminAppNavigation.jsx'
import AdminGlobalSearch from './AdminGlobalSearch.jsx'
import AdminEstablishmentsPageIntegration from './AdminEstablishmentsPageIntegration.jsx'
import AdminItemsPageIntegration from './AdminItemsPageIntegration.jsx'
import AdminDataIntegration from './AdminDataIntegration.jsx'
import './App.css'
import './AdminEstablishmentsFeedback.css'
import './AdminResponsive.css'
import './AdminNavigationStandard.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AdminGlobalSearch />
    <AdminEstablishmentsPageIntegration />
    <AdminItemsPageIntegration />
    <AdminDataIntegration />
    <AdminAppNavigation />
  </StrictMode>,
)
