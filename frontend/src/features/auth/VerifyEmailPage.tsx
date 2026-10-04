import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/routes'
import { emailRequestErrorMessage, isInvalidToken } from './authErrors'
import { EmailLinkResult } from './EmailLinkResult'
import { useLinkToken, useVerifyEmail } from './useEmailLinks'

/**
 * Where the emailed verification link lands. The link points here, not at the API, and this page
 * POSTs the token — email scanners prefetch links, which would burn a token redeemed by a GET
 * (SECURITY.md).
 */
export function VerifyEmailPage() {
  const token = useLinkToken()
  const verify = useVerifyEmail()
  // Once only: StrictMode runs effects twice in development, and a second POST would find the
  // token already used and show a false failure.
  const sent = useRef(false)

  useEffect(() => {
    if (token && !sent.current) {
      sent.current = true
      verify.mutate(token)
    }
  }, [token, verify])

  return (
    <AuthLayout
      title="Verify your email"
      description="Confirming the link from your inbox."
      footerText="Need help?"
      footerLinkText="Back to sign in"
      footerLinkTo={ROUTES.login}
    >
      {!token || verify.isError ? (
        <EmailLinkResult
          status="error"
          title={!token || isInvalidToken(verify.error) ? 'This link is invalid or has expired' : "We couldn't verify your email"}
          actions={
            <>
              <Button asChild>
                <Link to={ROUTES.checkEmail}>Send a new link</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={ROUTES.login}>Sign in</Link>
              </Button>
            </>
          }
        >
          {!token || isInvalidToken(verify.error)
            ? 'Links work once and for 24 hours. If you already verified, just sign in.'
            : emailRequestErrorMessage(verify.error)}
        </EmailLinkResult>
      ) : verify.isSuccess ? (
        <EmailLinkResult
          status="success"
          title="Email verified"
          actions={
            <Button asChild>
              <Link to={ROUTES.login}>Sign in</Link>
            </Button>
          }
        >
          Your account is ready. Sign in to start revising.
        </EmailLinkResult>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Verifying your email…
        </p>
      )}
    </AuthLayout>
  )
}
