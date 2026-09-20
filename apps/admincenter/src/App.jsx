import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminModuleBoundary from './AdminModuleBoundary.jsx'
import { connectMissionControlRealtime } from './missionControlRealtime.js'
import { loadGoogleIdentity } from './services/googleIdentity.js'
import { adminRequest as request } from './adminApi.js'
import { useDialogFocus } from './useDialogFocus.js'

const NotificationsCenter = lazy(() => import('./NotificationsCenter.jsx'))
const AdminUsersCenter = lazy(() => import('./AdminUsersCenter.jsx'))
const AdminPayoutCenter = lazy(() => import('./AdminPayoutCenter.jsx'))
const AgentChatPanel = lazy(() => import('./AgentChatPanel.jsx'))
const AdminEstablishmentsPage = lazy(() => import('./AdminEstablishmentsPageV2.jsx'))
const AdminItemsManager = lazy(() => import('./AdminItemsManager.jsx'))
const AdminApplicationsCenter = lazy(() => import('./AdminApplicationsCenter.jsx'))
const ImportantEventsCenter = lazy(() => import('./ImportantEventsCenter.jsx'))

const TOKEN_KEY = 'petertecnet_admin_token'
const OWNER_EMAIL = 'petertecnet@gmail.com'

const navItems = [
  ['users', 'Usuários', 'users'],
  ['establishments', 'Estabelecimentos', 'building'],
  ['operations', 'Operações', 'pulse'],
  ['agents', 'Agentes', 'agents'],
  ['financial', 'Financeiro', 'finance'],
  ['applications', 'Aplicações', 'apps'],
  ['items', 'Itens', 'items'],
  ['notifications', 'Notificações', 'bell'],
  ['activity', 'Atividade', 'activity'],
]

const PAGE_CONFIG = {
  dashboard: { slug: 'visao-geral', label: 'Visão geral' },
  operations: { slug: 'operacoes', label: 'Operações' },
  agents: { slug: 'agentes', label: 'Agentes' },
  financial: { slug: 'financeiro', label: 'Financeiro' },
  applications: { slug: 'aplicacoes', label: 'Aplicações' },
  users: { slug: 'usuarios', label: 'Usuários' },
  establishments: { slug: 'estabelecimentos', label: 'Estabelecimentos' },
  items: { slug: 'itens', label: 'Itens' },
  notifications: { slug: 'notificacoes', label: 'Notificações' },
  activity: { slug: 'atividade', label: 'Atividade' },
}

const PAGE_FROM_SLUG = Object.fromEntries(Object.entries(PAGE_CONFIG).flatMap(([key, config]) => [[key, key], [config.slug, key]]))
const BACKGROUND_REFRESH_PAGES = new Set(['dashboard', 'operations', 'financial', 'applications', 'activity'])
const BACKGROUND_REFRESH_MS = 120000
const SIDEBAR_PREF_KEY = 'petertecnet_admin_sidebar_open'
const DENSITY_PREF_KEY = 'petertecnet_admin_density'
const RECENT_PAGES_KEY = 'petertecnet_admin_recent_pages'
const FAVORITE_PAGES_KEY = 'petertecnet_admin_favorite_pages'
const DASHBOARD_WIDGETS_KEY = 'petertecnet_admin_dashboard_widgets'
const DEFAULT_DASHBOARD_WIDGETS = ['gross', 'platform', 'active-today', 'interactions-30d', 'applications', 'payments-attention']

function desktopNavigation() {
  return window.matchMedia('(min-width: 981px)').matches
}

function pageFromLocation() {
  const url = new URL(window.location.href)
  const queryToken = String(url.searchParams.get('page') || '').trim().toLowerCase()
  const pathToken = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '').trim().toLowerCase()
  const hashToken = decodeURIComponent(url.hash.replace(/^#/, '')).trim().toLowerCase()
  const requestedPage = PAGE_FROM_SLUG[queryToken] || PAGE_FROM_SLUG[pathToken] || PAGE_FROM_SLUG[hashToken]
  return !requestedPage || requestedPage === 'dashboard' ? 'users' : requestedPage
}

function writePageHistory(page, mode = 'pushState') {
  const url = new URL(window.location.href)
  const config = PAGE_CONFIG[page] || PAGE_CONFIG.users
  if (page === 'users') url.searchParams.delete('page')
  else url.searchParams.set('page', config.slug)
  url.hash = ''
  window.history[mode]({ ...(window.history.state || {}), adminPage: page }, '', `${url.pathname}${url.search}`)
}

function AdminIcon({ name }) {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    agents: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.5-4 2.7-6 5.5-6s5 2 5.5 6M14 15c3.2-.8 5.7 1.2 6.5 4"/>',
    finance: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.7-4 2.8-6 6-6s5.3 2 6 6M16 5.5a3 3 0 0 1 0 5.8M17 14c2.5.3 4 2.1 4 5"/>',
    building: '<path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M18 13h1"/>',
    items: '<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    activity: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: paths[name] || paths.home }} />
}

const groupLabels = {
  users: 'Usuários', applications: 'Aplicações', establishments: 'Estabelecimentos',
  items: 'Itens', events: 'Eventos', orders: 'Pedidos', payments: 'Pagamentos',
}

function tokenFrom(payload) {
  return payload?.token?.access_token || payload?.access_token || payload?.token || ''
}

function userFrom(payload) {
  return payload?.token?.user || payload?.user || null
}

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || 'Usuário'
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compactNumber(value) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(number(value))
}

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(number(value))