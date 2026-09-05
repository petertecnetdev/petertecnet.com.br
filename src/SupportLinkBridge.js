const path = window.location.pathname.replace(/\/+$/, '') || '/'

if (path !== '/suporte') {
  const install = () => {
    if (!document.body || document.querySelector('[data-peter-support-link]')) return

    const link = document.createElement('a')
    link.href = '/suporte'
    link.dataset.peterSupportLink = 'true'
    link.setAttribute('aria-label', 'Abrir suporte Peter Tecnet')
    link.innerHTML = '<span aria-hidden="true">?</span><b>Suporte</b>'
    Object.assign(link.style, {
      position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147482000',
      display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '10px 14px',
      border: '1px solid rgba(118,187,255,.34)', borderRadius: '999px',
      background: 'rgba(7,15,24,.92)', color: '#eaf5ff', textDecoration: 'none',
      font: '700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      boxShadow: '0 14px 38px rgba(0,0,0,.34)', backdropFilter: 'blur(16px)',
    })
    const mark = link.querySelector('span')
    Object.assign(mark.style, {
      width: '24px', height: '24px', borderRadius: '50%', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(135deg,#eaf5ff,#77bbff)', color: '#07101a', fontWeight: '900',
    })
    document.body.appendChild(link)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true })
  else install()
}
