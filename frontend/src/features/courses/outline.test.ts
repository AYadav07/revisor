import { describe, expect, it } from 'vitest'
import type { CourseTree } from '@/api'
import {
  formatOutline,
  lineForField,
  OUTLINE_EXAMPLE,
  OUTLINE_LIMITS,
  parseOutline,
  previewOutline,
  toOutlineTopics,
  choiceKey,
} from './outline'

/** Titles and notes only, without line numbers — what most assertions care about. */
function shape(text: string) {
  return parseOutline(text).topics.map((topic) => ({
    title: topic.title,
    subtopics: topic.subtopics.map(({ title, notes }) => ({ title, notes })),
  }))
}

describe('parseOutline', () => {
  it('reads the documented example', () => {
    const parsed = parseOutline(OUTLINE_EXAMPLE)

    expect(parsed.errors).toEqual([])
    expect(parsed.title).toBe('System Design')
    expect(parsed.titleLine).toBe(1)
    expect(parsed.description).toBe('Prep for HLD rounds')
    expect(shape(OUTLINE_EXAMPLE)).toEqual([
      {
        title: 'Caching',
        subtopics: [
          { title: 'Cache-aside vs write-through', notes: '' },
          { title: 'Eviction policies', notes: 'LRU, LFU, TTL trade-offs' },
        ],
      },
      { title: 'Databases', subtopics: [{ title: 'Indexing', notes: '' }, { title: 'Sharding', notes: '' }] },
    ])
  })

  it('records the line of every topic and subtopic', () => {
    const parsed = parseOutline('\nCaching\n  - LRU\n\nQueues\n')

    expect(parsed.topics.map((topic) => topic.line)).toEqual([2, 5])
    expect(parsed.topics[0].subtopics[0].line).toBe(3)
  })

  it('keeps notes verbatim — nested bullets, relative indent and inner blank lines — minus the common indent', () => {
    const text = 'Caching\n  - Eviction\n      Policies:\n        - LRU\n\n      Pick by workload\n\n\nQueues\n'

    expect(shape(text)[0].subtopics[0].notes).toBe('Policies:\n  - LRU\n\nPick by workload')
  })

  it('accepts unindented subtopics and tabs', () => {
    expect(shape('Caching\n- LRU\n\tnotes here\n')).toEqual([
      { title: 'Caching', subtopics: [{ title: 'LRU', notes: 'notes here' }] },
    ])
  })

  it('merges a repeated topic into its first occurrence, case-insensitively', () => {
    expect(shape('Queues\n  - Kafka\nStreams\nqueues\n  - RabbitMQ\n')).toEqual([
      { title: 'Queues', subtopics: [{ title: 'Kafka', notes: '' }, { title: 'RabbitMQ', notes: '' }] },
      { title: 'Streams', subtopics: [] },
    ])
  })

  it('treats a Windows line ending like any other', () => {
    expect(shape('Caching\r\n  - LRU\r\n')).toEqual([{ title: 'Caching', subtopics: [{ title: 'LRU', notes: '' }] }])
  })

  it.each([
    ['  - LRU', 1, 'A subtopic needs a topic above it.'],
    ['Caching\n  LRU', 2, 'Start a subtopic with “- ”, or remove the indent to make this a topic.'],
    ['Caching\n  - ', 2, 'The subtopic has no title.'],
    ['Caching\n  - LRU\n  - lru', 3, '“lru” is already in this topic (line 2).'],
    ['Caching\n# SD', 2, 'The course title (“# …”) must come before the first topic.'],
    ['# A\n# B', 2, 'The course title is already set on line 1.'],
    ['Caching\n> late', 2, 'The description (“> …”) must come before the first topic.'],
  ])('reports %j on line %i', (text, line, message) => {
    expect(parseOutline(text).errors).toEqual([{ line, message }])
  })

  it('does not misread a rejected subtopic’s notes as anything else', () => {
    expect(parseOutline('Caching\n  - LRU\n  - LRU\n      notes\n').errors).toHaveLength(1)
  })

  it('enforces the API limits on the offending line', () => {
    const longTitle = 'x'.repeat(OUTLINE_LIMITS.title + 1)
    const tooManyTopics = Array.from({ length: OUTLINE_LIMITS.topics + 1 }, (_, i) => `T${i}`).join('\n')

    expect(parseOutline(`Caching\n  - ${longTitle}`).errors[0].line).toBe(2)
    expect(parseOutline(tooManyTopics).errors).toEqual([
      { line: OUTLINE_LIMITS.topics + 1, message: 'An outline can have at most 100 topics.' },
    ])
  })
})

