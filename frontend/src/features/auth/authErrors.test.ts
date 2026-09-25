import { describe, expect, it } from 'vitest'
import { ApiError, type ProblemDetail } from '@/api'
import { interpretSignupError, loginErrorMessage } from './authErrors'

function apiError(status: number, message = 'server message', errors?: ProblemDetail['errors']): ApiError {
  const problem: ProblemDetail = { type: 't', title: 'T', status, detail: message, instance: '/x', errors }
  return new ApiError(status, message, problem)
}

describe('loginErrorMessage', () => {
  it('gives one vague message for 401, whatever the server said', () => {
    expect(loginErrorMessage(apiError(401, 'Invalid credentials'))).toBe('Invalid email or password.')
  })

  it('passes through the server message for rate limiting and for an unreachable server', () => {
    expect(loginErrorMessage(apiError(429, 'Too many attempts. Try again in 899 seconds.'))).toBe(
      'Too many attempts. Try again in 899 seconds.',
    )
    expect(loginErrorMessage(new ApiError(0, 'Could not reach the server.'))).toBe('Could not reach the server.')
  })

  it('uses a generic message for anything else', () => {
    expect(loginErrorMessage(apiError(500))).toBe('Something went wrong. Please try again.')
    expect(loginErrorMessage(new TypeError('boom'))).toBe('Something went wrong. Please try again.')
  })
})

describe('interpretSignupError', () => {
  it('turns a 409 into a message on the email field', () => {
    expect(interpretSignupError(apiError(409))).toEqual({
      fields: { email: 'An account with this email already exists.' },
      form: null,
    })
  })

  it('maps server validation errors onto their form fields', () => {
    const error = apiError(400, 'invalid', [
      { field: 'password', message: 'size must be between 8 and 72' },
      { field: 'email', message: 'must be a well-formed email address' },
    ])

    expect(interpretSignupError(error)).toEqual({
      fields: { password: 'size must be between 8 and 72', email: 'must be a well-formed email address' },
      form: null,
    })
  })

  it('shows errors for fields that are not on the form (timezone) at the form level', () => {
    const error = apiError(400, 'invalid', [
      { field: 'timezone', message: 'must be a valid IANA timezone id' },
      { field: 'name', message: 'must not be blank' },
    ])

    expect(interpretSignupError(error)).toEqual({
      fields: { name: 'must not be blank' },
      form: 'must be a valid IANA timezone id',
    })
  })

  it('falls back to the server message for a 400 with no field detail', () => {
    expect(interpretSignupError(apiError(400, 'Bad request'))).toEqual({ fields: {}, form: 'Bad request' })
  })

  it('passes through rate-limit and connectivity messages, and is generic otherwise', () => {
    expect(interpretSignupError(apiError(429, 'Too many attempts.')).form).toBe('Too many attempts.')
    expect(interpretSignupError(new ApiError(0, 'Offline.')).form).toBe('Offline.')
    expect(interpretSignupError(apiError(503)).form).toBe('Something went wrong. Please try again.')
    expect(interpretSignupError('weird').form).toBe('Something went wrong. Please try again.')
  })
})
