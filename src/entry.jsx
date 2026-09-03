const path = window.location.pathname.replace(/\/+$/, '') || '/'

const isMarketingHub = path === '/'
  || path === '/sobre'
  || path === '/portfolio'
  || path === '/orcamento'
  || path.startsWith('/servicos/')

if (isMarketingHub) {
  import('./MarketingHubApp.jsx')
} else {
  import('./main.jsx')
}
