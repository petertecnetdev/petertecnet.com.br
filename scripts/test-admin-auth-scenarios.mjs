import assert from 'node:assert/strict'
import { resolveAdminSession } from '../src/adminAuthPolicy.js'

const scenarios = [
  ['deslogado abre login estável', { hasToken: false }, 'guest'],
  ['sessão expirada volta ao login', { hasToken: true, meStatus: 401, adminStatus: 401 }, 'guest'],
  ['usuário autenticado sem permissão não monta admin', { hasToken: true, meStatus: 200, adminStatus: 403 }, 'forbidden'],
  ['administrador válido monta dashboard', { hasToken: true, meStatus: 200, adminStatus: 200 }, 'authenticated'],
  ['falha transitória não é confundida com logout', { hasToken: true, meStatus: 503, adminStatus: 503 }, 'retryable'],
]
for (const [label, input, expected] of scenarios) {
  assert.equal(resolveAdminSession(input), expected, label)
  console.log(`✓ ${label}`)
}
console.log('\nAdmin auth scenarios validated.')
