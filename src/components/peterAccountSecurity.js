export function isTrustedPeterTecnetUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'petertecnet.com.br' || host.endsWith('.petertecnet.com.br'))
  } catch {
    return false
  }
}
