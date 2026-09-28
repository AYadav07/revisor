import { apiFetch } from './client'
import type { AuthUser, LoginRequest, ResetPasswordRequest, SessionResponse, SignupRequest } from './types'

export const authApi = {
  /**
   * 201. Creates an unverified account and emails a verification link. Doesn't sign the user in:
   * they can't until they've clicked the link.
   */
  signup: (body: SignupRequest) => apiFetch<AuthUser>('/auth/signup', { method: 'POST', body }),

  /**
   * Sets the access + refresh cookies. 401 = wrong credentials or disabled account; 403
   * `email-not-verified` = right password, email not verified yet; 429 = rate limited.
   */
  login: (body: LoginRequest) => apiFetch<SessionResponse>('/auth/login', { method: 'POST', body }),

  /**
   * Rotates the refresh token (sent automatically as a cookie). Also how the app restores a
   * session on page load, since there is no separate "who am I" endpoint: 200 with the user
   * if the refresh cookie is still good, 401 if not.
   */
  refresh: () => apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' }),

  /** 204. Revokes the session server-side and clears both cookies; safe to call with no session. */
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  /** 200. Redeems the token from the emailed link. 400 `invalid-token` if unknown, expired or used. */
  verifyEmail: (token: string) => apiFetch<void>('/auth/verify-email', { method: 'POST', body: { token } }),

  /** 202 whether or not the address has an account (no enumeration). 429 = rate limited. */
  resendVerification: (email: string) =>
    apiFetch<void>('/auth/resend-verification', { method: 'POST', body: { email } }),

  /** 202 whether or not the address has an account (no enumeration). 429 = rate limited. */
  forgotPassword: (email: string) => apiFetch<void>('/auth/forgot-password', { method: 'POST', body: { email } }),

  /**
   * 204. Sets the new password and signs the user out everywhere; doesn't sign them in.
   * 400 `invalid-token` for a bad link, 400 `validation-failed` for a password the policy rejects.
   */
  resetPassword: (body: ResetPasswordRequest) => apiFetch<void>('/auth/reset-password', { method: 'POST', body }),
}
