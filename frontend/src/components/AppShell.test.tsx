import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { lazy, type ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, dashboardApi } from '@/api'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { ann, authValue } from '@/test/auth'
import { createTestQueryClient } from '@/test/render'
import { AppShell } from './AppShell'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, dashboardApi: { summary: vi.fn(), progress: vi.fn(), due: vi.fn() } }
})

const dashboard = vi.mocked(dashboardApi)

const admin = { ...ann, id: 2, name: 'Root', email: 'root@example.com', role: 'ADMIN' as const }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  dashboard.summary.mockResolvedValue({ dueToday: 0, overdue: 0, totalLearned: 4 })
  dashboard.progress.mockResolvedValue([
    { courseId: 1, courseTitle: 'System Design', learnedCount: 4, totalCount: 9 },
    { courseId: 2, courseTitle: 'DSA', learnedCount: 0, totalCount: 0 },
  ])
})

function renderShell(options: { path?: string; auth?: Partial<AuthContextValue>; page?: ReactElement } = {}) {
  const auth = authValue({ status: 'authenticated', user: ann, ...options.auth })
  const queryClient = createTestQueryClient()
  const view = () => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={[options.path ?? '/dashboard']}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={options.page ?? <p>dashboard page</p>} />
                <Route path="/courses" element={<p>courses page</p>} />
                <Route path="/courses/:id" element={<p>course page</p>} />
                <Route path="/admin/users" element={<p>admin page</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
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

describe('sidebar courses', () => {
  it('lists every course with how much of it is learned, linking to it', async () => {
    renderShell()
    const courses = screen.getByRole('region', { name: 'Your courses' })

    const systemDesign = await within(courses).findByRole('link', { name: /System Design/ })
    expect(systemDesign).toHaveAttribute('href', '/courses/1')
    expect(systemDesign).toHaveTextContent('4/9')
    expect(within(courses).getByRole('link', { name: /DSA/ })).toHaveTextContent('0/0')
  })

  it('marks the course being viewed', async () => {
    renderShell({ path: '/courses/1' })
    const courses = screen.getByRole('region', { name: 'Your courses' })

    expect(await within(courses).findByRole('link', { name: /System Design/ })).toHaveAttribute('aria-current', 'page')
    expect(within(courses).getByRole('link', { name: /DSA/ })).not.toHaveAttribute('aria-current')
  })

  it('says so when there are no courses yet', async () => {
    dashboard.progress.mockResolvedValue([])
    renderShell()

    expect(await screen.findByText('No courses yet.')).toBeInTheDocument()
  })
})

describe('due count', () => {
  it('badges Dashboard with everything reviewable now', async () => {
    dashboard.summary.mockResolvedValue({ dueToday: 2, overdue: 1, totalLearned: 4 })
    renderShell()

    expect(await within(mainNav()).findByRole('link', { name: 'Dashboard, 3 due' })).toBeInTheDocument()
  })
})

describe('menu on small screens', () => {
  it('opens the same navigation in a sheet, and closes it once a link is followed', async () => {
    const { user } = renderShell()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    await user.click(within(within(sheet).getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Courses' }))

    expect(await screen.findByText('courses page')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
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

describe('pages that load on demand', () => {
  it('keeps the navigation on screen with a placeholder while a page loads, then shows the page', async () => {
    let finish: (module: { default: () => ReactElement }) => void = () => {}
    const Lazy = lazy(() => new Promise<{ default: () => ReactElement }>((resolve) => (finish = resolve)))
    renderShell({ page: <Lazy /> })

    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument()
    expect(mainNav()).toBeInTheDocument()

    finish({ default: () => <p>loaded page</p> })

    expect(await screen.findByText('loaded page')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument()
  })

  it('contains a page that fails to load: message shown, navigation intact', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    renderShell({ page: <Broken /> })

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(mainNav()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
  })

  it('lets the user navigate away from a failed page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = lazy(() => Promise.reject(new Error('nope')))
    const { user } = renderShell({ page: <Broken /> })
    await screen.findByText('Something went wrong')

    await user.click(within(mainNav()).getByRole('link', { name: 'Courses' }))

    expect(await screen.findByText('courses page')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
