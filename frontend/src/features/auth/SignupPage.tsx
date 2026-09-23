import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { detectTimezone } from '@/lib/timezone'
import { ROUTES } from '@/routes'
import { interpretSignupError } from './authErrors'
import { signupSchema, type SignupValues } from './authSchemas'
import { useAuth } from './useAuth'

export function SignupPage() {
  const { signup } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  async function onSubmit(values: SignupValues) {
    setFormError(null)
    try {
      // The timezone is not a form field: it's read from the browser and sent silently (UI_DESIGN.md §6).
      await signup({ ...values, timezone: detectTimezone() })
      // On success <PublicOnly> sees the new session and redirects.
    } catch (error) {
      const { fields, form: formMessage } = interpretSignupError(error)
      for (const [name, message] of Object.entries(fields)) {
        form.setError(name as keyof SignupValues, { type: 'server', message })
      }
      setFormError(formMessage)
    }
  }

  const { isSubmitting } = form.formState

  return (
    <AuthLayout
      title="Create your account"
      description="Organise your interview prep and never lose a topic to forgetting."
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkTo={ROUTES.login}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
