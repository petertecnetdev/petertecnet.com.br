import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const LOCAL_KEY = 'peter-admin-commercial-onboarding-session-v2'
const CONTEXT = 'commercial_onboarding'

function readLocalSession() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state ? { ...parsed, source: 'local' } : null
  } catch {
    return null
  }
}

function writeLocalSession(state) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      id: null,
      context: CONTEXT,
      current_step: Number(state?.guidedStep || 0),
      status: 'in_progress',
      last_activity_at: new Date().toISOString(),
      state,
      source: 'local',
    }))
  } catch {
    // Falha de armazenamento local não deve interromper o atendimento.
  }
}

function clearLocalSession() {
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    // no-op
  }
}

export function useCommercialOnboardingSession({ enabled, active, state, apiRequest }) {
  const [remoteSession, setRemoteSession] = useState(null)
  const [recoverable, setRecoverable] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')
  const creatingRef = useRef(false)
  const lastSavedRef = useRef('')
  const serializedState = useMemo(() => JSON.stringify(state || {}), [state])

  const refreshRecoverable = useCallback(async () => {
    if (!enabled) return null
    const local = readLocalSession()
    try {
      const result = await apiRequest(`/admin/ecosystem/onboarding-sessions?context=${encodeURIComponent(CONTEXT)}&status=in_progress`)
      const remote = result?.sessions?.[0] || null
      const candidate = remote || local
      setRecoverable(candidate)
      return candidate
    } catch {
      setRecoverable(local)
      return local
    }
  }, [apiRequest, enabled])

  useEffect(() => {
    if (enabled && !active) refreshRecoverable()
  }, [enabled, active, refreshRecoverable])

  useEffect(() => {
    if (!enabled || !active) return undefined
    const timer = window.setTimeout(async () => {
      const currentState = JSON.parse(serializedState)
      writeLocalSession(currentState)
      if (lastSavedRef.current === serializedState && remoteSession?.id) return

      setSyncStatus('syncing')
      try {
        const payload = {
          subject_user_id: currentState?.guided?.user_id || null,
          app_id: currentState?.guided?.app_id || null,
          establishment_id: currentState?.guided?.establishment_id || null,
          context: CONTEXT,
          current_step: Number(currentState?.guidedStep || 0),
          state: currentState,
        }

        if (remoteSession?.id) {
          const result = await apiRequest(`/admin/ecosystem/onboarding-sessions/${remoteSession.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
          setRemoteSession(result?.session || remoteSession)
        } else if (!creatingRef.current) {
          creatingRef.current = true
          const result = await apiRequest('/admin/ecosystem/onboarding-sessions', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
          setRemoteSession(result?.session || null)
          setRecoverable(null)
        }
        lastSavedRef.current = serializedState
        setSyncStatus('saved')
      } catch {
        setSyncStatus('local')
      } finally {
        creatingRef.current = false
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [enabled, active, serializedState, remoteSession, apiRequest])

  const startFresh = useCallback(async () => {
    const stale = remoteSession || (recoverable?.source !== 'local' ? recoverable : null)
    if (stale?.id) {
      try {
        await apiRequest(`/admin/ecosystem/onboarding-sessions/${stale.id}/abandon`, { method: 'POST' })
      } catch {
        // A sessão local ainda será limpa; uma sessão remota expira automaticamente.
      }
    }
    clearLocalSession()
    setRemoteSession(null)
    setRecoverable(null)
    lastSavedRef.current = ''
    setSyncStatus('idle')
  }, [apiRequest, recoverable, remoteSession])

  const restore = useCallback(session => {
    const candidate = session || recoverable || readLocalSession()
    if (!candidate?.state) return null
    if (candidate.id) setRemoteSession(candidate)
    setRecoverable(null)
    setSyncStatus(candidate.id ? 'saved' : 'local')
    lastSavedRef.current = JSON.stringify(candidate.state)
    writeLocalSession(candidate.state)
    return candidate.state
  }, [recoverable])

  const complete = useCallback(async () => {
    const target = remoteSession || (recoverable?.id ? recoverable : null)
    if (target?.id) {
      try {
        await apiRequest(`/admin/ecosystem/onboarding-sessions/${target.id}/complete`, { method: 'POST' })
      } catch {
        setSyncStatus('local')
        return false
      }
    }
    clearLocalSession()
    setRemoteSession(null)
    setRecoverable(null)
    lastSavedRef.current = ''
    setSyncStatus('completed')
    return true
  }, [apiRequest, recoverable, remoteSession])

  const abandon = useCallback(async () => {
    const target = remoteSession || (recoverable?.id ? recoverable : null)
    if (target?.id) {
      try {
        await apiRequest(`/admin/ecosystem/onboarding-sessions/${target.id}/abandon`, { method: 'POST' })
      } catch {
        // Limpar o fallback local continua sendo seguro.
      }
    }
    clearLocalSession()
    setRemoteSession(null)
    setRecoverable(null)
    lastSavedRef.current = ''
    setSyncStatus('idle')
  }, [apiRequest, recoverable, remoteSession])

  return {
    recoverable,
    remoteSession,
    syncStatus,
    refreshRecoverable,
    startFresh,
    restore,
    complete,
    abandon,
  }
}
