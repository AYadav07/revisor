/** Route paths in one place, so a rename or a redirect target can't drift from the router. */
export const ROUTES = {
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
} as const

/** Where a signed-in user lands when nothing more specific was asked for. */
export const DEFAULT_AUTHENTICATED_PATH = ROUTES.dashboard
