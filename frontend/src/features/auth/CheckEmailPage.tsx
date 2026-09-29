import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/routes'
import { emailRequestErrorMessage } from './authErrors'
import { emailOnlySchema, type EmailOnlyValues } from './authSchemas'
import { useCooldown, useResendVerification } from './useEmailLinks'

/** Seconds between resend clicks (UI_DESIGN.md §4), well inside the server's own rate limit. */
export const RESEND_COOLDOWN_SECONDS = 60

/** What the page is told on arrival: the address, and whether a link was just sent or sign-in was refused. */
export interface CheckEmailState {
  email?: string
  reason?: 'signed-up' | 'unverified'
}

/**
 * "Check your inbox", after signing up or after a sign-in refused for an unverified email. Offers to
 * resend the link. Opened with no address (e.g. from an expired link) it asks for one first.
 */
export function CheckEmailPage() {
  const state = (useLocation().state ?? {}) as CheckEmailState
  const [email, setEmail] = useState(state.email ?? '')
  const resend = useResendVerification()
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)

  async function sendTo(address: string) {
    try {
      await resend.mutateAsync(address)
      setEmail(address)
      cooldown.start()
      // Same words whether or not the address has an account: the server doesn't say either.
      toast.success('If that address needs verifying, a new link is on its way.')
    } catch (error) {
      toast.error(emailRequestErrorMessage(error))
    }
  }

  return (
    <AuthLayout
      title="Check your email"
      description={
        state.reason === 'unverified'
          ? 'Verify your email address to sign in.'
          : 'One more step: confirm your email address.'
      }
      footerText="Verified already?"
      footerLinkText="Sign in"
      footerLinkTo={ROUTES.login}
    >
      {email ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-sm">
            <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              {state.reason === 'unverified' ? 'We sent a verification link to ' : 'We sent a link to '}
              <span className="font-medium break-all">{email}</span>. Click it to activate your account — it
              works for 24 hours. Can't find it? Check your spam folder.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={resend.isPending || cooldown.remaining > 0}
            onClick={() => sendTo(email)}
          >
            {resend.isPending
              ? 'Sending…'
              : cooldown.remaining > 0
                ? `Resend email (${cooldown.remaining}s)`
                : 'Resend email'}
          </Button>
        </div>
      ) : (
        <ResendForm pending={resend.isPending} onSubmit={({ email: address }) => sendTo(address)} />
      )}
    </AuthLayout>
  )
}

function ResendForm({ pending, onSubmit }: { pending: boolean; onSubmit: (values: EmailOnlyValues) => void }) {
  const form = useForm<EmailOnlyValues>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: '' } })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <p className="text-sm text-muted-foreground">Enter your email and we'll send you a new verification link.</p>
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
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Sending…' : 'Send verification link'}
        </Button>
      </form>
    </Form>
  )
}
