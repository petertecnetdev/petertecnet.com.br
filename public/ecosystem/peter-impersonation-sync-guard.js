(() => {
  'use strict'

  const install = () => {
    const runtime = window.PeterTecnetImpersonation
    if (!runtime || typeof runtime.sync !== 'function' || runtime.__syncGuardInstalled) return Boolean(runtime)

    const originalSync = runtime.sync.bind(runtime)
    let inFlight = null
    let generation = 0

    runtime.sync = async (...args) => {
      const requestGeneration = ++generation
      if (inFlight) return inFlight

      inFlight = Promise.resolve()
        .then(() => originalSync(...args))
        .finally(() => {
          if (requestGeneration === generation) inFlight = null
        })

      return inFlight
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
