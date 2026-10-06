import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cta = source.match(/<button className="primary-button"[\s\S]*?<\/button>/)?.[0] || ''

if (!cta) {
  throw new Error('Admin login CTA not found.')
}

if (!/Acessar dashboard/.test(cta)) {
  throw new Error('Admin login CTA label changed unexpectedly.')
}

if (!/<span[^>]*aria-hidden="true"[^>]*>↗<\/span>/.test(cta)) {
  throw new Error('Decorative login CTA arrow must use aria-hidden="true".')
}

console.log('Login CTA accessibility contract passed.')
