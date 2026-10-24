import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { courseApi, type CourseImportRequest, type OutlineRequest } from '@/api'
import { dashboardKeys } from '@/features/dashboard/queryKeys'
import { courseKeys } from './queryKeys'

/** Creates a course with its whole tree from an outline. */
export function useImportCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CourseImportRequest) => courseApi.importCourse(request),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  })
}

/** Adds an outline to a course. Notes may be overwritten, so cached subtopics go stale too. */
export function useApplyOutline(courseId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: OutlineRequest) => courseApi.applyOutline(courseId, request),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) }),
        queryClient.invalidateQueries({ queryKey: courseKeys.subtopics() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  })
}

/**
 * Asks the browser to confirm closing or reloading the tab while `unsaved` is true. In-app
 * navigation isn't covered: blocking it needs a data router, which the app doesn't use.
 */
export function useUnsavedChangesWarning(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])
}
