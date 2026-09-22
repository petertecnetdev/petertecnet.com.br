(() => {
  'use strict'

  const install = () => {
    const runtime = window.PeterTecnetImpersonation
    if (!runtime || typeof runtime.sync !== 'function' || runtime.__syncGuardInstalled) return Boolean(runtime)

    const originalSync = runtime.sync.bind(runtime)
    let inFlight = null

    runtime.sync = (...args) => {
      if (inFlight) return inFlight

      const request = Promise.resolve()
        .then(() => originalSync(...args))
        .finally(() => {
          if (inFlight === request) inFlight = null
        })

      inFlight = request
      return request
    }

    runtime.__syncGuardInstalled = true
    return true
  }

  if (install()) return

  let attempts = 0
  const timer = setInterval(() => {
    attempts += 1
    if (install() || attempts >= 20) clearInterval(timer)
  }, 50)
})()
