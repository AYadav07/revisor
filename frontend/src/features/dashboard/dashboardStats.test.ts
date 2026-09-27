import { describe, expect, it } from 'vitest'
import type { DueItem } from '@/api'
import { forecastDays, groupByCourse, percentLearned } from './dashboardStats'

const item = (subtopicId: number, courseId: number): DueItem => ({
  subtopicId,
  subtopicTitle: `S${subtopicId}`,
  topicId: 1,
  topicTitle: 'T',
  courseId,
  courseTitle: `Course ${courseId}`,
  nextReviewDate: '2026-09-26',
  daysOverdue: 0,
})

describe('percentLearned', () => {
  it.each([
    [0, 0, 0],
    [0, 10, 0],
    [1, 3, 33],
    [2, 3, 67],
    [5, 10, 50],
    [10, 10, 100],
  ])('%i of %i → %i%%', (learned, total, expected) => {
    expect(percentLearned(learned, total)).toBe(expected)
  })

  it('is 0, not NaN, for a course with no subtopics', () => {
    expect(percentLearned(0, 0)).toBe(0)
  })
})

describe('groupByCourse', () => {
  it('is empty for no items', () => {
    expect(groupByCourse([])).toEqual([])
  })

  it('groups by course, keeping the order courses first appear and the order within each', () => {
    const groups = groupByCourse([item(1, 20), item(2, 10), item(3, 20), item(4, 10), item(5, 30)])

    expect(groups.map((g) => [g.courseId, g.courseTitle, g.items.map((i) => i.subtopicId)])).toEqual([
      [20, 'Course 20', [1, 3]],
      [10, 'Course 10', [2, 4]],
      [30, 'Course 30', [5]],
    ])
  })

  it('does not modify its input', () => {
    const items = [item(1, 1), item(2, 1)]
    groupByCourse(items)
    expect(items).toHaveLength(2)
  })
})

describe('forecastDays', () => {
  const due = (subtopicId: number, nextReviewDate: string): DueItem => ({ ...item(subtopicId, 1), nextReviewDate })

  it('gives today and the next six days, across a month boundary', () => {
    expect(forecastDays([], '2026-09-28').map((day) => day.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })

  it('counts each day, putting overdue items on today', () => {
    const days = forecastDays(
      [due(1, '2026-09-20'), due(2, '2026-09-25'), due(3, '2026-09-26'), due(4, '2026-09-28'), due(5, '2026-09-28')],
      '2026-09-26',
    )

    expect(days[0]).toEqual({ date: '2026-09-26', count: 3, overdue: 2 })
    expect(days[2]).toEqual({ date: '2026-09-28', count: 2, overdue: 0 })
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(5)
  })

  it('ignores anything beyond the week', () => {
    expect(forecastDays([due(1, '2026-10-30')], '2026-09-26').every((day) => day.count === 0)).toBe(true)
  })
})
