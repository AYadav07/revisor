import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  courseApi,
  dashboardApi,
  reviewApi,
  type DueItem,
  type PageResponse,
  type Quality,
  type ReviewResponse,
  type SubtopicResponse,
} from '@/api'
import { courseKeys } from '@/features/courses/queryKeys'
import { dashboardKeys } from '@/features/dashboard/queryKeys'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'
import { reviewKeys } from './queryKeys'
import { ReviewPage } from './ReviewPage'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    dashboardApi: { due: vi.fn() },
    courseApi: { getSubtopic: vi.fn() },
    reviewApi: { review: vi.fn() },
  }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const dashboard = vi.mocked(dashboardApi)
const courses = vi.mocked(courseApi)
const review = vi.mocked(reviewApi)

function due(id: number): DueItem {
  return {
    subtopicId: id,
    subtopicTitle: `Subtopic ${id}`,
    topicId: 50 + id,
    topicTitle: `Topic ${id}`,
    courseId: 9,
    courseTitle: 'System Design',
    nextReviewDate: '2026-09-20',
    daysOverdue: 6,
  }
}

function queueOf(...ids: number[]): PageResponse<DueItem> {
  return { content: ids.map(due), page: 0, size: 100, totalElements: ids.length }
}

function reviewed(subtopicId: number, nextReviewDate = '2026-10-04'): ReviewResponse {
  return { subtopicId, easeFactor: 2.5, intervalDays: 6, nextReviewDate, repetitionCount: 2 }
}

function notesFor(id: number, notes: string | null = `Notes for ${id}`): SubtopicResponse {
  return { id, topicId: 50 + id, title: `Subtopic ${id}`, notes }
}

beforeEach(() => {
  vi.clearAllMocks()
  dashboard.due.mockResolvedValue(queueOf(1, 2, 3))
  courses.getSubtopic.mockImplementation(async (id) => notesFor(id))
  review.review.mockImplementation(async (id) => reviewed(id))
})

function renderPage(route = '/subtopics/1/review') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/subtopics/:id/review"
        element={
          <>
            <ReviewPage />
            <LocationProbe />
            <BackButton />
          </>
        }
      />
      <Route path="/dashboard" element={<LocationProbe />} />
    </Routes>,
    { route },
  )
}

function BackButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Go back</button>
}

const location = () => screen.getByTestId('location').textContent

async function reveal(user: ReturnType<typeof renderPage>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Reveal' }))
}

describe('loading the queue', () => {
  it('shows a placeholder while loading', () => {
    dashboard.due.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading review' })).toBeInTheDocument()
    expect(screen.queryByText('Nothing due')).not.toBeInTheDocument()
  })

  it('asks for everything due today, up to the page-size cap', async () => {
    renderPage()

    await screen.findByRole('button', { name: 'Reveal' })
    expect(dashboard.due).toHaveBeenCalledWith({ range: 'today', page: 0, size: 100 })
  })

  it('offers a retry when the queue cannot be loaded, and recovers', async () => {
    dashboard.due.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(queueOf(1))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your reviews.")
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: 'Reveal' })).toBeInTheDocument()
  })

  it('says nothing is due when the queue is empty, with a way back', async () => {
    dashboard.due.mockResolvedValue(queueOf())

    renderPage()

    expect(await screen.findByText('Nothing due')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard')
  })
})

