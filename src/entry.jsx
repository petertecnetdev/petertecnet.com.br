const path = window.location.pathname.replace(/\/+$/, '') || '/'

const BOOT_RELOAD_KEY = 'pt:boot-reload-attempted'
const RUNTIME_RELOAD_KEY = 'pt:runtime-reload-attempted'
const BOOT_TIMEOUT_MS = 12000
const BLANK_SCREEN_GRACE_MS = 700
let applicationBooted = false
let runtimeRecoveryStarted = false
let blankScreenTimer = null

function clearBootReloadGuard() {
  try {
    sessionStorage.removeItem(BOOT_RELOAD_KEY)
  } catch {
    // Storage can be unavailable in restricted/private contexts.
  }
}

function clearRuntimeReloadGuard() {
  try {
    sessionStorage.removeItem(RUNTIME_RELOAD_KEY)
  } catch {
    // Storage can be unavailable in restricted/private contexts.
  }
}

function renderBootFailure(error, title = 'Não foi possível manter esta página aberta.') {
  console.error('[Peter Tecnet] application runtime failed', error)

  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#02080c;color:#effcff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <section style="width:min(520px,100%);padding:28px;border:1px solid rgba(116,217,234,.16);border-radius:22px;background:rgba(5,20,29,.96);box-shadow:0 26px 80px rgba(0,0,0,.35)">
        <img src="/petertecnetlogo.png" alt="Peter Tecnet" style="width:68px;height:68px;object-fit:contain;margin-bottom:14px" />
        <p style="margin:0 0 8px;color:#35dff2;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Peter Tecnet</p>
        <h1 style="margin:0 0 12px;font-size:clamp(24px,6vw,36px);line-height:1.15">${title}</h1>
        <p style="margin:0 0 20px;color:#91adb5;line-height:1.6">A interface entrou em um estado inconsistente e foi interrompida antes de deixar uma tela vazia. Recarregue para buscar a versão atual da aplicação.</p>
        <button id="pt-boot-retry" type="button" style="min-height:44px;padding:0 18px;border:0;border-radius:12px;background:#dffbff;color:#041217;font:800 14px/1 Inter,system-ui,sans-serif;cursor:pointer">Recarregar Peter Tecnet</button>
      </section>
    </main>`

  document.getElementById('pt-boot-retry')?.addEventListener('click', () => {
    clearBootReloadGuard()
    clearRuntimeReloadGuard()
    window.location.reload()
  })
}

function replaceWithFreshVersion(recoveryKey, error, fallbackTitle) {
  if (runtimeRecoveryStarted) return
  runtimeRecoveryStarted = true

  let alreadyRetried = false
  try {
    alreadyRetried = sessionStorage.getItem(recoveryKey) === '1'
    if (!alreadyRetried) sessionStorage.setItem(recoveryKey, '1')
  } catch {
    alreadyRetried = true
  }

  if (!alreadyRetried) {
    const url = new URL(window.location.href)
    url.searchParams.set('_pt_refresh', Date.now().toString())
    window.location.replace(url.toString())
    return
  }

  renderBootFailure(error, fallbackTitle)
}

function recoverBoot(error) {
  replaceWithFreshVersion(
    BOOT_RELOAD_KEY,
    error,
    'Não foi possível concluir a atualização da página.',
  )
}

function recoverRuntime(error) {
  if (!applicationBooted) return
  replaceWithFreshVersion(
    RUNTIME_RELOAD_KEY,
    error,
    'A página encontrou um problema depois de abrir.',
  )
}

function rootIsBlank() {
  const root = document.getElementById('root')
  if (!root) return true
  if (root.childElementCount > 0) return false
  return root.textContent.trim().length === 0
}

function scheduleBlankScreenCheck(source = 'mutation') {
  if (!applicationBooted || runtimeRecoveryStarted) return
  window.clearTimeout(blankScreenTimer)
  blankScreenTimer = window.setTimeout(() => {
    if (rootIsBlank()) {
      recoverRuntime(new Error(`React root became empty after boot (${source})`))
    }
  }, BLANK_SCREEN_GRACE_MS)
}

function installBlankScreenWatchdog() {
  const root = document.getElementById('root')
  if (!root) {
    recoverRuntime(new Error('Application root is missing after boot'))
    return
  }

  const observer = new MutationObserver(() => scheduleBlankScreenCheck('root mutation'))
  observer.observe(root, { childList: true, subtree: false })

  window.addEventListener('pageshow', () => scheduleBlankScreenCheck('pageshow'))
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleBlankScreenCheck('visibilitychange')
  })

  // React can clear a root after an uncaught render/effect failure. Global
  // errors are only actionable here when the visual tree also disappeared.
  window.addEventListener('error', event => {
    window.setTimeout(() => {
      if (rootIsBlank()) recoverRuntime(event.error || new Error(event.message || 'Uncaught runtime error'))
    }, 0)
  })
  window.addEventListener('unhandledrejection', event => {
    window.setTimeout(() => {
      if (rootIsBlank()) recoverRuntime(event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled rejection')))
    }, 0)
  })

  scheduleBlankScreenCheck('watchdog installation')
}

const bootTimeout = window.setTimeout(() => {
  recoverBoot(new Error(`Application boot exceeded ${BOOT_TIMEOUT_MS}ms`))
}, BOOT_TIMEOUT_MS)

async function boot() {
  // Non-critical bridges must never block the primary application boot.
  void import('./MarketingConversionBridge.js').catch(error => console.warn('[Peter Tecnet] marketing conversion bridge unavailable', error))
  void import('./MarketingQuoteDraftBridge.js').catch(error => console.warn('[Peter Tecnet] marketing quote bridge unavailable', error))

  if (path !== '/suporte') {
    void import('./utils/peterWhatsappFallback.js')
      .then(({ installPeterWhatsappFallback }) => installPeterWhatsappFallback())
      .catch(error => console.warn('[Peter Tecnet] WhatsApp CTA unavailable', error))
  }

  const isMarketingHub = path === '/'
    || path === '/sobre'
    || path === '/portfolio'
    || path === '/orcamento'
    || path.startsWith('/servicos/')

  if (path === '/suporte') {
    await import('./SupportPublicApp.jsx')
  } else if (isMarketingHub) {
    await Promise.all([
      import('./MarketingHubApp.jsx'),
      import('./MarketingRuntimeConfig.js'),
    ])
  } else {
    await import('./main.jsx')
  }
}

boot()
  .then(() => {
    window.clearTimeout(bootTimeout)
    clearBootReloadGuard()
    applicationBooted = true
    installBlankScreenWatchdog()

    // A healthy page that remains mounted for a while is allowed to recover
    // automatically again in a future, unrelated session/runtime failure.
    window.setTimeout(() => {
      if (!rootIsBlank()) clearRuntimeReloadGuard()
    }, 10000)
  })
  .catch(error => {
    window.clearTimeout(bootTimeout)
    recoverBoot(error)
  })
