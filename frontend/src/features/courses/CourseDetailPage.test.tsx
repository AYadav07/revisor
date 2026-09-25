import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, courseApi, reviewApi, type CourseTree } from '@/api'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'
import { CourseDetailPage } from './CourseDetailPage'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    courseApi: { getCourse: vi.fn(), createTopic: vi.fn(), createSubtopic: vi.fn() },
    reviewApi: { learn: vi.fn() },
  }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const courses = vi.mocked(courseApi)
const review = vi.mocked(reviewApi)

function makeTree(): CourseTree {
  return {
    id: 7,
    title: 'System Design',
    description: 'Distributed systems',
    topics: [
      {
        id: 10,
        title: 'Load balancing',
        orderIndex: 0,
        subtopics: [
          { id: 100, title: 'L4 vs L7', notes: 'Layer 4 sees TCP, layer 7 sees HTTP', learned: true, nextReviewDate: '2026-10-03' },
          { id: 101, title: 'Consistent hashing', notes: null, learned: false, nextReviewDate: null },
        ],
      },
      { id: 11, title: 'Caching', orderIndex: 2, subtopics: [] },
    ],
  }
}

function problem(status: number, errors: { field: string; message: string }[] = []) {
  return { type: 't', title: 'T', status, detail: 'd', instance: '/x', errors }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage(route = '/courses/7') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/courses/:id"
        element={
          <>
            <CourseDetailPage />
            <LocationProbe />
          </>
        }
      />
      <Route path="/courses" element={<LocationProbe />} />
    </Routes>,
    { route },
  )
}

describe('loading and errors', () => {
  it('shows placeholders while loading, with no error or empty state', () => {
    courses.getCourse.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading course' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Course not found')).not.toBeInTheDocument()
  })

  it('fetches the course named in the URL', async () => {
    courses.getCourse.mockResolvedValue(makeTree())

    renderPage('/courses/7')

    await screen.findByRole('heading', { level: 1, name: 'System Design' })
    expect(courses.getCourse).toHaveBeenCalledWith(7)
  })

  it('says "not found" for a 404 — the same for a missing course and someone else\'s', async () => {
    courses.getCourse.mockRejectedValue(new ApiError(404, 'Course not found'))

    renderPage()

    expect(await screen.findByText('Course not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your courses' })).toHaveAttribute('href', '/courses')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['abc', '0', '-1', '1.5', '007'])('says "not found" for the id "%s" without asking the server', (id) => {
    renderPage(`/courses/${id}`)

    expect(screen.getByText('Course not found')).toBeInTheDocument()
    expect(courses.getCourse).not.toHaveBeenCalled()
  })

  it('offers a retry for any other failure, and recovers when it works', async () => {
    courses.getCourse.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(makeTree())
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this course.")
    expect(screen.queryByText('Course not found')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'System Design' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('links back to the course list', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    const { user } = renderPage()

    await user.click(await screen.findByRole('link', { name: /All courses/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/courses')
  })
})

describe('the tree', () => {
  it('shows the title, description and overall progress', async () => {
    courses.getCourse.mockResolvedValue(makeTree())

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'System Design' })).toBeInTheDocument()
    expect(screen.getByText('Distributed systems')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 subtopics learned')).toBeInTheDocument()
  })

  it('lists every topic, expanded, with its own progress', async () => {
    courses.getCourse.mockResolvedValue(makeTree())

    renderPage()

    const load = await screen.findByRole('button', { name: /Load balancing/ })
    expect(load).toHaveAttribute('aria-expanded', 'true')
    expect(load).toHaveTextContent('1/2 learned')
    const caching = screen.getByRole('button', { name: /Caching/ })
    expect(caching).toHaveAttribute('aria-expanded', 'true')
    expect(caching).toHaveTextContent('0/0 learned')
    expect(screen.getByText('No subtopics yet.')).toBeInTheDocument()
  })

  it('shows a learned subtopic with its next review date, and an unlearned one with a way to start', async () => {
    courses.getCourse.mockResolvedValue(makeTree())

    renderPage()

    const learned = (await screen.findByText('L4 vs L7')).closest('li')!
    expect(within(learned).getByText('Learned')).toBeInTheDocument()
    expect(within(learned).getByText(/Next review Oct\D+3\D+2026/)).toBeInTheDocument()
    expect(within(learned).getByText('Layer 4 sees TCP, layer 7 sees HTTP')).toBeInTheDocument()
    expect(within(learned).queryByRole('button', { name: /as learned/ })).not.toBeInTheDocument()

    const fresh = screen.getByText('Consistent hashing').closest('li')!
    expect(within(fresh).queryByText('Learned')).not.toBeInTheDocument()
    expect(within(fresh).getByRole('button', { name: /Mark .Consistent hashing. as learned/ })).toBeEnabled()
  })

  it('collapses and re-expands a topic', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    const { user } = renderPage()
    const load = await screen.findByRole('button', { name: /Load balancing/ })

    await user.click(load)
    expect(load).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('L4 vs L7')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Caching/ })).toHaveAttribute('aria-expanded', 'true')

    await user.click(load)
    expect(load).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('L4 vs L7')).toBeInTheDocument()
  })

  it('shows an empty state for a course with no topics, and still lets you add one', async () => {
    courses.getCourse.mockResolvedValue({ ...makeTree(), topics: [] })

    renderPage()

    expect(await screen.findByText('No topics yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add topic' })).toBeInTheDocument()
    expect(screen.getByText('0 of 0 subtopics learned')).toBeInTheDocument()
  })

  it('shows no description line for a course without one', async () => {
    courses.getCourse.mockResolvedValue({ ...makeTree(), description: null })

    renderPage()

    await screen.findByRole('heading', { level: 1, name: 'System Design' })
    expect(screen.queryByText('Distributed systems')).not.toBeInTheDocument()
  })
})

