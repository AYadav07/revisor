import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, courseApi, type CourseTree } from '@/api'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'
import { BulkAddPage, describeOutlineResult } from './BulkAddPage'
import { CourseDetailPage } from './CourseDetailPage'
import { outlineFileName } from './ExportOutlineDialog'
import { ImportCoursePage } from './ImportCoursePage'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    courseApi: { getCourse: vi.fn(), importCourse: vi.fn(), applyOutline: vi.fn() },
  }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const courses = vi.mocked(courseApi)

function makeTree(): CourseTree {
  return {
    id: 7,
    title: 'System Design',
    description: null,
    topics: [
      {
        id: 10,
        title: 'Caching',
        orderIndex: 0,
        subtopics: [{ id: 100, title: 'Eviction', notes: 'LRU', learned: true, nextReviewDate: '2026-10-30' }],
      },
    ],
  }
}

/** Typing an outline key by key is slow and mangles indentation; set it in one go, as a paste would. */
function enterOutline(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Outline' }), { target: { value: text } })
}

function problem(errors: { field: string; message: string }[]) {
  return { type: 'https://revisor.aydev.in/errors/validation-failed', title: 'T', status: 400, detail: 'd', instance: '/x', errors }
}

beforeEach(() => {
  vi.clearAllMocks()
  courses.getCourse.mockResolvedValue(makeTree())
})

describe('import page', () => {
  function renderImport() {
    return renderWithProviders(
      <Routes>
        <Route path="/courses/import" element={<ImportCoursePage />} />
        <Route path="/courses/:id" element={<LocationProbe />} />
      </Routes>,
      { route: '/courses/import' },
    )
  }

  it('previews the outline, takes the title from “# ”, and imports it in one request', async () => {
    courses.importCourse.mockResolvedValue({ ...makeTree(), id: 42 })
    const { user } = renderImport()

    enterOutline('# System Design\n> HLD\nCaching\n  - Eviction\n      LRU\n')

    expect(await screen.findByText('1 topic, 1 subtopic')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Course title' })).toHaveValue('System Design')
    await user.click(screen.getByRole('button', { name: 'Import course' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/courses/42'))
    expect(courses.importCourse).toHaveBeenCalledWith({
      title: 'System Design',
      description: 'HLD',
      topics: [{ title: 'Caching', subtopics: [{ title: 'Eviction', notes: 'LRU', onConflict: 'SKIP' }] }],
    })
    expect(toast.success).toHaveBeenCalledWith('Imported “System Design” with 1 topic and 1 subtopic')
  })

  it('lists errors by line, jumps to them, and keeps Import disabled until fixed', async () => {
    const { user } = renderImport()

    enterOutline('# SD\n  - orphan\n')

    const error = await screen.findByRole('button', { name: 'Line 2: A subtopic needs a topic above it.' })
    expect(screen.getByRole('button', { name: 'Import course' })).toBeDisabled()
    await user.click(error)
    const textarea = screen.getByRole('textbox', { name: 'Outline' }) as HTMLTextAreaElement
    expect(textarea).toHaveFocus()
    expect(textarea.selectionStart).toBe('# SD\n'.length)
  })

  it('puts a server validation error back on its outline line', async () => {
    courses.importCourse.mockRejectedValue(
      new ApiError(400, 'd', problem([{ field: 'topics[1].subtopics[0].title', message: 'too long' }])),
    )
    const { user } = renderImport()

    enterOutline('# SD\nCaching\nQueues\n  - Kafka\n')
    await user.click(await screen.findByRole('button', { name: 'Import course' }))

    expect(await screen.findByRole('button', { name: 'Line 4: too long' })).toBeInTheDocument()
  })

  it('offers the example on an empty outline', async () => {
    const { user } = renderImport()

    await user.click(screen.getByRole('button', { name: 'Insert example' }))

    expect(await screen.findByText('2 topics, 4 subtopics')).toBeInTheDocument()
  })
})

describe('bulk add page', () => {
  function renderBulkAdd() {
    return renderWithProviders(
      <Routes>
        <Route path="/courses/:id/outline" element={<BulkAddPage />} />
        <Route path="/courses/:id" element={<LocationProbe />} />
      </Routes>,
      { route: '/courses/7/outline' },
    )
  }

  it('marks existing and new items and sends the chosen conflict resolution', async () => {
    courses.applyOutline.mockResolvedValue({
      topicsCreated: 1,
      topicsMerged: 1,
      subtopicsCreated: 1,
      subtopicsUpdated: 1,
      subtopicsSkipped: 0,
    })
    const { user } = renderBulkAdd()
    await screen.findByRole('heading', { name: 'Bulk add' })

    enterOutline('caching\n  - eviction\n      LRU, LFU\nQueues\n  - Kafka\n')

    expect(await screen.findByText('1 new topic, 1 new subtopic, 1 conflict')).toBeInTheDocument()
    const preview = screen.getByRole('list', { name: 'Outline preview' })
    expect(within(preview).getByText('Caching')).toBeInTheDocument() // the existing topic keeps its title
    const choice = within(preview).getByRole('group', { name: 'Conflict for “eviction”' })
    expect(within(choice).getByRole('button', { name: 'Skip' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(choice).getByRole('button', { name: 'Overwrite' }))
    await user.click(screen.getByRole('button', { name: 'Add to course' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/courses/7'))
    expect(courses.applyOutline).toHaveBeenCalledWith(7, {
      topics: [
        { title: 'caching', subtopics: [{ title: 'eviction', notes: 'LRU, LFU', onConflict: 'OVERWRITE' }] },
        { title: 'Queues', subtopics: [{ title: 'Kafka', notes: null, onConflict: 'SKIP' }] },
      ],
    })
    expect(toast.success).toHaveBeenCalledWith('Added 1 topic and 1 subtopic, updated 1')
  })

  it('skips every conflict by default, and “Overwrite all” flips them all', async () => {
    const { user } = renderBulkAdd()
    await screen.findByRole('heading', { name: 'Bulk add' })

    enterOutline('Caching\n  - Eviction\n      new notes\n')
    await user.click(await screen.findByRole('button', { name: 'Overwrite all' }))

    expect(screen.getByRole('button', { name: 'Overwrite' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows not found for a course that isn’t the caller’s', async () => {
    courses.getCourse.mockRejectedValue(new ApiError(404, 'Not found'))
    renderBulkAdd()

    expect(await screen.findByText('Course not found')).toBeInTheDocument()
  })
})

describe('export', () => {
  it('shows the course as an outline from the course page', async () => {
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/courses/:id" element={<CourseDetailPage />} />
      </Routes>,
      { route: '/courses/7' },
    )

    await user.click(await screen.findByRole('button', { name: 'Export outline' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('textbox', { name: 'Outline' })).toHaveValue(
      '# System Design\n\nCaching\n  - Eviction\n      LRU\n',
    )
  })

  it('names the download after the course', () => {
    expect(outlineFileName('System Design: HLD!')).toBe('system-design-hld.md')
    expect(outlineFileName('???')).toBe('course.md')
  })
})

describe('describeOutlineResult', () => {
  it('leaves out what didn’t happen', () => {
    expect(
      describeOutlineResult({ topicsCreated: 0, topicsMerged: 1, subtopicsCreated: 3, subtopicsUpdated: 0, subtopicsSkipped: 2 }),
    ).toBe('Added 0 topics and 3 subtopics, skipped 2')
  })
})
