import { controlApi, getToken } from './api.js'

const decodeData = payload => {
  if (payload == null) return null
  if (typeof payload === 'object') return payload
  try { return JSON.parse(payload) } catch { return payload }
}

export async function connectAdminRealtime({ onEcosystem, onNotification, onState }) {
  let closed = false
  let socket = null
  let reconnectTimer = null
  let attempts = 0

  const stop = () => {
    closed = true
    window.clearTimeout(reconnectTimer)
    if (socket && socket.readyState < 2) socket.close(1000, 'admin-control-plane-stop')
  }

  async function subscribe(channel, socketId, config) {
    const channelName = `private-${channel.name}`
    const token = getToken()
    const body = new URLSearchParams({ socket_id: socketId, channel_name: channelName })
    const response = await fetch(config.auth_endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    })
    if (!response.ok) throw new Error('Falha ao autorizar canal privado do Reverb.')
    const auth = await response.json()
    socket?.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: auth.auth, channel: channelName } }))
  }

  async function open() {
    if (closed) return
    try {
      onState?.('connecting')
      const config = await controlApi('/admin/ecosystem/control-plane/realtime')
      if (!config?.key || !config?.host) throw new Error('Configuração pública do Reverb incompleta.')
      const secure = config.scheme === 'https' || config.scheme === 'wss'
      const scheme = secure ? 'wss' : 'ws'
      const port = Number(config.port || (secure ? 443 : 80))
      const portPart = (secure && port === 443) || (!secure && port === 80) ? '' : `:${port}`
      const url = `${scheme}://${config.host}${portPart}/app/${encodeURIComponent(config.key)}?protocol=7&client=js&version=8.6.0&flash=false`
      socket = new WebSocket(url)

      socket.onopen = () => onState?.('authenticating')
      socket.onmessage = async event => {
        const packet = decodeData(event.data)
        if (!packet?.event) return
        if (packet.event === 'pusher:connection_established') {
          attempts = 0
          const connection = decodeData(packet.data)
          const socketId = connection?.socket_id
          if (!socketId) return
          try {
            await Promise.all((config.channels || []).map(channel => subscribe(channel, socketId, config)))
            onState?.('connected')
          } catch (error) {
            onState?.('degraded', error.message)
          }
          return
        }
        if (packet.event === 'ecosystem.updated') onEcosystem?.(decodeData(packet.data))
        if (packet.event === 'app.notification.created') onNotification?.(decodeData(packet.data))
      }
      socket.onerror = () => onState?.('degraded')
      socket.onclose = () => {
        if (closed) return
        onState?.('reconnecting')
        attempts += 1
        const delay = Math.min(30000, 1000 * (2 ** Math.min(attempts, 5)))
        reconnectTimer = window.setTimeout(open, delay)
      }
    } catch (error) {
      if (closed) return
      onState?.('degraded', error.message)
      attempts += 1
      reconnectTimer = window.setTimeout(open, Math.min(30000, 1500 * attempts))
    }
  }

  open()
  return stop
}
