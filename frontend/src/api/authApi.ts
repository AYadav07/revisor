import { apiFetch } from './client'
import type { AuthUser, LoginRequest, SessionResponse, SignupRequest } from './types'

export const authApi = {
  /** 201. Doesn't log the user in — call {@link authApi.login} afterwards. */
  signup: (body: SignupRequest) => apiFetch<AuthUser>('/auth/signup', { method: 'POST', body }),

  /** Sets the access + refresh cookies. 401 = wrong credentials or disabled account; 429 = rate limited. */
  login: (body: LoginRequest) => apiFetch<SessionResponse>('/auth/login', { method: 'POST', body }),

  /**
   * Rotates the refresh token (sent automatically as a cookie). Also how the app restores a
   * session on page load, since there is no separate "who am I" endpoint: 200 with the user
   * if the refresh cookie is still good, 401 if not.
   */
  refresh: () => apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' }),

  /** 204. Revokes the session server-side and clears both cookies; safe to call with no session. */
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
}
