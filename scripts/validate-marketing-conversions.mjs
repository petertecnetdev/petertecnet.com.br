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
  'javascript:alert(1)',
]) {
  assert.equal(classifyMarketingConversion(anchor(href)), null, `Destino não deve ser classificado como Instagram: ${href}`)
}

assert.deepEqual(classifyMarketingConversion(anchor('mailto:contato@petertecnet.com.br')),
  { type: 'contact', id: 'email' })
assert.deepEqual(classifyMarketingConversion(anchor('https://wa.me/5511999999999')),
  { type: 'contact', id: 'whatsapp' })
assert.deepEqual(classifyMarketingConversion(anchor('/orcamento?servico=api')),
  { type: 'conversion', id: 'quote' })
assert.deepEqual(classifyMarketingConversion(anchor('/servicos/apis')),
  { type: 'service', id: 'apis' })
assert.deepEqual(classifyMarketingConversion(anchor('/plataformas/cutinapp')),
  { type: 'application', id: 'cutinapp' })
assert.deepEqual(classifyMarketingConversion(anchor('/solucoes/consultoria')),
  { type: 'item', id: 'consultoria' })
assert.deepEqual(classifyMarketingConversion(anchor('/blog/automacao')),
  { type: 'content', id: 'automacao' })
assert.equal(classifyMarketingConversion(anchor('#')), null)
assert.equal(classifyMarketingConversion(anchor(null)), null)

console.log('Classificação de conversões, Instagram e destinos semelhantes: PASS')
