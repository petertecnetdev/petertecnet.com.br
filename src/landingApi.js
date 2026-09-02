const API_ORIGIN = 'https://api.petertecnet.com.br'
export const PETER_TECNET_CNPJ = '42595409000148'

const normalizeDocument = value => String(value || '').replace(/\D/g, '')

export const resolveAssetUrl = path => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${API_ORIGIN}/${String(path).replace(/^\/+/, '')}`
}

export const getItemImage = item => {
  if (item?.image_url) return resolveAssetUrl(item.image_url)
  const files = Array.isArray(item?.files) ? item.files : []
  const preferred = files.find(file => file?.is_primary) || files.find(file => file?.type === 'image') || files[0]
  return resolveAssetUrl(preferred?.public_url || preferred?.url || preferred?.path)
}

const apiGet = async (path, signal) => {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const error = new Error(`API request failed: ${response.status}`)
    error.status = response.status
    throw error
  }

  return response.json()
}

export const fetchApplications = signal => apiGet('/api/applications', signal)
export const fetchSite = signal => apiGet('/api/ecosystem/site', signal)

const resolveNexusApplication = applications =>
  applications.find(application => String(application?.slug || '').toLowerCase() === 'nexus')

const isPeterTecnetCompany = company => {
  if (!company) return false
  if (normalizeDocument(company.cnpj) === PETER_TECNET_CNPJ) return true
  const name = `${company.name || ''} ${company.fantasy || ''}`.toLowerCase()
  return name.includes('peter tecnet')
}

const loadLegacyCatalog = async signal => {
  const payload = await apiGet(`/api/nexus/public/catalog-by-cnpj/${PETER_TECNET_CNPJ}`, signal)
  if (!payload?.success) throw new Error('Legacy catalog unavailable')
  return {
    establishment: payload.establishment || null,
    items: Array.isArray(payload.items) ? payload.items : [],
    source: 'legacy',
  }
}

const discoverPeterTecnetCompany = async (nexusAppId, signal) => {
  const queries = [
    `/api/nexus/discovery?app_id=${encodeURIComponent(nexusAppId)}&q=${encodeURIComponent('Peter Tecnet')}&limit=20`,
    `/api/nexus/discovery?app_id=${encodeURIComponent(nexusAppId)}&limit=100`,
  ]

  for (const path of queries) {
    try {
      const discovery = await apiGet(path, signal)
      const companies = Array.isArray(discovery?.establishments) ? discovery.establishments : []
      const company = companies.find(isPeterTecnetCompany)
      if (company) return company
    } catch (error) {
      if (error?.name === 'AbortError') throw error
    }
  }

  return null
}

export async function fetchPeterCatalog(applications, signal) {
  const nexus = resolveNexusApplication(applications)

  if (nexus?.id) {
    try {
      const company = await discoverPeterTecnetCompany(nexus.id, signal)
      if (company?.slug || company?.id) {
        const identifier = company.slug || company.id
        const catalog = await apiGet(`/api/nexus/catalog/${encodeURIComponent(identifier)}?app_id=${encodeURIComponent(nexus.id)}`, signal)
        if (catalog?.success) {
          return {
            establishment: catalog.establishment || company,
            items: Array.isArray(catalog.items) ? catalog.items : [],
            nexusAppId: nexus.id,
            source: 'nexus-v2',
          }
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
    }
  }

  return loadLegacyCatalog(signal)
}

export async function fetchPeterItem(identifier, applications, signal) {
  const nexus = resolveNexusApplication(applications)

  if (nexus?.id) {
    try {
      const payload = await apiGet(`/api/nexus/item/${encodeURIComponent(identifier)}?app_id=${encodeURIComponent(nexus.id)}`, signal)
      if (payload?.success && isPeterTecnetCompany(payload.establishment)) {
        return {
          item: payload.item,
          establishment: payload.establishment,
          otherItems: Array.isArray(payload.other_items) ? payload.other_items : [],
          source: 'nexus-v2',
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
    }
  }

  const catalog = await loadLegacyCatalog(signal)
  const item = catalog.items.find(candidate => String(candidate?.slug || candidate?.id) === String(identifier))
  if (!item) {
    const error = new Error('Item not found')
    error.status = 404
    throw error
  }

  return {
    item,
    establishment: catalog.establishment,
    otherItems: catalog.items.filter(candidate => candidate?.id !== item?.id).slice(0, 8),
    source: 'legacy',
  }
}

export const formatCurrency = value => {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Sob consulta'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}
