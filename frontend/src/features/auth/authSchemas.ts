import { z } from 'zod'

/**
 * Client-side validation for the auth forms. Mirrors the backend's Bean Validation on
 * SignupRequest/LoginRequest in intent (UI_DESIGN.md §6): the server stays the authority, this
 * just saves a round trip and gives instant feedback.
 */

const email = z
  .string()
  .trim()
  .pipe(z.email('Enter a valid email address').max(255, 'Email must be at most 255 characters'))

// BCrypt only reads the first 72 *bytes* of a password. The backend caps length at 72 characters,
// which lets a string of multi-byte characters slip past it, so cap bytes here.
const MAX_PASSWORD_BYTES = 72

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, {
      message: `Password is too long (at most ${MAX_PASSWORD_BYTES} bytes)`,
    }),
})

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
