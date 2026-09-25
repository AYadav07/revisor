import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, courseApi, type CourseTree } from '@/api'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'
import { CourseDetailPage } from './CourseDetailPage'
import { courseKeys } from './queryKeys'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    courseApi: {
      getCourse: vi.fn(),
      updateCourse: vi.fn(),
      deleteCourse: vi.fn(),
      updateTopic: vi.fn(),
      deleteTopic: vi.fn(),
      updateSubtopic: vi.fn(),
      deleteSubtopic: vi.fn(),
    },
    reviewApi: { learn: vi.fn() },
  }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const courses = vi.mocked(courseApi)

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
          { id: 100, title: 'L4 vs L7', notes: 'Layer 4 sees TCP', learned: true, nextReviewDate: '2026-10-03' },
          { id: 101, title: 'Consistent hashing', notes: null, learned: false, nextReviewDate: null },
        ],
      },
      { id: 11, title: 'Caching', orderIndex: 2, subtopics: [] },
    ],
  }
}

function problem(errors: { field: string; message: string }[]) {
  return { type: 't', title: 'T', status: 400, detail: 'd', instance: '/x', errors }
}

beforeEach(() => {
  vi.clearAllMocks()
  courses.getCourse.mockResolvedValue(makeTree())
})

function renderPage() {
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
    { route: '/courses/7' },
  )
}

type User = ReturnType<typeof renderPage>['user']

/** Clicks a topic-level action ("Rename topic", …) inside that topic's accordion item. */
async function topicAction(user: User, topic: string, action: string) {
  const trigger = await screen.findByRole('button', { name: new RegExp(topic) })
  const item = trigger.closest('[data-slot="accordion-item"]') as HTMLElement
  await user.click(within(item).getByRole('button', { name: action }))
  return screen.findByRole('dialog')
}

