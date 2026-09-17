(() => {
  'use strict';
  if (window.PeterTecnetNavigation?.version) return;

  const VERSION = '1.0.0';
  const BREAKPOINT = 900;
  const TOKEN_KEYS = ['petertecnet_admin_token','petertecnet_token','token','access_token','auth_token'];
  const USER_KEYS = ['user','petertecnet_user','auth_user'];
  const APPS = {
    cutinapp: { accent:'#8b5cf6', accent2:'#22d3ee', items:[['feed','Feed','⌂'],['search','Buscar','⌕'],['event','Eventos','◈'],['messages','Mensagens','✉'],['profile','Perfil','●']] },
    nexus: { accent:'#65d1ff', accent2:'#7c3aed', items:[['','Início','⌂'],['establishment/my','Catálogos','▦'],['?peterSearch=1','Buscar','⌕'],['purchases','Compras','▣'],['user/update','Perfil','●']] },
    plat: { accent:'#f59e0b', accent2:'#fb7185', items:[['','Início','⌂'],['establishment/my','Meu local','▦'],['item','Itens','◇'],['order','Pedidos','▣'],['user/update','Perfil','●']] },
    rasoio: { accent:'#38bdf8', accent2:'#14b8a6', items:[['','Início','⌂'],['establishment/my','Barbearia','▦'],['appointment','Agenda','◷'],['item','Serviços','◇'],['user/update','Perfil','●']] },
    kryvion: { accent:'#22d3ee', accent2:'#a3e635', items:[['','Início','⌂'],['market','Mercado','⌁'],['radar','Radar','⌖'],['portfolio','Portfólio','▥'],['profile','Perfil','●']] },
    payflow: { accent:'#34d399', accent2:'#60a5fa', items:[['','Início','⌂'],['clients','Clientes','♙'],['opportunities','Funil','⌁'],['charges','Cobranças','▣'],['profile','Perfil','●']] },
    laora: { accent:'#c084fc', accent2:'#f472b6', items:[['','Início','⌂'],['search','Buscar','⌕'],['services','Serviços','◇'],['messages','Mensagens','✉'],['profile','Perfil','●']] },
    locaio: { accent:'#2dd4bf', accent2:'#38bdf8', items:[['','Início','⌂'],['search','Buscar','⌕'],['appointments','Agenda','◷'],['services','Serviços','◇'],['profile','Perfil','●']] }
  };

  const slug = () => (document.querySelector('meta[name="peter-app-slug"]')?.content || location.hostname.split('.')[0] || '').toLowerCase();
  const hasToken = () => TOKEN_KEYS.some(k => { try { return Boolean(localStorage.getItem(k)); } catch { return false; } });
  const getUser = () => { for (const k of USER_KEYS) { try { const v=localStorage.getItem(k); if(v) return JSON.parse(v); } catch {} } return null; };
  const normalize = p => ('/' + String(p||'').replace(/^\/+|\/+$/g,'')).replace(/\/$/,'') || '/';
  const current = () => normalize(location.pathname);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = user => { const n=(user?.name||user?.username||user?.email||'').trim(); return n ? n.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() : 'PT'; };
  const hrefFor = path => path.startsWith('?') ? '/' + path : normalize(path);
  const isActive = path => { if (path.startsWith('?')) return false; const h=hrefFor(path); return h==='/' ? current()==='/' : current()===h || current().startsWith(h+'/'); };
  const track = (action, metadata={}) => { try { window.PeterTecnetTelemetry?.track?.('navigation', { action, metadata:{...metadata,navigation_version:VERSION,app_slug:slug()} }); window.PeterTecnetFrontendCore?.telemetry?.track?.('navigation',{action,metadata}); } catch {} };

  const css = `
:root{--peter-bottom-nav-h:72px;--peter-nav-z:1040}
html{scroll-padding-bottom:calc(var(--peter-bottom-nav-h) + env(safe-area-inset-bottom,0px))}
body.peter-has-bottom-nav{padding-bottom:calc(var(--peter-bottom-nav-h) + env(safe-area-inset-bottom,0px))!important}
#peter-ecosystem-bottom-nav{display:none}
@media(max-width:${BREAKPOINT}px){
 body.peter-has-bottom-nav .cut-mobile-bottom-nav,body.peter-has-bottom-nav .ecosystem-bottom-nav:not(#peter-ecosystem-bottom-nav){display:none!important}
 #peter-ecosystem-bottom-nav{position:fixed;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));left:max(10px,env(safe-area-inset-left,0px));right:max(10px,env(safe-area-inset-right,0px));bottom:max(8px,env(safe-area-inset-bottom,0px));height:64px;padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:rgba(9,14,26,.78);box-shadow:0 16px 48px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);z-index:var(--peter-nav-z);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;isolation:isolate}
 #peter-ecosystem-bottom-nav a{position:relative;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:16px;color:rgba(238,244,255,.68);text-decoration:none!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .18s ease,color .18s ease,background .18s ease}
 #peter-ecosystem-bottom-nav a:active{transform:scale(.94)}
 #peter-ecosystem-bottom-nav a:focus-visible{outline:2px solid var(--peter-nav-accent);outline-offset:1px}
 #peter-ecosystem-bottom-nav a[aria-current="page"]{color:#fff;background:linear-gradient(135deg,color-mix(in srgb,var(--peter-nav-accent) 22%,transparent),color-mix(in srgb,var(--peter-nav-accent2) 15%,transparent))}
 #peter-ecosystem-bottom-nav a[aria-current="page"]:before{content:"";position:absolute;top:2px;width:18px;height:2px;border-radius:2px;background:var(--peter-nav-accent);box-shadow:0 0 12px var(--peter-nav-accent)}
 #peter-ecosystem-bottom-nav .peter-nav-icon{font-size:20px;line-height:20px;font-weight:700}
 #peter-ecosystem-bottom-nav .peter-nav-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:12px;font-weight:700;letter-spacing:.01em}
 #peter-ecosystem-bottom-nav .peter-nav-avatar{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;font-size:9px;font-weight:800;color:#07111f;background:linear-gradient(135deg,var(--peter-nav-accent),var(--peter-nav-accent2));box-shadow:0 0 0 2px rgba(255,255,255,.12)}
}
@media(max-width:360px){#peter-ecosystem-bottom-nav{left:6px;right:6px;border-radius:18px}#peter-ecosystem-bottom-nav .peter-nav-label{font-size:9px}}
@media(orientation:landscape) and (max-height:500px) and (max-width:${BREAKPOINT}px){:root{--peter-bottom-nav-h:60px}#peter-ecosystem-bottom-nav{height:54px;padding:4px}#peter-ecosystem-bottom-nav a{min-height:44px}#peter-ecosystem-bottom-nav .peter-nav-label{display:none}}
@media(prefers-reduced-motion:reduce){#peter-ecosystem-bottom-nav a{transition:none!important}}
body.peter-keyboard-open #peter-ecosystem-bottom-nav{display:none!important}
`;

  const ensureStyle = () => { if(document.getElementById('peter-navigation-style')) return; const s=document.createElement('style'); s.id='peter-navigation-style'; s.textContent=css; document.head.appendChild(s); };
  const remove = () => { document.getElementById('peter-ecosystem-bottom-nav')?.remove(); document.body?.classList.remove('peter-has-bottom-nav'); };
  const mount = () => {
    ensureStyle(); remove();
    const app=APPS[slug()]; if(!app || !hasToken() || matchMedia(`(min-width:${BREAKPOINT+1}px)`).matches) return;
    const user=getUser(); const nav=document.createElement('nav'); nav.id='peter-ecosystem-bottom-nav'; nav.className='ecosystem-bottom-nav'; nav.setAttribute('aria-label','Navegação principal'); nav.style.setProperty('--peter-nav-accent',app.accent); nav.style.setProperty('--peter-nav-accent2',app.accent2);
    nav.innerHTML=app.items.map(([path,label,icon],i)=>{ const active=isActive(path); const avatar=i===4 ? `<span class="peter-nav-avatar" aria-hidden="true">${escapeHtml(initials(user))}</span>` : `<span class="peter-nav-icon" aria-hidden="true">${escapeHtml(icon)}</span>`; return `<a href="${escapeHtml(hrefFor(path))}" data-peter-nav-path="${escapeHtml(path)}" ${active?'aria-current="page"':''} aria-label="${escapeHtml(label)}">${avatar}<span class="peter-nav-label">${escapeHtml(label)}</span></a>`; }).join('');
    nav.addEventListener('click',e=>{ const a=e.target.closest('a'); if(!a)return; const p=a.dataset.peterNavPath||''; track('bottom_nav_click',{destination:p,label:a.getAttribute('aria-label')}); if(p.startsWith('?')){e.preventDefault(); history.replaceState(history.state,'',p); window.dispatchEvent(new PopStateEvent('popstate')); setTimeout(()=>{ const input=document.querySelector('input[type="search"],input[placeholder*="Buscar" i],input[placeholder*="Pesquisar" i],.globalnav__searchBox input'); input?.focus(); input?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}); },50); }});
    document.body.appendChild(nav); document.body.classList.add('peter-has-bottom-nav');
  };

  let baseline=window.visualViewport?.height || window.innerHeight;
  const viewport = () => { const h=window.visualViewport?.height || window.innerHeight; const open=baseline-h>150; document.body?.classList.toggle('peter-keyboard-open',open); if(!open) baseline=Math.max(baseline,h); };
  const refresh=()=>requestAnimationFrame(mount);
  window.addEventListener('authChanged',refresh); window.addEventListener('peter:auth-changed',refresh); window.addEventListener('popstate',refresh); window.addEventListener('resize',refresh,{passive:true}); window.visualViewport?.addEventListener('resize',viewport,{passive:true});
  const originalPush=history.pushState; const originalReplace=history.replaceState;
  history.pushState=function(...args){const r=originalPush.apply(this,args);refresh();return r}; history.replaceState=function(...args){const r=originalReplace.apply(this,args);refresh();return r};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
  window.PeterTecnetNavigation={version:VERSION,mount,refresh,remove,apps:APPS};
})();
