// Apenas links inline simples: texto da API permanece texto React, nunca HTML.
const INLINE_LINK = /\[([^\]\r\n]+)\]\(([^)\r\n]+)\)/g
const CONTROL = /[\u0000-\u001f\u007f]/

export function safeMarkdownHref(value) {
  if (typeof value !== 'string') return null
  const href = value.trim()
  if (!href || CONTROL.test(href) || /\s|\\/.test(href) || href.startsWith('//')) return null

  if (href.startsWith('/') || (href.startsWith('#') && href.length > 1)) return href

  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
      return url.href
    } catch {
      return null
    }
  }

  if (/^mailto:/i.test(href) && /^[^\s@?]+@[^\s@?]+\.[^\s@?]+(?:\?[^#]*)?$/.test(href.slice(7))) return href
  return null
}

export function parseMarkdownInline(value) {
  const source = String(value ?? '')
  const parts = []
  let cursor = 0

  for (const match of source.matchAll(INLINE_LINK)) {
    if (match.index > cursor) parts.push({ type: 'text', text: source.slice(cursor, match.index) })
    const href = match.index > 0 && source[match.index - 1] === '!' ? null : safeMarkdownHref(match[2])
    parts.push(href
      ? { type: 'link', text: match[1], href, external: /^https?:\/\//i.test(href) }
      : { type: 'text', text: match[0] })
    cursor = match.index + match[0].length
  }

  if (cursor < source.length) parts.push({ type: 'text', text: source.slice(cursor) })
  return parts.length ? parts : [{ type: 'text', text: source }]
}
