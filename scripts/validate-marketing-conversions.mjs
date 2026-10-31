import assert from 'node:assert/strict'
import { classifyMarketingConversion } from '../src/utils/marketingConversion.js'

const anchor = (href, textContent = '') => ({
  getAttribute: name => name === 'href' ? href : null,
  textContent,
})

assert.deepEqual(classifyMarketingConversion(anchor('https://instagram.com/petertecnet')),
  { type: 'contact', id: 'instagram' })
assert.deepEqual(classifyMarketingConversion(anchor('https://www.instagram.com/petertecnet/')),
  { type: 'contact', id: 'instagram' })
assert.deepEqual(classifyMarketingConversion(anchor('https://help.instagram.com/article')),
  { type: 'contact', id: 'instagram' })
assert.deepEqual(classifyMarketingConversion(anchor('//instagram.com/petertecnet')),
  { type: 'contact', id: 'instagram' })

for (const href of [
  'https://instagram.com.evil.example/',
  'https://evil.example/?next=https://instagram.com',
  '/instagram.com',
  'https://user@instagram.com/petertecnet',
  'javascript:alert(1)',
]) {
  assert.equal(classifyMarketingConversion(anchor(href)), null, `Destino não deve ser classificado como Instagram: ${href}`)
}

for (const href of [
  'https://wa.me/5511999999999',
  'https://api.whatsapp.com/send?phone=5511999999999',
  'https://web.whatsapp.com/send?phone=5511999999999',
  'https://chat.whatsapp.com/invite',
]) {
  assert.deepEqual(classifyMarketingConversion(anchor(href)),
    { type: 'contact', id: 'whatsapp' }, `WhatsApp oficial não reconhecido: ${href}`)
}

for (const href of [
  'https://evil.example/?next=wa.me/5511999999999',
  'https://wa.me.evil.example/5511999999999',
  'https://whatsapp.com.evil.example/',
  '/wa.me/5511999999999',
  'javascript:alert(1)',
]) {
  assert.equal(classifyMarketingConversion(anchor(href, 'WhatsApp')), null,
    `Destino não deve ser classificado como WhatsApp: ${href}`)
}

assert.deepEqual(classifyMarketingConversion(anchor('mailto:contato@petertecnet.com.br')),
  { type: 'contact', id: 'email' })
assert.deepEqual(classifyMarketingConversion(anchor('/orcamento?servico=api')),
  { type: 'conversion', id: 'quote' })
assert.deepEqual(classifyMarketingConversion(anchor('https://petertecnet.com.br/orcamento/')),
  { type: 'conversion', id: 'quote' })

for (const href of [
  '/orcamento-falso',
  '/orcamentoXYZ',
  '/orcamento/extra',
  'https://evil.example/orcamento',
  '//evil.example/orcamento',
]) {
  assert.equal(classifyMarketingConversion(anchor(href)), null, `Rota não deve ser classificada como orçamento: ${href}`)
}

assert.deepEqual(classifyMarketingConversion(anchor('/servicos/apis?origem=blog')),
  { type: 'service', id: 'apis' })
assert.deepEqual(classifyMarketingConversion(anchor('/plataformas/cutinapp')),
  { type: 'application', id: 'cutinapp' })
assert.deepEqual(classifyMarketingConversion(anchor('/solucoes/consultoria')),
  { type: 'item', id: 'consultoria' })
assert.deepEqual(classifyMarketingConversion(anchor('/blog/automacao')),
  { type: 'content', id: 'automacao' })
assert.deepEqual(classifyMarketingConversion(anchor('/servicos/consultoria%20tecnica')),
  { type: 'service', id: 'consultoria tecnica' })

for (const href of [
  '/servicos',
  '/servicosXYZ/apis',
  '/servicos/%2Fadmin',
  '/servicos/%ZZ',
  '/servicos/..',
  'https://evil.example/servicos/apis',
  '//evil.example/servicos/apis',
]) {
  assert.equal(classifyMarketingConversion(anchor(href)), null, `Rota não deve ser classificada: ${href}`)
}

assert.equal(classifyMarketingConversion(anchor('#')), null)
assert.equal(classifyMarketingConversion(anchor(null)), null)

console.log('Classificação de conversões, domínios oficiais e limites de rotas: PASS')
