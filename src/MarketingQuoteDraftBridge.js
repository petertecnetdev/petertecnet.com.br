import { clearSessionDraft, readSessionDraft, writeSessionDraft } from './utils/sessionDraft.js'
import { trackDiscoveryEvent } from './discoveryApi.js'

const APP_SLUG = 'peter-tecnet'
const DRAFT_KEY = 'petertecnet:marketing:quote-draft:v1'
const FORM_SELECTOR = '.hub-quote-form'
const INSTALLED_FLAG = '__peterMarketingQuoteDraftBridgeInstalled'

function normalizeLabel(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function fieldKey(control, index) {
  const label = control.closest('label')
  const labelText = label?.querySelector(':scope > span')?.textContent || label?.textContent || ''
  return normalizeLabel(labelText) || `${control.tagName.toLocaleLowerCase()}_${index}`
}

function editableControls(form) {
  return [...form.querySelectorAll('input:not([type="file"]):not([type="hidden"]), select, textarea')]
}

function snapshot(form) {
  return editableControls(form).reduce((draft, control, index) => {
    draft[fieldKey(control, index)] = String(control.value || '')
    return draft
  }, {})
}

function hasMeaningfulValue(draft) {
  return Object.values(draft || {}).some(value => String(value || '').trim().length > 0)
}

function setControlledValue(control, value) {
  const prototype = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  if (descriptor?.set) descriptor.set.call(control, value)
  else control.value = value

  const eventName = control instanceof HTMLSelectElement ? 'change' : 'input'
  control.dispatchEvent(new Event(eventName, { bubbles: true }))
}

function restore(form, draft) {
  let restored = 0
  editableControls(form).forEach((control, index) => {
    const key = fieldKey(control, index)
    if (!Object.prototype.hasOwnProperty.call(draft, key)) return
    const value = String(draft[key] || '')
    if (!value || control.value === value) return
    setControlledValue(control, value)
    restored += 1
  })
  return restored
}

function track(event, metadata = {}) {
  trackDiscoveryEvent(event, {
    entityType: 'inquiry',
    entityId: 'quote-form',
    application: APP_SLUG,
    metadata: {
      source_path: window.location.pathname,
      ...metadata,
    },
  })
}

function installOnForm(form) {
  if (form.dataset.quoteDraftBridge === '1') return
  form.dataset.quoteDraftBridge = '1'

  const existingDraft = readSessionDraft(DRAFT_KEY)
  if (existingDraft && hasMeaningfulValue(existingDraft)) {
    const restoredFields = restore(form, existingDraft)
    if (restoredFields > 0) {
      track('quote_draft_recovered', {
        restored_fields: restoredFields,
        has_contact: Boolean(existingDraft.email || existingDraft.whatsapp_telefone),
        has_details: Boolean(existingDraft.detalhes),
      })
    }
  }

  let started = false
  let saveTimer = null
  const persist = () => {
    const draft = snapshot(form)
    if (hasMeaningfulValue(draft)) writeSessionDraft(DRAFT_KEY, draft)
    else clearSessionDraft(DRAFT_KEY)
  }

  const onChange = event => {
    const control = event.target
    if (!control?.matches?.('input:not([type="file"]), select, textarea')) return
    if (!started) {
      started = true
      track('quote_form_started', {
        service: snapshot(form).o_que_voce_precisa || '',
      })
    }
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(persist, 120)
  }

  form.addEventListener('input', onChange)
  form.addEventListener('change', onChange)
  form.addEventListener('submit', () => {
    persist()
    let checks = 0
    const successWatcher = window.setInterval(() => {
      checks += 1
      if (form.querySelector('.hub-form-feedback.is-success')) {
        clearSessionDraft(DRAFT_KEY)
        window.clearInterval(successWatcher)
        track('quote_draft_cleared_after_conversion')
      } else if (checks >= 40) {
        window.clearInterval(successWatcher)
      }
    }, 250)
  })
}

function install() {
  const attach = () => document.querySelectorAll(FORM_SELECTOR).forEach(installOnForm)
  attach()
  const observer = new MutationObserver(attach)
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

if (!window[INSTALLED_FLAG]) {
  window[INSTALLED_FLAG] = true
  install()
}
