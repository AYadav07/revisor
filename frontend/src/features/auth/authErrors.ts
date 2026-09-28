import { ApiError } from '@/api'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/** Whether an API error is the given Problem Details type, e.g. `email-not-verified` (API.md). */
function hasProblemType(error: unknown, slug: string): boolean {
  return error instanceof ApiError && (error.problem?.type ?? '').endsWith(`/errors/${slug}`)
}

/** Right password, but the email isn't verified yet (403). The user should be sent to /check-email. */
export function isEmailNotVerified(error: unknown): boolean {
  return hasProblemType(error, 'email-not-verified')
}

/** An emailed link that is unknown, expired or already used (400). */
export function isInvalidToken(error: unknown): boolean {
  return hasProblemType(error, 'invalid-token')
}

/**
 * What to say when a request about an emailed link fails for a reason other than a bad link:
 * rate limiting and connectivity messages already explain themselves.
 */
export function emailRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 0 || error.status === 429)) {
    return error.message
  }
  return GENERIC_MESSAGE
}

/** What to tell a user whose sign-in attempt failed. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // Deliberately vague, like the server: a wrong password, an unknown email and a disabled
      // account all look the same, so this can't be used to probe which emails have accounts.
      return 'Invalid email or password.'
    }
    // Unreachable server, or rate limited: the message already says what happened (and, for 429,
    // how long to wait).
    if (error.status === 0 || error.status === 429) {
      return error.message
    }
  }
  return GENERIC_MESSAGE
}

export type SignupField = 'name' | 'email' | 'password'

export interface SignupErrors {
  /** Messages to show against specific form fields. */
  fields: Partial<Record<SignupField, string>>
  /** A message for the form as a whole, or null if the field errors say it all. */
  form: string | null
}

const SIGNUP_FIELDS: readonly string[] = ['name', 'email', 'password'] satisfies SignupField[]

function isSignupField(field: string): field is SignupField {
  return SIGNUP_FIELDS.includes(field)
}

/** Sorts a failed signup into per-field messages and an overall message. */
export function interpretSignupError(error: unknown): SignupErrors {
  if (!(error instanceof ApiError)) {
    return { fields: {}, form: GENERIC_MESSAGE }
  }

  if (error.status === 409) {
    return { fields: { email: 'An account with this email already exists.' }, form: null }
  }

  if (error.status === 400) {
    const fields: SignupErrors['fields'] = {}
    const unmapped: string[] = []
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if (isSignupField(field)) {
        fields[field] = message
      } else {
        unmapped.push(message) // e.g. timezone: not something the user can fix on the form
      }
    }
    if (unmapped.length > 0) return { fields, form: unmapped.join(' ') }
    return { fields, form: Object.keys(fields).length > 0 ? null : error.message }
  }

  if (error.status === 0 || error.status === 429) {
    return { fields: {}, form: error.message }
  }
  return { fields: {}, form: GENERIC_MESSAGE }
}
