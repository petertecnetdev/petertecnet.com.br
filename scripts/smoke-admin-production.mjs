const base = (process.env.ADMIN_HEALTH_URL || 'https://admincenter.petertecnet.com.br/').replace(/\/+$/, '/')
const expectedRelease = process.env.ADMIN_EXPECTED_RELEASE || '2026.09.06.2'

async function get(url) {
  const response = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Peter-Tecnet-Admin-Smoke/1.0' } })
  const text = await response.text()
  if (!response.ok) throw new Error(`${url} respondeu HTTP ${response.status}`)
  return { response, text }
}

const root = await get(base)
const assetMatch = root.text.match(/src="(\/assets\/[^"]+\.js)"/)
if (!assetMatch) throw new Error('index.html não referencia bundle JS de produção.')
const asset = await get(new URL(assetMatch[1], base).href)
if (!asset.text.includes(expectedRelease)) throw new Error(`Bundle publicado não contém release ${expectedRelease}.`)
const worker = await get(new URL('/service-worker.js', base).href)
if (!worker.text.includes("petertecnet-admin-pwa-v7")) throw new Error('Service Worker v7 ainda não está publicado.')
if (worker.text.includes("url.pathname.startsWith('/admin')")) throw new Error('Service Worker ainda contém regra legada /admin.')
console.log(`Smoke OK: ${base} · release ${expectedRelease} · asset ${assetMatch[1]} · SW v7`)
