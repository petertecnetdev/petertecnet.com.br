import assert from 'node:assert/strict'
import test from 'node:test'
import { errorMessage, tokenFrom } from './api.js'

test('extracts supported authentication token formats', () => {
  assert.equal(tokenFrom({ access_token: 'direct' }), 'direct')
  assert.equal(tokenFrom({ token: { access_token: 'nested' } }), 'nested')
  assert.equal(tokenFrom({ token: { original: { access_token: 'laravel' } } }), 'laravel')
})

test('uses the first Laravel validation error', () => {
  assert.equal(errorMessage({ errors: { email: ['E-mail inválido.'] } }), 'E-mail inválido.')
})

