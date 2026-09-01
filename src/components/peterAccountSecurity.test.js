import { describe, expect, it } from 'vitest'
import { isTrustedPeterTecnetUrl } from './peterAccountSecurity'

describe('isTrustedPeterTecnetUrl', () => {
  it('accepts only HTTPS Peter Tecnet hosts', () => {
    expect(isTrustedPeterTecnetUrl('https://nexus.petertecnet.com.br')).toBe(true)
    expect(isTrustedPeterTecnetUrl('https://petertecnet.com.br')).toBe(true)
    expect(isTrustedPeterTecnetUrl('https://example.com')).toBe(false)
    expect(isTrustedPeterTecnetUrl('http://nexus.petertecnet.com.br')).toBe(false)
  })
})
