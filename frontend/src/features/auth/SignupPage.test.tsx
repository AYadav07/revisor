import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type ProblemDetail } from '@/api'
import { authValue } from '@/test/auth'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { SignupPage } from './SignupPage'

vi.mock('@/lib/timezone', () => ({ detectTimezone: () => 'Asia/Kolkata' }))

function renderSignup(auth: AuthContextValue = authValue()) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { user: userEvent.setup(), auth }
}

async function fill(user: ReturnType<typeof userEvent.setup>, name: string, email: string, password: string) {
  if (name) await user.type(screen.getByLabelText('Name'), name)
  if (email) await user.type(screen.getByLabelText('Email'), email)
  if (password) await user.type(screen.getByLabelText('Password'), password)
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Create account' }))

function serverError(status: number, errors?: ProblemDetail['errors']): ApiError {
  return new ApiError(status, 'server message', { type: 't', title: 'T', status, detail: 'server message', instance: '/x', errors })
}

describe('SignupPage', () => {
  it('renders name, email and password — and no timezone field', () => {
    renderSignup()

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.queryByLabelText(/time ?zone/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('validates every field before sending anything', async () => {
    const { user, auth } = renderSignup()

    await submit(user)

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(auth.signup).not.toHaveBeenCalled()
  })

  it('rejects a password over BCrypt’s 72-byte limit even when it is under 72 characters', async () => {
    const { user, auth } = renderSignup()

    await fill(user, 'Ann', 'ann@example.com', '😀'.repeat(20))
    await submit(user)

    expect(await screen.findByText('Password is too long (at most 72 bytes)')).toBeInTheDocument()
    expect(auth.signup).not.toHaveBeenCalled()
  })

  it('sends the details plus the browser timezone, which is never shown to the user', async () => {
    const { user, auth } = renderSignup()

    await fill(user, '  Ann ', 'ann@example.com', 'correct-horse')
    await submit(user)

    await waitFor(() => expect(auth.signup).toHaveBeenCalledTimes(1))
    expect(auth.signup).toHaveBeenCalledWith({
      name: 'Ann',
      email: 'ann@example.com',
      password: 'correct-horse',
      timezone: 'Asia/Kolkata',
    })
  })

  it('puts a duplicate-email error on the email field itself', async () => {
    const signup = vi.fn().mockRejectedValue(serverError(409))
    const { user } = renderSignup(authValue({ signup }))

    await fill(user, 'Ann', 'ann@example.com', 'correct-horse')
    await submit(user)

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('maps server-side validation errors onto their fields', async () => {
    const signup = vi
      .fn()
      .mockRejectedValue(serverError(400, [{ field: 'password', message: 'size must be between 8 and 72' }]))
    const { user } = renderSignup(authValue({ signup }))

    await fill(user, 'Ann', 'ann@example.com', 'correct-horse')
    await submit(user)

    expect(await screen.findByText('size must be between 8 and 72')).toBeInTheDocument()
  })

  it('shows problems the user cannot fix on the form (like a bad timezone) as a form-level alert', async () => {
    const signup = vi
      .fn()
      .mockRejectedValue(serverError(400, [{ field: 'timezone', message: 'must be a valid IANA timezone id' }]))
    const { user } = renderSignup(authValue({ signup }))

    await fill(user, 'Ann', 'ann@example.com', 'correct-horse')
    await submit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('must be a valid IANA timezone id')
  })

  it('shows rate limiting as a form-level alert', async () => {
    const signup = vi.fn().mockRejectedValue(new ApiError(429, 'Too many attempts. Try again in 3599 seconds.'))
    const { user } = renderSignup(authValue({ signup }))

    await fill(user, 'Ann', 'ann@example.com', 'correct-horse')
    await submit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 3599 seconds.')
  })

  it('disables the button while creating the account', async () => {
    const signup = vi.fn().mockImplementation(() => new Promise(() => {}))
    const { user } = renderSignup(authValue({ signup }))

    await fill(user, 'Ann', 'ann@example.com', 'correct-horse')
    await submit(user)

    expect(await screen.findByRole('button', { name: 'Creating account…' })).toBeDisabled()
  })
})