async function subtopicAction(user: User, verb: 'Edit' | 'Delete', subtopic: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${verb} .${subtopic}.$`) }))
  return screen.findByRole('dialog')
}

async function courseAction(user: User, name: 'Edit course' | 'Delete course') {
  await user.click(await screen.findByRole('button', { name }))
  return screen.findByRole('dialog')
}

const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

describe('editing the course', () => {
  it('opens with the current title and description', async () => {
    const { user } = renderPage()

    const dialog = await courseAction(user, 'Edit course')

    expect(within(dialog).getByRole('heading', { name: 'Edit course' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Title')).toHaveValue('System Design')
    expect(within(dialog).getByLabelText('Description (optional)')).toHaveValue('Distributed systems')
  })

  it('shows an empty description field for a course without one', async () => {
    courses.getCourse.mockResolvedValue({ ...makeTree(), description: null })
    const { user } = renderPage()

    const dialog = await courseAction(user, 'Edit course')

    expect(within(dialog).getByLabelText('Description (optional)')).toHaveValue('')
  })

  it('saves the change, refreshes the page and the course list, and closes', async () => {
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue({ ...makeTree(), title: 'Systems' })
    courses.updateCourse.mockResolvedValue({} as never)
    const { user, queryClient } = renderPage()
    queryClient.setQueryData(courseKeys.list({ page: 0, size: 12 }), { content: [] })
    const dialog = await courseAction(user, 'Edit course')

    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, '  Systems  ')
    await user.clear(within(dialog).getByLabelText('Description (optional)'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(courses.updateCourse).toHaveBeenCalledWith(7, { title: 'Systems', description: null }))
    await closed()
    expect(await screen.findByRole('heading', { level: 1, name: 'Systems' })).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Course updated')
    expect(queryClient.getQueryState(courseKeys.list({ page: 0, size: 12 }))?.isInvalidated).toBe(true)
  })

  it('rejects a blank title without calling the API', async () => {
    const { user } = renderPage()
    const dialog = await courseAction(user, 'Edit course')

    await user.clear(within(dialog).getByLabelText('Title'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('Title is required')).toBeInTheDocument()
    expect(courses.updateCourse).not.toHaveBeenCalled()
  })

  it("puts the server's message on the field and keeps the dialog", async () => {
    courses.updateCourse.mockRejectedValue(
      new ApiError(400, 'invalid', problem([{ field: 'description', message: 'description too long' }])),
    )
    const { user } = renderPage()
    const dialog = await courseAction(user, 'Edit course')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('description too long')).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('shows a generic error for a server failure, keeping the dialog', async () => {
    courses.updateCourse.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    const dialog = await courseAction(user, 'Edit course')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't save the course. Please try again.")
  })

  it('discards an abandoned edit: reopening shows the saved values, not the draft', async () => {
    const { user } = renderPage()
    let dialog = await courseAction(user, 'Edit course')
    await user.type(within(dialog).getByLabelText('Title'), ' DRAFT')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await closed()

    dialog = await courseAction(user, 'Edit course')

    expect(within(dialog).getByLabelText('Title')).toHaveValue('System Design')
    expect(courses.updateCourse).not.toHaveBeenCalled()
  })
})

describe('deleting the course', () => {
  it('says what will be lost, with counts', async () => {
    const { user } = renderPage()

    const dialog = await courseAction(user, 'Delete course')

    expect(within(dialog).getByRole('heading', { name: 'Delete “System Design”?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('its 2 topics, its 2 subtopics and all their review history')
  })

  it('does nothing when cancelled', async () => {
    const { user } = renderPage()
    const dialog = await courseAction(user, 'Delete course')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await closed()
    expect(courses.deleteCourse).not.toHaveBeenCalled()
    expect(screen.getByTestId('location')).toHaveTextContent('/courses/7')
  })

  it('deletes, leaves for the list without ever refetching the gone course, and refreshes the list', async () => {
    courses.deleteCourse.mockResolvedValue(undefined)
    const { user, queryClient } = renderPage()
    queryClient.setQueryData(courseKeys.list({ page: 0, size: 12 }), { content: [] })
    const dialog = await courseAction(user, 'Delete course')

    await user.click(within(dialog).getByRole('button', { name: 'Delete course' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/courses'))
    expect(screen.getByTestId('location')).not.toHaveTextContent('/courses/7')
    expect(courses.deleteCourse).toHaveBeenCalledWith(7)
    expect(toast.success).toHaveBeenCalledWith('Deleted “System Design”')
    expect(courses.getCourse).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(courseKeys.detail(7))).toBeUndefined()
    expect(queryClient.getQueryState(courseKeys.list({ page: 0, size: 12 }))?.isInvalidated).toBe(true)
  })

  it('treats "already gone" (404) as done: leaves quietly', async () => {
    courses.deleteCourse.mockRejectedValue(new ApiError(404, 'Course not found'))
    const { user } = renderPage()
    const dialog = await courseAction(user, 'Delete course')

    await user.click(within(dialog).getByRole('button', { name: 'Delete course' }))

    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('/courses/7'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('stays put and shows an error for a server failure, ready to retry', async () => {
    courses.deleteCourse.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(undefined)
    const { user } = renderPage()
    const dialog = await courseAction(user, 'Delete course')

    await user.click(within(dialog).getByRole('button', { name: 'Delete course' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't delete the course. Please try again.")
    expect(screen.getByTestId('location')).toHaveTextContent('/courses/7')

    await user.click(within(dialog).getByRole('button', { name: 'Delete course' }))
    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('/courses/7'))
  })

  it('locks the dialog while the request is in flight', async () => {
    courses.deleteCourse.mockImplementation(() => new Promise(() => {}))
    const { user } = renderPage()
    const dialog = await courseAction(user, 'Delete course')

    await user.click(within(dialog).getByRole('button', { name: 'Delete course' }))

    expect(await within(dialog).findByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('a failed attempt is not remembered after cancelling', async () => {
    courses.deleteCourse.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    let dialog = await courseAction(user, 'Delete course')
    await user.click(within(dialog).getByRole('button', { name: 'Delete course' }))
    await within(dialog).findByRole('alert')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await closed()

    dialog = await courseAction(user, 'Delete course')

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('renaming a topic', () => {
  it('opens with the topic\'s title', async () => {
    const { user } = renderPage()

    const dialog = await topicAction(user, 'Caching', 'Rename topic')

    expect(within(dialog).getByRole('heading', { name: 'Rename topic' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Caching')
  })

  it('saves the new title, keeping the topic where it is, and refreshes the tree', async () => {
    courses.getCourse
      .mockResolvedValueOnce(makeTree())
      .mockResolvedValue({ ...makeTree(), topics: [makeTree().topics[0], { ...makeTree().topics[1], title: 'Caches' }] })
    courses.updateTopic.mockResolvedValue({} as never)
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Rename topic')

    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, ' Caches ')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    // orderIndex 2, not the position: the API replaces the whole topic.
    await waitFor(() => expect(courses.updateTopic).toHaveBeenCalledWith(11, { title: 'Caches', orderIndex: 2 }))
    await closed()
    expect(await screen.findByRole('button', { name: /Caches/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Caching/ })).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Topic renamed')
  })

  it('rejects a blank title without calling the API', async () => {
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Rename topic')

    await user.clear(within(dialog).getByLabelText('Title'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('Title is required')).toBeInTheDocument()
    expect(courses.updateTopic).not.toHaveBeenCalled()
  })

  it("shows the server's validation message on the title", async () => {
    courses.updateTopic.mockRejectedValue(
      new ApiError(400, 'invalid', problem([{ field: 'title', message: 'title taken' }])),
    )
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Rename topic')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('title taken')).toBeInTheDocument()
  })

  it('shows a generic error for a server failure', async () => {
    courses.updateTopic.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Rename topic')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't rename the topic. Please try again.")
  })
})

describe('deleting a topic', () => {
  const withoutCaching = (): CourseTree => ({ ...makeTree(), topics: [makeTree().topics[0]] })

  it('names the topic and how many subtopics go with it', async () => {
    const { user } = renderPage()

    const dialog = await topicAction(user, 'Load balancing', 'Delete topic')

    expect(within(dialog).getByRole('heading', { name: 'Delete “Load balancing”?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('its 2 subtopics')
  })

  it('deletes it, refreshes the tree and confirms', async () => {
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(withoutCaching())
    courses.deleteTopic.mockResolvedValue(undefined)
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Delete topic')

    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))

    await waitFor(() => expect(courses.deleteTopic).toHaveBeenCalledWith(11))
    await closed()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Caching/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Load balancing/ })).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Deleted “Caching”')
  })

  it('does nothing when cancelled', async () => {
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Delete topic')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await closed()
    expect(courses.deleteTopic).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Caching/ })).toBeInTheDocument()
  })

  it('treats "already gone" (404) as done: closes quietly and refreshes the tree', async () => {
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(withoutCaching())
    courses.deleteTopic.mockRejectedValue(new ApiError(404, 'Topic not found'))
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Delete topic')

    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))

    await closed()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Caching/ })).not.toBeInTheDocument())
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('keeps the dialog open with an error for a server failure', async () => {
    courses.deleteTopic.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    const dialog = await topicAction(user, 'Caching', 'Delete topic')

    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't delete the topic. Please try again.")
    expect(screen.getByText('Caching')).toBeInTheDocument() // the page behind the modal is aria-hidden
  })
})

describe('editing a subtopic', () => {
  it('opens with its title and notes', async () => {
    const { user } = renderPage()

    const dialog = await subtopicAction(user, 'Edit', 'L4 vs L7')

    expect(within(dialog).getByRole('heading', { name: 'Edit subtopic' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Title')).toHaveValue('L4 vs L7')
    expect(within(dialog).getByLabelText('Notes (optional)')).toHaveValue('Layer 4 sees TCP')
  })

  it('shows empty notes for a subtopic without any', async () => {
    const { user } = renderPage()

    const dialog = await subtopicAction(user, 'Edit', 'Consistent hashing')

    expect(within(dialog).getByLabelText('Notes (optional)')).toHaveValue('')
  })

  it('saves, refreshes the tree and closes — blank notes go as null', async () => {
    const after = makeTree()
    after.topics[0].subtopics[1] = { ...after.topics[0].subtopics[1], title: 'Rendezvous hashing' }
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(after)
    courses.updateSubtopic.mockResolvedValue({} as never)
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Edit', 'Consistent hashing')

    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Rendezvous hashing')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(courses.updateSubtopic).toHaveBeenCalledWith(101, { title: 'Rendezvous hashing', notes: null }),
    )
    await closed()
    expect(await screen.findByText('Rendezvous hashing')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Subtopic updated')
  })

  it('can clear the notes', async () => {
    courses.updateSubtopic.mockResolvedValue({} as never)
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Edit', 'L4 vs L7')

    await user.clear(within(dialog).getByLabelText('Notes (optional)'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(courses.updateSubtopic).toHaveBeenCalledWith(100, { title: 'L4 vs L7', notes: null }))
  })

  it('rejects a blank title without calling the API', async () => {
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Edit', 'L4 vs L7')

    await user.clear(within(dialog).getByLabelText('Title'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('Title is required')).toBeInTheDocument()
    expect(courses.updateSubtopic).not.toHaveBeenCalled()
  })

  it("puts the server's message on the notes field", async () => {
    courses.updateSubtopic.mockRejectedValue(
      new ApiError(400, 'invalid', problem([{ field: 'notes', message: 'notes too long' }])),
    )
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Edit', 'L4 vs L7')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('notes too long')).toBeInTheDocument()
  })

  it('shows a generic error for a server failure', async () => {
    courses.updateSubtopic.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Edit', 'L4 vs L7')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't save the subtopic. Please try again.")
  })

  it('opens each subtopic with its own values, not the previous one\'s', async () => {
    const { user } = renderPage()
    let dialog = await subtopicAction(user, 'Edit', 'L4 vs L7')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await closed()

    dialog = await subtopicAction(user, 'Edit', 'Consistent hashing')

    expect(within(dialog).getByLabelText('Title')).toHaveValue('Consistent hashing')
    expect(within(dialog).getByLabelText('Notes (optional)')).toHaveValue('')
  })
})

describe('deleting a subtopic', () => {
  const withoutL4 = (): CourseTree => {
    const tree = makeTree()
    tree.topics[0].subtopics = [tree.topics[0].subtopics[1]]
    return tree
  }

  it('names the subtopic', async () => {
    const { user } = renderPage()

    const dialog = await subtopicAction(user, 'Delete', 'L4 vs L7')

    expect(within(dialog).getByRole('heading', { name: 'Delete “L4 vs L7”?' })).toBeInTheDocument()
  })

  it('deletes it, refreshes the tree and confirms', async () => {
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(withoutL4())
    courses.deleteSubtopic.mockResolvedValue(undefined)
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Delete', 'L4 vs L7')

    await user.click(within(dialog).getByRole('button', { name: 'Delete subtopic' }))

    await waitFor(() => expect(courses.deleteSubtopic).toHaveBeenCalledWith(100))
    await closed()
    await waitFor(() => expect(screen.queryByText('L4 vs L7')).not.toBeInTheDocument())
    expect(screen.getByText('Consistent hashing')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 subtopics learned')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Deleted “L4 vs L7”')
  })

  it('does nothing when cancelled', async () => {
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Delete', 'L4 vs L7')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await closed()
    expect(courses.deleteSubtopic).not.toHaveBeenCalled()
  })

  it('treats "already gone" (404) as done: closes quietly and refreshes the tree', async () => {
    courses.getCourse.mockResolvedValueOnce(makeTree()).mockResolvedValue(withoutL4())
    courses.deleteSubtopic.mockRejectedValue(new ApiError(404, 'Subtopic not found'))
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Delete', 'L4 vs L7')

    await user.click(within(dialog).getByRole('button', { name: 'Delete subtopic' }))

    await closed()
    await waitFor(() => expect(screen.queryByText('L4 vs L7')).not.toBeInTheDocument())
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('keeps the dialog open with an error for a server failure', async () => {
    courses.deleteSubtopic.mockRejectedValue(new ApiError(500, 'boom'))
    const { user } = renderPage()
    const dialog = await subtopicAction(user, 'Delete', 'L4 vs L7')

    await user.click(within(dialog).getByRole('button', { name: 'Delete subtopic' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't delete the subtopic. Please try again.",
    )
    expect(screen.getByText('L4 vs L7')).toBeInTheDocument()
  })
})
