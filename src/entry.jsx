const path = window.location.pathname.replace(/\/+$/, '') || '/'

const BOOT_RELOAD_KEY = 'pt:boot-reload-attempted'
const BOOT_TIMEOUT_MS = 12000

function clearBootReloadGuard() {
  try {
    sessionStorage.removeItem(BOOT_RELOAD_KEY)
  } catch {
    // Storage can be unavailable in restricted/private contexts.
  }
}

function renderBootFailure(error) {
  console.error('[Peter Tecnet] application boot failed', error)

  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#02080c;color:#effcff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <section style="width:min(520px,100%);padding:28px;border:1px solid rgba(116,217,234,.16);border-radius:22px;background:rgba(5,20,29,.96);box-shadow:0 26px 80px rgba(0,0,0,.35)">
        <img src="/petertecnetlogo.png" alt="Peter Tecnet" style="width:68px;height:68px;object-fit:contain;margin-bottom:14px" />
        <p style="margin:0 0 8px;color:#35dff2;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Peter Tecnet</p>
        <h1 style="margin:0 0 12px;font-size:clamp(24px,6vw,36px);line-height:1.15">Não foi possível concluir a atualização da página.</h1>
        <p style="margin:0 0 20px;color:#91adb5;line-height:1.6">A versão anterior não ficará presa na tela de carregamento. Recarregue para buscar os arquivos mais recentes.</p>
        <button id="pt-boot-retry" type="button" style="min-height:44px;padding:0 18px;border:0;border-radius:12px;background:#dffbff;color:#041217;font:800 14px/1 Inter,system-ui,sans-serif;cursor:pointer">Recarregar versão atualizada</button>
      </section>
    </main>`

  document.getElementById('pt-boot-retry')?.addEventListener('click', () => {
    clearBootReloadGuard()
    window.location.reload()
  })
}

function recoverBoot(error) {
  let alreadyRetried = false

  try {
    alreadyRetried = sessionStorage.getItem(BOOT_RELOAD_KEY) === '1'
    if (!alreadyRetried) sessionStorage.setItem(BOOT_RELOAD_KEY, '1')
  } catch {
    alreadyRetried = true
  }

  if (!alreadyRetried) {
    const url = new URL(window.location.href)
    url.searchParams.set('_pt_refresh', Date.now().toString())
    window.location.replace(url.toString())
    return
  }

  renderBootFailure(error)
}

const bootTimeout = window.setTimeout(() => {
  recoverBoot(new Error(`Application boot exceeded ${BOOT_TIMEOUT_MS}ms`))
}, BOOT_TIMEOUT_MS)

async function boot() {
  // Non-critical bridges must never block the primary application boot.
  void import('./MarketingConversionBridge.js').catch(error => console.warn('[Peter Tecnet] marketing conversion bridge unavailable', error))
  void import('./MarketingQuoteDraftBridge.js').catch(error => console.warn('[Peter Tecnet] marketing quote bridge unavailable', error))
  void import('./SupportLinkBridge.js').catch(error => console.warn('[Peter Tecnet] support bridge unavailable', error))

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
  })
  .catch(error => {
    window.clearTimeout(bootTimeout)
    recoverBoot(error)
  })
