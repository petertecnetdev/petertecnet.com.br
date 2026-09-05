import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminEstablishmentsIntegration from './AdminEstablishmentsIntegration.jsx'
import './App.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AdminEstablishmentsIntegration />
  </StrictMode>,
)
