import { describe, expect, it } from 'vitest'
import type { CourseTree, SubtopicTreeNode, TopicTreeNode } from '@/api'
import { courseProgress, nextTopicOrderIndex, parseCourseId, topicProgress } from './courseTree'

const sub = (id: number, learned: boolean): SubtopicTreeNode => ({
  id,
  title: `S${id}`,
  notes: null,
  learned,
  nextReviewDate: learned ? '2026-10-01' : null,
})
const topic = (id: number, orderIndex: number, subtopics: SubtopicTreeNode[] = []): TopicTreeNode => ({
  id,
  title: `T${id}`,
  orderIndex,
  subtopics,
})

describe('parseCourseId', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('accepts %s', (param, expected) => {
    expect(parseCourseId(param)).toBe(expected)
  })

  it.each([undefined, '', 'abc', '0', '-3', '1.5', '007', ' 1', '1 ', '1e3', '9007199254740993'])(
    'rejects %j',
    (param) => {
      expect(parseCourseId(param)).toBeNull()
    },
  )
})

describe('progress', () => {
  it('counts learned subtopics in a topic', () => {
    expect(topicProgress(topic(1, 0, [sub(1, true), sub(2, false), sub(3, true)]))).toEqual({ learned: 2, total: 3 })
    expect(topicProgress(topic(1, 0))).toEqual({ learned: 0, total: 0 })
  })

  it('sums across every topic of a course', () => {
    const tree: CourseTree = {
      id: 1,
      title: 'C',
      description: null,
      topics: [topic(1, 0, [sub(1, true), sub(2, false)]), topic(2, 1), topic(3, 2, [sub(3, true)])],
    }
    expect(courseProgress(tree)).toEqual({ learned: 2, total: 3 })
    expect(courseProgress({ ...tree, topics: [] })).toEqual({ learned: 0, total: 0 })
  })
})

describe('nextTopicOrderIndex', () => {
  it('starts at 0 for a course with no topics', () => {
    expect(nextTopicOrderIndex([])).toBe(0)
  })

  it('goes after the highest index, not the count, so a gap left by a delete cannot cause a clash', () => {
    expect(nextTopicOrderIndex([topic(1, 0), topic(2, 1), topic(3, 2)])).toBe(3)
    expect(nextTopicOrderIndex([topic(1, 0), topic(3, 2)])).toBe(3)
  })
})
