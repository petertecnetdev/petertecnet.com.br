const API_ORIGIN = 'https://api.petertecnet.com.br'
const API = `${API_ORIGIN}/api`

function parseData(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

function websocketUrl(config) {
  const secure = String(config.scheme || 'https').toLowerCase() === 'https'
  const scheme = secure ? 'wss' : 'ws'
  const port = Number(config.port || (secure ? 443 : 80))
  const defaultPort = secure ? 443 : 80
  const portPart = port === defaultPort ? '' : `:${port}`
  return `${scheme}://${config.host}${portPart}/app/${encodeURIComponent(config.key)}?protocol=7&client=js&version=8.4.0&flash=false`
}

async function authorize(config, token, socketId) {
  const endpoint = config.auth_endpoint || `${API_ORIGIN}/broadcasting/auth`
  const body = new URLSearchParams({ socket_id: socketId, channel_name: config.channel })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body.toString(),
  })
  if (!response.ok) throw new Error(`Realtime auth HTTP ${response.status}`)
  return response.json()
}

export function connectMissionControlRealtime({ token, onUpdate, onState }) {
  let disposed = false
  let socket = null
  let retryTimer = null
  let reconnectMs = 1000

  const state = value => onState?.(value)

  function scheduleReconnect() {
    if (disposed || retryTimer) return
    state('fallback')
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      void connect()
    }, reconnectMs)
    reconnectMs = Math.min(reconnectMs * 2, 30000)
  }

  async function connect() {
    if (disposed) return
    state('connecting')
    try {
      const response = await fetch(`${API}/admin/ecosystem/command/realtime-config`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (!response.ok) throw new Error(`Realtime config HTTP ${response.status}`)
      const config = await response.json()
      if (!config?.enabled || !config?.key || !config?.host) {
        state('fallback')
        return
      }

      socket = new WebSocket(websocketUrl(config))

      socket.onopen = () => state('connecting')
      socket.onerror = () => state('fallback')
      socket.onclose = () => scheduleReconnect()
      socket.onmessage = async message => {
        if (disposed) return
        let envelope
        try { envelope = JSON.parse(message.data) } catch { return }

        if (envelope.event === 'pusher:connection_established') {
          try {
            const connection = parseData(envelope.data)
            const auth = await authorize(config, token, connection.socket_id)
            socket?.send(JSON.stringify({
              event: 'pusher:subscribe',
              data: { auth: auth.auth, channel: config.channel, channel_data: auth.channel_data },
            }))
          } catch {
            socket?.close()
          }
          return
        }

        if (envelope.event === 'pusher_internal:subscription_succeeded') {
          reconnectMs = 1000
          state('connected')
          return
        }

        if (envelope.event === config.event || envelope.event === `.${config.event}`) {
          onUpdate?.(parseData(envelope.data))
        }
      }
    } catch {
      scheduleReconnect()
    }
  }

  void connect()

  return () => {
    disposed = true
    if (retryTimer) window.clearTimeout(retryTimer)
    retryTimer = null
    if (socket) {
      socket.onclose = null
      socket.close()
    }
    socket = null
  }
}