describe('formatOutline', () => {
  const course: CourseTree = {
    id: 1,
    title: 'System Design',
    description: 'HLD prep\n\nSecond paragraph',
    topics: [
      {
        id: 10,
        title: 'Caching',
        orderIndex: 0,
        subtopics: [
          { id: 100, title: 'Eviction', notes: 'Policies:\n  - LRU\n\nPick by workload', learned: true, nextReviewDate: '2026-10-01' },
          { id: 101, title: 'Write-through', notes: null, learned: false, nextReviewDate: null },
        ],
      },
      { id: 11, title: 'Queues', orderIndex: 1, subtopics: [] },
    ],
  }

  it('writes the documented format', () => {
    expect(formatOutline(course)).toBe(
      [
        '# System Design',
        '> HLD prep',
        '>',
        '> Second paragraph',
        '',
        'Caching',
        '  - Eviction',
        '      Policies:',
        '        - LRU',
        '',
        '      Pick by workload',
        '  - Write-through',
        '',
        'Queues',
        '',
      ].join('\n'),
    )
  })

  it('round-trips through parseOutline', () => {
    const parsed = parseOutline(formatOutline(course))

    expect(parsed.errors).toEqual([])
    expect(parsed.title).toBe(course.title)
    expect(parsed.description).toBe(course.description)
    expect(parsed.topics.map((topic) => ({ title: topic.title, subtopics: topic.subtopics.map((s) => [s.title, s.notes]) }))).toEqual(
      course.topics.map((topic) => ({ title: topic.title, subtopics: topic.subtopics.map((s) => [s.title, s.notes ?? '']) })),
    )
  })
})

describe('previewOutline', () => {
  const existing: CourseTree = {
    id: 1,
    title: 'SD',
    description: null,
    topics: [
      {
        id: 10,
        title: 'Caching',
        orderIndex: 0,
        subtopics: [{ id: 100, title: 'Eviction', notes: 'LRU', learned: false, nextReviewDate: null }],
      },
    ],
  }

  it('marks merged topics, new items, unchanged matches and conflicts — like the backend', () => {
    const parsed = parseOutline(
      'caching\n  - eviction\n  - Read-through\nQueues\n  - Kafka\n',
    )
    const preview = previewOutline(parsed, existing)

    expect(preview.topics.map((topic) => [topic.title, topic.status])).toEqual([
      ['Caching', 'existing'],
      ['Queues', 'new'],
    ])
    expect(preview.topics[0].subtopics.map((s) => s.status)).toEqual(['existing', 'new'])
    expect(preview.counts).toEqual({ newTopics: 1, newSubtopics: 2, conflicts: 0, unchanged: 1 })
  })

  it('flags differing notes as a conflict, carrying the current notes', () => {
    const preview = previewOutline(parseOutline('Caching\n  - Eviction\n      LRU, LFU\n'), existing)

    expect(preview.topics[0].subtopics[0]).toMatchObject({ status: 'conflict', existingNotes: 'LRU', key: choiceKey('Caching', 'Eviction') })
    expect(preview.counts.conflicts).toBe(1)
  })

  it('treats everything as new for a new course', () => {
    expect(previewOutline(parseOutline('Caching\n  - Eviction\n'), null).counts).toEqual({
      newTopics: 1,
      newSubtopics: 1,
      conflicts: 0,
      unchanged: 0,
    })
  })
})

describe('toOutlineTopics', () => {
  it('sends blank notes as null and skips conflicts unless told otherwise', () => {
    const parsed = parseOutline('Caching\n  - A\n  - B\n      notes\n')

    expect(toOutlineTopics(parsed, { [choiceKey(' caching', 'B')]: 'OVERWRITE' })).toEqual([
      {
        title: 'Caching',
        subtopics: [
          { title: 'A', notes: null, onConflict: 'SKIP' },
          { title: 'B', notes: 'notes', onConflict: 'OVERWRITE' },
        ],
      },
    ])
  })
})

describe('lineForField', () => {
  const parsed = parseOutline('# SD\nCaching\n  - A\n  - B\nQueues\n')

  it.each([
    ['topics[0].subtopics[1].title', 4],
    ['topics[1].title', 5],
    ['topics[0].subtopics[9].title', 2],
    ['title', 1],
    ['topics', null],
    ['topics[7].title', null],
  ])('places %s on line %s', (field, line) => {
    expect(lineForField(parsed, field)).toBe(line)
  })
})
