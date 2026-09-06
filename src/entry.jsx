const path = window.location.pathname.replace(/\/+$/, '') || '/'

import('./MarketingConversionBridge.js')
import('./MarketingQuoteDraftBridge.js')
import('./SupportLinkBridge.js')

const isMarketingHub = path === '/'
  || path === '/sobre'
  || path === '/portfolio'
  || path === '/orcamento'
  || path.startsWith('/servicos/')

if (path === '/suporte') {
  import('./SupportPublicApp.jsx')
} else if (isMarketingHub) {
  Promise.all([
    import('./MarketingHubApp.jsx'),
    import('./MarketingRuntimeConfig.js'),
  ])
} else {
  import('./main.jsx')
}
