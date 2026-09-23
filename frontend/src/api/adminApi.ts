import { apiFetch } from './client'
import type { AdminUser, AdminUsersParams, PageParams, PageResponse, UserCourseProgress } from './types'

/** ADMIN role only — a plain user gets 403 from every one of these. */
export const adminApi = {
  listUsers: (params: AdminUsersParams = {}) =>
    apiFetch<PageResponse<AdminUser>>('/admin/users', { query: { ...params } }),

  /** Disabling also logs the user out everywhere. 409 if an admin tries to disable themselves. */
  setUserEnabled: (id: number, enabled: boolean) =>
    apiFetch<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: { enabled } }),

  /** 409 unless the user is already disabled (or is the caller). Permanently removes all their data. */
  deleteUser: (id: number) => apiFetch<void>(`/admin/users/${id}`, { method: 'DELETE' }),

  /** Read-only view of another user's courses with progress. */
  listUserCourses: (id: number, params: PageParams = {}) =>
    apiFetch<PageResponse<UserCourseProgress>>(`/admin/users/${id}/courses`, { query: { ...params } }),
}
