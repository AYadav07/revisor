import type { DueItem } from '@/api'

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
