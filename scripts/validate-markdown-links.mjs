import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseMarkdownInline, safeMarkdownHref } from '../src/utils/markdownLinks.js'

const cta = parseMarkdownInline('Integre seus sistemas. [Pedir orçamento](/orcamento?servico=api-e-integracoes) agora.')
assert.deepEqual(cta, [
  { type: 'text', text: 'Integre seus sistemas. ' },
  { type: 'link', text: 'Pedir orçamento', href: '/orcamento?servico=api-e-integracoes', external: false },
  { type: 'text', text: ' agora.' },
])
assert.equal(parseMarkdownInline('[Contato](mailto:contato@example.com)')[0].href, 'mailto:contato@example.com')
assert.equal(parseMarkdownInline('[Seção](#integracoes)')[0].href, '#integracoes')
assert.equal(parseMarkdownInline('[Serviços](/servicos/apis?origem=blog&utm_source=artigo)')[0].href, '/servicos/apis?origem=blog&utm_source=artigo')
assert.deepEqual(parseMarkdownInline('[Um](/orcamento) e [Dois](https://example.com/)').filter(part => part.type === 'link').map(part => part.href), ['/orcamento', 'https://example.com/'])
assert.equal(safeMarkdownHref('HTTPS://EXAMPLE.COM/path'), 'https://example.com/path')
assert.equal(parseMarkdownInline('[Externo](https://example.com/a)')[0].external, true)

for (const href of [
  'http://example.com', 'HTTP://example.com',
  'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'vbscript:msgbox(1)',
  '//evil.example/redirect', 'https://user:password@example.com/', 'https://example.com\\@evil.example',
  'https://example.com/\nattack', 'https://example.com/\tattack', 'file:///etc/passwd',
  'ftp://example.com', 'https://', 'https://example.com/\u0000',
]) {
  assert.equal(safeMarkdownHref(href), null, 'Protocolo/URL não permitido: ' + JSON.stringify(href))
  assert.equal(parseMarkdownInline('[Clique](' + href + ')').some(part => part.type === 'link'), false)
}
assert.equal(parseMarkdownInline('![imagem](https://example.com/a.png)').some(part => part.type === 'link'), false)
assert.equal(parseMarkdownInline('[Link incompleto](/orcamento').map(part => part.text).join(''), '[Link incompleto](/orcamento')
assert.equal(parseMarkdownInline('[<img src=x onerror=alert(1)>](/orcamento)')[0].text, '<img src=x onerror=alert(1)>')
assert.equal(parseMarkdownInline('<script>alert(1)</script>')[0].type, 'text')

const renderer = readFileSync(new URL('../src/MarkdownInline.jsx', import.meta.url), 'utf8')
assert.match(renderer, /<a key=\{index\} href=\{part\.href\}/)
assert.match(renderer, /noopener noreferrer/)
assert.doesNotMatch(renderer, /dangerouslySetInnerHTML|innerHTML/)

for (const path of ['../src/PublicBlogArticle.jsx', '../src/PublicDiscoveryExperience.jsx']) {
  const component = readFileSync(new URL(path, import.meta.url), 'utf8')
  assert.match(component, /import MarkdownInline from '\.\/MarkdownInline\.jsx'/, 'Import ausente: ' + path)
  assert.match(component, /<p[^>]*><MarkdownInline text=\{/)
  assert.match(component, /<li[^>]*><MarkdownInline text=\{/)
  assert.match(component, /<h2[^>]*><MarkdownInline text=\{/)
}
console.log('Links Markdown, CTA, HTTPS, protocolos e contrato dos dois renderizadores: PASS')
