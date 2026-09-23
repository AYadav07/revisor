import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { authValue } from '@/test/auth'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { LoginPage } from './LoginPage'

function renderLogin(auth: AuthContextValue = authValue()) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { user: userEvent.setup(), auth }
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
  it('renders the form and a link to sign up', () => {
    renderLogin()

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
  })

  it('validates before sending anything', async () => {
    const { user, auth } = renderLogin()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('rejects a malformed email', async () => {
    const { user, auth } = renderLogin()

    await fillAndSubmit(user, 'not-an-email', 'pw')

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('submits the trimmed email and the password as typed', async () => {
    const { user, auth } = renderLogin()

    await fillAndSubmit(user, '  ann@example.com ', ' pw ')

    await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(1))
    expect(auth.login).toHaveBeenCalledWith({ email: 'ann@example.com', password: ' pw ' })
  })

  it('shows one vague message for bad credentials, and keeps what the user typed', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError(401, 'Invalid credentials'))
    const { user } = renderLogin(authValue({ login }))

    await fillAndSubmit(user, 'ann@example.com', 'wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByLabelText('Email')).toHaveValue('ann@example.com')
  })

  it('shows the rate-limit message from the server', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError(429, 'Too many attempts. Try again in 899 seconds.'))
    const { user } = renderLogin(authValue({ login }))

    await fillAndSubmit(user, 'ann@example.com', 'pw')

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 899 seconds.')
  })

  it('clears a previous error when the user tries again', async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(401, 'x'))
      .mockImplementationOnce(() => new Promise(() => {})) // second attempt hangs
    const { user } = renderLogin(authValue({ login }))
    await fillAndSubmit(user, 'ann@example.com', 'wrong')
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('disables the button and says so while signing in, so a double-click cannot double-submit', async () => {
    const login = vi.fn().mockImplementation(() => new Promise(() => {})) // never settles
    const { user } = renderLogin(authValue({ login }))

    await fillAndSubmit(user, 'ann@example.com', 'pw')

    const button = await screen.findByRole('button', { name: 'Signing in…' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(login).toHaveBeenCalledTimes(1)
  })
})
