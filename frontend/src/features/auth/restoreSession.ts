import { ApiError, authApi, type AuthUser } from '@/api'

let inFlight: Promise<AuthUser | null> | null = null

/**
 * Works out who is signed in on page load, by trying to refresh the session (there is no
 * "who am I" endpoint): the refresh cookie is either still good, giving us the user, or it
 * isn't, giving `null`. Any other failure (server down, 5xx) rejects.
 *
 * Concurrent calls share ONE request, and that is a correctness requirement, not an
 * optimisation. React StrictMode runs effects twice in development, so without this two
 * refreshes would go out with the same cookie; the second presents an already-rotated token,
 * which the backend treats as theft and answers by revoking the whole session — logging the
 * developer out on every reload.
 */
export function restoreSession(): Promise<AuthUser | null> {
  inFlight ??= authApi
    .refresh()
    .then((session) => session.user)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        return null
      }
      throw error
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}
