import type { Plugin } from 'vite'

/** Same fallback as src/api/client.ts: a local build talks to the local backend. */
const LOCAL_API_URL = 'http://localhost:8080'

interface BuildEnv {
  /** Set to "1" by Cloudflare Pages' build environment. */
  CF_PAGES?: string
  VITE_API_URL?: string
}

/**
 * The API's origin for the CSP. On Cloudflare the URL is mandatory and must be HTTPS: a missing one
 * would otherwise build an app that silently calls http://localhost:8080 from every visitor's browser.
 */
export function apiOrigin(env: BuildEnv): string {
  const onCloudflare = env.CF_PAGES === '1'
  const raw = env.VITE_API_URL?.trim()
  if (!raw) {
    if (onCloudflare) throw new Error('VITE_API_URL must be set for Cloudflare Pages builds, e.g. https://api.<domain>')
    return new URL(LOCAL_API_URL).origin
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`VITE_API_URL is not a valid URL: ${raw}`)
  }
  if (onCloudflare && url.protocol !== 'https:') {
    throw new Error(`VITE_API_URL must be https:// on Cloudflare Pages (auth cookies are Secure): ${raw}`)
  }
  return url.origin
}

/**
 * Cloudflare Pages `_headers` (SECURITY.md, "Frontend security headers"). The CSP allows exactly what
 * the app loads: its own bundle, the API, and the Inter font from Google Fonts. Inline styles are
 * allowed because toasts (sonner) inject a <style> element; inline scripts are not.
 */
export function pagesHeaders(api: string): string {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self'",
    `connect-src 'self' ${api}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  return `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

# Vite content-hashes everything under /assets, so a file there never changes.
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`
}

/** Checks the build's API URL and writes `_headers` next to index.html in the output. */
export function cloudflarePages(env: BuildEnv): Plugin {
  return {
    name: 'revisor:cloudflare-pages',
    apply: 'build',
    buildStart() {
      try {
        apiOrigin(env)
      } catch (error) {
        this.error((error as Error).message)
      }
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: pagesHeaders(apiOrigin(env)) })
    },
  }
}
