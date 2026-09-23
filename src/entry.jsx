const path = window.location.pathname.replace(/\/+$/, '') || '/'

const BOOT_TIMEOUT_MS = 20000
const BLANK_SCREEN_GRACE_MS = 700
let applicationBooted = false
let runtimeFailureRendered = false
let blankScreenTimer = null

function renderBootFailure(error, title = 'Não foi possível manter esta página aberta.') {
  if (runtimeFailureRendered) return
  runtimeFailureRendered = true
  console.error('[Peter Tecnet] application runtime failed', error)

  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#02080c;color:#effcff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <section style="width:min(520px,100%);padding:28px;border:1px solid rgba(116,217,234,.16);border-radius:22px;background:rgba(5,20,29,.96);box-shadow:0 26px 80px rgba(0,0,0,.35)">
        <img src="/petertecnet-brand.svg" alt="Peter Tecnet" style="width:68px;height:68px;object-fit:contain;margin-bottom:14px" />
        <p style="margin:0 0 8px;color:#35dff2;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Peter Tecnet</p>
        <h1 style="margin:0 0 12px;font-size:clamp(24px,6vw,36px);line-height:1.15">${title}</h1>
        <p style="margin:0 0 20px;color:#91adb5;line-height:1.6">A página não vai mais tentar recarregar sozinha em sequência. Tente uma atualização manual para buscar a versão mais recente.</p>
        <button id="pt-boot-retry" type="button" style="min-height:44px;padding:0 18px;border:0;border-radius:12px;background:#dffbff;color:#041217;font:800 14px/1 Inter,system-ui,sans-serif;cursor:pointer">Recarregar Peter Tecnet</button>
      </section>
    </main>`

  document.getElementById('pt-boot-retry')?.addEventListener('click', () => window.location.reload())
}

function rootIsBlank() {
  const root = document.getElementById('root')
  if (!root) return true
  if (root.childElementCount > 0) return false
  return root.textContent.trim().length === 0
}

function scheduleBlankScreenCheck(source = 'mutation') {
  if (!applicationBooted || runtimeFailureRendered) return
  window.clearTimeout(blankScreenTimer)
  blankScreenTimer = window.setTimeout(() => {
    if (rootIsBlank()) {
      renderBootFailure(
        new Error(`React root became empty after boot (${source})`),
        'A página encontrou um problema depois de abrir.',
      )
    }
  }, BLANK_SCREEN_GRACE_MS)
}

function installBlankScreenWatchdog() {
  const root = document.getElementById('root')
  if (!root) {
    renderBootFailure(new Error('Application root is missing after boot'))
    return
  }

  const observer = new MutationObserver(() => scheduleBlankScreenCheck('root mutation'))
  observer.observe(root, { childList: true, subtree: false })

  window.addEventListener('pageshow', () => scheduleBlankScreenCheck('pageshow'))
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleBlankScreenCheck('visibilitychange')
  })

  window.addEventListener('error', event => {
    window.setTimeout(() => {
      if (rootIsBlank()) {
        renderBootFailure(
          event.error || new Error(event.message || 'Uncaught runtime error'),
          'A página encontrou um problema depois de abrir.',
        )
      }
    }, 0)
  })

  window.addEventListener('unhandledrejection', event => {
    window.setTimeout(() => {
      if (rootIsBlank()) {
        renderBootFailure(
          event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled rejection')),
          'A página encontrou um problema depois de abrir.',
        )
      }
    }, 0)
  })

  scheduleBlankScreenCheck('watchdog installation')
}

const bootTimeout = window.setTimeout(() => {
  renderBootFailure(
    new Error(`Application boot exceeded ${BOOT_TIMEOUT_MS}ms`),
    'Não foi possível concluir a abertura da página.',
  )
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
    applicationBooted = true
    installBlankScreenWatchdog()
  })
  .catch(error => {
    window.clearTimeout(bootTimeout)
    renderBootFailure(error, 'Não foi possível concluir a abertura da página.')
  })