describe('marking a subtopic as learned', () => {
  const learnedTree = (): CourseTree => {
    const tree = makeTree()
    tree.topics[0].subtopics[1] = { ...tree.topics[0].subtopics[1], learned: true, nextReviewDate: '2026-09-27' }
    return tree
  }

  it('calls the API, then refetches so the row shows its schedule', async () => {
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(learnedTree())
    review.learn.mockResolvedValue({} as never)
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: /Mark .Consistent hashing. as learned/ }))

    expect(review.learn).toHaveBeenCalledWith(101)
    expect(await screen.findByText(/Next review Sep\D+27\D+2026/)).toBeInTheDocument()
    expect(screen.getByText('2 of 2 subtopics learned')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /as learned/ })).not.toBeInTheDocument()
  })

  it('disables only the clicked subtopic while it is saving', async () => {
    const tree = makeTree()
    tree.topics[0].subtopics.push({ id: 102, title: 'Sharding', notes: null, learned: false, nextReviewDate: null })
    courses.getCourse.mockResolvedValue(tree)
    review.learn.mockImplementation(() => new Promise(() => {}))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: /Mark .Consistent hashing. as learned/ }))

    expect(await screen.findByRole('button', { name: /Mark .Consistent hashing. as learned/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Mark .Sharding. as learned/ })).toBeEnabled()
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('toasts an error and leaves the button usable when it fails', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    review.learn.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: /Mark .Consistent hashing. as learned/ }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't mark it as learned. Please try again."))
    expect(screen.getByRole('button', { name: /Mark .Consistent hashing. as learned/ })).toBeEnabled()
    expect(courses.getCourse).toHaveBeenCalledTimes(1)
  })
})

