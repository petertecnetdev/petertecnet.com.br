const SITE_ORIGIN = 'https://petertecnet.com.br'

function normalize(value) {
  return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function isInstagramDestination(href) {
  try {
    const url = new URL(href, SITE_ORIGIN)
    return ['http:', 'https:'].includes(url.protocol)
      && (url.hostname === 'instagram.com' || url.hostname.endsWith('.instagram.com'))
  } catch {
    return false
  }
}

export function classifyMarketingConversion(anchor) {
  const href = anchor?.getAttribute?.('href') || ''
  if (!href || href === '#') return null
  if (href.startsWith('mailto:')) return { type: 'contact', id: 'email' }
  if (href.includes('wa.me') || normalize(anchor.textContent).includes('whatsapp')) return { type: 'contact', id: 'whatsapp' }
  if (isInstagramDestination(href)) return { type: 'contact', id: 'instagram' }
  if (href.startsWith('/orcamento')) return { type: 'conversion', id: 'quote' }
  if (href.startsWith('/servicos/')) return { type: 'service', id: decodeURIComponent(href.split('/')[2]?.split('?')[0] || '') }
  if (href.startsWith('/plataformas/')) return { type: 'application', id: decodeURIComponent(href.split('/')[2]?.split('?')[0] || '') }
  if (href.startsWith('/solucoes/')) return { type: 'item', id: decodeURIComponent(href.split('/')[2]?.split('?')[0] || '') }
  if (href.startsWith('/blog/')) return { type: 'content', id: decodeURIComponent(href.split('/')[2]?.split('?')[0] || '') }
  return null
}
