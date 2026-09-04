(() => {
  'use strict'

  const VERSION = '1.0.0'
  const listeners = new Set()
  let configuration = {
    apiBase: 'https://api.petertecnet.com.br/api',
    appSlug: '',
    getToken: () => ['petertecnet_admin_token', 'petertecnet_token', 'token', 'access_token', 'auth_token']
      .map(key => localStorage.getItem(key)).find(Boolean) || null,
  }
  let snapshot = { roles: [], memberships: [], relationships: [], relationship_summary: { total: 0, returned: 0, truncated: false } }

  const asArray = value => Array.isArray(value) ? value : []
  const normalize = value => String(value || '').trim().toLowerCase()
  const sameId = (left, right) => String(left ?? '') === String(right ?? '')

  function configure(next = {}) {
    configuration = { ...configuration, ...next }
    configuration.apiBase = String(configuration.apiBase || '').replace(/\/+$/, '')
    configuration.appSlug = normalize(configuration.appSlug)
    return api
  }

  function normalizeSnapshot(payload) {
    const source = payload?.data?.user ? payload.data : payload
    const access = source?.contextual_access || source?.access || source || {}
    return {
      roles: asArray(access.roles),
      memberships: asArray(access.memberships),
      relationships: asArray(access.relationships),
      relationship_summary: access.relationship_summary || {
        total: asArray(access.relationships).length,
        returned: asArray(access.relationships).length,
        truncated: false,
      },
    }
  }

  function setSnapshot(payload) {
    snapshot = normalizeSnapshot(payload)
    for (const listener of listeners) listener(snapshot)
    window.dispatchEvent(new CustomEvent('peter:access-changed', { detail: snapshot }))
    return snapshot
  }

  function getSnapshot() { return snapshot }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function can(permission, options = {}) {
    const { applicationId = null, establishmentId = null, resourceUuid = null, resourceType = null, resourceId = null } = options
    return snapshot.roles.some(assignment => {
      if (!asArray(assignment?.permissions).includes(permission)) return false
      if (applicationId && assignment?.application?.id && !sameId(assignment.application.id, applicationId)) return false
      if (establishmentId && assignment?.establishment?.id && !sameId(assignment.establishment.id, establishmentId)) return false
      if (resourceUuid && assignment?.resource?.uuid && normalize(assignment.resource.uuid) !== normalize(resourceUuid)) return false
      if (resourceType && assignment?.resource_type && normalize(assignment.resource_type) !== normalize(resourceType)) return false
      if (resourceId && assignment?.resource_id && !sameId(assignment.resource_id, resourceId)) return false
      return true
    })
  }

  function relationshipsFor(options = {}) {
    const { resourceUuid = null, resourceType = null, resourceId = null, relationshipType = null } = options
    return snapshot.relationships.filter(relationship => {
      if (resourceUuid && normalize(relationship?.resource?.uuid) !== normalize(resourceUuid)) return false
      if (resourceType && normalize(relationship?.resource_type) !== normalize(resourceType)) return false
      if (resourceId && !sameId(relationship?.resource_id, resourceId)) return false
      if (relationshipType && normalize(relationship?.type || relationship?.relationship_type) !== normalize(relationshipType)) return false
      return true
    })
  }

  function relationshipFor(options = {}) {
    return relationshipsFor(options)[0] || null
  }

  async function request(path, options = {}) {
    const token = configuration.getToken?.()
    const response = await fetch(`${configuration.apiBase}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || 'Falha ao consultar acesso contextual.')
      error.status = response.status
      error.data = payload
      throw error
    }
    return payload
  }

  async function loadSummary() {
    if (!configuration.appSlug) throw new Error('PeterTecnetAccess requer appSlug.')
    const payload = await request(`/v1/apps/${encodeURIComponent(configuration.appSlug)}/me`)
    setSnapshot(payload)
    return payload
  }

  async function loadRelationships(filters = {}) {
    if (!configuration.appSlug) throw new Error('PeterTecnetAccess requer appSlug.')
    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') query.set(key, String(value))
    })
    const payload = await request(`/v1/apps/${encodeURIComponent(configuration.appSlug)}/me/relationships?${query.toString()}`)
    return payload
  }

  async function authorize(resourceUuid, permission) {
    if (!configuration.appSlug) throw new Error('PeterTecnetAccess requer appSlug.')
    return request(`/v1/apps/${encodeURIComponent(configuration.appSlug)}/resources/${encodeURIComponent(resourceUuid)}/authorize`, {
      method: 'POST',
      body: JSON.stringify({ permission }),
    })
  }

  function createReactBindings(React) {
    if (!React?.createContext || !React?.useContext) throw new Error('React inválido para PeterTecnetAccess bindings.')
    const AccessContext = React.createContext({ snapshot: getSnapshot(), can, relationshipsFor, relationshipFor })

    function AccessProvider({ children }) {
      const [value, setValue] = React.useState(getSnapshot())
      React.useEffect(() => subscribe(setValue), [])
      return React.createElement(AccessContext.Provider, {
        value: { snapshot: value, can, relationshipsFor, relationshipFor, loadSummary, loadRelationships, authorize },
      }, children)
    }

    function useAccess() { return React.useContext(AccessContext) }
    function usePermission(permission, options = {}) {
      React.useContext(AccessContext)
      return can(permission, options)
    }
    function useRelationship(options = {}) {
      React.useContext(AccessContext)
      return relationshipFor(options)
    }

    return { AccessContext, AccessProvider, useAccess, usePermission, useRelationship }
  }

  const api = Object.freeze({
    version: VERSION,
    configure,
    normalizeSnapshot,
    setSnapshot,
    getSnapshot,
    subscribe,
    can,
    relationshipsFor,
    relationshipFor,
    loadSummary,
    loadRelationships,
    authorize,
    createReactBindings,
  })

  window.PeterTecnetAccess = api
})()
