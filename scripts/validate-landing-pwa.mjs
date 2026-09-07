import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const fail = (message) => {
  console.error(`[landing-pwa] ${message}`);
  process.exit(1);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};

const index = read('index.html');
const manifest = JSON.parse(read('public/manifest.json'));
const worker = read('public/service-worker.js');

assert(index.includes('id="root"'), 'index.html must keep the React root mount.');
assert(index.includes('<pt-processing-indicator'), 'index.html must keep the branded bootstrap loader.');
assert(index.includes('/petertecnetlogo.png'), 'index.html must use the official Peter Tecnet logo.');
assert(index.includes('data-sw="/service-worker.js"'), 'landing must register the dedicated service worker.');
assert(index.includes('rel="manifest"'), 'landing must expose the PWA manifest.');

for (const forbidden of ['favicon.svg', 'pwa-admin-192.svg', 'pwa-admin-512.svg', 'manifest.webmanifest']) {
  assert(!index.includes(forbidden), `index.html references forbidden legacy asset: ${forbidden}`);
  assert(!fs.existsSync(path.join(root, 'public', forbidden)), `legacy asset still exists in public/: ${forbidden}`);
}

assert(manifest.id === '/', 'manifest id must belong to the landing root.');
assert(manifest.scope === '/', 'manifest scope must belong to the landing root.');
assert(manifest.name === 'Peter Tecnet', 'manifest name must be Peter Tecnet.');
assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest must declare at least one icon.');
assert(manifest.icons.every((icon) => String(icon.src || '').includes('petertecnetlogo.png')), 'manifest icons must use the official logo.');

assert(worker.includes("petertecnet-landing-pwa-"), 'service worker must use the landing cache namespace.');
assert(!worker.includes("const CACHE_VERSION = 'petertecnet-admin-pwa"), 'landing service worker cannot use the Admin Center cache version.');
assert(!worker.includes('<title>Admin Center'), 'landing offline page cannot identify as Admin Center.');
assert(worker.includes("url.pathname.startsWith('/admin')"), 'landing service worker must explicitly bypass legacy /admin routes.');
assert(worker.includes('cache: \'no-store\''), 'navigation requests must prefer fresh network content.');

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  for (const forbidden of ['favicon.svg', 'pwa-admin-192.svg', 'pwa-admin-512.svg', 'manifest.webmanifest']) {
    assert(!fs.existsSync(path.join(dist, forbidden)), `production build contains forbidden legacy asset: ${forbidden}`);
  }

  const builtIndexPath = path.join(dist, 'index.html');
  if (fs.existsSync(builtIndexPath)) {
    const builtIndex = fs.readFileSync(builtIndexPath, 'utf8');
    assert(builtIndex.includes('/petertecnetlogo.png'), 'production index must reference the official logo.');
    assert(builtIndex.includes('/service-worker.js'), 'production index must register the landing service worker.');
  }
}

console.log('[landing-pwa] branding, bootstrap, manifest and service-worker contract OK');
