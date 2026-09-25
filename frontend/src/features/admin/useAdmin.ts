import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { adminKeys } from './queryKeys'

/** Users per page. */
export const ADMIN_PAGE_SIZE = 20

/**
 * One page of users, optionally filtered. Every call is written to the AdminAction audit log
 * (API.md), so this is fetched only when the admin asks — never per keystroke, never on a timer.
 */
export function useAdminUsers(q: string, page: number) {
  const params = { q: q || undefined, page, size: ADMIN_PAGE_SIZE }
  return useQuery({
    queryKey: adminKeys.userList(params),
    queryFn: () => adminApi.listUsers(params),
    placeholderData: keepPreviousData,
    // Not refetched behind the admin's back on focus or reconnect, for the audit-log reason above.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** Read-only view of one user's courses with their progress. */
export function useUserCourses(userId: number, page: number) {
  const params = { page, size: ADMIN_PAGE_SIZE }
  return useQuery({
    queryKey: adminKeys.userCourses(userId, params),
    queryFn: () => adminApi.listUserCourses(userId, params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** Disable or re-enable a user. Disabling also signs them out everywhere (API.md). */
export function useSetUserEnabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, enabled }: { userId: number; enabled: boolean }) => adminApi.setUserEnabled(userId, enabled),
    // Settled, not just success: a 404 means the row is stale and should go.
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
  })
}

/** Permanently deletes a (disabled) user and everything they own. */
export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => adminApi.deleteUser(userId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
  })
}
