import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { authApi, setSessionExpiredHandler, type LoginRequest, type SignupRequest } from '@/api'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { authReducer, initialAuthState } from './authReducer'
import { restoreSession } from './restoreSession'

/**
 * Current-user state (Context + useReducer, ARCHITECTURE.md §8). Restores the session when the
 * app loads, and is the only place that signs a user in or out.
 *
 * The query cache is cleared on every identity change so one user's data can never show up
 * for the next.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState)
  const queryClient = useQueryClient()

  // Lets the session-expired handler (registered once, below) see the *current* status.
  const statusRef = useRef(state.status)
  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  useEffect(() => {
    let cancelled = false
    restoreSession()
      .then((user) => {
        if (!cancelled) dispatch(user ? { type: 'signed-in', user } : { type: 'signed-out' })
      })
      .catch(() => {
        // Server unreachable or erroring: we can't confirm a session, so start at the sign-in page.
        if (!cancelled) dispatch({ type: 'signed-out' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      // A request that was already in flight when the user signed out can still 401 afterwards;
      // that isn't an expiry, so don't announce one.
      if (statusRef.current !== 'authenticated') return
      queryClient.clear()
      dispatch({ type: 'signed-out' })
      toast.info('Your session expired. Please sign in again.')
    })
    return () => setSessionExpiredHandler(null)
  }, [queryClient])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const { user } = await authApi.login(credentials)
      queryClient.clear()
      dispatch({ type: 'signed-in', user })
      return user
    },
    [queryClient],
  )

  const signup = useCallback(
    async (details: SignupRequest) => {
      await authApi.signup(details)
      return login({ email: details.email, password: details.password })
    },
    [login],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      queryClient.clear()
      dispatch({ type: 'signed-out' })
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, user: state.user, login, signup, logout }),
    [state.status, state.user, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
