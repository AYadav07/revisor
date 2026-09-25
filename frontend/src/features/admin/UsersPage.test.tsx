import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { focusManager, onlineManager, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminApi, ApiError, type AdminUser, type PageResponse, type UserCourseProgress } from '@/api'
import { AuthContext } from '@/features/auth/AuthContext'
import { ann, authValue } from '@/test/auth'
import { LocationProbe } from '@/test/LocationProbe'
import { createTestQueryClient } from '@/test/render'
import { adminKeys } from './queryKeys'
import { UsersPage } from './UsersPage'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    adminApi: { listUsers: vi.fn(), setUserEnabled: vi.fn(), deleteUser: vi.fn(), listUserCourses: vi.fn() },
  }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(adminApi)

const root: AdminUser = {
  id: 1,
  name: 'Root',
  email: 'root@example.com',
  role: 'ADMIN',
  enabled: true,
  timezone: 'UTC',
  createdAt: '2026-01-05T09:00:00Z',
}
const bob: AdminUser = { ...root, id: 2, name: 'Bob', email: 'bob@example.com', role: 'USER' }
const carol: AdminUser = { ...root, id: 3, name: 'Carol', email: 'carol@example.com', role: 'USER', enabled: false }

function pageOf<T>(content: T[], totalElements = content.length, page = 0): PageResponse<T> {
  return { content, page, size: 20, totalElements }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listUsers.mockResolvedValue(pageOf([root, bob, carol]))
  api.setUserEnabled.mockImplementation(async (id, enabled) => ({ ...bob, id, enabled }))
  api.deleteUser.mockResolvedValue(undefined)
  api.listUserCourses.mockResolvedValue(pageOf<UserCourseProgress>([]))
})

function renderPage(route = '/admin/users') {
  const queryClient = createTestQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue({ status: 'authenticated', user: { ...ann, id: 1, role: 'ADMIN' } })}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route
              path="/admin/users"
              element={
                <>
                  <UsersPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return { queryClient, user: userEvent.setup() }
}

const location = () => screen.getByTestId('location').textContent
const rowOf = async (name: string) => (await screen.findByRole('cell', { name: new RegExp(`^${name}`) })).closest('tr') as HTMLElement

