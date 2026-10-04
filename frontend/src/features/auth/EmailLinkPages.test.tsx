import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, authApi, type ProblemDetail } from '@/api'
import { LocationProbe } from '@/test/LocationProbe'
import { createTestQueryClient } from '@/test/render'
import { CheckEmailPage, RESEND_COOLDOWN_SECONDS } from './CheckEmailPage'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { ResetPasswordPage } from './ResetPasswordPage'
import { VerifyEmailPage } from './VerifyEmailPage'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    },
  }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(authApi)

function problem(status: number, slug: string, errors?: ProblemDetail['errors']): ApiError {
  const body: ProblemDetail = {
    type: `https://revisor.aydev.in/errors/${slug}`,
    title: slug,
    status,
    detail: `server says ${slug}`,
    instance: '/api/v1/auth/x',
    errors,
  }
  return new ApiError(status, body.detail, body)
}

function renderAt(path: string, element: ReactElement, state?: unknown) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
        <Routes>
          <Route path={path.split('?')[0]} element={element} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup() }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VerifyEmailPage', () => {
  it('posts the token from the link once, strips it from the address bar, and confirms', async () => {
    api.verifyEmail.mockResolvedValue(undefined)
    renderAt('/verify-email?token=abc123', <VerifyEmailPage />)

    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(api.verifyEmail).toHaveBeenCalledTimes(1)
    expect(api.verifyEmail).toHaveBeenCalledWith('abc123')
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/verify-email$/)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('explains an invalid or expired link and offers a new one', async () => {
    api.verifyEmail.mockRejectedValue(problem(400, 'invalid-token'))
    renderAt('/verify-email?token=used', <VerifyEmailPage />)

    expect(await screen.findByText('This link is invalid or has expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', '/check-email')
  })

  it('without a token, says the link is invalid and calls nothing', () => {
    renderAt('/verify-email', <VerifyEmailPage />)

    expect(screen.getByText('This link is invalid or has expired')).toBeInTheDocument()
    expect(api.verifyEmail).not.toHaveBeenCalled()
  })

  it('passes through a rate-limit message rather than blaming the link', async () => {
    api.verifyEmail.mockRejectedValue(new ApiError(429, 'Too many attempts. Try again in 60 seconds.'))
    renderAt('/verify-email?token=abc', <VerifyEmailPage />)

    expect(await screen.findByText("We couldn't verify your email")).toBeInTheDocument()
    expect(screen.getByText('Too many attempts. Try again in 60 seconds.')).toBeInTheDocument()
  })
})

describe('CheckEmailPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows where the link went, and resends with a cooldown between clicks', async () => {
    api.resendVerification.mockResolvedValue(undefined)
    const { user } = renderAt('/check-email', <CheckEmailPage />, { email: 'ann@example.com', reason: 'signed-up' })

    expect(screen.getByText('ann@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resend email' }))

    expect(api.resendVerification).toHaveBeenCalledWith('ann@example.com')
    expect(toast.success).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: `Resend email (${RESEND_COOLDOWN_SECONDS}s)` })).toBeDisabled()
  })

  it('re-enables the resend button once the cooldown has passed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.resendVerification.mockResolvedValue(undefined)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={[{ pathname: '/check-email', state: { email: 'ann@example.com' } }]}>
          <CheckEmailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Resend email' }))
    await screen.findByRole('button', { name: /Resend email \(\d+s\)/ })

    await act(() => vi.advanceTimersByTimeAsync((RESEND_COOLDOWN_SECONDS + 1) * 1000))

    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled()
  })

  it('tells the user when resending is rate limited', async () => {
    api.resendVerification.mockRejectedValue(new ApiError(429, 'Too many attempts. Try again in 3600 seconds.'))
    const { user } = renderAt('/check-email', <CheckEmailPage />, { email: 'ann@example.com', reason: 'unverified' })

    await user.click(screen.getByRole('button', { name: 'Resend email' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many attempts. Try again in 3600 seconds.'))
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled()
  })

  it('asks for the address when opened without one', async () => {
    api.resendVerification.mockResolvedValue(undefined)
    const { user } = renderAt('/check-email', <CheckEmailPage />)

    await user.type(screen.getByLabelText('Email'), ' ann@example.com ')
    await user.click(screen.getByRole('button', { name: 'Send verification link' }))

    await waitFor(() => expect(api.resendVerification).toHaveBeenCalledWith('ann@example.com'))
    expect(await screen.findByText('ann@example.com')).toBeInTheDocument()
  })
})

describe('ForgotPasswordPage', () => {
  it('shows the same confirmation whatever the address, since the server never says whether it exists', async () => {
    api.forgotPassword.mockResolvedValue(undefined)
    const { user } = renderAt('/forgot-password', <ForgotPasswordPage />)

    await user.type(screen.getByLabelText('Email'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText(/If an account exists for/)).toHaveTextContent('someone@example.com')
    expect(api.forgotPassword).toHaveBeenCalledWith('someone@example.com')
  })

  it('validates the address before sending', async () => {
    const { user } = renderAt('/forgot-password', <ForgotPasswordPage />)

    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(api.forgotPassword).not.toHaveBeenCalled()
  })

  it('shows a rate-limit message and keeps the form', async () => {
    api.forgotPassword.mockRejectedValue(new ApiError(429, 'Too many attempts. Try again in 3600 seconds.'))
    const { user } = renderAt('/forgot-password', <ForgotPasswordPage />)

    await user.type(screen.getByLabelText('Email'), 'ann@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 3600 seconds.')
    expect(screen.getByLabelText('Email')).toHaveValue('ann@example.com')
  })
})

describe('ResetPasswordPage', () => {
  async function choose(user: ReturnType<typeof userEvent.setup>, password: string, confirm: string) {
    await user.type(screen.getByLabelText('New password'), password)
    await user.type(screen.getByLabelText('Confirm new password'), confirm)
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
  }

  it('sends the token with the new password, then goes to sign in', async () => {
    api.resetPassword.mockResolvedValue(undefined)
    const { user } = renderAt('/reset-password?token=tok', <ResetPasswordPage />)
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/reset-password$/)

    await choose(user, 'battery-staple', 'battery-staple')

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'))
    expect(api.resetPassword).toHaveBeenCalledWith({ token: 'tok', newPassword: 'battery-staple' })
    expect(toast.success).toHaveBeenCalled()
  })

  it('checks the confirmation matches before sending', async () => {
    const { user } = renderAt('/reset-password?token=tok', <ResetPasswordPage />)

    await choose(user, 'battery-staple', 'battery-stable')

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(api.resetPassword).not.toHaveBeenCalled()
  })

  it('turns an expired or used link into a way to request a new one', async () => {
    api.resetPassword.mockRejectedValue(problem(400, 'invalid-token'))
    const { user } = renderAt('/reset-password?token=old', <ResetPasswordPage />)

    await choose(user, 'battery-staple', 'battery-staple')

    expect(await screen.findByText('This link is invalid or has expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('puts a server-side password policy error on the field', async () => {
    api.resetPassword.mockRejectedValue(
      problem(400, 'validation-failed', [{ field: 'newPassword', message: 'size must be between 8 and 72' }]),
    )
    const { user } = renderAt('/reset-password?token=tok', <ResetPasswordPage />)

    await choose(user, 'battery-staple', 'battery-staple')

    expect(await screen.findByText('size must be between 8 and 72')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('without a token, shows the invalid-link message instead of a form', () => {
    renderAt('/reset-password', <ResetPasswordPage />)

    expect(screen.getByText('This link is invalid or has expired')).toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
})
