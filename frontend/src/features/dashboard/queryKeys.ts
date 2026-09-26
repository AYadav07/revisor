import type { DueParams } from '@/api'

/**
 * TanStack Query keys for everything the dashboard shows (due list, progress, summary). One root
 * so any change that can move a dashboard number — learning, reviewing, adding or deleting
 * subtopics — refreshes them all with a single invalidation.
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  progress: () => [...dashboardKeys.all, 'progress'] as const,
  dues: () => [...dashboardKeys.all, 'due'] as const,
  due: (params: DueParams) => [...dashboardKeys.dues(), params] as const,
}
