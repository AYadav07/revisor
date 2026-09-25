import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  dashboardApi,
  type CourseProgress,
  type DashboardSummary,
  type DueItem,
  type PageResponse,
} from '@/api'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'
import { DashboardPage } from './DashboardPage'
import { dashboardKeys } from './queryKeys'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, dashboardApi: { summary: vi.fn(), progress: vi.fn(), due: vi.fn() } }
})

const api = vi.mocked(dashboardApi)

const summary: DashboardSummary = { dueToday: 4, overdue: 2, totalLearned: 17 }

function item(id: number, overrides: Partial<DueItem> = {}): DueItem {
  return {
    subtopicId: id,
    subtopicTitle: `Subtopic ${id}`,
    topicId: 100 + id,
    topicTitle: `Topic ${id}`,
    courseId: 1,
    courseTitle: 'System Design',
    nextReviewDate: '2026-09-26',
    daysOverdue: 0,
    ...overrides,
  }
}

function pageOf(content: DueItem[], totalElements = content.length, page = 0): PageResponse<DueItem> {
  return { content, page, size: 20, totalElements }
}

const courseProgress: CourseProgress[] = [
  { courseId: 1, courseTitle: 'System Design', learnedCount: 2, totalCount: 5 },
  { courseId: 2, courseTitle: 'DSA', learnedCount: 0, totalCount: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  // Fixtures use fixed dates; pin "today" so what counts as due never depends on the real date.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 26, 12))
  api.summary.mockResolvedValue(summary)
  api.progress.mockResolvedValue(courseProgress)
  api.due.mockResolvedValue(pageOf([item(1)]))
})

afterEach(() => {
  vi.useRealTimers()
})

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    { route: '/dashboard' },
  )
}

describe('stat tiles', () => {
  it('shows due today, overdue and learned', async () => {
    renderPage()

    for (const [label, value] of [['Due today', '4'], ['Overdue', '2'], ['Learned', '17']]) {
      const tile = (await screen.findByText(label, { selector: '[data-slot="card-description"]' })).closest('[data-slot="card"]') as HTMLElement
      expect(within(tile).getByText(value)).toBeInTheDocument()
    }
  })

  it('draws overdue in the destructive color only when something is overdue', async () => {
    api.summary.mockResolvedValueOnce(summary).mockResolvedValue({ ...summary, overdue: 0 })
    const { queryClient } = renderPage()
    const number = async () =>
      (await screen.findByText('Overdue', { selector: '[data-slot="card-description"]' })).closest('[data-slot="card"]')!.querySelector('[data-slot="card-title"]')!

    expect(await number()).toHaveClass('text-destructive')
    await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    await waitFor(async () => expect(await number()).not.toHaveClass('text-destructive'))
  })

  it('shows placeholders while loading', () => {
    api.summary.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading summary' })).toBeInTheDocument()
  })

  it('offers a retry when it fails — without disturbing the rest of the page', async () => {
    api.summary.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(summary)
    const { user } = renderPage()

    expect(await screen.findByText("Couldn't load your summary.")).toBeInTheDocument()
    expect(await screen.findByText('Subtopic 1')).toBeInTheDocument()
    expect(await screen.findByText('2 of 5 learned')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('17')).toBeInTheDocument()
  })
})

describe('start review', () => {
  it('links to the first thing due, in the review flow', async () => {
    api.due.mockResolvedValue(pageOf([item(7), item(8)]))

    renderPage()

    expect(await screen.findByRole('link', { name: 'Start review' })).toHaveAttribute('href', '/subtopics/7/review')
  })

  it('is absent when nothing is due', async () => {
    api.due.mockResolvedValue(pageOf([]))

    renderPage()

    await screen.findByText("You're all caught up for today.")
    expect(screen.queryByRole('link', { name: 'Start review' })).not.toBeInTheDocument()
  })

  it("shares one request with the Today list rather than fetching it twice", async () => {
    renderPage()

    await screen.findByText('Subtopic 1')
    expect(api.due).toHaveBeenCalledTimes(1)
    expect(api.due).toHaveBeenCalledWith({ range: 'today', page: 0, size: 20 })
  })
})

