import { createContext } from 'react'
import type { AuthUser, LoginRequest, SignupRequest } from '@/api'
import type { AuthState } from './authReducer'

export interface AuthContextValue {
  status: AuthState['status']
  user: AuthUser | null
  /** Rejects with an ApiError on failure (401 bad credentials, 429 rate limited, ...). */
  login: (credentials: LoginRequest) => Promise<AuthUser>
  /** Creates the account, then signs in with the same credentials (signup itself sets no cookies). */
  signup: (details: SignupRequest) => Promise<AuthUser>
  /**
   * Always clears the local session, even if the server call fails — but then rejects, since the
   * server-side session (and its cookies) may still be alive and the user should be told.
   */
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
