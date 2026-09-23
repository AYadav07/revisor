import { describe, expect, it } from 'vitest'
import { redirectTarget } from './redirectTarget'

describe('redirectTarget', () => {
  it('returns the page the guard bounced the user from, keeping its query string and hash', () => {
    expect(redirectTarget({ from: { pathname: '/courses/3', search: '?tab=x', hash: '#top' } })).toBe(
      '/courses/3?tab=x#top',
    )
  })

  it('falls back to the dashboard when there is no usable "from"', () => {
    for (const state of [null, undefined, {}, { from: {} }, { from: { pathname: '' } }, 'nonsense', 42]) {
      expect(redirectTarget(state)).toBe('/dashboard')
    }
  })

  it.each(['//evil.example', 'https://evil.example/x', 'javascript:alert(1)', 'courses'])(
    'ignores a non-local target (%s), so it can never become an open redirect',
    (pathname) => {
      expect(redirectTarget({ from: { pathname } })).toBe('/dashboard')
    },
  )
})
