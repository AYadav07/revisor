import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { ann, authValue } from '@/test/auth'
import { AppShell } from './AppShell'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }))

const admin = { ...ann, id: 2, name: 'Root', email: 'root@example.com', role: 'ADMIN' as const }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

function renderShell(options: { path?: string; auth?: Partial<AuthContextValue> } = {}) {
  const auth = authValue({ status: 'authenticated', user: ann, ...options.auth })
  const view = () => (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[options.path ?? '/dashboard']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<p>dashboard page</p>} />
              <Route path="/courses" element={<p>courses page</p>} />
              <Route path="/admin/users" element={<p>admin page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>
  )
  const utils = render(view())
  return { user: userEvent.setup(), auth, utils, view }
}

const mainNav = () => screen.getByRole('navigation', { name: 'Main' })

describe('navigation', () => {
  it('shows the brand, linking home, and the shared links for a normal user', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'Revisor' })).toHaveAttribute('href', '/dashboard')
    expect(within(mainNav()).getAllByRole('link').map((link) => link.textContent)).toEqual(['Dashboard', 'Courses'])
  })

  it('adds the Admin link for an admin, and only for an admin', () => {
    renderShell({ auth: { user: admin } })

    expect(within(mainNav()).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin/users')
  })

  it('marks the current page, and only the current page', () => {
    renderShell({ path: '/courses' })

    expect(within(mainNav()).getByRole('link', { name: 'Courses' })).toHaveAttribute('aria-current', 'page')
    expect(within(mainNav()).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('navigates without leaving the shell', async () => {
    const { user } = renderShell()
    expect(screen.getByText('dashboard page')).toBeInTheDocument()

    await user.click(within(mainNav()).getByRole('link', { name: 'Courses' }))

    expect(screen.getByText('courses page')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })
})

describe('user menu', () => {
  it('shows who is signed in on the trigger, and their email once opened', async () => {
    const { user } = renderShell()

    await user.click(screen.getByRole('button', { name: 'Ann' }))

    expect(await screen.findByText('ann@example.com')).toBeInTheDocument()
  })

  it('offers Light, Dark and System, with System selected until the user chooses', async () => {
    const { user } = renderShell()

    await user.click(screen.getByRole('button', { name: 'Ann' }))

    expect(await screen.findByRole('menuitemradio', { name: 'System' })).toBeChecked()
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).not.toBeChecked()
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).not.toBeChecked()
  })

  it('applies the chosen theme as data-theme on <html> and remembers it in localStorage', async () => {
    const { user, utils, view } = renderShell()

    await user.click(screen.getByRole('button', { name: 'Ann' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    // A fresh page load restores it: same storage, new provider.
    utils.unmount()
    render(view())
    await user.click(screen.getByRole('button', { name: 'Ann' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('switches back to light', async () => {
    const { user } = renderShell()
    await user.click(screen.getByRole('button', { name: 'Ann' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }))

    await user.click(screen.getByRole('button', { name: 'Ann' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Light' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('signs out', async () => {
    const { user, auth } = renderShell()

    await user.click(screen.getByRole('button', { name: 'Ann' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('warns that the user may still be signed in when the server could not be reached', async () => {
    const logout = vi.fn().mockRejectedValue(new ApiError(0, 'offline'))
    const { user } = renderShell({ auth: { logout } })

    await user.click(screen.getByRole('button', { name: 'Ann' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't reach the server, so you may still be signed in."),
    )
  })

  it('renders no menu at all when nobody is signed in', () => {
    renderShell({ auth: { status: 'unauthenticated', user: null } })

    expect(screen.queryByRole('button', { name: 'Ann' })).not.toBeInTheDocument()
  })
})
