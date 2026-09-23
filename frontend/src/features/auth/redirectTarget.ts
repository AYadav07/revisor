import { DEFAULT_AUTHENTICATED_PATH } from '@/routes'

interface FromLocation {
  pathname?: string
  search?: string
  hash?: string
}

/**
 * Where to send a user after they sign in: the page a guard bounced them from (RequireAuth puts
 * it in router state as `from`), else the default landing page. Only same-site paths are honoured
 * — a value like "//evil.example" is ignored — so this can never be turned into an open redirect.
 */
export function redirectTarget(locationState: unknown): string {
  const from = (locationState as { from?: FromLocation } | null | undefined)?.from
  const pathname = from?.pathname
  if (!pathname || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return DEFAULT_AUTHENTICATED_PATH
  }
  return `${pathname}${from?.search ?? ''}${from?.hash ?? ''}`
}
