/**
 * TanStack Query keys for everything the dashboard shows (due list, progress, summary). One root
 * so any change that can move a dashboard number — learning, reviewing, adding or deleting
 * subtopics — refreshes them all with a single invalidation.
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
}
