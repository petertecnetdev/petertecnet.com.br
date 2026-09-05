import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ActivityCenter from './ActivityCenter.jsx'
import ApiLogInsightsPanel from './ApiLogInsightsPanel.jsx'
import './AdminActivityIntegration.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

function adminRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 20000)

  return fetch(`${API}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async response => {
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}))

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
    }

    if (!response.ok) {
      const error = new Error(
        payload?.error ||
        payload?.message ||
        Object.values(payload?.errors || {}).flat()?.[0] ||
        'Não foi possível concluir a operação.',
      )
      error.status = response.status
      error.retryAfter = Number(response.headers.get('Retry-After') || payload?.retry_after || 0)
      throw error
    }

    return payload
  }).catch(error => {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder.')
    throw error
  }).finally(() => window.clearTimeout(timeout))
}

function findActivitySection() {
  return document.getElementById('activity')
}

export default function AdminActivityIntegration() {
  const [mountNode, setMountNode] = useState(null)

  useEffect(() => {
    let currentSection = null
    let currentMount = null

    const attach = () => {
      const section = findActivitySection()
      if (!section || section === currentSection) return

      if (currentSection) currentSection.classList.remove('activity-center-enhanced')
      if (currentMount?.isConnected) currentMount.remove()

      const node = document.createElement('div')
      node.id = 'activity-center-portal-root'
      node.className = 'activity-center-portal-root'
      section.appendChild(node)
      section.classList.add('activity-center-enhanced')

      currentSection = section
      currentMount = node
      setMountNode(node)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (currentSection) currentSection.classList.remove('activity-center-enhanced')
      if (currentMount?.isConnected) currentMount.remove()
      setMountNode(null)
    }
  }, [])

  if (!mountNode) return null

  return createPortal(
    <>
      <ActivityCenter request={adminRequest} tokenKey={TOKEN_KEY} />
      <ApiLogInsightsPanel request={adminRequest} />
    </>,
    mountNode,
  )
}
