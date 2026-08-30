import { startTelemetry } from './telemetry'
import { getToken } from './admin/api'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

startTelemetry({ apiBaseUrl: 'https://api.petertecnet.com.br/api', appSlug: 'peter-tecnet', appId: 3, getToken })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
