import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ApiError } from '@/api'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/routes'
import { emailRequestErrorMessage, isInvalidToken } from './authErrors'
import { resetPasswordSchema, type ResetPasswordValues } from './authSchemas'
import { EmailLinkResult } from './EmailLinkResult'
import { useLinkToken, useResetPassword } from './useEmailLinks'

/** Where the emailed reset link lands: choose a new password, then sign in with it. */
export function ResetPasswordPage() {
  const token = useLinkToken()
  const reset = useResetPassword()
  const navigate = useNavigate()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  async function onSubmit({ newPassword }: ResetPasswordValues) {
    if (!token) return
    try {
      await reset.mutateAsync({ token, newPassword })
      toast.success('Password updated. Sign in with your new password.')
      navigate(ROUTES.login, { replace: true })
    } catch (error) {
      const serverMessage = error instanceof ApiError ? error.fieldErrors.newPassword : undefined
      if (serverMessage) {
        form.setError('newPassword', { type: 'server', message: serverMessage })
      }
    }
  }

  const linkIsBad = !token || isInvalidToken(reset.error)
  // Field errors are shown on the field; anything else (rate limit, offline) above the form.
  const formError =
    reset.isError && !linkIsBad && !(reset.error instanceof ApiError && reset.error.fieldErrors.newPassword)
      ? emailRequestErrorMessage(reset.error)
      : null

  return (
    <AuthLayout
      title="Choose a new password"
      description="Setting a new password signs you out on every device."
      footerText="Remembered it?"
      footerLinkText="Sign in"
      footerLinkTo={ROUTES.login}
    >
      {linkIsBad ? (
        <EmailLinkResult
          status="error"
          title="This link is invalid or has expired"
          actions={
            <Button asChild>
              <Link to={ROUTES.forgotPassword}>Request a new link</Link>
            </Button>
          }
        >
          Reset links work once, for 30 minutes.
        </EmailLinkResult>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending ? 'Saving…' : 'Set new password'}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  )
}
