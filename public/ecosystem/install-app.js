(() => {
  if (window.__PETERTECNET_INSTALL_APP__) return;
  window.__PETERTECNET_INSTALL_APP__ = true;

  const script = document.currentScript;
  const appName = script?.dataset?.appName || document.title || 'Aplicativo';
  const swPath = script?.dataset?.sw || '';
  const manifestPath = script?.dataset?.manifest || '';
  const searchParams = new URLSearchParams(window.location.search);
  const installIntent = searchParams.get('install') === '1';

  if (manifestPath && !document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestPath;
    document.head.appendChild(link);
  }

  if (swPath && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swPath, { scope: '/' }).catch(() => {});
    }, { once: true });
  }

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isMobileDevice = () => {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
    return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.matchMedia('(max-width: 820px)').matches);
  };

  if (isStandalone() || !isMobileDevice()) return;

  let deferredPrompt = null;
  let installed = false;

  const clearInstallIntent = () => {
    if (!installIntent || !window.history?.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('install');
    url.searchParams.delete('source');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const style = document.createElement('style');
  style.textContent = `.pt-install-app{position:fixed!important;left:50%!important;bottom:max(14px,env(safe-area-inset-bottom))!important;z-index:2147483000!important;width:min(calc(100% - 24px),560px);transform:translateX(-50%);display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;border:1px solid rgba(118,229,255,.3);border-radius:20px;padding:12px;background:linear-gradient(135deg,rgba(4,18,27,.98),rgba(8,31,43,.98));color:#effdff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.48);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);cursor:pointer;touch-action:manipulation}.pt-install-app[data-intent="true"]{border-color:rgba(118,229,255,.68);box-shadow:0 18px 70px rgba(0,0,0,.52),0 0 0 4px rgba(77,220,255,.08);animation:ptInstallIntent 1.7s ease-in-out 2}.pt-install-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:rgba(118,229,255,.12);border:1px solid rgba(118,229,255,.18)}.pt-install-icon svg{width:22px;height:22px}.pt-install-copy{min-width:0;text-align:left}.pt-install-copy strong{display:block;font-size:14px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pt-install-copy span{display:block;margin-top:4px;color:#a9c4cc;font-size:11.5px;line-height:1.25}.pt-install-cta{border:0;border-radius:13px;padding:11px 14px;background:#e6fbff;color:#06151b;font-size:12px;font-weight:900;white-space:nowrap}.pt-install-help{position:fixed;inset:0;z-index:2147483640;display:grid;place-items:end center;padding:20px;background:rgba(0,6,11,.66);backdrop-filter:blur(7px)}.pt-install-card{width:min(440px,100%);border:1px solid rgba(118,229,255,.2);border-radius:22px;padding:20px;background:#07151d;color:#effdff;font-family:Inter,system-ui,sans-serif}.pt-install-card h2{margin:0 0 8px;font-size:20px}.pt-install-card p{margin:0 0 16px;color:#a9c4cc;line-height:1.5}.pt-install-card button{width:100%;border:0;border-radius:14px;padding:12px 14px;background:#dffbff;color:#06151b;font-weight:800}@keyframes ptInstallIntent{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.018)}}@media(max-width:430px){.pt-install-app{grid-template-columns:auto 1fr;gap:10px}.pt-install-cta{grid-column:1/-1;width:100%}}@media(min-width:821px){.pt-install-app,.pt-install-help{display:none!important}}`;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pt-install-app';
  button.dataset.intent = installIntent ? 'true' : 'false';
  button.setAttribute('aria-label', `Instalar ${appName}`);
  button.innerHTML = `<span class="pt-install-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg></span><span class="pt-install-copy"><strong>${installIntent ? `Concluir instalação de ${appName}` : `Instale ${appName}`}</strong><span>${installIntent ? 'Você veio da loja Peter Tecnet. Confirme a instalação abaixo.' : 'Acesso rápido, tela cheia e ícone no seu celular.'}</span></span><span class="pt-install-cta">${installIntent ? 'Instalar agora' : 'Instalar aplicativo'}</span>`;

  const showHelp = () => {
    if (document.querySelector('.pt-install-help')) return;
    const overlay = document.createElement('div');
    overlay.className = 'pt-install-help';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instructions = isiOS ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.' : 'No Chrome, abra o menu do navegador e toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.';
    overlay.innerHTML = `<div class="pt-install-card"><h2>Instalar ${appName}</h2><p>${instructions}</p><button type="button">Entendi</button></div>`;
    const close = () => { overlay.remove(); clearInstallIntent(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('button').addEventListener('click', close);
    document.body.appendChild(overlay);
  };

  button.addEventListener('click', async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      try { await prompt.userChoice; } catch (_) {}
      clearInstallIntent();
      ensureMounted();
      return;
    }
    showHelp();
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    button.dataset.ready = 'true';
    ensureMounted();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    clearInstallIntent();
    button.remove();
  });

  window.PeterTecnetInstall = {
    isReady: () => Boolean(deferredPrompt),
    open: () => button.click(),
  };

  function ensureMounted() {
    if (installed || isStandalone() || !isMobileDevice()) {
      button.remove();
      return;
    }
    if (document.body && !button.isConnected) document.body.appendChild(button);
  }

  const observer = new MutationObserver(() => ensureMounted());
  const startPersistence = () => {
    ensureMounted();
    if (document.body) observer.observe(document.body, { childList: true });
  };

  window.addEventListener('pageshow', ensureMounted);
  window.addEventListener('popstate', ensureMounted);
  window.addEventListener('hashchange', ensureMounted);
  window.addEventListener('orientationchange', ensureMounted);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureMounted(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPersistence, { once: true });
  else startPersistence();
})();
