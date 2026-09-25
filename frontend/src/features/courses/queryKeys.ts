import type { PageParams } from '@/api'

/**
 * TanStack Query keys for course data, built hierarchically so a mutation can invalidate exactly
 * what it affects: `lists()` matches every page of the course list, `detail(id)` one course tree.
 */
export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (params: PageParams) => [...courseKeys.lists(), params] as const,
  details: () => [...courseKeys.all, 'detail'] as const,
  detail: (id: number) => [...courseKeys.details(), id] as const,
}
