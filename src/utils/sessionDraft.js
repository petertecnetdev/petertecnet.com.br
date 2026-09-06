export function readSessionDraft(key) {
  if (!key) return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeSessionDraft(key, value) {
  if (!key) return false
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function clearSessionDraft(key) {
  if (!key) return false
  try {
    window.sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