describe('which subtopic the session shows', () => {
  it('shows the one named in the URL, with its place in the queue', async () => {
    renderPage('/subtopics/2/review')

    expect(await screen.findByRole('heading', { level: 1, name: 'Subtopic 2' })).toBeInTheDocument()
    expect(screen.getByText('Reviewing 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('System Design › Topic 2')).toBeInTheDocument()
  })

  it.each(['99', 'abc', '0'])('starts from the top of the queue when the URL names "%s"', async (id) => {
    renderPage(`/subtopics/${id}/review`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Subtopic 1' })).toBeInTheDocument()
    expect(location()).toBe('/subtopics/1/review')
  })

  it('links out of the session', async () => {
    const { user } = renderPage()

    await user.click(await screen.findByRole('link', { name: 'Exit review' }))

    expect(location()).toBe('/dashboard')
  })
})

describe('the recall step', () => {
  it('hides the notes and the grades until Reveal is clicked', async () => {
    renderPage()

    await screen.findByRole('heading', { level: 1, name: 'Subtopic 1' })
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
    expect(screen.queryByText('Notes for 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Blackout/ })).not.toBeInTheDocument()
  })

  it('reveals the notes and all six labelled grades', async () => {
    const { user } = renderPage()

    await reveal(user)

    expect(await screen.findByText('Notes for 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
    for (const [quality, label] of [[0, 'Blackout'], [1, 'Wrong'], [2, 'Hard'], [3, 'Hesitant'], [4, 'Good'], [5, 'Perfect']]) {
      expect(screen.getByRole('button', { name: new RegExp(`${quality} · ${label}`) })).toBeEnabled()
    }
  })

  it('says so when there are no notes', async () => {
    courses.getSubtopic.mockResolvedValue(notesFor(1, null))
    const { user } = renderPage()

    await reveal(user)

    expect(await screen.findByText("You didn't write any notes for this one.")).toBeInTheDocument()
  })

  it('shows a placeholder while the notes load', async () => {
    courses.getSubtopic.mockImplementation(() => new Promise(() => {}))
    const { user } = renderPage()

    await reveal(user)

    expect(screen.getByRole('status', { name: 'Loading notes' })).toBeInTheDocument()
  })

  it('offers a retry when the notes fail, and grading still works meanwhile', async () => {
    courses.getSubtopic.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(notesFor(1))
    const { user } = renderPage()
    await reveal(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load your notes.")
    expect(screen.getByRole('button', { name: /4 · Good/ })).toBeEnabled()

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Notes for 1')).toBeInTheDocument()
  })

  it('keeps line breaks in the notes', async () => {
    courses.getSubtopic.mockResolvedValue(notesFor(1, 'line one\nline two'))
    const { user } = renderPage()

    await reveal(user)

    expect(await screen.findByText(/line one/)).toHaveClass('whitespace-pre-wrap')
  })
})

describe('grading', () => {
  it.each([
    [0, 'Blackout'],
    [1, 'Wrong'],
    [2, 'Hard'],
    [3, 'Hesitant'],
    [4, 'Good'],
    [5, 'Perfect'],
  ] as [Quality, string][])('sends quality %i for "%s"', async (quality, label) => {
    const { user } = renderPage()
    await reveal(user)

    await user.click(await screen.findByRole('button', { name: new RegExp(`${quality} · ${label}`) }))

    await waitFor(() => expect(review.review).toHaveBeenCalledWith(1, quality))
    expect(review.review).toHaveBeenCalledTimes(1)
  })

  it('confirms the next review date, then moves to the next subtopic — closed again', async () => {
    review.review.mockResolvedValue(reviewed(1, '2026-10-04'))
    const { user } = renderPage()
    await reveal(user)

    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))

    await waitFor(() => expect(location()).toBe('/subtopics/2/review'))
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Next review Oct\D+4\D+2026$/))
    expect(await screen.findByRole('heading', { level: 1, name: 'Subtopic 2' })).toBeInTheDocument()
    expect(screen.getByText('Reviewing 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /4 · Good/ })).not.toBeInTheDocument()
  })

  it('replaces the history entry, so Back does not return to an already-graded subtopic', async () => {
    const { user } = renderPage()
    await reveal(user)
    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))
    await waitFor(() => expect(location()).toBe('/subtopics/2/review'))

    // A pushed entry would make this land back on subtopic 1; a replaced one leaves nowhere to go.
    await user.click(screen.getByRole('button', { name: 'Go back' }))

    expect(location()).toBe('/subtopics/2/review')
  })

  it('keeps the same queue for the whole session — reviewing does not refetch it', async () => {
    const { user } = renderPage()
    await reveal(user)
    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))
    await screen.findByText('Reviewing 2 of 3')
    await reveal(user)
    await user.click(await screen.findByRole('button', { name: /5 · Perfect/ }))
    await screen.findByText('Reviewing 3 of 3')

    expect(dashboard.due).toHaveBeenCalledTimes(1)
  })

  it('finishes with a summary after the last one, and offers the dashboard', async () => {
    const { user } = renderPage('/subtopics/3/review')
    await reveal(user)

    await user.click(await screen.findByRole('button', { name: /3 · Hesitant/ }))

    expect(await screen.findByText('Session complete')).toBeInTheDocument()
    expect(screen.getByText('You reviewed 1 subtopic. Nice work.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('counts every subtopic reviewed in the session', async () => {
    const { user } = renderPage()
    for (const [label, next] of [['4 · Good', 'Reviewing 2 of 3'], ['4 · Good', 'Reviewing 3 of 3']]) {
      await reveal(user)
      await user.click(await screen.findByRole('button', { name: new RegExp(label) }))
      await screen.findByText(next)
    }
    await reveal(user)
    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))

    expect(await screen.findByText('You reviewed 3 subtopics. Nice work.')).toBeInTheDocument()
  })

  it('disables every grade while one is being saved', async () => {
    review.review.mockImplementation(() => new Promise(() => {}))
    const { user } = renderPage()
    await reveal(user)

    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))

    await waitFor(() => expect(screen.getByRole('button', { name: /5 · Perfect/ })).toBeDisabled())
    expect(screen.getByRole('button', { name: /0 · Blackout/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /5 · Perfect/ }))
    expect(review.review).toHaveBeenCalledTimes(1)
  })

  it('on a server failure: says so, stays on the subtopic, and lets the user try again', async () => {
    review.review.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(reviewed(1))
    const { user } = renderPage()
    await reveal(user)

    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your grade. Please try again.")
    expect(location()).toBe('/subtopics/1/review')
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /4 · Good/ })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /4 · Good/ }))
    await waitFor(() => expect(location()).toBe('/subtopics/2/review'))
  })

  it('clears the old error as soon as the user tries again', async () => {
    review.review.mockRejectedValueOnce(new ApiError(500, 'boom')).mockImplementationOnce(() => new Promise(() => {}))
    const { user } = renderPage()
    await reveal(user)
    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: /4 · Good/ }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it.each([404, 409])('on a %i: explains it cannot be reviewed and lets the user move on without grading', async (status) => {
    review.review.mockRejectedValueOnce(new ApiError(status, 'gone'))
    const { user } = renderPage('/subtopics/2/review')
    await reveal(user)

    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent("This subtopic can't be reviewed any more.")
    expect(screen.queryByRole('button', { name: /4 · Good/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(location()).toBe('/subtopics/3/review'))
    expect(review.review).toHaveBeenCalledTimes(1)
    await reveal(user)
    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))
    // Only the one actually graded counts.
    expect(await screen.findByText('You reviewed 1 subtopic. Nice work.')).toBeInTheDocument()
  })

  it('marks the dashboard and course pages stale, but not the session queue', async () => {
    const { user, queryClient } = renderPage()
    queryClient.setQueryData([...dashboardKeys.all, 'summary'], { dueToday: 3 })
    queryClient.setQueryData(courseKeys.detail(9), { id: 9 })
    await reveal(user)

    await user.click(await screen.findByRole('button', { name: /4 · Good/ }))

    await waitFor(() => expect(queryClient.getQueryState([...dashboardKeys.all, 'summary'])?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(courseKeys.detail(9))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(reviewKeys.queue())?.isInvalidated).toBe(false)
  })
})

describe('leaving the session', () => {
  it('forgets the queue, so the next session starts from a fresh list', async () => {
    const { user, queryClient } = renderPage()
    await screen.findByRole('button', { name: 'Reveal' })
    expect(queryClient.getQueryData(reviewKeys.queue())).toBeDefined()

    await user.click(screen.getByRole('link', { name: 'Exit review' }))

    await waitFor(() => expect(queryClient.getQueryData(reviewKeys.queue())).toBeUndefined())
  })
})
