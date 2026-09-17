(() => {
'use strict';
const VERSION='1.1.0',BP=900;
const TOKENS=['petertecnet_admin_token','petertecnet_token','token','access_token','auth_token'];
const USERS=['user','petertecnet_user','auth_user'];
const APPS={
 cutinapp:{accent:'#8b5cf6',accent2:'#22d3ee',items:[['feed','Feed','⌂'],['search','Buscar','⌕'],['event','Eventos','◈'],['messages','Mensagens','✉'],['profile','Perfil','●']]},
 nexus:{accent:'#65d1ff',accent2:'#7c3aed',items:[['','Início','⌂'],['establishment/my','Catálogos','▦'],['?peterSearch=1','Buscar','⌕'],['purchases','Compras','▣'],['user/update','Perfil','●']]},
 plat:{accent:'#f59e0b',accent2:'#fb7185',items:[['','Início','⌂'],['establishment/my','Meu local','▦'],['item','Itens','◇'],['order','Pedidos','▣'],['user/update','Perfil','●']]},
 rasoio:{accent:'#38bdf8',accent2:'#14b8a6',items:[['','Início','⌂'],['establishment/my','Barbearia','▦'],['appointment','Agenda','◷'],['item','Serviços','◇'],['user/update','Perfil','●']]},
 kryvion:{accent:'#22d3ee',accent2:'#a3e635',items:[['','Início','⌂'],['market','Mercado','⌁'],['radar','Radar','⌖'],['portfolio','Portfólio','▥'],['profile','Perfil','●']]},
 payflow:{accent:'#34d399',accent2:'#60a5fa',items:[['','Início','⌂'],['clients','Clientes','♙'],['opportunities','Funil','⌁'],['charges','Cobranças','▣'],['profile','Perfil','●']]},
 laora:{accent:'#c084fc',accent2:'#f472b6',items:[['','Início','⌂'],['search','Buscar','⌕'],['services','Serviços','◇'],['messages','Mensagens','✉'],['profile','Perfil','●']]},
 locaio:{accent:'#2dd4bf',accent2:'#38bdf8',items:[['','Início','⌂'],['search','Buscar','⌕'],['appointments','Agenda','◷'],['services','Serviços','◇'],['profile','Perfil','●']]}
};
const appSlug=()=>document.querySelector('meta[name="peter-app-slug"]')?.content?.toLowerCase()||location.hostname.split('.')[0].toLowerCase();
const hasToken=()=>TOKENS.some(k=>{try{return !!localStorage.getItem(k)}catch{return false}});
const user=()=>{for(const k of USERS)try{const v=localStorage.getItem(k);if(v)return JSON.parse(v)}catch{}return null};
const norm=p=>('/'+String(p||'').replace(/^\/+|\/+$/g,'')).replace(/\/$/,'')||'/';
const href=p=>p.startsWith('?')?'/'+p:norm(p), current=()=>norm(location.pathname);
const active=p=>!p.startsWith('?')&&(href(p)==='/'?current()==='/':current()===href(p)||current().startsWith(href(p)+'/'));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=u=>{const n=(u?.name||u?.username||u?.email||'PT').trim();return n.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()};
const CSS=`
:root{--peter-bottom-nav-h:76px;--peter-nav-z:1040;--peter-overlay-z:1600;--peter-touch:44px}
html,body,#root{max-width:100%;overflow-x:clip}html{scroll-padding-bottom:calc(var(--peter-bottom-nav-h) + env(safe-area-inset-bottom,0px))}
img,svg,video,canvas{max-width:100%}button,a,input,select,textarea{min-width:0}
body.peter-has-bottom-nav{padding-bottom:calc(var(--peter-bottom-nav-h) + env(safe-area-inset-bottom,0px))}
footer,.footer,[class$="Footer"],[class*=" footer"]{max-width:100%;overflow-x:clip}
#peter-ecosystem-bottom-nav{display:none}
@media(max-width:${BP}px){
 body.peter-has-bottom-nav .cut-mobile-bottom-nav,body.peter-has-bottom-nav .ecosystem-bottom-nav:not(#peter-ecosystem-bottom-nav){display:none}
 body.peter-has-bottom-nav footer,body.peter-has-bottom-nav .footer{padding-bottom:calc(var(--peter-bottom-nav-h) + 16px + env(safe-area-inset-bottom,0px))}
 #peter-ecosystem-bottom-nav{box-sizing:border-box;position:fixed;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));left:max(10px,env(safe-area-inset-left,0px));right:max(10px,env(safe-area-inset-right,0px));bottom:max(8px,env(safe-area-inset-bottom,0px));height:64px;padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:rgba(9,14,26,.84);box-shadow:0 16px 48px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);z-index:var(--peter-nav-z);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;isolation:isolate}
 #peter-ecosystem-bottom-nav a{position:relative;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:16px;color:rgba(238,244,255,.72);text-decoration:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .18s ease,color .18s ease,background .18s ease}
 #peter-ecosystem-bottom-nav a:active{transform:scale(.94)}#peter-ecosystem-bottom-nav a:focus-visible{outline:2px solid var(--peter-nav-accent);outline-offset:1px}
 #peter-ecosystem-bottom-nav a[aria-current="page"]{color:#fff;background:rgba(255,255,255,.08)}#peter-ecosystem-bottom-nav a[aria-current="page"]:before{content:"";position:absolute;top:2px;width:18px;height:2px;border-radius:2px;background:var(--peter-nav-accent);box-shadow:0 0 12px var(--peter-nav-accent)}
 .peter-nav-icon{font-size:20px;line-height:20px;font-weight:700}.peter-nav-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:12px;font-weight:700}.peter-nav-avatar{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;font-size:9px;font-weight:800;color:#07111f;background:linear-gradient(135deg,var(--peter-nav-accent),var(--peter-nav-accent2))}
 body[data-peter-app="nexus"] .globalnav{min-height:116px}
 body[data-peter-app="nexus"] .globalnav__bar{box-sizing:border-box;width:100%;min-height:116px;padding:8px 12px 10px;grid-template-columns:44px minmax(0,1fr) auto;grid-template-rows:48px 48px;column-gap:8px;row-gap:4px}
 body[data-peter-app="nexus"] .globalnav__left{grid-column:1;grid-row:1;min-width:44px}body[data-peter-app="nexus"] .globalnav__right{grid-column:3;grid-row:1;gap:8px}
 body[data-peter-app="nexus"] .globalnav__searchWrap{grid-column:1/-1;grid-row:2;width:100%;max-width:none;min-width:0}body[data-peter-app="nexus"] .globalnav__searchBox{width:100%;height:46px;min-width:0}body[data-peter-app="nexus"] .globalnav__searchBox input{min-width:0;font-size:16px}
 body[data-peter-app="nexus"] .globalnav__cartButton,body[data-peter-app="nexus"] .globalnav__menuButton{width:44px;height:44px;flex-basis:44px}body[data-peter-app="nexus"] .globalnav__searchResults{top:120px;left:8px;right:8px;max-width:calc(100vw - 16px)}
}
@media(max-width:360px){#peter-ecosystem-bottom-nav{left:6px;right:6px;border-radius:18px}.peter-nav-label{font-size:9px}}
@media(max-width:${BP}px) and (orientation:landscape){body[data-peter-app="nexus"] .globalnav{min-height:104px}body[data-peter-app="nexus"] .globalnav__bar{min-height:104px;grid-template-rows:44px 44px;padding-block:6px}body[data-peter-app="nexus"] .globalnav__searchResults{top:108px}}
@media(prefers-reduced-motion:reduce){#peter-ecosystem-bottom-nav a,*{scroll-behavior:auto!important}#peter-ecosystem-bottom-nav a{transition:none}}
body.peter-keyboard-open #peter-ecosystem-bottom-nav{display:none}
`;
const style=()=>{let s=document.getElementById('peter-navigation-style');if(!s){s=document.createElement('style');s.id='peter-navigation-style';document.head.appendChild(s)}s.textContent=CSS};
const remove=()=>{document.getElementById('peter-ecosystem-bottom-nav')?.remove();document.body?.classList.remove('peter-has-bottom-nav')};
const mount=()=>{style();if(!document.body)return;const slug=appSlug();document.body.dataset.peterApp=slug;remove();const app=APPS[slug];if(!app||!hasToken()||matchMedia(`(min-width:${BP+1}px)`).matches)return;const u=user(),nav=document.createElement('nav');nav.id='peter-ecosystem-bottom-nav';nav.className='ecosystem-bottom-nav';nav.setAttribute('aria-label','Navegação principal');nav.style.setProperty('--peter-nav-accent',app.accent);nav.style.setProperty('--peter-nav-accent2',app.accent2);nav.innerHTML=app.items.map(([p,l,i],x)=>`<a href="${esc(href(p))}" data-peter-nav-path="${esc(p)}" ${active(p)?'aria-current="page"':''} aria-label="${esc(l)}">${x===4?`<span class="peter-nav-avatar" aria-hidden="true">${esc(initials(u))}</span>`:`<span class="peter-nav-icon" aria-hidden="true">${esc(i)}</span>`}<span class="peter-nav-label">${esc(l)}</span></a>`).join('');nav.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;const p=a.dataset.peterNavPath||'';if(p.startsWith('?')){e.preventDefault();history.replaceState(history.state,'',p);setTimeout(()=>document.querySelector('input[type="search"],input[placeholder*="Buscar" i],input[placeholder*="Pesquisar" i],.globalnav__searchBox input')?.focus(),50)}});document.body.appendChild(nav);document.body.classList.add('peter-has-bottom-nav')};
let baseline=visualViewport?.height||innerHeight;const viewport=()=>{const h=visualViewport?.height||innerHeight,open=baseline-h>150;document.body?.classList.toggle('peter-keyboard-open',open);if(!open)baseline=Math.max(baseline,h)};const refresh=()=>requestAnimationFrame(mount);
['authChanged','peter:auth-changed','popstate','resize'].forEach(e=>addEventListener(e,refresh,{passive:true}));visualViewport?.addEventListener('resize',viewport,{passive:true});
const push=history.pushState,replace=history.replaceState;history.pushState=function(...a){const r=push.apply(this,a);refresh();return r};history.replaceState=function(...a){const r=replace.apply(this,a);refresh();return r};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();window.PeterTecnetNavigation={version:VERSION,mount,refresh,remove,apps:APPS};
})();