describe('due list', () => {
  it('groups by course, under a link to the course, in order', async () => {
    api.due.mockResolvedValue(
      pageOf([
        item(1, { courseId: 2, courseTitle: 'DSA' }),
        item(2, { courseId: 1, courseTitle: 'System Design' }),
        item(3, { courseId: 2, courseTitle: 'DSA' }),
      ]),
    )

    renderPage()

    const dsa = await screen.findByRole('region', { name: 'DSA' })
    expect(within(dsa).getByRole('link', { name: 'DSA' })).toHaveAttribute('href', '/courses/2')
    expect(within(dsa).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Subtopic 1'),
      expect.stringContaining('Subtopic 3'),
    ])
    const groups = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    expect(groups).toEqual(['DSA', 'System Design'])
  })

  it('links each due subtopic to its review and names its topic', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: 'Subtopic 1' })
    expect(link).toHaveAttribute('href', '/subtopics/1/review')
    expect(screen.getByText('Topic 1')).toBeInTheDocument()
  })

  it('badges how overdue each is, and "Due today" for the rest', async () => {
    api.due.mockResolvedValue(
      pageOf([
        item(1, { daysOverdue: 3, nextReviewDate: '2026-09-23' }),
        item(2, { daysOverdue: 1, nextReviewDate: '2026-09-25' }),
        item(3),
      ]),
    )

    renderPage()

    const row = async (title: string) => (await screen.findByRole('link', { name: title })).closest('li') as HTMLElement
    expect(within(await row('Subtopic 1')).getByText('3 days overdue')).toBeInTheDocument()
    expect(within(await row('Subtopic 2')).getByText('1 day overdue')).toBeInTheDocument()
    expect(within(await row('Subtopic 3')).getByText('Due today')).toBeInTheDocument()
  })

  it('shows the week ahead too: later items carry their date and are not links', async () => {
    api.due.mockImplementation(async (params) =>
      params?.range === 'week'
        ? pageOf([item(1), item(2, { nextReviewDate: '2026-10-01' })])
        : pageOf([item(1)]),
    )
    const { user } = renderPage()
    await screen.findByText('Subtopic 1')

    await user.click(screen.getByRole('button', { name: 'This week' }))

    expect(await screen.findByText(/Due Oct\D+1\D+2026/)).toBeInTheDocument()
    expect(screen.getByText('Subtopic 2')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Subtopic 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Subtopic 1' })).toBeInTheDocument()
  })

  it('starts on Today, and says which range is showing', async () => {
    renderPage()

    await screen.findByText('Subtopic 1')
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'false')
  })

  it("asks for the week range and doesn't show Today's items under it while loading", async () => {
    api.due.mockImplementation((params) =>
      params?.range === 'week' ? new Promise(() => {}) : Promise.resolve(pageOf([item(1)])),
    )
    const { user } = renderPage()
    await screen.findByText('Subtopic 1')

    await user.click(screen.getByRole('button', { name: 'This week' }))

    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true')
    expect(api.due).toHaveBeenCalledWith({ range: 'week', page: 0, size: 20 })
    expect(screen.getByRole('status', { name: 'Loading due list' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'System Design' })).not.toBeInTheDocument()
  })

  it.each([
    ['today', 'Today', "You're all caught up for today."],
    ['week', 'This week', 'Nothing is due in the next seven days.'],
  ])('says so when nothing is due in the %s range', async (_range, button, message) => {
    api.due.mockResolvedValue(pageOf([]))
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: button }))

    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('pages through a long list, and goes back to the first page when the range changes', async () => {
    api.due.mockImplementation(async (params) => pageOf([item(100 + (params?.page ?? 0))], 45, params?.page ?? 0))
    const { user } = renderPage()
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(api.due).toHaveBeenCalledWith({ range: 'today', page: 1, size: 20 })
    expect(screen.getByText('Subtopic 101')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'This week' }))

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(api.due).toHaveBeenLastCalledWith({ range: 'week', page: 0, size: 20 })
  })

  it('has no pager for a single page', async () => {
    renderPage()

    await screen.findByText('Subtopic 1')
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('does not leave a blank card when the current page is past the end', async () => {
    api.due.mockImplementation(async (params) =>
      (params?.page ?? 0) === 0 ? pageOf([item(1)], 21) : pageOf([], 21, params?.page ?? 0),
    )
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Next' }))

    expect(await screen.findByText('No reviews on this page')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to the first page' }))
    expect(await screen.findByText('Subtopic 1')).toBeInTheDocument()
  })

  it('shows placeholders while loading', () => {
    api.due.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading due list' })).toBeInTheDocument()
  })

  it('offers a retry when it fails, without disturbing the rest of the page', async () => {
    api.due.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValue(pageOf([item(1)]))
    const { user } = renderPage()

    expect(await screen.findByText("Couldn't load your reviews.")).toBeInTheDocument()
    expect(await screen.findByText('17')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Start review' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Subtopic 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start review' })).toBeInTheDocument()
  })
})

describe('course progress', () => {
  it('shows learned of total and a bar for each course, linking to the course', async () => {
    renderPage()

    const row = (await screen.findByText('2 of 5 learned')).closest('li') as HTMLElement
    expect(within(row).getByRole('link', { name: 'System Design' })).toHaveAttribute('href', '/courses/1')
    const bar = within(row).getByRole('progressbar', { name: 'System Design progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
  })

  it('shows an empty bar, not NaN, for a course with nothing in it', async () => {
    renderPage()

    const bar = await screen.findByRole('progressbar', { name: 'DSA progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText('0 of 0 learned')).toBeInTheDocument()
  })

  it('points a user with no courses at the courses page', async () => {
    api.progress.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No courses yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to courses' })).toHaveAttribute('href', '/courses')
  })

  it('shows placeholders while loading', () => {
    api.progress.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading progress' })).toBeInTheDocument()
  })

  it('offers a retry when it fails', async () => {
    api.progress.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(courseProgress)
    const { user } = renderPage()

    expect(await screen.findByText("Couldn't load your progress.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('2 of 5 learned')).toBeInTheDocument()
  })
})

describe('staying current', () => {
  it('refetches the summary, the due list and the progress when the dashboard is marked stale', async () => {
    const { queryClient } = renderPage()
    await screen.findByText('2 of 5 learned')
    await screen.findByText('Subtopic 1')
    await screen.findByText('17')
    api.summary.mockResolvedValue({ dueToday: 0, overdue: 0, totalLearned: 18 })
    api.progress.mockResolvedValue([{ courseId: 1, courseTitle: 'System Design', learnedCount: 3, totalCount: 5 }])
    api.due.mockResolvedValue(pageOf([item(2)]))

    // What learning, reviewing or deleting a subtopic does elsewhere in the app.
    await queryClient.invalidateQueries({ queryKey: dashboardKeys.all })

    expect(await screen.findByText('18')).toBeInTheDocument()
    expect(await screen.findByText('3 of 5 learned')).toBeInTheDocument()
    expect(await screen.findByText('Subtopic 2')).toBeInTheDocument()
    expect(screen.queryByText('Subtopic 1')).not.toBeInTheDocument()
  })
})

describe('page', () => {
  it('has the Dashboard heading', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })
})
