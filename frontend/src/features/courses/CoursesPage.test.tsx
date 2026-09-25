import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, courseApi, type CourseResponse, type PageResponse } from '@/api'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'
import { CoursesPage } from './CoursesPage'
import { courseKeys } from './queryKeys'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, courseApi: { listCourses: vi.fn(), createCourse: vi.fn() } }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(courseApi)

const systemDesign: CourseResponse = { id: 1, title: 'System Design', description: 'Distributed systems' }
const dsa: CourseResponse = { id: 2, title: 'DSA', description: null }

function pageOf(content: CourseResponse[], totalElements = content.length, page = 0): PageResponse<CourseResponse> {
  return { content, page, size: 12, totalElements }
}

/** A listCourses implementation that builds its response from the requested page (0 when unspecified). */
function pagedBy(build: (page: number) => PageResponse<CourseResponse>) {
  return async (params?: { page?: number }) => build(params?.page ?? 0)
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage(route = '/courses') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/courses"
        element={
          <>
            <CoursesPage />
            <LocationProbe />
          </>
        }
      />
    </Routes>,
    { route },
  )
}

const location = () => screen.getByTestId('location').textContent

describe('states', () => {
  it('shows placeholders while loading — and neither the empty state nor an error', () => {
    api.listCourses.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading courses' })).toBeInTheDocument()
    expect(screen.queryByText('No courses yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lists the courses as links to their pages, showing a description only when there is one', async () => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign, dsa]))

    renderPage()

    const first = await screen.findByRole('link', { name: /System Design/ })
    expect(first).toHaveAttribute('href', '/courses/1')
    expect(within(first).getByText('Distributed systems')).toBeInTheDocument()
    const second = screen.getByRole('link', { name: 'DSA' })
    expect(second).toHaveAttribute('href', '/courses/2')
    expect(screen.getByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New course' })).toBeInTheDocument()
  })

  it('asks the API for the first page, twelve at a time', async () => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign]))

    renderPage()

    await screen.findByText('System Design')
    expect(api.listCourses).toHaveBeenCalledWith({ page: 0, size: 12 })
  })

  it('shows an empty state with the only "New course" button (the header one is hidden until there is a list)', async () => {
    api.listCourses.mockResolvedValue(pageOf([]))

    renderPage()

    expect(await screen.findByText('No courses yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'New course' })).toHaveLength(1)
  })

  it('explains a failed load and lets the user retry it', async () => {
    api.listCourses.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(pageOf([systemDesign]))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your courses.")
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('System Design')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('pagination', () => {
  const total = 25 // 3 pages of 12

  it('offers no pagination when everything fits on one page', async () => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign], 1))

    renderPage()

    await screen.findByText('System Design')
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('moves through pages, keeping the page number in the URL (one-based) and fetching the right one', async () => {
    api.listCourses.mockImplementation(
      pagedBy((page) => pageOf([{ id: page + 10, title: `Course on page ${page}`, description: null }], total, page)),
    )
    const { user } = renderPage()
    await screen.findByText('Course on page 0')
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText('Course on page 1')).toBeInTheDocument()
    expect(location()).toBe('/courses?page=2')
    expect(api.listCourses).toHaveBeenLastCalledWith({ page: 1, size: 12 })
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('keeps showing the current page while the next one loads, instead of flashing placeholders', async () => {
    let release!: (page: PageResponse<CourseResponse>) => void
    api.listCourses
      .mockResolvedValueOnce(pageOf([systemDesign], total, 0))
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    const { user } = renderPage()
    await screen.findByText('System Design')

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('System Design')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading courses' })).not.toBeInTheDocument()
    release(pageOf([dsa], total, 1))
    expect(await screen.findByText('DSA')).toBeInTheDocument()
    expect(screen.queryByText('System Design')).not.toBeInTheDocument()
  })

  it('returns to a clean /courses URL on the first page', async () => {
    api.listCourses.mockImplementation(
      pagedBy((page) => pageOf([{ id: 1, title: `P${page}`, description: null }], total, page)),
    )
    const { user } = renderPage('/courses?page=2')
    await screen.findByText('P1')

    await user.click(screen.getByRole('button', { name: /previous/i }))

    await screen.findByText('P0')
    expect(location()).toBe('/courses')
  })

  it('opens directly on the page in the URL, and disables Next on the last page', async () => {
    api.listCourses.mockImplementation(
      pagedBy((page) => pageOf([{ id: 1, title: `P${page}`, description: null }], total, page)),
    )

    renderPage('/courses?page=3')

    expect(await screen.findByText('P2')).toBeInTheDocument()
    expect(api.listCourses).toHaveBeenCalledWith({ page: 2, size: 12 })
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it.each(['abc', '0', '-4', ''])('treats a nonsense page (?page=%s) as the first page', async (junk) => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign], total))

    renderPage(`/courses?page=${junk}`)

    await screen.findByText('System Design')
    expect(api.listCourses).toHaveBeenCalledWith({ page: 0, size: 12 })
  })

  it('handles a page past the end with a way back, not a blank screen', async () => {
    api.listCourses.mockImplementation(
      pagedBy((page) => (page === 0 ? pageOf([systemDesign], 5) : pageOf([], 5, page))),
    )
    const { user } = renderPage('/courses?page=9')

    expect(await screen.findByText('No courses on this page')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to the first page' }))

    expect(await screen.findByText('System Design')).toBeInTheDocument()
    expect(location()).toBe('/courses')
  })
})

describe('creating a course', () => {
  async function openDialog(user: ReturnType<typeof renderPage>['user']) {
    await user.click(await screen.findByRole('button', { name: 'New course' }))
    return screen.findByRole('dialog', { name: 'New course' })
  }

  it('creates it, confirms, closes, and refreshes the list to include it', async () => {
    const networking: CourseResponse = { id: 3, title: 'Networking', description: 'OSI model' }
    api.listCourses.mockResolvedValueOnce(pageOf([systemDesign])).mockResolvedValue(pageOf([systemDesign, networking]))
    api.createCourse.mockResolvedValue(networking)
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Title'), '  Networking ')
    await user.type(within(dialog).getByLabelText('Description (optional)'), 'OSI model')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createCourse).toHaveBeenCalledWith({ title: 'Networking', description: 'OSI model' })
    expect(toast.success).toHaveBeenCalledWith('Created “Networking”')
    expect(await screen.findByRole('link', { name: /Networking/ })).toBeInTheDocument()
    expect(api.listCourses).toHaveBeenCalledTimes(2)
  })

  it('sends a blank description as null', async () => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign]))
    api.createCourse.mockResolvedValue({ id: 3, title: 'X', description: null })
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Title'), 'X')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    await waitFor(() => expect(api.createCourse).toHaveBeenCalledWith({ title: 'X', description: null }))
  })

  it('creates the first course from the empty state', async () => {
    api.listCourses.mockResolvedValue(pageOf([]))
    api.createCourse.mockResolvedValue(systemDesign)
    const { user } = renderPage()
    await screen.findByText('No courses yet')

    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Title'), 'System Design')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    await waitFor(() => expect(api.createCourse).toHaveBeenCalledTimes(1))
  })

  it('validates before sending anything, and stays open', async () => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign]))
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    expect(await within(dialog).findByText('Title is required')).toBeInTheDocument()
    expect(api.createCourse).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it("puts the server's validation message on the field it names, and keeps the dialog open", async () => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign]))
    api.createCourse.mockRejectedValue(
      new ApiError(400, 'invalid', {
        type: 't', title: 'T', status: 400, detail: 'invalid', instance: '/x',
        errors: [{ field: 'title', message: 'size must be between 0 and 255' }],
      }),
    )
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Title'), 'Anything')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    expect(await within(dialog).findByText('size must be between 0 and 255')).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each([
    ['a server error', new ApiError(500, 'boom'), "Couldn't create the course. Please try again."],
    ['an unreachable server', new ApiError(0, 'Could not reach the server.'), 'Could not reach the server.'],
  ])('reports %s in the dialog without losing what was typed', async (_name, error, message) => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign]))
    api.createCourse.mockRejectedValue(error)
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Title'), 'Keep me')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Keep me')
  })

  it('disables the button while creating, so a double-click cannot create two', async () => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign]))
    api.createCourse.mockImplementation(() => new Promise(() => {}))
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Title'), 'Once')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))

    const pending = await within(dialog).findByRole('button', { name: 'Creating…' })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(api.createCourse).toHaveBeenCalledTimes(1)
  })

  it.each(['Cancel', 'Escape'])('starts the next opening blank — no text, no error — after closing with %s', async (how) => {
    api.listCourses.mockResolvedValue(pageOf([systemDesign]))
    api.createCourse.mockRejectedValue(new ApiError(500, 'boom')) // leaves an error alert behind
    const { user } = renderPage()
    let dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Title'), 'Abandoned')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()

    if (how === 'Cancel') await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    else await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    dialog = await openDialog(user)

    expect(within(dialog).getByLabelText('Title')).toHaveValue('')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('marks EVERY cached page of the list stale, not just the one on screen', async () => {
    api.listCourses.mockImplementation(
      pagedBy((page) => pageOf([{ id: page + 1, title: `P${page}`, description: null }], 25, page)),
    )
    api.createCourse.mockResolvedValue(systemDesign)
    const { user, queryClient } = renderPage('/courses?page=2')
    await screen.findByText('P1')
    await user.click(screen.getByRole('button', { name: /previous/i }))
    await screen.findByText('P0') // page 0 and page 1 are now both cached; only page 0 is on screen

    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Title'), 'New')
    await user.click(within(dialog).getByRole('button', { name: 'Create course' }))
    await waitFor(() => expect(api.createCourse).toHaveBeenCalled())

    await waitFor(() =>
      expect(queryClient.getQueryState(courseKeys.list({ page: 1, size: 12 }))?.isInvalidated).toBe(true),
    )
  })
})
