(() => {
  if (window.__PETERTECNET_INSTALL_APP__) return;
  window.__PETERTECNET_INSTALL_APP__ = true;

  const script = document.currentScript;
  const appName = script?.dataset?.appName || document.title || 'Aplicativo';
  const swPath = script?.dataset?.sw || '';
  const manifestPath = script?.dataset?.manifest || '';

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
  if (isStandalone()) return;

  let deferredPrompt = null;

  const style = document.createElement('style');
  style.textContent = `
    .pt-install-app{position:fixed;right:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483000;display:flex;align-items:center;gap:9px;border:1px solid rgba(118,229,255,.28);border-radius:999px;padding:11px 15px;background:rgba(4,18,27,.94);color:#effdff;font:700 13px/1.1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 10px 34px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.06);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);cursor:pointer;touch-action:manipulation;transition:transform .18s ease,opacity .18s ease,border-color .18s ease}.pt-install-app:hover{transform:translateY(-2px);border-color:rgba(118,229,255,.56)}.pt-install-app:active{transform:translateY(0) scale(.98)}.pt-install-app svg{width:18px;height:18px;flex:0 0 18px}.pt-install-help{position:fixed;inset:0;z-index:2147483640;display:grid;place-items:end center;padding:20px;background:rgba(0,6,11,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}.pt-install-card{width:min(440px,100%);border:1px solid rgba(118,229,255,.2);border-radius:22px;padding:20px;background:#07151d;color:#effdff;box-shadow:0 24px 80px rgba(0,0,0,.5);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pt-install-card h2{margin:0 0 8px;font-size:20px}.pt-install-card p{margin:0 0 16px;color:#a9c4cc;line-height:1.5}.pt-install-card button{width:100%;border:0;border-radius:14px;padding:12px 14px;background:#dffbff;color:#06151b;font-weight:800;cursor:pointer}@media(min-width:768px){.pt-install-help{place-items:center}.pt-install-app{right:22px;bottom:22px}}@media(prefers-reduced-motion:reduce){.pt-install-app{transition:none}}`;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pt-install-app';
  button.setAttribute('aria-label', `Instalar ${appName}`);
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg><span>Instalar app</span>';

  const showHelp = () => {
    if (document.querySelector('.pt-install-help')) return;
    const overlay = document.createElement('div');
    overlay.className = 'pt-install-help';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instructions = isiOS
      ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
      : 'No Chrome, abra o menu do navegador e toque em “Instalar app” ou “Instalar e criar atalho”.';
    overlay.innerHTML = `<div class="pt-install-card"><h2>Instalar ${appName}</h2><p>${instructions}</p><button type="button">Entendi</button></div>`;
    const close = () => overlay.remove();
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.querySelector('button').addEventListener('click', close);
    document.body.appendChild(overlay);
    overlay.querySelector('button').focus({ preventScroll: true });
  };

  button.addEventListener('click', async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      try { await prompt.userChoice; } catch (_) {}
      return;
    }
    showHelp();
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    button.dataset.ready = 'true';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    button.remove();
  });

  const mount = () => {
    if (!isStandalone() && !button.isConnected) document.body.appendChild(button);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
