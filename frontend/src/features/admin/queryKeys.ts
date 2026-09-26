import type { AdminUsersParams, PageParams } from '@/api'

/** TanStack Query keys for the admin area. Lists are hierarchical so one invalidation covers every page and search. */
export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userList: (params: AdminUsersParams) => [...adminKeys.users(), 'list', params] as const,
  userCourses: (userId: number, params: PageParams) => [...adminKeys.users(), userId, 'courses', params] as const,
}
