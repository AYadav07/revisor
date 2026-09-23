import { describe, expect, it } from 'vitest'
import { loginSchema, signupSchema } from './authSchemas'

function messages(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))
}

describe('loginSchema', () => {
  it('accepts a normal login and trims the email', () => {
    const result = loginSchema.safeParse({ email: '  ann@example.com ', password: 'pw' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ email: 'ann@example.com', password: 'pw' })
  })

  it('does not trim the password — spaces are legitimate password characters', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: ' pw ' }).password).toBe(' pw ')
  })

  it('requires a valid email and a password', () => {
    expect(messages(loginSchema.safeParse({ email: 'nope', password: '' }))).toEqual({
      email: 'Enter a valid email address',
      password: 'Password is required',
    })
  })
})

describe('signupSchema', () => {
  const valid = { name: 'Ann', email: 'ann@example.com', password: 'correct-horse' }

  it('accepts a valid signup', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a name, ignoring whitespace-only ones', () => {
    expect(messages(signupSchema.safeParse({ ...valid, name: '   ' }))).toEqual({ name: 'Name is required' })
  })

  it('enforces the backend minimum of 8 characters', () => {
    expect(signupSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false)
    expect(signupSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true)
  })

  it('caps the password at 72 BYTES, since BCrypt ignores everything past that', () => {
    expect(signupSchema.safeParse({ ...valid, password: 'a'.repeat(72) }).success).toBe(true)
    expect(signupSchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success).toBe(false)
    // 20 emoji: only 40 UTF-16 characters (under the backend's 72-char limit) but 80 bytes.
    expect(messages(signupSchema.safeParse({ ...valid, password: '😀'.repeat(20) }))).toEqual({
      password: 'Password is too long (at most 72 bytes)',
    })
  })

  it('enforces the backend maximums on name and email', () => {
    expect(signupSchema.safeParse({ ...valid, name: 'n'.repeat(256) }).success).toBe(false)
    expect(signupSchema.safeParse({ ...valid, email: `${'e'.repeat(250)}@example.com` }).success).toBe(false)
  })
})
