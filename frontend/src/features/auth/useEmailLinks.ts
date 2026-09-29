import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authApi, type ResetPasswordRequest } from '@/api'

/** Redeems the token from an emailed verification link. */
export function useVerifyEmail() {
  return useMutation({ mutationFn: (token: string) => authApi.verifyEmail(token) })
}

/** Asks for another verification email. The server answers 202 whether or not the address exists. */
export function useResendVerification() {
  return useMutation({ mutationFn: (email: string) => authApi.resendVerification(email) })
}

/** Asks for a password reset email. The server answers 202 whether or not the address exists. */
export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) })
}

export function useResetPassword() {
  return useMutation({ mutationFn: (body: ResetPasswordRequest) => authApi.resetPassword(body) })
}

/**
 * The `?token=` of an emailed link, read once on arrival and then removed from the address bar,
 * so it doesn't linger in history or get copied along with the URL (SECURITY.md). Returns null
 * when the page was opened without one.
 */
export function useLinkToken(): string | null {
  const [searchParams, setSearchParams] = useSearchParams()
  // Captured on the first render only: stripping the URL below must not make the token disappear.
  const [token] = useState(() => searchParams.get('token'))

  useEffect(() => {
    if (searchParams.has('token')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  return token
}

/**
 * A countdown for "wait before trying again" buttons. `start()` begins a new wait; `remaining` is
 * the whole seconds left, 0 when the action is available.
 */
export function useCooldown(seconds: number) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endsAt === null) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= endsAt) {
        setEndsAt(null)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [endsAt])

  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))
  return {
    remaining,
    start: () => {
      const current = Date.now()
      setNow(current)
      setEndsAt(current + seconds * 1000)
    },
  }
}
