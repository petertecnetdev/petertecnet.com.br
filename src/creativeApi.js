const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const APP_SLUG = 'peter-tecnet'

function token() {
  return localStorage.getItem('petertecnet_admin_token') || localStorage.getItem('token') || ''
}

export async function generateMarketingImage(payload, { signal } = {}) {
  const auth = token()
  if (!auth) {
    const error = new Error('Sessão administrativa não encontrada neste navegador.')
    error.code = 'NO_SESSION'
    throw error
  }

  const response = await fetch(`${API}/v1/apps/${APP_SLUG}/creative/images`, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.message || 'Não foi possível gerar a imagem agora.')
    error.status = response.status
    error.payload = data
    throw error
  }

  return data
}
