import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courseApi, type CourseRequest } from '@/api'
import { courseKeys } from './queryKeys'

/** Courses per page on the list screen: three columns of four rows. Well under the backend's cap of 100. */
export const COURSES_PAGE_SIZE = 12

/** One page of the user's courses. `page` is zero-based, as in the API. */
export function useCourses(page: number) {
  const params = { page, size: COURSES_PAGE_SIZE }
  return useQuery({
    queryKey: courseKeys.list(params),
    queryFn: () => courseApi.listCourses(params),
    // Keep showing the previous page while the next loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  })
}

export function useCreateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CourseRequest) => courseApi.createCourse(request),
    // A new course changes `totalElements` and possibly which courses fall on which page, so every
    // cached page of the list is stale, not just the visible one.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKeys.lists() }),
  })
}

/** Editing a course changes its title in the list as well as on its own page. */
export function useUpdateCourse(courseId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CourseRequest) => courseApi.updateCourse(courseId, request),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) }),
        queryClient.invalidateQueries({ queryKey: courseKeys.lists() }),
      ]),
  })
}

/**
 * Deletes a course. Only the list is refreshed here: the course's own tree must not be refetched
 * (it would 404 while the page is still showing), so the caller drops it from the cache after
 * navigating away.
 */
export function useDeleteCourse(courseId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => courseApi.deleteCourse(courseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKeys.lists() }),
  })
}