describe('the list', () => {
  it('shows each user with role, status and join date', async () => {
    renderPage()

    const bobRow = await rowOf('Bob')
    expect(within(bobRow).getByText('bob@example.com')).toBeInTheDocument()
    expect(within(bobRow).getByText('User')).toBeInTheDocument()
    expect(within(bobRow).getByText('Active')).toBeInTheDocument()
    expect(within(bobRow).getByText(/Jan\D+5\D+2026/)).toBeInTheDocument()
    expect(within(await rowOf('Root')).getByText('Admin')).toBeInTheDocument()
    expect(within(await rowOf('Carol')).getByText('Disabled')).toBeInTheDocument()
  })

  it('asks for the first page, twenty at a time, with no search', async () => {
    renderPage()

    await rowOf('Bob')
    expect(api.listUsers).toHaveBeenCalledWith({ q: undefined, page: 0, size: 20 })
  })

  it('shows placeholders while loading', () => {
    api.listUsers.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading users' })).toBeInTheDocument()
  })

  it('offers a retry when it fails, and recovers', async () => {
    api.listUsers.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(pageOf([bob]))
    const { user } = renderPage()

    expect(await screen.findByText("Couldn't load users.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await rowOf('Bob')).toBeInTheDocument()
  })

  it('pages through a long list, keeping the page in the URL', async () => {
    api.listUsers.mockImplementation(async (params) => pageOf([{ ...bob, name: `Page${params?.page}` }], 45, params?.page ?? 0))
    const { user } = renderPage()
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(location()).toBe('/admin/users?page=2')
    expect(api.listUsers).toHaveBeenLastCalledWith({ q: undefined, page: 1, size: 20 })
  })

  it('opens on the page named in the URL', async () => {
    renderPage('/admin/users?page=3')

    await waitFor(() => expect(api.listUsers).toHaveBeenCalledWith({ q: undefined, page: 2, size: 20 }))
  })

  it('does not leave a blank table when the page is past the end', async () => {
    api.listUsers.mockImplementation(async (params) => ((params?.page ?? 0) === 0 ? pageOf([bob], 21) : pageOf([], 21, params?.page ?? 0)))
    const { user } = renderPage('/admin/users?page=2')

    expect(await screen.findByText('No users on this page')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to the first page' }))
    expect(await rowOf('Bob')).toBeInTheDocument()
    expect(location()).toBe('/admin/users')
  })
})

describe('audit log', () => {
  // Every admin GET is written to the audit log, so nothing may refetch behind the admin's back.
  it('does not refetch the list when the window regains focus or the connection returns', async () => {
    renderPage()
    await rowOf('Bob')
    expect(api.listUsers).toHaveBeenCalledTimes(1)

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(api.listUsers).toHaveBeenCalledTimes(1)
    focusManager.setFocused(undefined)
  })

  it("does not refetch a user's courses on focus either", async () => {
    const { user } = renderPage()
    await user.click(within(await rowOf('Bob')).getByRole('button', { name: "View Bob's courses" }))
    await screen.findByText('No courses')

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(api.listUserCourses).toHaveBeenCalledTimes(1)
    focusManager.setFocused(undefined)
  })
})

describe('search', () => {
  it('searches on submit and puts the search in the URL', async () => {
    const { user } = renderPage()
    await rowOf('Bob')

    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), '  bob  ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(api.listUsers).toHaveBeenLastCalledWith({ q: 'bob', page: 0, size: 20 }))
    expect(location()).toBe('/admin/users?q=bob')
  })

  it('does not search while typing — each search is an audited admin action', async () => {
    const { user } = renderPage()
    await rowOf('Bob')
    api.listUsers.mockClear()

    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'bob')

    expect(api.listUsers).not.toHaveBeenCalled()
  })

  it('opens on the search named in the URL, filled in', async () => {
    renderPage('/admin/users?q=ann')

    await waitFor(() => expect(api.listUsers).toHaveBeenCalledWith({ q: 'ann', page: 0, size: 20 }))
    expect(screen.getByRole('searchbox', { name: 'Search users' })).toHaveValue('ann')
  })

  it('a new search goes back to the first page', async () => {
    const { user } = renderPage('/admin/users?q=ann&page=3')
    await waitFor(() => expect(api.listUsers).toHaveBeenCalled())
    const box = screen.getByRole('searchbox', { name: 'Search users' })

    await user.clear(box)
    await user.type(box, 'bob')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(location()).toBe('/admin/users?q=bob'))
  })

  it('keeps the search when paging', async () => {
    api.listUsers.mockResolvedValue(pageOf([bob], 45))
    const { user } = renderPage('/admin/users?q=ann')
    await user.click(await screen.findByRole('button', { name: 'Next' }))

    expect(location()).toBe('/admin/users?q=ann&page=2')
    await waitFor(() => expect(api.listUsers).toHaveBeenLastCalledWith({ q: 'ann', page: 1, size: 20 }))
  })

  it('offers Clear only while a search is applied, and clear shows everyone again', async () => {
    const { user } = renderPage('/admin/users?q=ann')
    await waitFor(() => expect(api.listUsers).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(location()).toBe('/admin/users'))
    expect(screen.getByRole('searchbox', { name: 'Search users' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })

  it('has no Clear button without a search', async () => {
    renderPage()

    await rowOf('Bob')
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })

  it('says when nothing matches, and offers to clear the search', async () => {
    api.listUsers.mockResolvedValue(pageOf([]))
    const { user } = renderPage('/admin/users?q=zzz')

    expect(await screen.findByText('No matching users')).toBeInTheDocument()
    expect(screen.getByText('Nobody\'s name or email matches “zzz”.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => expect(location()).toBe('/admin/users'))
    // The box follows the URL, not just what was last typed into it.
    expect(screen.getByRole('searchbox', { name: 'Search users' })).toHaveValue('')
  })

  it('rejects an over-long search without asking the API', async () => {
    const { user } = renderPage()
    await rowOf('Bob')
    api.listUsers.mockClear()

    await user.click(screen.getByRole('searchbox', { name: 'Search users' }))
    await user.paste('a'.repeat(101))
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Search must be at most 100 characters')).toBeInTheDocument()
    expect(api.listUsers).not.toHaveBeenCalled()
  })
})

describe('what each row offers', () => {
  it("gives the admin's own row no disable or delete — the API would refuse them", async () => {
    renderPage()

    const own = await rowOf('Root')
    expect(within(own).getByText('(you)')).toBeInTheDocument()
    expect(within(own).queryByRole('button', { name: /Disable|Enable|Delete/ })).not.toBeInTheDocument()
    expect(within(own).getByRole('button', { name: /courses/ })).toBeInTheDocument()
  })

  it('lets you disable an active user but not delete them yet', async () => {
    renderPage()

    const row = await rowOf('Bob')
    expect(within(row).getByRole('button', { name: 'Disable Bob' })).toBeEnabled()
    expect(within(row).getByRole('button', { name: 'Disable Bob' })).toHaveTextContent(/^Disable$/)
    expect(within(row).getByRole('button', { name: 'Delete Bob' })).toBeDisabled()
  })

  it('tells admins from users at a glance', async () => {
    renderPage()

    expect(within(await rowOf('Root')).getByText('Admin')).toHaveClass('bg-primary')
    expect(within(await rowOf('Bob')).getByText('User')).toHaveClass('bg-secondary')
  })

  it('lets you re-enable or delete a disabled user', async () => {
    renderPage()

    const row = await rowOf('Carol')
    expect(within(row).getByRole('button', { name: 'Enable Carol' })).toBeEnabled()
    expect(within(row).getByRole('button', { name: 'Enable Carol' })).toHaveTextContent(/^Enable$/)
    expect(within(row).getByRole('button', { name: 'Delete Carol' })).toBeEnabled()
  })
})

describe('disabling and enabling', () => {
  it('disables a user, confirms, and refreshes the list', async () => {
    api.listUsers.mockResolvedValueOnce(pageOf([root, bob])).mockResolvedValue(pageOf([root, { ...bob, enabled: false }]))
    const { user } = renderPage()

    await user.click(within(await rowOf('Bob')).getByRole('button', { name: 'Disable Bob' }))

    await waitFor(() => expect(api.setUserEnabled).toHaveBeenCalledWith(2, false))
    expect(toast.success).toHaveBeenCalledWith('Disabled Bob')
    await waitFor(() => expect(within(screen.getByText('Bob').closest('tr')!).getByText('Disabled')).toBeInTheDocument())
  })

  it('re-enables a user', async () => {
    const { user } = renderPage()

    await user.click(within(await rowOf('Carol')).getByRole('button', { name: 'Enable Carol' }))

    await waitFor(() => expect(api.setUserEnabled).toHaveBeenCalledWith(3, true))
    expect(toast.success).toHaveBeenCalledWith('Enabled Carol')
  })

  it("locks only that user's button while the request runs", async () => {
    api.setUserEnabled.mockImplementation(() => new Promise(() => {}))
    const { user } = renderPage()

    await user.click(within(await rowOf('Bob')).getByRole('button', { name: 'Disable Bob' }))

    await waitFor(() => expect(within(screen.getByText('Bob').closest('tr')!).getByRole('button', { name: 'Disable Bob' })).toBeDisabled())
    expect(within(screen.getByText('Carol').closest('tr')!).getByRole('button', { name: 'Enable Carol' })).toBeEnabled()
  })

  it('refreshes the list when the user no longer exists (404)', async () => {
    api.setUserEnabled.mockRejectedValue(new ApiError(404, 'gone'))
    api.listUsers.mockResolvedValueOnce(pageOf([root, bob])).mockResolvedValue(pageOf([root]))
    const { user } = renderPage()

    await user.click(within(await rowOf('Bob')).getByRole('button', { name: 'Disable Bob' }))

    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument())
  })

  it('toasts an error and changes nothing when it fails', async () => {
    api.setUserEnabled.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()

    await user.click(within(await rowOf('Bob')).getByRole('button', { name: 'Disable Bob' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't update the user. Please try again."))
    expect(toast.success).not.toHaveBeenCalled()
    expect(within(await rowOf('Bob')).getByText('Active')).toBeInTheDocument()
  })
})

describe('deleting', () => {
  async function openDelete(user: ReturnType<typeof renderPage>['user'], name = 'Carol') {
    await user.click(within(await rowOf(name)).getByRole('button', { name: `Delete ${name}` }))
    return screen.findByRole('dialog')
  }

  it('says exactly what will be lost', async () => {
    const { user } = renderPage()

    const dialog = await openDelete(user)

    expect(within(dialog).getByRole('heading', { name: 'Delete Carol?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('permanently deletes carol@example.com and all of their courses, review history and sessions')
  })

  it('does nothing when cancelled', async () => {
    const { user } = renderPage()
    const dialog = await openDelete(user)

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.deleteUser).not.toHaveBeenCalled()
  })

  it('deletes, confirms, and refreshes the list', async () => {
    api.listUsers.mockResolvedValueOnce(pageOf([root, bob, carol])).mockResolvedValue(pageOf([root, bob]))
    const { user } = renderPage()
    const dialog = await openDelete(user)

    await user.click(within(dialog).getByRole('button', { name: 'Delete user' }))

    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith(3))
    expect(toast.success).toHaveBeenCalledWith('Deleted Carol')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText('Carol')).not.toBeInTheDocument())
  })

  it('explains a 409: they must be disabled first — and stays open', async () => {
    api.deleteUser.mockRejectedValue(new ApiError(409, 'not disabled'))
    const { user } = renderPage()
    const dialog = await openDelete(user)

    await user.click(within(dialog).getByRole('button', { name: 'Delete user' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("This user can't be deleted right now. They must be disabled first.")
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('shows a generic error for a server failure', async () => {
    api.deleteUser.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    const dialog = await openDelete(user)

    await user.click(within(dialog).getByRole('button', { name: 'Delete user' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't delete the user. Please try again.")
  })

  it('treats "already gone" (404) as done: closes quietly and refreshes the list', async () => {
    api.deleteUser.mockRejectedValue(new ApiError(404, 'gone'))
    api.listUsers.mockResolvedValueOnce(pageOf([root, bob, carol])).mockResolvedValue(pageOf([root, bob]))
    const { user } = renderPage()
    const dialog = await openDelete(user)

    await user.click(within(dialog).getByRole('button', { name: 'Delete user' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast.success).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Carol')).not.toBeInTheDocument())
  })

  it('does not remember a failure after cancelling', async () => {
    api.deleteUser.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    let dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete user' }))
    await within(dialog).findByRole('alert')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = await openDelete(user)

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe("viewing a user's courses", () => {
  const courses: UserCourseProgress[] = [
    { courseId: 5, title: 'System Design', description: 'Distributed systems', learnedCount: 2, totalCount: 5 },
    { courseId: 6, title: 'DSA', description: null, learnedCount: 0, totalCount: 0 },
  ]

  async function open(user: ReturnType<typeof renderPage>['user'], name = 'Bob') {
    await user.click(within(await rowOf(name)).getByRole('button', { name: `View ${name}'s courses` }))
    return screen.findByRole('dialog')
  }

  it("lists that user's courses with progress, read-only", async () => {
    api.listUserCourses.mockResolvedValue(pageOf(courses))
    const { user } = renderPage()

    const dialog = await open(user)

    expect(within(dialog).getByRole('heading', { name: "Bob's courses" })).toBeInTheDocument()
    expect(await within(dialog).findByText('System Design')).toBeInTheDocument()
    expect(within(dialog).getByText('Distributed systems')).toBeInTheDocument()
    expect(within(dialog).getByText('2 of 5 learned')).toBeInTheDocument()
    expect(within(dialog).getByRole('progressbar', { name: 'System Design progress' })).toHaveAttribute('aria-valuenow', '40')
    expect(within(dialog).getByRole('progressbar', { name: 'DSA progress' })).toHaveAttribute('aria-valuenow', '0')
    expect(api.listUserCourses).toHaveBeenCalledWith(2, { page: 0, size: 20 })
    expect(within(dialog).queryByRole('button', { name: /edit|delete|add/i })).not.toBeInTheDocument()
  })

  it('says when they have none', async () => {
    const { user } = renderPage()

    const dialog = await open(user)

    expect(await within(dialog).findByText('No courses')).toBeInTheDocument()
  })

  it('shows placeholders while loading', async () => {
    api.listUserCourses.mockImplementation(() => new Promise(() => {}))
    const { user } = renderPage()

    const dialog = await open(user)

    expect(within(dialog).getByRole('status', { name: 'Loading courses' })).toBeInTheDocument()
  })

  it('offers a retry when it fails', async () => {
    api.listUserCourses.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(pageOf(courses))
    const { user } = renderPage()
    const dialog = await open(user)

    expect(await within(dialog).findByText("Couldn't load their courses.")).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))

    expect(await within(dialog).findByText('System Design')).toBeInTheDocument()
  })

  it('pages through many courses, and starts on the first page each time it opens', async () => {
    api.listUserCourses.mockImplementation(async (_id, params) => pageOf([{ ...courses[0], title: `Course p${params?.page}` }], 45, params?.page ?? 0))
    const { user } = renderPage()
    let dialog = await open(user)
    await user.click(await within(dialog).findByRole('button', { name: 'Next' }))
    expect(await within(dialog).findByText('Course p1')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = await open(user)

    expect(await within(dialog).findByText('Course p0')).toBeInTheDocument()
  })

  it('caches each user separately', async () => {
    api.listUserCourses.mockImplementation((id) =>
      id === 3 ? new Promise(() => {}) : Promise.resolve(pageOf([{ ...courses[0], title: `Courses of ${id}` }])),
    )
    const { user, queryClient } = renderPage()
    let dialog = await open(user, 'Bob')
    await within(dialog).findByText('Courses of 2')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = await open(user, 'Carol')

    // Carol's are still loading: Bob's must not be shown in their place.
    expect(within(dialog).getByRole('status', { name: 'Loading courses' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Courses of 2')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(adminKeys.userCourses(2, { page: 0, size: 20 }))).toBeDefined()
  })
})
