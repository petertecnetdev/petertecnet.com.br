import { useEffect } from 'react'
import { normalizeAdminPath } from './AdminNavigationConfig.js'
import { ADMIN_BEFORE_NAVIGATE_EVENT, ADMIN_NAVIGATION_CHANGED_EVENT } from './AdminUiEvents.js'

const STORAGE_KEY = 'petertecnet:admin-workspace-state:v1'
const FILTER_SELECTOR = [
  '.filter-grid input',
  '.filter-grid select',
  '.filter-grid textarea',
  '.la-filters input',
  '.la-filters select',
  '[data-admin-persist-state] input',
  '[data-admin-persist-state] select',
  '[data-admin-persist-state] textarea',
].join(',')

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    const entries = Object.entries(store).slice(-30)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // State persistence must never block the Admin Center.
  }
}

function fieldKey(element, index) {
  const semantic = element.dataset.adminPersistKey
    || element.getAttribute('name')
    || element.id
    || element.getAttribute('aria-label')
    || element.getAttribute('placeholder')
    || `${element.tagName.toLowerCase()}:${element.getAttribute('type') || 'value'}:${index}`
  return String(semantic)
}

function isSafeField(element) {
  const type = String(element.getAttribute('type') || '').toLowerCase()
  if (['password', 'file', 'hidden', 'submit', 'button'].includes(type)) return false
  if (String(element.getAttribute('autocomplete') || '').toLowerCase().includes('password')) return false
  return true
}

function captureFields() {
  return [...document.querySelectorAll(FILTER_SELECTOR)]
    .filter(isSafeField)
    .map((element, index) => ({
      key: fieldKey(element, index),
      kind: element.type === 'checkbox' || element.type === 'radio' ? 'checked' : 'value',
      value: element.type === 'checkbox' || element.type === 'radio' ? Boolean(element.checked) : element.value,
    }))
}

function nativeSetValue(element, value) {
  const prototype = Object.getPrototypeOf(element)
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  if (descriptor?.set) descriptor.set.call(element, value)
  else element.value = value
}

function restoreFields(fields = []) {
  if (!fields.length) return
  const controls = [...document.querySelectorAll(FILTER_SELECTOR)].filter(isSafeField)
  const saved = new Map(fields.map(field => [field.key, field]))

  controls.forEach((element, index) => {
    const field = saved.get(fieldKey(element, index))
    if (!field) return

    if (field.kind === 'checked') {
      if (element.checked === Boolean(field.value)) return
      element.checked = Boolean(field.value)
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }

    if (String(element.value) === String(field.value ?? '')) return
    nativeSetValue(element, field.value ?? '')
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    if (element.tagName !== 'SELECT') element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function savePath(pathname = window.location.pathname) {
  const path = normalizeAdminPath(pathname)
  const store = readStore()
  store[path] = {
    scrollY: Math.max(0, window.scrollY || 0),
    mainScrollTop: Math.max(0, document.querySelector('.admin-persistent-main')?.scrollTop || 0),
    fields: captureFields(),
    savedAt: Date.now(),
  }
  writeStore(store)
}

function restorePath(pathname = window.location.pathname) {
  const path = normalizeAdminPath(pathname)
  const state = readStore()[path]
  if (!state) return

  restoreFields(state.fields)
  const main = document.querySelector('.admin-persistent-main')
  if (main && Number.isFinite(state.mainScrollTop)) main.scrollTop = state.mainScrollTop
  if (Number.isFinite(state.scrollY)) window.scrollTo({ top: state.scrollY, left: 0, behavior: 'auto' })
}

export default function AdminWorkspaceStateBridge() {
  useEffect(() => {
    let saveTimer = 0
    let restoreFrame = 0

    const queueSave = () => {
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => savePath(), 120)
    }
    const queueRestore = () => {
      window.cancelAnimationFrame(restoreFrame)
      restoreFrame = window.requestAnimationFrame(() => {
        restoreFrame = window.requestAnimationFrame(() => restorePath())
      })
    }
    const onBeforeNavigate = event => savePath(event.detail?.from || window.location.pathname)
    const onNavigationChanged = () => queueRestore()
    const onPageHide = () => savePath()
    const onInteraction = event => {
      if (event.target?.matches?.(FILTER_SELECTOR)) queueSave()
    }

    queueRestore()
    document.addEventListener('input', onInteraction, true)
    document.addEventListener('change', onInteraction, true)
    window.addEventListener('scroll', queueSave, { passive: true })
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener(ADMIN_BEFORE_NAVIGATE_EVENT, onBeforeNavigate)
    window.addEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, onNavigationChanged)

    return () => {
      window.clearTimeout(saveTimer)
      window.cancelAnimationFrame(restoreFrame)
      document.removeEventListener('input', onInteraction, true)
      document.removeEventListener('change', onInteraction, true)
      window.removeEventListener('scroll', queueSave)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener(ADMIN_BEFORE_NAVIGATE_EVENT, onBeforeNavigate)
      window.removeEventListener(ADMIN_NAVIGATION_CHANGED_EVENT, onNavigationChanged)
    }
  }, [])

  return null
}
