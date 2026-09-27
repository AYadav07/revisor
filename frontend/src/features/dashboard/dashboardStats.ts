import type { DueItem } from '@/api'
import { addDaysIso } from '@/lib/date'

/** Whole-number percentage learned; 0 for a course with nothing in it yet (not NaN). */
export function percentLearned(learned: number, total: number): number {
  return total === 0 ? 0 : Math.round((learned / total) * 100)
}

export interface CourseGroup {
  courseId: number
  courseTitle: string
  items: DueItem[]
}

/** Groups due items by course, in the order each course first appears — so the oldest-due course leads. */
export function groupByCourse(items: readonly DueItem[]): CourseGroup[] {
  const groups = new Map<number, CourseGroup>()
  for (const item of items) {
    const group = groups.get(item.courseId)
    if (group) group.items.push(item)
    else groups.set(item.courseId, { courseId: item.courseId, courseTitle: item.courseTitle, items: [item] })
  }
  return [...groups.values()]
}

export interface ForecastDay {
  /** ISO date. */
  date: string
  /** Reviews scheduled that day; today's also includes everything overdue. */
  count: number
  /** How many of today's are overdue — 0 on every other day. */
  overdue: number
}

/** Days in the dashboard's "Coming up" chart: today and the six after it, like `range=week`. */
export const FORECAST_DAYS = 7

/**
 * Buckets the week's due items (`GET /dashboard/due?range=week`) by day, for the review forecast.
 * Overdue items land on today — that's when they're next reviewable. Anything past the window
 * (there shouldn't be) is ignored.
 */
export function forecastDays(items: readonly DueItem[], today: string): ForecastDay[] {
  const days: ForecastDay[] = Array.from({ length: FORECAST_DAYS }, (_, offset) => ({
    date: addDaysIso(today, offset),
    count: 0,
    overdue: 0,
  }))
  for (const item of items) {
    if (item.nextReviewDate < today) {
      days[0].count++
      days[0].overdue++
      continue
    }
    const day = days.find((candidate) => candidate.date === item.nextReviewDate)
    if (day) day.count++
  }
  return days
}
