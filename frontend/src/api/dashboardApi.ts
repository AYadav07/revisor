import { apiFetch } from './client'
import type { CourseProgress, DashboardSummary, DueItem, DueParams, PageResponse } from './types'

/** All of these compute "today" in the user's own timezone, server-side. */
export const dashboardApi = {
  /** Due and overdue subtopics, oldest first. `range` defaults to today on the server. */
  due: (params: DueParams = {}) =>
    apiFetch<PageResponse<DueItem>>('/dashboard/due', { query: { ...params } }),

  /** One entry per course — a plain array, not paginated. */
  progress: () => apiFetch<CourseProgress[]>('/dashboard/progress'),

  /** The stat tiles: due today, overdue, total learned. */
  summary: () => apiFetch<DashboardSummary>('/dashboard/summary'),
}
