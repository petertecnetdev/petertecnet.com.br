const API = 'https://api.petertecnet.com.br';
const CNPJ = '42595409000148';
const ID = 'pt-whatsapp-fallback';

const normalize = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/(?:wa\.me\/|phone=)(\d{10,15})/i);
  if (match?.[1]) return `https://wa.me/${match[1]}`;
  const digits = text.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;
  const hasCountryCode = digits.startsWith('55') && digits.length >= 12;
  return `https://wa.me/${hasCountryCode ? digits : `55${digits}`}`;
};

const fromContact = (contact) => normalize(
  contact?.whatsapp_url || contact?.whatsappUrl || contact?.whatsapp ||
  contact?.whatsapp_phone || contact?.phone || contact?.mobile || contact?.cellphone
);

async function getPeterWhatsapp() {
  try {
    const response = await fetch(`${API}/api/ecosystem/site`, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const payload = await response.json();
      const link = fromContact(payload?.site?.contact || payload?.contact);
      if (link) return link;
    }
  } catch {}

  try {
    const response = await fetch(`${API}/api/nexus/public/catalog-by-cnpj/${CNPJ}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = await response.json();
    return fromContact(payload?.establishment);
  } catch {
    return null;
  }
}

const pageLabel = () => {
  const h1 = document.querySelector('main h1, [role="main"] h1, h1')?.textContent?.replace(/\s+/g, ' ').trim();
  if (h1 && h1.length < 180) return h1;
  return String(document.title || 'esta página').split(/[|·]/)[0].trim();
};

const whatsappIcon = `
  <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M19.11 17.49c-.26-.13-1.54-.76-1.78-.85-.24-.09-.41-.13-.59.13-.17.26-.67.85-.83 1.02-.15.17-.3.2-.56.07-.26-.13-1.08-.4-2.06-1.27-.76-.68-1.27-1.52-1.42-1.78-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.43.09-.17.04-.33-.02-.46-.07-.13-.59-1.41-.8-1.94-.21-.5-.43-.43-.59-.44h-.5c-.17 0-.46.07-.7.33-.24.26-.91.89-.91 2.17 0 1.28.93 2.52 1.06 2.69.13.17 1.82 2.78 4.41 3.9.62.27 1.1.43 1.47.55.62.2 1.18.17 1.63.1.5-.07 1.54-.63 1.76-1.24.22-.61.22-1.13.15-1.24-.06-.11-.24-.17-.5-.3M16.04 27.1h-.01a11.08 11.08 0 0 1-5.65-1.55l-.41-.24-4.2 1.1 1.12-4.1-.27-.42a11.07 11.07 0 1 1 9.42 5.21m9.43-20.35A13.25 13.25 0 0 0 16.05 2.85C8.76 2.85 2.82 8.78 2.82 16.08c0 2.33.61 4.6 1.77 6.59L2.7 29.55l7.04-1.85a13.24 13.24 0 0 0 6.31 1.61h.01c7.29 0 13.23-5.93 13.23-13.23 0-3.53-1.37-6.85-3.82-9.33"/>
  </svg>`;

export function installPeterWhatsappFallback() {
  if (document.getElementById(ID)) return;

  const button = document.createElement('a');
  button.id = ID;
  button.target = '_blank';
  button.rel = 'noreferrer';
  button.title = 'WhatsApp Peter Tecnet';
  button.setAttribute('aria-label', 'Abrir WhatsApp da Peter Tecnet');
  button.innerHTML = whatsappIcon;
  button.href = '#';

  Object.assign(button.style, {
    position: 'fixed',
    right: 'max(16px, env(safe-area-inset-right))',
    bottom: 'max(18px, env(safe-area-inset-bottom))',
    width: '58px',
    height: '58px',
    borderRadius: '50%',
    background: '#25D366',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    textDecoration: 'none',
    boxShadow: '0 14px 36px rgba(0,0,0,.34)',
    zIndex: '2147483000',
    border: '1px solid rgba(255,255,255,.24)',
    transition: 'transform .18s ease, box-shadow .18s ease',
    cursor: 'pointer'
  });

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px) scale(1.04)';
    button.style.boxShadow = '0 18px 42px rgba(0,0,0,.4)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'none';
    button.style.boxShadow = '0 14px 36px rgba(0,0,0,.34)';
  });

  const setWhatsappHref = (base) => {
    if (!base) return;
    const separator = base.includes('?') ? '&' : '?';
    const message = `Olá! Vim pelo site da Peter Tecnet e gostaria de falar com um agente sobre "${pageLabel()}".`;
    button.href = `${base}${separator}text=${encodeURIComponent(message)}`;
  };

  button.addEventListener('click', (event) => {
    if (button.href && !button.href.endsWith('#')) return;
    event.preventDefault();
    getPeterWhatsapp().then((base) => {
      if (!base) return;
      setWhatsappHref(base);
      window.open(button.href, '_blank', 'noopener,noreferrer');
    });
  });

  document.body.appendChild(button);
  getPeterWhatsapp().then(setWhatsappHref);
}
