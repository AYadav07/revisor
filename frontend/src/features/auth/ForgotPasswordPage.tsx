import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/routes'
import { emailRequestErrorMessage } from './authErrors'
import { emailOnlySchema, type EmailOnlyValues } from './authSchemas'
import { EmailLinkResult } from './EmailLinkResult'
import { useForgotPassword } from './useEmailLinks'

/**
 * Requests a reset link. The confirmation is the same whether or not the address has an account —
 * the API answers 202 either way, so this page can't be used to find out who has signed up.
 */
export function ForgotPasswordPage() {
  const forgot = useForgotPassword()
  const form = useForm<EmailOnlyValues>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: '' } })

  return (
    <AuthLayout
      title="Forgot your password?"
      description="We'll email you a link to choose a new one."
      footerText="Remembered it?"
      footerLinkText="Sign in"
      footerLinkTo={ROUTES.login}
    >
      {forgot.isSuccess ? (
        <EmailLinkResult
          status="success"
          title="Check your email"
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.login}>Back to sign in</Link>
            </Button>
          }
        >
          If an account exists for <span className="font-medium break-all">{forgot.variables}</span>, we've sent a link
          to reset its password. It works once, for 30 minutes.
        </EmailLinkResult>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(({ email }) => forgot.mutate(email))} noValidate className="space-y-4">
            {forgot.isError && (
              <Alert variant="destructive">
                <AlertDescription>{emailRequestErrorMessage(forgot.error)}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  )
}
