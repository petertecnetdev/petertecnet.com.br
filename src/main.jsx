import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './LandingEnhancements.css'
import './seo.js'
import App from './App.jsx'
import PeterAccountGateway from './components/PeterAccountGateway.jsx'

const API_BASE_URL = 'https://api.petertecnet.com.br/api'
const APP_SLUG = 'peter-tecnet'

const adminToken = localStorage.getItem('petertecnet_admin_token')
const ecosystemToken = localStorage.getItem('token')

if (adminToken && !ecosystemToken) localStorage.setItem('token', adminToken)
if (ecosystemToken && !adminToken) localStorage.setItem('petertecnet_admin_token', ecosystemToken)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PeterAccountGateway apiBaseUrl={API_BASE_URL} appSlug={APP_SLUG}>
      <App />
    </PeterAccountGateway>
  </StrictMode>,
)
