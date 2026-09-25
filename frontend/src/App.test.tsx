import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, authApi } from '@/api'
import { ann } from '@/test/auth'
import App from './App'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    authApi: { signup: vi.fn(), login: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
  }
})
vi.mock('@/lib/timezone', () => ({ detectTimezone: () => 'Asia/Kolkata' }))

const api = vi.mocked(authApi)

beforeEach(() => {
  vi.clearAllMocks()
  api.refresh.mockRejectedValue(new ApiError(401, 'no session'))
})

function renderApp(path: string, options: { strict?: boolean } = {}) {
  const tree = (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(options.strict ? <StrictMode>{tree}</StrictMode> : tree)
  return userEvent.setup()
}

const signInHeading = () => screen.findByText('Sign in', { selector: '[data-slot="card-title"]' })
const dashboardHeading = () => screen.findByText('Dashboard', { selector: '[data-slot="card-title"]' })

describe('routing and the sign-in journey', () => {
  it('sends a signed-out visitor from a protected page to /login', async () => {
    renderApp('/dashboard')

    expect(await signInHeading()).toBeInTheDocument()
  })

  it('sends any unknown URL through the same door', async () => {
    renderApp('/no/such/page')

    expect(await signInHeading()).toBeInTheDocument()
  })

  it('shows a returning user their dashboard straight away, restoring the session from the cookie', async () => {
    api.refresh.mockResolvedValue({ user: ann })

    renderApp('/dashboard')

    expect(await dashboardHeading()).toBeInTheDocument()
    // Who you're signed in as lives in the shell's user menu.
    expect(screen.getByRole('button', { name: 'Ann' })).toBeInTheDocument()
  })

  it('keeps a signed-in user off the login and signup pages', async () => {
    api.refresh.mockResolvedValue({ user: ann })

    renderApp('/login')

    expect(await dashboardHeading()).toBeInTheDocument()
  })

  it('logs in and lands on the dashboard', async () => {
    api.login.mockResolvedValue({ user: ann })
    const user = renderApp('/login')
    await signInHeading()

    await user.type(screen.getByLabelText('Email'), 'ann@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await dashboardHeading()).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'correct-horse' })
  })

  it('creates an account, signs in with it, and lands on the dashboard — sending the browser timezone', async () => {
    api.signup.mockResolvedValue(ann)
    api.login.mockResolvedValue({ user: ann })
    const user = renderApp('/signup')
    await screen.findByText('Create your account')

    await user.type(screen.getByLabelText('Name'), 'Ann')
    await user.type(screen.getByLabelText('Email'), 'ann@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await dashboardHeading()).toBeInTheDocument()
    expect(api.signup).toHaveBeenCalledWith({
      name: 'Ann',
      email: 'ann@example.com',
      password: 'correct-horse',
      timezone: 'Asia/Kolkata',
    })
    expect(api.login).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'correct-horse' })
  })

  it('stays on the login page and explains a failed sign-in', async () => {
    api.login.mockRejectedValue(new ApiError(401, 'Invalid credentials'))
    const user = renderApp('/login')
    await signInHeading()

    await user.type(screen.getByLabelText('Email'), 'ann@example.com')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard', { selector: '[data-slot="card-title"]' })).not.toBeInTheDocument()
  })

  it('signs out from the dashboard, returns to /login, and the next visit is signed out too', async () => {
    api.refresh.mockResolvedValue({ user: ann })
    api.logout.mockResolvedValue(undefined)
    const user = renderApp('/dashboard')
    await dashboardHeading()

    await user.click(screen.getByRole('button', { name: 'Ann' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await signInHeading()).toBeInTheDocument()
    expect(api.logout).toHaveBeenCalledTimes(1)
  })

  it('does not fire a second refresh under StrictMode — that would get the session revoked', async () => {
    api.refresh.mockResolvedValue({ user: ann })

    renderApp('/dashboard', { strict: true })

    await dashboardHeading()
    await waitFor(() => expect(api.refresh).toHaveBeenCalledTimes(1))
  })

  describe('the admin area', () => {
    const root = { ...ann, id: 2, name: 'Root', email: 'root@example.com', role: 'ADMIN' as const }

    it('is open to an admin, who also sees the Admin link', async () => {
      api.refresh.mockResolvedValue({ user: root })

      renderApp('/admin/users')

      expect(await screen.findByText('Users', { selector: '[data-slot="card-title"]' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
    })

    it('shows a normal user "Not authorized" inside the shell, with no Admin link to click', async () => {
      api.refresh.mockResolvedValue({ user: ann })

      renderApp('/admin/users')

      expect(await screen.findByText('Not authorized')).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    })

    it('sends a signed-out visitor to /login rather than showing "Not authorized"', async () => {
      renderApp('/admin/users')

      expect(await signInHeading()).toBeInTheDocument()
    })
  })
})
