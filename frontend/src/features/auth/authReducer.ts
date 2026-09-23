import type { AuthUser } from '@/api'

/**
 * `loading` only exists until the first session restore finishes on page load — it stops route
 * guards from bouncing a returning user to /login before we know whether they're signed in.
 */
export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated'; user: null }

export type AuthAction = { type: 'signed-in'; user: AuthUser } | { type: 'signed-out' }

export const initialAuthState: AuthState = { status: 'loading', user: null }

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'signed-in':
      return { status: 'authenticated', user: action.user }
    case 'signed-out':
      return { status: 'unauthenticated', user: null }
  }
}
