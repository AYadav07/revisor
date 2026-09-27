import { describe, expect, it } from 'vitest'
import { apiOrigin, pagesHeaders } from './cloudflarePages.ts'

describe('apiOrigin', () => {
  it('uses the configured API origin, dropping any path', () => {
    expect(apiOrigin({ CF_PAGES: '1', VITE_API_URL: 'https://api.example.dev/' })).toBe('https://api.example.dev')
  })

  it('falls back to the local backend for a local build', () => {
    expect(apiOrigin({})).toBe('http://localhost:8080')
  })

  it('refuses a Cloudflare build without an API URL', () => {
    expect(() => apiOrigin({ CF_PAGES: '1' })).toThrow('VITE_API_URL must be set')
    expect(() => apiOrigin({ CF_PAGES: '1', VITE_API_URL: '  ' })).toThrow('VITE_API_URL must be set')
  })

  it('refuses a plain-http API on Cloudflare, where auth cookies are Secure', () => {
    expect(() => apiOrigin({ CF_PAGES: '1', VITE_API_URL: 'http://api.example.dev' })).toThrow('https://')
  })

  it('refuses a malformed URL', () => {
    expect(() => apiOrigin({ VITE_API_URL: 'api.example.dev' })).toThrow('not a valid URL')
  })
})

describe('pagesHeaders', () => {
  const headers = pagesHeaders('https://api.example.dev')
  const csp = headers.match(/Content-Security-Policy: (.*)/)?.[1] ?? ''

  it('lets the app reach its API and nothing else off-site', () => {
    expect(csp).toContain("connect-src 'self' https://api.example.dev")
    expect(csp).toContain("default-src 'self'")
  })

  it('allows no inline or third-party scripts, plugins or framing', () => {
    expect(csp).toContain("script-src 'self';")
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('allows the Google Fonts stylesheet and font files', () => {
    expect(csp).toContain('https://fonts.googleapis.com')
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com")
  })

  it('caches hashed assets forever', () => {
    expect(headers).toMatch(/\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/)
  })
})
