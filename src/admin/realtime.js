import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { getToken } from './api'

window.Pusher = Pusher

export function connectEcosystemRealtime(onUpdate, onStatus = () => {}) {
  const token = getToken()
  if (!token) return () => {}
  const echo = new Echo({ broadcaster: 'reverb', key: import.meta.env.VITE_REVERB_APP_KEY || 'du4itnqxw1q9cijovxjm', wsHost: import.meta.env.VITE_REVERB_HOST || 'api.petertecnet.com.br', wsPort: 80, wssPort: 443, forceTLS: true, enabledTransports: ['ws', 'wss'], authEndpoint: 'https://api.petertecnet.com.br/broadcasting/auth', auth: { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } } })
  let timer
  const schedule = event => { window.clearTimeout(timer); timer = window.setTimeout(() => onUpdate(event), 350) }
  echo.connector.pusher.connection.bind('connected', () => onStatus('online'))
  echo.connector.pusher.connection.bind('disconnected', () => onStatus('reconnecting'))
  echo.connector.pusher.connection.bind('error', () => onStatus('offline'))
  echo.private('ecosystem.admin').listen('.ecosystem.updated', schedule)
  return () => { window.clearTimeout(timer); echo.leave('ecosystem.admin'); echo.disconnect() }
}
