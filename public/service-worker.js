const CACHE_VERSION = 'petertecnet-landing-pwa-v2';
const CACHE_PREFIX = 'petertecnet-landing-pwa-';
const ADMIN_CACHE_PREFIX = 'petertecnet-admin-pwa-';
const STATIC_ASSETS = [
  '/manifest.json',
  '/petertecnetlogo.png',
  '/ecosystem/processing-indicator.css',
  '/ecosystem/processing-indicator.js',
];

const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#02080c">
  <title>Peter Tecnet offline</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#02080c;color:#effcff}
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 0,rgba(53,223,242,.1),transparent 38%),#02080c}
    main{width:min(520px,100%);padding:28px;border:1px solid rgba(116,217,234,.16);border-radius:22px;background:rgba(5,20,29,.96);box-shadow:0 26px 80px rgba(0,0,0,.35)}
    img{width:72px;height:72px;object-fit:contain;margin-bottom:12px}small{color:#35dff2;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1{margin:10px 0 12px;font-size:clamp(26px,6vw,38px)}p{margin:0 0 20px;color:#91adb5;line-height:1.6}a{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:0 18px;border-radius:12px;background:#dffbff;color:#041217;font-weight:900;text-decoration:none}
  </style>
</head>
<body><main><img src="/petertecnetlogo.png" alt="Peter Tecnet"><small>Peter Tecnet</small><h1>Você está offline</h1><p>Assim que sua conexão voltar, recarregue a página para acessar a experiência mais recente da Peter Tecnet.</p><a href="/">Tentar novamente</a></main></body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => (
            (key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
            || key.startsWith(ADMIN_CACHE_PREFIX)
          ))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The Admin Center has its own domain and service worker. Never let the
  // public landing worker intercept legacy /admin routes on this origin.
  if (url.pathname.startsWith('/admin')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => new Response(OFFLINE_HTML, {
        status: 503,
        statusText: 'Peter Tecnet offline',
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }))
    );
    return;
  }

  // Vite emits immutable hashed assets, but a cache-first strategy can keep a
  // partially deployed/stale runtime alive when a release changes while the
  // PWA is open. Prefer the network and use cache only as an offline fallback.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