describe('adding a topic', () => {
  it('creates it after the highest existing order index, refetches, and clears the input', async () => {
    const after = makeTree()
    after.topics.push({ id: 12, title: 'Queues', orderIndex: 3, subtopics: [] })
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(after)
    courses.createTopic.mockResolvedValue({} as never)
    const { user } = renderPage()

    const input = await screen.findByPlaceholderText('New topic title')
    await user.type(input, '  Queues  ')
    await user.click(screen.getByRole('button', { name: 'Add topic' }))

    // Existing indexes are 0 and 2 (a gap, from a past delete), so the next is 3 — not the count, 2.
    await waitFor(() => expect(courses.createTopic).toHaveBeenCalledWith(7, { title: 'Queues', orderIndex: 3 }))
    expect(await screen.findByRole('button', { name: /Queues/ })).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  it('keeps existing topics collapsed when a new one is added', async () => {
    const after = makeTree()
    after.topics.push({ id: 12, title: 'Queues', orderIndex: 3, subtopics: [] })
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(after)
    courses.createTopic.mockResolvedValue({} as never)
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /Caching/ }))

    await user.type(screen.getByPlaceholderText('New topic title'), 'Queues')
    await user.click(screen.getByRole('button', { name: 'Add topic' }))

    expect(await screen.findByRole('button', { name: /Queues/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Caching/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('starts the first topic of an empty course at index 0', async () => {
    courses.getCourse.mockResolvedValue({ ...makeTree(), topics: [] })
    courses.createTopic.mockResolvedValue({} as never)
    const { user } = renderPage()

    await user.type(await screen.findByPlaceholderText('New topic title'), 'Basics')
    await user.click(screen.getByRole('button', { name: 'Add topic' }))

    await waitFor(() => expect(courses.createTopic).toHaveBeenCalledWith(7, { title: 'Basics', orderIndex: 0 }))
  })

  it('rejects a blank title without calling the API', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    const { user } = renderPage()

    await user.type(await screen.findByPlaceholderText('New topic title'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add topic' }))

    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    expect(courses.createTopic).not.toHaveBeenCalled()
  })

  it("shows the server's validation message on the field, keeping the input", async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    courses.createTopic.mockRejectedValue(
      new ApiError(400, 'invalid', problem(400, [{ field: 'title', message: 'size must be between 1 and 255' }])),
    )
    const { user } = renderPage()

    const input = await screen.findByPlaceholderText('New topic title')
    await user.type(input, 'Queues')
    await user.click(screen.getByRole('button', { name: 'Add topic' }))

    expect(await screen.findByText('size must be between 1 and 255')).toBeInTheDocument()
    expect(input).toHaveValue('Queues')
  })

  it('shows a generic error for a server failure, keeping the input', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    courses.createTopic.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()

    const input = await screen.findByPlaceholderText('New topic title')
    await user.type(input, 'Queues')
    await user.click(screen.getByRole('button', { name: 'Add topic' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't add the topic. Please try again.")
    expect(input).toHaveValue('Queues')
  })
})

describe('adding a subtopic', () => {
  async function openDialog(user: ReturnType<typeof renderPage>['user'], topic = 'Load balancing') {
    const trigger = await screen.findByRole('button', { name: new RegExp(topic) })
    const item = trigger.closest('[data-slot="accordion-item"]') as HTMLElement
    await user.click(within(item).getByRole('button', { name: 'Add subtopic' }))
    return screen.findByRole('dialog')
  }

  it('names the topic in the dialog and creates the subtopic under it', async () => {
    const after = makeTree()
    after.topics[0].subtopics.push({ id: 103, title: 'Health checks', notes: 'Active vs passive', learned: false, nextReviewDate: null })
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(after)
    courses.createSubtopic.mockResolvedValue({} as never)
    const { user } = renderPage()
    const dialog = await openDialog(user)

    expect(within(dialog).getByRole('heading', { name: 'Add subtopic to Load balancing' })).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Title'), 'Health checks')
    await user.type(within(dialog).getByLabelText('Notes (optional)'), 'Active vs passive')
    await user.click(within(dialog).getByRole('button', { name: 'Add subtopic' }))

    await waitFor(() =>
      expect(courses.createSubtopic).toHaveBeenCalledWith(10, { title: 'Health checks', notes: 'Active vs passive' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Health checks')).toBeInTheDocument()
  })

  it('sends blank notes as null', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    courses.createSubtopic.mockResolvedValue({} as never)
    const { user } = renderPage()
    const dialog = await openDialog(user, 'Caching')

    await user.type(within(dialog).getByLabelText('Title'), 'LRU')
    await user.click(within(dialog).getByRole('button', { name: 'Add subtopic' }))

    await waitFor(() => expect(courses.createSubtopic).toHaveBeenCalledWith(11, { title: 'LRU', notes: null }))
  })

  it('trims the title and treats whitespace-only notes as no notes', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    courses.createSubtopic.mockResolvedValue({} as never)
    const { user } = renderPage()
    const dialog = await openDialog(user, 'Caching')

    await user.type(within(dialog).getByLabelText('Title'), '  LRU  ')
    await user.type(within(dialog).getByLabelText('Notes (optional)'), '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Add subtopic' }))

    await waitFor(() => expect(courses.createSubtopic).toHaveBeenCalledWith(11, { title: 'LRU', notes: null }))
  })

  it('rejects a blank title without calling the API, and keeps the dialog open', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Add subtopic' }))

    expect(await within(dialog).findByText('Title is required')).toBeInTheDocument()
    expect(courses.createSubtopic).not.toHaveBeenCalled()
  })

  it("puts the server's message on the notes field it names", async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    courses.createSubtopic.mockRejectedValue(
      new ApiError(400, 'invalid', problem(400, [{ field: 'notes', message: 'notes too long' }])),
    )
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Title'), 'X')
    await user.click(within(dialog).getByRole('button', { name: 'Add subtopic' }))

    expect(await within(dialog).findByText('notes too long')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a generic error for a server failure, keeping the dialog and its input', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    courses.createSubtopic.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Title'), 'X')
    await user.click(within(dialog).getByRole('button', { name: 'Add subtopic' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't add the subtopic. Please try again.")
    expect(within(dialog).getByLabelText('Title')).toHaveValue('X')
  })

  it('starts from scratch when reopened after cancelling — no leftover text or error', async () => {
    courses.getCourse.mockResolvedValue(makeTree())
    const { user } = renderPage()
    let dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Add subtopic' }))
    await within(dialog).findByText('Title is required')
    await user.type(within(dialog).getByLabelText('Title'), 'Draft')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = await openDialog(user)
    expect(within(dialog).getByLabelText('Title')).toHaveValue('')
    expect(within(dialog).queryByText('Title is required')).not.toBeInTheDocument()
  })
})
