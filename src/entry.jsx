const path = window.location.pathname.replace(/\/+$/, '') || '/'

if (path === '/') {
  import('./PeterLandingApp.jsx')
} else {
  import('./main.jsx')
}
